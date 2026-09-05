'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { FieldApplicability } from '@/domain/enums'
import {
  CHALLENGE_REASONS,
  FIELD_APPLICABILITIES,
  FIELD_CATEGORIES,
  SOURCE_CLASSES,
  STEP_CATEGORIES,
  STEP_EDGE_KINDS,
  StepEdgeKind,
} from '@/domain/enums'
import {
  boundedOptionalText,
  LIMITS,
  optionalId,
  requiredEnum,
  requiredId,
  requiredText,
  sourceUrl,
} from '@/lib/contribution-input'
import { text } from '@/lib/form-fields'
import { currentViewer } from '@/server/auth'
import { flagDuplicate } from '@/server/lifecycle/service'
import {
  addField,
  addStepWithConnection,
  challengeField,
  confirmField,
  reviseField,
} from '@/server/revisions/service'

/**
 * The contribution loop — Phase 8. FR-14, FR-15, FR-16, FR-17, FR-18, FR-50, FR-55, FR-69.
 *
 * **Four distinct actions, and they stay distinct** (CLAUDE.md §5, §16):
 *
 *   ADD       new information that was missing
 *   UPDATE    a corrected value — appends a revision, the old value survives
 *   CONFIRM   "still true" — no revision, because nothing changed
 *   CHALLENGE "this may be wrong" — changes nothing, and says so publicly
 *
 * REPORT — "this may be dangerous" — is deliberately absent. It is a different action with
 * different consequences and belongs to Phase 9.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **There is no approval gate here, and its absence is the design.** An update goes live the
 * moment it is submitted, and the community corrects it afterwards (FR-16, FR-69, §43.1).
 * VR-08 shows "Update goes live when confirmed by the community" and "All updates are
 * reviewed"; CLAUDE.md §8.6 lists both as mockup exceptions not to build. There is no
 * `pending` state, no reviewer, no queue table and no moderator role to add one to.
 *
 * Every mutation goes through `src/server/revisions/service.ts`, which is the only door into
 * shared knowledge — the ESLint boundary, the runtime write guard and the Postgres triggers
 * all refuse anything else (Phase 3).
 *
 * Signing in is the gate, and the only one (FR-12). Reading needs no account, anywhere.
 */

async function requireContributor(locale: string, next: string): Promise<{ id: string }> {
  const viewer = await currentViewer()
  if (!viewer) redirect(`/${locale}/signin?next=${encodeURIComponent(next)}`)
  return viewer
}

/**
 * Every value below is validated server-side — audit F9.
 *
 * These actions are POST endpoints reachable without the page rendering, so `required` and a
 * `<select>` of valid options prove nothing about what arrives. The helpers in
 * `@/lib/contribution-input` refuse a malformed enum rather than substituting a default,
 * because publishing a source class or a category the contributor did not choose is a
 * quieter failure than an error but a worse one: their name is on it (FR-33, invariant 11).
 */

/** Applicability is a set, so it arrives as repeated checkbox values (FR-81). */
function applicabilities(form: FormData): FieldApplicability[] {
  return form
    .getAll('applicability')
    .filter((value): value is string => typeof value === 'string')
    .filter((value): value is FieldApplicability =>
      (FIELD_APPLICABILITIES as readonly string[]).includes(value),
    )
}

// ── ADD ──────────────────────────────────────────────────────────────────────────────────

/** FR-14: add a missing step to a route, and connect it to the road. */
export async function addStepAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}`)

  /**
   * The step and its connection are one operation — audit F7.
   *
   * This used to be `addStep` followed by `addEdge`: two transactions, so a failure between
   * them left a step in the route with no edges — a valid graph node that appears nowhere on
   * the road and that no control can reconnect. `addStepWithConnection` commits both or
   * neither, and validates inside the transaction that the predecessor belongs to this route
   * and is not archived. A step id from another route satisfies every foreign key, so that
   * check is the only thing between a form post and an edge spanning two routes.
   */
  await addStepWithConnection({
    actor: { id: viewer.id },
    routeId: requiredId(formData, 'routeId', 'The route'),
    label: requiredText(formData, 'label', { max: LIMITS.stepLabel, label: 'A step name' }),
    category: requiredEnum(formData, 'category', STEP_CATEGORIES, 'Step category'),
    connectAfterStepId: optionalId(formData, 'afterStepId', 'The step this follows'),
    // Only meaningful when a predecessor was named. Defaulting to `sequential` here is not a
    // substitution of an unreadable value: the current form has no control for edge kind at
    // all, which is audit F6 and belongs to Phase 12E's graph authoring work.
    edgeKind:
      text(formData, 'edgeKind').trim() === ''
        ? StepEdgeKind.sequential
        : requiredEnum(formData, 'edgeKind', STEP_EDGE_KINDS, 'Connection kind'),
    reason: boundedOptionalText(formData, 'reason', { max: LIMITS.note, label: 'The reason' }),
  })

  revalidatePath(`/${locale}/routes/${slug}`)
}

/** FR-15: add a missing field to a step. */
export async function addFieldAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const stepId = text(formData, 'stepId')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}?step=${stepId}`)

  await addField({
    actor: { id: viewer.id },
    stepId,
    category: requiredEnum(formData, 'category', FIELD_CATEGORIES, 'Field category'),
    valueText: requiredText(formData, 'valueText', {
      max: LIMITS.fieldValue,
      label: 'The information',
    }),
    // Source class and applicability are asked separately, because they answer different
    // questions — who asserts this, and whom does it apply to (FR-81, D-47, invariant 11).
    // The default is `community_submission`, deliberately the least authoritative class.
    // A contributor may say a fact is official; the form does not assume it, because an
    // unstated provenance quietly promoted to "official" is the failure invariant 11 and
    // FR-33 exist to prevent.
    sourceClass: requiredEnum(formData, 'sourceClass', SOURCE_CLASSES, 'Source'),
    applicability: applicabilities(formData),
    sourceUrl: sourceUrl(formData, 'sourceUrl'),
    sourceNote: boundedOptionalText(formData, 'sourceNote', {
      max: LIMITS.note,
      label: 'The source note',
    }),
    reason: boundedOptionalText(formData, 'reason', { max: LIMITS.note, label: 'The reason' }),
  })

  revalidatePath(`/${locale}/routes/${slug}`)
}

// ── UPDATE ───────────────────────────────────────────────────────────────────────────────

/**
 * FR-16, FR-69: correct a field. Appends a revision; the previous value survives.
 *
 * `basedOnRevisionId` is carried through from the form, so if somebody else revised the same
 * field while this form was open, both corrections are preserved and the field renders as
 * contested rather than one of them being silently overwritten (BR-21, invariant 15).
 */
export async function updateFieldAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const stepId = text(formData, 'stepId')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}?step=${stepId}`)

  await reviseField({
    actor: { id: viewer.id },
    fieldId: requiredId(formData, 'fieldId', 'The field'),
    basedOnRevisionId: optionalId(formData, 'basedOnRevisionId', 'The revision being corrected'),
    valueText: requiredText(formData, 'valueText', {
      max: LIMITS.fieldValue,
      label: 'The information',
    }),
    // The default is `community_submission`, deliberately the least authoritative class.
    // A contributor may say a fact is official; the form does not assume it, because an
    // unstated provenance quietly promoted to "official" is the failure invariant 11 and
    // FR-33 exist to prevent.
    sourceClass: requiredEnum(formData, 'sourceClass', SOURCE_CLASSES, 'Source'),
    applicability: applicabilities(formData),
    sourceUrl: sourceUrl(formData, 'sourceUrl'),
    sourceNote: boundedOptionalText(formData, 'sourceNote', {
      max: LIMITS.note,
      label: 'The source note',
    }),
    reason: boundedOptionalText(formData, 'reason', { max: LIMITS.note, label: 'The reason' }),
  })

  revalidatePath(`/${locale}/routes/${slug}`)
}

// ── CONFIRM ──────────────────────────────────────────────────────────────────────────────

/**
 * FR-17, FR-55: vouch that a field is still current.
 *
 * Creates no revision, because nothing changed. One row per person per field, so a
 * confirmation count stays a count of people (invariant 14).
 */
export async function confirmFieldAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const stepId = text(formData, 'stepId')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}?step=${stepId}`)

  await confirmField({
    actor: { id: viewer.id },
    fieldId: requiredId(formData, 'fieldId', 'The field'),
  })
  revalidatePath(`/${locale}/routes/${slug}`)
}

// ── CHALLENGE ────────────────────────────────────────────────────────────────────────────

/**
 * FR-18: say that a field may be wrong, with a reason.
 *
 * Changes nothing about the value. The field keeps its content and its source class, and
 * renders with an open challenge against it until a revision answers it (FR-49, FR-70). The
 * note is optional — a required essay is how a concern goes unraised (FR-50).
 */
export async function challengeFieldAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const stepId = text(formData, 'stepId')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}?step=${stepId}`)

  await challengeField({
    actor: { id: viewer.id },
    fieldId: requiredId(formData, 'fieldId', 'The field'),
    reason: requiredEnum(formData, 'reason', CHALLENGE_REASONS, 'Challenge reason'),
    note: boundedOptionalText(formData, 'note', { max: LIMITS.note, label: 'The note' }),
  })

  revalidatePath(`/${locale}/routes/${slug}`)
}

/** §40.4 — any signed-in contributor may say two routes look like the same journey. */
export async function flagDuplicateAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}`)

  const duplicateOfId = optionalId(formData, 'duplicateOfId', 'The route it duplicates')
  if (duplicateOfId === null) return

  await flagDuplicate({
    flaggedById: viewer.id,
    routeId: requiredId(formData, 'routeId', 'The route'),
    duplicateOfId,
    note: boundedOptionalText(formData, 'duplicateNote', { max: LIMITS.note, label: 'The note' }),
  })

  revalidatePath(`/${locale}/routes/${slug}`)
}
