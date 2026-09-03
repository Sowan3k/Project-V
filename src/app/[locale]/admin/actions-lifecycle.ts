'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { RouteLifecycleState } from '@/domain/enums'
import { ROUTE_LIFECYCLE_STATES, RouteLifecycleState as Lifecycle } from '@/domain/enums'
import { optionalText, text } from '@/lib/form-fields'
import { currentViewer } from '@/server/auth'
import {
  flagDuplicate,
  mergeRoutes,
  requireAdministrator,
  resolveDuplicateFlag,
  reviewAllRoutes,
  setLifecycleState,
  unmergeRoute,
} from '@/server/lifecycle/service'

/**
 * Lifecycle, duplicate and merge actions — Phase 11. FR-40, FR-46, FR-58, §19.2, §40.4.
 *
 * Every field is read through `@/lib/form-fields`, which throws on a file: Next encodes every
 * server-action form as `multipart/form-data` whatever the page renders, so the refusal has to
 * live at this boundary (FR-25, BR-06, §24.1, invariants 6 and 7).
 *
 * **Authorisation is not here.** Each of these calls a service function that checks the
 * administrator role itself, so a missing check in an action cannot open a hole — the same
 * arrangement Phase 9 used for the safety actions. A hidden button is not a permission
 * (CLAUDE.md §9).
 */

async function requireSignedIn(locale: string, next: string): Promise<{ id: string }> {
  const viewer = await currentViewer()
  if (!viewer) redirect(`/${locale}/signin?next=${encodeURIComponent(next)}`)
  return viewer
}

function oneOf<T extends string>(values: readonly T[], raw: string, fallback: T): T {
  return (values as readonly string[]).includes(raw) ? (raw as T) : fallback
}

/** §40.4 — any signed-in contributor may say two routes look like the same journey. */
export async function flagDuplicateAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const viewer = await requireSignedIn(locale, `/${locale}/routes/${slug}`)

  const duplicateOfId = text(formData, 'duplicateOfId')
  if (duplicateOfId === '') return

  await flagDuplicate({
    reporterId: viewer.id,
    routeId: text(formData, 'routeId'),
    duplicateOfId,
    note: optionalText(formData, 'duplicateNote'),
  })

  revalidatePath(`/${locale}/routes/${slug}`)
}

/** FR-46 — the administrator sets a route's standing, with a reason kept beside it. */
export async function setLifecycleStateAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const viewer = await requireSignedIn(locale, `/${locale}/admin/routes`)

  await setLifecycleState({
    adminId: viewer.id,
    routeId: text(formData, 'routeId'),
    state: oneOf<RouteLifecycleState>(
      ROUTE_LIFECYCLE_STATES,
      text(formData, 'lifecycleState'),
      Lifecycle.experimental,
    ),
    note: optionalText(formData, 'stateNote'),
  })

  revalidatePath(`/${locale}/admin/routes`)
}

/** FR-40, FR-58, §40.4 — declare one route the surviving version of another. */
export async function mergeRoutesAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const viewer = await requireSignedIn(locale, `/${locale}/admin/routes`)

  const canonicalRouteId = text(formData, 'canonicalRouteId')
  if (canonicalRouteId === '') return

  await mergeRoutes({
    adminId: viewer.id,
    duplicateRouteId: text(formData, 'duplicateRouteId'),
    canonicalRouteId,
    note: optionalText(formData, 'mergeNote'),
  })

  revalidatePath(`/${locale}/admin/routes`)
}

/** A merge is a judgement, and §40.1 protects the routes where the answer is "different". */
export async function unmergeRouteAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const viewer = await requireSignedIn(locale, `/${locale}/admin/routes`)

  await unmergeRoute({
    adminId: viewer.id,
    routeId: text(formData, 'routeId'),
    note: optionalText(formData, 'mergeNote'),
  })

  revalidatePath(`/${locale}/admin/routes`)
}

/** Close a duplicate flag — merged, or judged genuinely different. Both are real answers. */
export async function resolveDuplicateFlagAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const viewer = await requireSignedIn(locale, `/${locale}/admin/routes`)

  await resolveDuplicateFlag({
    adminId: viewer.id,
    flagId: text(formData, 'flagId'),
    note: optionalText(formData, 'resolutionNote'),
  })

  revalidatePath(`/${locale}/admin/routes`)
}

/**
 * §19.2's periodic review, run on demand.
 *
 * Deliberately a button rather than a schedule. A cron that silently reclassifies routes is a
 * thing nobody watches; a person pressing this sees exactly what moved and why, which is what
 * §19.2 describes ("The administrator may periodically perform an annual review").
 *
 * It applies only what each route's own record proposes, so it can never promote a route and
 * can never archive one — those need a person, and this is not one (invariant 14).
 */
export async function runPeriodicReviewAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const viewer = await requireSignedIn(locale, `/${locale}/admin/routes`)

  // The review can only apply what each route's own record already proposes, so it grants
  // nothing. The check is here so the button is not a way for anyone to trigger background
  // work, and it reuses the service's own check rather than reading `role` a second time.
  await requireAdministrator(viewer.id)

  await reviewAllRoutes()
  revalidatePath(`/${locale}/admin/routes`)
}
