'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type {
  ChallengeReason,
  FieldApplicability,
  FieldCategory,
  SourceClass,
  StepCategory,
  StepEdgeKind as StepEdgeKindT,
} from '@/domain/enums'
import {
  CHALLENGE_REASONS,
  ChallengeReason as Reason,
  FIELD_APPLICABILITIES,
  FIELD_CATEGORIES,
  FieldCategory as Category,
  SOURCE_CLASSES,
  SourceClass as Source,
  STEP_CATEGORIES,
  StepCategory as Stage,
  StepEdgeKind,
} from '@/domain/enums'
import { optionalText, text } from '@/lib/form-fields'
import { currentViewer } from '@/server/auth'
import {
  addEdge,
  addField,
  addStep,
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

function oneOf<T extends string>(values: readonly T[], raw: string, fallback: T): T {
  return (values as readonly string[]).includes(raw) ? (raw as T) : fallback
}

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

  const { stepId } = await addStep({
    actor: { id: viewer.id },
    routeId: text(formData, 'routeId'),
    label: text(formData, 'label').trim(),
    category: oneOf<StepCategory>(
      STEP_CATEGORIES,
      text(formData, 'category'),
      Stage.documents_preparation,
    ),
    reason: optionalText(formData, 'reason'),
  })

  // Connect it after an existing step when one is named. A step with no edges is a valid
  // graph node but an invisible one, so the form offers the connection in the same breath.
  const afterStepId = text(formData, 'afterStepId')
  if (afterStepId !== '') {
    await addEdge({
      actor: { id: viewer.id },
      routeId: text(formData, 'routeId'),
      fromStepId: afterStepId,
      toStepId: stepId,
      kind: oneOf<StepEdgeKindT>(
        Object.values(StepEdgeKind),
        text(formData, 'edgeKind'),
        StepEdgeKind.sequential,
      ),
    })
  }

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
    category: oneOf<FieldCategory>(
      FIELD_CATEGORIES,
      text(formData, 'category'),
      Category.requirement,
    ),
    valueText: text(formData, 'valueText').trim(),
    // Source class and applicability are asked separately, because they answer different
    // questions — who asserts this, and whom does it apply to (FR-81, D-47, invariant 11).
    // The default is `community_submission`, deliberately the least authoritative class.
    // A contributor may say a fact is official; the form does not assume it, because an
    // unstated provenance quietly promoted to "official" is the failure invariant 11 and
    // FR-33 exist to prevent.
    sourceClass: oneOf<SourceClass>(
      SOURCE_CLASSES,
      text(formData, 'sourceClass'),
      Source.community_submission,
    ),
    applicability: applicabilities(formData),
    sourceUrl: optionalText(formData, 'sourceUrl'),
    sourceNote: optionalText(formData, 'sourceNote'),
    reason: optionalText(formData, 'reason'),
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
    fieldId: text(formData, 'fieldId'),
    basedOnRevisionId: optionalText(formData, 'basedOnRevisionId'),
    valueText: text(formData, 'valueText').trim(),
    // The default is `community_submission`, deliberately the least authoritative class.
    // A contributor may say a fact is official; the form does not assume it, because an
    // unstated provenance quietly promoted to "official" is the failure invariant 11 and
    // FR-33 exist to prevent.
    sourceClass: oneOf<SourceClass>(
      SOURCE_CLASSES,
      text(formData, 'sourceClass'),
      Source.community_submission,
    ),
    applicability: applicabilities(formData),
    sourceUrl: optionalText(formData, 'sourceUrl'),
    sourceNote: optionalText(formData, 'sourceNote'),
    reason: optionalText(formData, 'reason'),
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

  await confirmField({ actor: { id: viewer.id }, fieldId: text(formData, 'fieldId') })
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
    fieldId: text(formData, 'fieldId'),
    reason: oneOf<ChallengeReason>(CHALLENGE_REASONS, text(formData, 'reason'), Reason.other),
    note: optionalText(formData, 'note'),
  })

  revalidatePath(`/${locale}/routes/${slug}`)
}
