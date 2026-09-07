import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

import { ContentColumn, PageCanvas } from '@/components/layout'
import { ROUTE_LIFECYCLE_STATES } from '@/domain/enums'
import { mergeCompatibility } from '@/domain/merge'
import { isLocale } from '@/i18n/config'
import {
  buttonClass,
  Chip,
  ContributorLink,
  EmptyState,
  FormField,
  inputClass,
  Panel,
  PanelHeader,
  TabNav,
} from '@/components/ui'
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
/**
 * Never indexed, and never crawled.
 *
 * The page already answers 404 to anyone who is not an administrator, so this is not what
 * keeps it private — but an indexed moderation URL advertises that the surface exists and
 * invites people to try it. `robots.ts` disallows the path; this keeps it out of the index
 * even if it is linked from somewhere.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const INPUT = inputClass('compact')

export default async function AdminRoutesPage({ params }: { params: Promise<{ locale: string }> }) {
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
    <PageCanvas className="py-8">
      <ContentColumn width="wide">
        <h1 className="text-title font-semibold tracking-tight text-ink-900">
          {t.admin.routesTitle}
        </h1>
        {/* The other queue, named — see `TabNav`. `/admin/routes` was reachable only by typing
          its URL until Phase 12M. */}
        <TabNav
          label={t.admin.tabsLabel}
          tabs={[
            {
              href: `/${locale}/admin/reports`,
              label: t.admin.title,
              current: false,
            },
            {
              href: `/${locale}/admin/routes`,
              label: t.admin.routesTitle,
              current: true,
            },
          ]}
        />
        <ContentColumn width="reading">
          <p className="mt-2 text-sm leading-6 text-ink-700">{t.admin.routesLede}</p>
          {/* The direction rule, stated where the person exercising it can read it. */}
          <p className="mt-2 text-xs leading-5 text-ink-500">{t.admin.routesDirection}</p>
        </ContentColumn>

        {/*
          The periodic review, as its own object — Phase 12E.

          It had been a small outlined button with a sentence trailing after it on the same
          line, which is how the one control on this page that touches every route at once
          read as an afterthought. What it will and will not do is the important half, so it
          gets the width to say it (FR-46, §19.2).
        */}
        <Panel as="section" tone="sunken" className="mt-6">
          <PanelHeader title={t.admin.runReview} />
          <ContentColumn width="reading">
            <p className="mt-1 text-meta leading-5 text-ink-700">{t.admin.runReviewHint}</p>
          </ContentColumn>
          <form action={runPeriodicReviewAction} className="mt-3">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={buttonClass('secondary', { size: 'compact' })}>
              {t.admin.runReview}
            </button>
          </form>
        </Panel>

        <section className="mt-10">
          <h2 className="text-section font-semibold tracking-tight text-ink-900">
            {t.admin.duplicatesTitle}
          </h2>
          <ContentColumn width="reading">
            <p className="mt-1 text-xs leading-5 text-ink-500">{t.admin.duplicatesOldestFirst}</p>
          </ContentColumn>

          {flags.length === 0 ? (
            <p className="mt-3 text-sm text-ink-700">{t.admin.duplicatesEmpty}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {flags.map((flag) => (
                <Panel as="li" key={flag.id}>
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
                    <p className="mt-1 text-meta leading-5 text-ink-700">{flag.note}</p>
                  )}
                  <p className="mt-1 text-meta text-ink-500">
                    <ContributorLink handle={flag.flaggedByHandle} locale={locale} /> ·{' '}
                    {flag.createdAt.toISOString().slice(0, 10)}
                  </p>

                  <form
                    action={resolveDuplicateFlagAction}
                    className="mt-3 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="flagId" value={flag.id} />
                    <FormField className="flex-1" label={t.admin.mergeNote} size="compact">
                      <input type="text" name="resolutionNote" className={INPUT} />
                    </FormField>
                    <button type="submit" className={buttonClass('secondary', { size: 'compact' })}>
                      {t.admin.notDuplicate}
                    </button>
                  </form>
                </Panel>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-section font-semibold tracking-tight text-ink-900">
            {t.admin.setState}
          </h2>
          <ContentColumn width="reading">
            <p className="mt-1 text-xs leading-5 text-ink-500">{t.admin.mergeExplainer}</p>
          </ContentColumn>

          {routes.length === 0 ? (
            <EmptyState title={t.admin.routesEmpty} body={t.admin.routesEmptyNote} />
          ) : (
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
          )}
        </section>
      </ContentColumn>
    </PageCanvas>
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
  /**
   * Routes this one could genuinely be a duplicate of — audit F5.
   *
   * Same origin, destination and study level: the route's search identity (FR-01, §9). A
   * differing mechanism or intake does not disqualify a candidate but is named beside it, so
   * the administrator weighs it rather than discovering it afterwards.
   */
  const candidates = routes
    .filter((other) => other.id !== route.id)
    .map((other) => ({ other, ...mergeCompatibility(route, other) }))
    .filter((candidate) => candidate.compatible)

  return (
    <Panel as="li">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <Link
          href={`/${locale}/routes/${route.slug}`}
          className="text-panel font-medium text-brand-700 underline"
        >
          {route.title}
        </Link>
        <span className="flex flex-wrap items-center gap-2 text-meta text-ink-500">
          {/*
            Standing as a chip, and deliberately the *neutral* chip whatever the state —
            CLAUDE.md §11 closed the maturity palette decision by deciding there is none, and
            an administration screen is not an exception to it. The word carries the state.
          */}
          <Chip>{t.routeLifecycle[route.lifecycleState]}</Chip>
          {route.createdAt.toISOString().slice(0, 10)}
        </span>
      </div>

      {route.mergedIntoSlug === null ? null : (
        <p className="mt-1 text-meta text-ink-700">→ {route.mergedIntoSlug}</p>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <form action={setLifecycleStateAction} className="grid gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="routeId" value={route.id} />
            <FormField label={t.admin.setState} size="compact">
              <select name="lifecycleState" defaultValue={route.lifecycleState} className={INPUT}>
                {ROUTE_LIFECYCLE_STATES.map((state) => (
                  <option key={state} value={state}>
                    {t.routeLifecycle[state]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={t.admin.stateNote} size="compact">
              <input type="text" name="stateNote" className={INPUT} />
            </FormField>
            <button
              type="submit"
              className={buttonClass('secondary', {
                size: 'compact',
                className: 'justify-self-start',
              })}
            >
              {t.admin.setState}
            </button>
          </form>
        </div>

        <div>
          {route.mergedIntoSlug === null ? (
            <form action={mergeRoutesAction} className="grid gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="duplicateRouteId" value={route.id} />
              <FormField
                label={t.admin.mergeInto}
                hint={
                  candidates.length === 0 ? t.admin.mergeNoCandidates : t.admin.mergeCandidatesHint
                }
                size="compact"
              >
                {/*
                  Only routes describing the same journey — audit F5.

                  This used to offer every other route, so declaring a Bangladesh→Germany
                  Master's route superseded by a Bangladesh→Malaysia one was two clicks. The
                  filter is a convenience, not the rule: `mergeRoutes` refuses an incompatible
                  pair server-side, because a hidden option is not a permission (CLAUDE.md §9).

                  A differing mechanism or intake is shown rather than hidden — that is a
                  judgement the baseline leaves to a person (src/domain/merge.ts).
                */}
                <select name="canonicalRouteId" className={INPUT}>
                  <option value="">—</option>
                  {candidates.map(({ other, cautions }) => (
                    <option key={other.id} value={other.id}>
                      {other.title}
                      {cautions.length === 0
                        ? ''
                        : ` — ${cautions.map((c) => t.admin.mergeCaution[c]).join(', ')}`}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label={t.admin.mergeNote} size="compact">
                <input type="text" name="mergeNote" className={INPUT} />
              </FormField>
              <button
                type="submit"
                className={buttonClass('secondary', {
                  size: 'compact',
                  className: 'justify-self-start',
                })}
              >
                {t.admin.mergeSubmit}
              </button>
            </form>
          ) : (
            <form action={unmergeRouteAction} className="grid gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="routeId" value={route.id} />
              <button
                type="submit"
                className="justify-self-start text-meta text-brand-700 underline"
              >
                {t.admin.unmergeSubmit}
              </button>
            </form>
          )}
        </div>
      </div>
    </Panel>
  )
}
