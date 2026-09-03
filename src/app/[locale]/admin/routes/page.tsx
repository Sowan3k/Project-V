import { notFound } from 'next/navigation'
import Link from 'next/link'

import { ContentColumn, GridRegion, PageGrid } from '@/components/layout'
import { ROUTE_LIFECYCLE_STATES } from '@/domain/enums'
import { isLocale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { getDictionary } from '@/i18n/get-dictionary'
import { currentViewer } from '@/server/auth'
import {
  openDuplicateFlags,
  routesForMaintenance,
  type MaintenanceRow,
} from '@/server/lifecycle/read'
import { NotAnAdministratorError, requireAdministrator } from '@/server/lifecycle/service'

import {
  mergeRoutesAction,
  resolveDuplicateFlagAction,
  runPeriodicReviewAction,
  setLifecycleStateAction,
  unmergeRouteAction,
} from '../actions-lifecycle'

/**
 * The administrator's periodic review — Phase 11. FR-40, FR-45, FR-46, FR-58. §19.2, §40.4.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * §19.2: "The administrator may periodically perform an annual review by destination: merge
 * duplicates, archive obsolete routes, refresh categories, remove abuse, and perform
 * feature/content housekeeping. **Normal historical information should be archived rather
 * than destroyed.**"
 *
 * Every control here follows that last sentence. Archiving is a lifecycle state, merging is a
 * pointer, and both are reversible; nothing on this page deletes a route, a step, a field, a
 * revision or a follower, and there is no control that could.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Ordered by age, never by popularity.** There is no follower column and no sort by one.
 * §19 is explicit that "a route may receive little activity simply because it is seasonal or
 * less popular", so a maintenance queue ranked by followers would quietly make popularity the
 * thing that gets looked after (invariant 14, BR-05, BR-32).
 *
 * Same access shape as the reports queue: the role is checked in the service, and anyone else
 * gets a plain not-found rather than a forbidden. There is no reason to tell somebody that an
 * administration page exists and they are not allowed in (§23.3, CLAUDE.md §9).
 */
export const dynamic = 'force-dynamic'

const INPUT =
  'mt-1 block w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900'
const LABEL = 'block text-xs text-ink-700'

export default async function AdminRoutesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const viewer = await currentViewer()
  if (!viewer) notFound()
  try {
    await requireAdministrator(viewer.id)
  } catch (error) {
    if (error instanceof NotAnAdministratorError) notFound()
    throw error
  }

  const [routes, flags] = await Promise.all([routesForMaintenance(), openDuplicateFlags()])

  return (
    <ContentColumn width="wide">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{t.admin.routesTitle}</h1>
      <ContentColumn width="reading">
        <p className="mt-2 text-sm leading-6 text-ink-700">{t.admin.routesLede}</p>
        {/* The direction rule, stated where the person exercising it can read it. */}
        <p className="mt-2 text-xs leading-5 text-ink-500">{t.admin.routesDirection}</p>
      </ContentColumn>

      <form action={runPeriodicReviewAction} className="mt-4">
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="rounded-lg border border-brand-700 px-3 py-1.5 text-xs font-medium text-brand-700"
        >
          {t.admin.runReview}
        </button>
        <span className="ml-3 text-xs text-ink-500">{t.admin.runReviewHint}</span>
      </form>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">
          {t.admin.duplicatesTitle}
        </h2>
        <ContentColumn width="reading">
          <p className="mt-1 text-xs leading-5 text-ink-500">{t.admin.duplicatesOldestFirst}</p>
        </ContentColumn>

        {flags.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700">{t.admin.duplicatesEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {flags.map((flag) => (
              <li key={flag.id} className="rounded-xl border border-hairline bg-surface p-4">
                <p className="text-sm text-ink-900">
                  <Link
                    href={`/${locale}/routes/${flag.routeSlug}`}
                    className="text-brand-700 underline"
                  >
                    {flag.routeTitle}
                  </Link>{' '}
                  <span className="text-ink-500">↔</span>{' '}
                  <Link
                    href={`/${locale}/routes/${flag.duplicateOfSlug}`}
                    className="text-brand-700 underline"
                  >
                    {flag.duplicateOfTitle}
                  </Link>
                </p>
                {flag.note === null ? null : (
                  <p className="mt-1 text-xs leading-5 text-ink-700">{flag.note}</p>
                )}
                <p className="mt-1 text-xs text-ink-500">
                  {flag.flaggedByHandle ?? '—'} · {flag.createdAt.toISOString().slice(0, 10)}
                </p>

                <form action={resolveDuplicateFlagAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="flagId" value={flag.id} />
                  <label className={`${LABEL} flex-1`}>
                    {t.admin.mergeNote}
                    <input type="text" name="resolutionNote" className={INPUT} />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-ink-900"
                  >
                    {t.admin.notDuplicate}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">{t.admin.setState}</h2>
        <ContentColumn width="reading">
          <p className="mt-1 text-xs leading-5 text-ink-500">{t.admin.mergeExplainer}</p>
        </ContentColumn>

        <ul className="mt-4 space-y-4">
          {routes.map((route) => (
            <RouteMaintenanceRow
              key={route.id}
              route={route}
              routes={routes}
              locale={locale}
              dictionary={t}
            />
          ))}
        </ul>
      </section>
    </ContentColumn>
  )
}

function RouteMaintenanceRow({
  route,
  routes,
  locale,
  dictionary: t,
}: {
  route: MaintenanceRow
  routes: readonly MaintenanceRow[]
  locale: string
  dictionary: Dictionary
}) {
  return (
    <li className="rounded-xl border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link
          href={`/${locale}/routes/${route.slug}`}
          className="text-sm font-medium text-brand-700 underline"
        >
          {route.title}
        </Link>
        <span className="text-xs text-ink-500">
          {t.routeLifecycle[route.lifecycleState]} · {route.createdAt.toISOString().slice(0, 10)}
        </span>
      </div>

      {route.mergedIntoSlug === null ? null : (
        <p className="mt-1 text-xs text-ink-700">
          → {route.mergedIntoSlug}
        </p>
      )}

      <PageGrid className="mt-3">
        <GridRegion span={6}>
          <form action={setLifecycleStateAction} className="grid gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="routeId" value={route.id} />
            <label className={LABEL}>
              {t.admin.setState}
              <select name="lifecycleState" defaultValue={route.lifecycleState} className={INPUT}>
                {ROUTE_LIFECYCLE_STATES.map((state) => (
                  <option key={state} value={state}>
                    {t.routeLifecycle[state]}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              {t.admin.stateNote}
              <input type="text" name="stateNote" className={INPUT} />
            </label>
            <button
              type="submit"
              className="justify-self-start rounded-lg border border-brand-700 px-3 py-1.5 text-xs font-medium text-brand-700"
            >
              {t.admin.setState}
            </button>
          </form>
        </GridRegion>

        <GridRegion span={6}>
          {route.mergedIntoSlug === null ? (
            <form action={mergeRoutesAction} className="grid gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="duplicateRouteId" value={route.id} />
              <label className={LABEL}>
                {t.admin.mergeInto}
                <select name="canonicalRouteId" className={INPUT}>
                  <option value="">—</option>
                  {routes
                    .filter((other) => other.id !== route.id)
                    .map((other) => (
                      <option key={other.id} value={other.id}>
                        {other.title}
                      </option>
                    ))}
                </select>
              </label>
              <label className={LABEL}>
                {t.admin.mergeNote}
                <input type="text" name="mergeNote" className={INPUT} />
              </label>
              <button
                type="submit"
                className="justify-self-start rounded-lg border border-hairline px-3 py-1.5 text-xs text-ink-900"
              >
                {t.admin.mergeSubmit}
              </button>
            </form>
          ) : (
            <form action={unmergeRouteAction} className="grid gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="routeId" value={route.id} />
              <button type="submit" className="justify-self-start text-xs text-brand-700 underline">
                {t.admin.unmergeSubmit}
              </button>
            </form>
          )}
        </GridRegion>
      </PageGrid>
    </li>
  )
}
