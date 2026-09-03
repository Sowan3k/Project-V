'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { ChangeSeverity, FollowerChangeStance, RouteChangeKind } from '@/domain/enums'
import {
  CHANGE_SEVERITIES,
  ChangeSeverity as Severity,
  FOLLOWER_CHANGE_STANCES,
  FollowerChangeStance as Stance,
  ROUTE_CHANGE_KINDS,
  RouteChangeKind as Kind,
} from '@/domain/enums'
import { optionalDate, optionalText, text } from '@/lib/form-fields'
import { currentViewer } from '@/server/auth'
import { announceChange, recordDisruption, resolveDisruption } from '@/server/changes/service'
import { clearChangeStance, setChangeStance } from '@/server/journeys/changes'

/**
 * Recording changes and disruptions — Phase 10. FR-32, FR-59, FR-60, FR-63. §41.
 *
 * **Every field is read through `@/lib/form-fields`, which throws on a file.** Next.js encodes
 * every server-action form as `multipart/form-data` regardless of what the page renders, so
 * "there is no upload path" can only be enforced at this boundary, never inferred from markup
 * (FR-25, BR-06, §24.1, invariants 6 and 7).
 *
 * **No approval gate.** Any signed-in contributor may record either kind of entry and it is
 * live immediately (FR-16, FR-44, BR-01, invariant 3, §43.1). VR-08's "update goes live when
 * confirmed by the community" is listed in CLAUDE.md §8.6 as something not to build, and the
 * reasoning applies twice over here: a student who learns on Tuesday that the test centre is
 * shut is useful on Tuesday and useless the following week.
 */

async function requireContributor(locale: string, next: string): Promise<{ id: string }> {
  const viewer = await currentViewer()
  if (!viewer) redirect(`/${locale}/signin?next=${encodeURIComponent(next)}`)
  return viewer
}

function oneOf<T extends string>(values: readonly T[], raw: string, fallback: T): T {
  return (values as readonly string[]).includes(raw) ? (raw as T) : fallback
}

/**
 * FR-59, FR-60 — announce that the public route changed.
 *
 * Severity comes from the form because §41.2 defines it by consequence to the follower, which
 * is a judgement no diff contains. The fallback is `informational`: where a submission is
 * malformed the quiet answer is the safe one, because over-claiming severity trains readers
 * to ignore the level that matters.
 */
export async function announceChangeAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}/changes`)

  await announceChange({
    authorId: viewer.id,
    routeId: text(formData, 'routeId'),
    kind: oneOf<RouteChangeKind>(
      ROUTE_CHANGE_KINDS,
      text(formData, 'changeKind'),
      Kind.field_correction,
    ),
    severity: oneOf<ChangeSeverity>(
      CHANGE_SEVERITIES,
      text(formData, 'changeSeverity'),
      Severity.informational,
    ),
    title: text(formData, 'changeTitle').trim(),
    detail: optionalText(formData, 'changeDetail'),
    // `undefined` from the helper means "not submitted"; both that and an empty field mean
    // no effective date is known, which §41.1 treats as a legitimate answer.
    effectiveAt: optionalDate(formData, 'effectiveAt') ?? null,
    stepId: optionalText(formData, 'changeStepId'),
  })

  revalidatePath(`/${locale}/routes/${slug}/changes`)
}

/**
 * FR-32, FR-63, BR-27 — record a temporary disruption.
 *
 * Deliberately a different action from `announceChangeAction`, with different fields, rather
 * than one form with a "temporary?" checkbox. The two are different things and the interface
 * should not let somebody file a fortnight's flooding as a permanent change to Germany's visa
 * rules by ticking the wrong box (invariant 19).
 */
export async function recordDisruptionAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}/changes`)

  const startsAt = optionalDate(formData, 'startsAt') ?? new Date()

  await recordDisruption({
    authorId: viewer.id,
    routeId: text(formData, 'routeId'),
    severity: oneOf<ChangeSeverity>(
      CHANGE_SEVERITIES,
      text(formData, 'disruptionSeverity'),
      Severity.relevant,
    ),
    title: text(formData, 'disruptionTitle').trim(),
    detail: optionalText(formData, 'disruptionDetail'),
    startsAt,
    endsAt: optionalDate(formData, 'endsAt') ?? null,
    locationScope: optionalText(formData, 'locationScope'),
    stepId: optionalText(formData, 'disruptionStepId'),
  })

  revalidatePath(`/${locale}/routes/${slug}/changes`)
}

/** BR-08 — it finished early. Sets `resolvedAt`; the announced window stays readable. */
export async function resolveDisruptionAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}/changes`)

  await resolveDisruption({
    authorId: viewer.id,
    disruptionId: text(formData, 'disruptionId'),
    note: optionalText(formData, 'resolvedNote'),
  })

  revalidatePath(`/${locale}/routes/${slug}/changes`)
}

/**
 * §13.3 — the follower says what a change means for their own case.
 *
 * Private. It writes a note on their own journey and touches nothing public and nothing on
 * anybody else's. Notably it does **not** write step progress: "this change does not apply to
 * me" and "this step does not apply to me" are different statements, and letting a change
 * quietly rewrite progress is exactly what invariant 8 forbids.
 */
export async function setChangeStanceAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}/changes`)

  await setChangeStance({
    userId: viewer.id,
    routeId: text(formData, 'routeId'),
    changeId: text(formData, 'changeId'),
    stance: oneOf<FollowerChangeStance>(
      FOLLOWER_CHANGE_STANCES,
      text(formData, 'stance'),
      Stance.applies,
    ),
  })

  revalidatePath(`/${locale}/routes/${slug}/changes`)
}

/** And withdraw it. An answer they can retract is an answer they can give honestly. */
export async function clearChangeStanceAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const viewer = await requireContributor(locale, `/${locale}/routes/${slug}/changes`)

  await clearChangeStance({
    userId: viewer.id,
    routeId: text(formData, 'routeId'),
    changeId: text(formData, 'changeId'),
  })

  revalidatePath(`/${locale}/routes/${slug}/changes`)
}
