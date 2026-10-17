import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  AnnouncedChangeCard,
  DisruptionCard,
  RelevanceNote,
  SeverityChip,
  SeverityLegend,
} from '@/components/changes'
import { ContentColumn, GridRegion, PageGrid } from '@/components/layout'
import { buttonClass, EmptyState, LinkButton, Rail, TabNav } from '@/components/ui'
import type { ChangeRelevance, DisruptionRelevance } from '@/domain/changes'
import type { ChangeSeverity } from '@/domain/enums'
import { CHANGE_SEVERITIES } from '@/domain/enums'
import { isLocale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { getDictionary } from '@/i18n/get-dictionary'
import { currentViewer } from '@/server/auth'
import {
  currentDisruptions,
  recentChanges,
  type ChangeView,
  type DisruptionView,
  type FeedRoute,
} from '@/server/changes/read'
import { followedRouteReports, type FollowedRouteReport } from '@/server/journeys/changes'

/**
 * The Updates page — Phase 14. FR-28, FR-29, FR-59, FR-61, FR-62, FR-63, FR-76. VR-10.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **A primary context, so a page of its own, with its four views as tabs** (CLAUDE.md §7.1).
 * "Every change across the routes I care about" is not a view of any one route, so it cannot
 * be a route tab. Each tab is its own URL: `/updates`, `/updates/journey`, `/updates/following`
 * and `/updates/elsewhere`, so any of them can be bookmarked or sent.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The list is ordered by announcement. Whether a change reaches you is not.**
 *
 * Rows sort by when they were recorded, which is the order a reader catching up expects. The
 * "Affecting my journey" tab is decided by `changeRelevance`, through the same follower report
 * the route's own Changes tab uses, and that decision is made on the effective date (invariant
 * 21, BR-26). A change typed in today about a rule that started in March does not land ahead of
 * somebody who finished that step in April.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **No email, no push, no unread count** (§35, §8.6). This page is the first-release mechanism
 * for seeing change, which is why it had to exist.
 *
 * Filters are a `<form method="get">`, so they deep-link and work with JavaScript disabled.
 *
 * The two page files wrap this in `PageCanvas`, so each of them visibly sits on the shared
 * canvas (CLAUDE.md §7.2, and the guard in `presentation.test.ts` that reads page files).
 */

export const UPDATE_TABS = ['all', 'journey', 'following', 'elsewhere'] as const
export type UpdateTab = (typeof UPDATE_TABS)[number]

const TAB_PATH: Record<UpdateTab, string> = {
  all: '',
  journey: '/journey',
  following: '/following',
  elsewhere: '/elsewhere',
}

const SHOW_VALUES = ['both', 'changes', 'disruptions'] as const
type Show = (typeof SHOW_VALUES)[number]

type SearchParams = Record<string, string | string[] | undefined>

const FEED_LIMIT = 50

/** What the query string asked for, with anything unrecognised ignored rather than trusted. */
function readFilters(query: SearchParams): { show: Show; severities: ChangeSeverity[] } {
  const rawShow = Array.isArray(query.show) ? query.show[0] : query.show
  const show = SHOW_VALUES.find((value) => value === rawShow) ?? 'both'
  const rawSeverity = query.severity
  const asked = rawSeverity === undefined ? [] : Array.isArray(rawSeverity) ? rawSeverity : [rawSeverity]
  const severities = CHANGE_SEVERITIES.filter((severity) => asked.includes(severity))
  return { show, severities }
}

/** One change as a row on this page: which route it is on, and where the reader stands. */
interface ChangeRow {
  readonly change: ChangeView
  readonly route: FeedRoute
  readonly relevance: ChangeRelevance | null
}

interface DisruptionRow {
  readonly disruption: DisruptionView
  readonly route: FeedRoute
  readonly relevance: DisruptionRelevance | null
}

/**
 * Still to come or still running. The same comparison `currentDisruptions` makes in the
 * database, applied to the follower's rows, which arrive with expired ones included.
 */
function notOver(disruption: DisruptionView, now: Date): boolean {
  const time = now.getTime()
  const ends = disruption.endsAt === null || disruption.endsAt.getTime() > time
  const unresolved = disruption.resolvedAt === null || disruption.resolvedAt.getTime() > time
  return ends && unresolved
}

const newestFirst = (a: ChangeRow, b: ChangeRow): number =>
  b.change.announcedAt.getTime() - a.change.announcedAt.getTime() ||
  b.change.id.localeCompare(a.change.id)

/** The follower's own rows across every route they follow, newest first. */
function followerRows(
  reports: readonly FollowedRouteReport[],
  now: Date,
): { changes: ChangeRow[]; disruptions: DisruptionRow[] } {
  const changes: ChangeRow[] = []
  const disruptions: DisruptionRow[] = []
  for (const { route, report } of reports) {
    for (const entry of report.changes) {
      changes.push({ change: entry.change, route, relevance: entry.relevance })
    }
    for (const entry of report.disruptions) {
      if (notOver(entry.disruption, now)) {
        disruptions.push({ disruption: entry.disruption, route, relevance: entry.relevance })
      }
    }
  }
  changes.sort(newestFirst)
  disruptions.sort(
    (a, b) =>
      b.disruption.startsAt.getTime() - a.disruption.startsAt.getTime() ||
      b.disruption.id.localeCompare(a.disruption.id),
  )
  return { changes, disruptions }
}

export async function UpdatesView({
  params,
  searchParams,
  tab,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
  tab: UpdateTab
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)
  const query = await searchParams
  const { show, severities } = readFilters(query)

  const viewer = await currentViewer()
  const now = new Date()

  // Scoped by the session user id, like every other journey read (invariant 5). An anonymous
  // reader has no reports, and the two private tabs say what they would show instead.
  const reports = viewer === null ? [] : await followedRouteReports(viewer.id, { now })
  const followedIds = reports.map((entry) => entry.route.id)
  const mine = followerRows(reports, now)

  // Where the reader stands on a change, for the public tabs too: a row on "All" that sits on a
  // followed route carries the same note it carries on that route's Changes tab.
  const changeRelevanceById = new Map(mine.changes.map((row) => [row.change.id, row.relevance]))
  const disruptionRelevanceById = new Map(
    mine.disruptions.map((row) => [row.disruption.id, row.relevance]),
  )

  const bySeverity = <T extends { readonly severity: ChangeSeverity }>(item: T): boolean =>
    severities.length === 0 || severities.includes(item.severity)

  let changes: readonly ChangeRow[] = []
  let disruptions: readonly DisruptionRow[] = []
  const signedOutPrivateTab = viewer === null && (tab === 'journey' || tab === 'following')

  if (tab === 'all' || tab === 'elsewhere') {
    const excludeRouteIds = tab === 'elsewhere' ? followedIds : undefined
    const [feedChanges, feedDisruptions] = await Promise.all([
      show === 'disruptions'
        ? Promise.resolve([])
        : recentChanges({ excludeRouteIds, severities, limit: FEED_LIMIT }),
      show === 'changes'
        ? Promise.resolve([])
        : currentDisruptions({ excludeRouteIds, severities, limit: FEED_LIMIT, now }),
    ])
    changes = feedChanges.map((change) => ({
      change,
      route: change.route,
      relevance: changeRelevanceById.get(change.id) ?? null,
    }))
    disruptions = feedDisruptions.map((disruption) => ({
      disruption,
      route: disruption.route,
      relevance: disruptionRelevanceById.get(disruption.id) ?? null,
    }))
  } else if (!signedOutPrivateTab) {
    // "Affecting my journey" keeps the rows that ask something of this reader: a caution, which
    // only a change on a step they have not finished, or one they said applies, can earn. The
    // same rule as the route page's "needs a look" count, so the two never disagree.
    const keepChange = (row: ChangeRow) =>
      bySeverity(row.change) && (tab === 'following' || row.relevance?.weight === 'caution')
    const keepDisruption = (row: DisruptionRow) =>
      bySeverity(row.disruption) && (tab === 'following' || row.relevance?.weight === 'caution')
    changes = show === 'disruptions' ? [] : mine.changes.filter(keepChange).slice(0, FEED_LIMIT)
    disruptions =
      show === 'changes' ? [] : mine.disruptions.filter(keepDisruption).slice(0, FEED_LIMIT)
  }

  const base = `/${locale}/updates`
  const tabs = UPDATE_TABS.map((id) => ({
    href: `${base}${TAB_PATH[id]}`,
    label: t.updates.tab[id],
    current: id === tab,
  }))
  const here = `${base}${TAB_PATH[tab]}`

  const rail = (
    <div className="space-y-6">
      <Rail title={t.updates.summaryTitle} level={2}>
        <AheadOfYou viewer={viewer !== null} reports={reports} dictionary={t} />
      </Rail>
      <Rail title={t.updates.filterTitle} level={2}>
        <FilterForm action={here} show={show} severities={severities} dictionary={t} />
      </Rail>
    </div>
  )

  return (
    <>
      <h1 className="text-title font-semibold tracking-tight text-ink-900">{t.updates.title}</h1>
      <ContentColumn width="reading">
        <p className="mt-2 text-sm leading-6 text-ink-700">{t.updates.lede}</p>
      </ContentColumn>

      <TabNav label={t.updates.tabsLabel} tabs={tabs} />

      <PageGrid className="mt-6">
        <GridRegion span={8} tablet={4}>
          {signedOutPrivateTab ? (
            <EmptyState
              title={t.updates.signedOut[tab].title}
              body={t.updates.signedOut[tab].body}
              action={
                <LinkButton href={`/${locale}/signin?next=${encodeURIComponent(here)}`}>
                  {t.auth.signIn}
                </LinkButton>
              }
            />
          ) : (tab === 'journey' || tab === 'following') && reports.length === 0 ? (
            <EmptyState
              title={t.updates.notFollowingTitle}
              body={t.updates.notFollowingBody}
              action={<LinkButton href={`/${locale}/routes`}>{t.landing.findMyRoute}</LinkButton>}
            />
          ) : tab === 'journey' && changes.length === 0 && disruptions.length === 0 ? (
            <EmptyState title={t.updates.nothingAheadTitle} body={t.updates.nothingAheadBody} />
          ) : (
            <>
              {show === 'disruptions' ? null : (
                <ChangeSection rows={changes} locale={locale} dictionary={t} />
              )}
              {show === 'changes' ? null : (
                <DisruptionSection
                  rows={disruptions}
                  locale={locale}
                  now={now}
                  dictionary={t}
                  spaced={show === 'both'}
                />
              )}
            </>
          )}
        </GridRegion>
        <GridRegion span={4} tablet={2} className="order-first md:order-none">
          {rail}
        </GridRegion>
      </PageGrid>

      <section className="mt-10 border-t border-hairline pt-6">
        <h2 className="text-panel font-semibold text-ink-900">{t.changes.severityLegendTitle}</h2>
        <div className="mt-2">
          <SeverityLegend dictionary={t} />
        </div>
      </section>

      {/* §35, CLAUDE.md §8.6: VR-10 offers "Subscribe to Alerts". There is no such thing. */}
      <p className="mt-8 border-t border-hairline pt-4 text-xs leading-5 text-ink-500">
        {t.changes.noAlerts}
      </p>
    </>
  )
}

function ChangeSection({
  rows,
  locale,
  dictionary: t,
}: {
  rows: readonly ChangeRow[]
  locale: string
  dictionary: Dictionary
}) {
  return (
    <section>
      <h2 className="text-section font-semibold tracking-tight text-ink-900">
        {t.updates.changesTitle}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700">{t.updates.noChanges}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {rows.map((row) => (
              <AnnouncedChangeCard
                key={row.change.id}
                change={row.change}
                locale={locale}
                dictionary={t}
                route={row.route}
              >
                {row.relevance === null ? null : (
                  <RelevanceNote relevance={row.relevance} dictionary={t} />
                )}
                {/* §13.3: only the follower can say whether a narrow change applies to them.
                    The answer is given where the change lives, beside the comparison. */}
                {row.relevance?.askFollower === true ? (
                  <p className="mt-2 text-xs">
                    <Link
                      href={`/${locale}/routes/${row.route.slug}/changes`}
                      className="text-brand-700 underline"
                    >
                      {t.updates.answerOnRoute}
                    </Link>
                  </p>
                ) : null}
              </AnnouncedChangeCard>
            ))}
          </ul>
          {rows.length < FEED_LIMIT ? null : (
            <p className="mt-2 text-xs text-ink-500">{t.updates.limitNote(FEED_LIMIT)}</p>
          )}
        </>
      )}
    </section>
  )
}

function DisruptionSection({
  rows,
  locale,
  now,
  dictionary: t,
  spaced,
}: {
  rows: readonly DisruptionRow[]
  locale: string
  now: Date
  dictionary: Dictionary
  spaced: boolean
}) {
  return (
    <section className={spaced ? 'mt-10' : ''}>
      <h2 className="text-section font-semibold tracking-tight text-ink-900">
        {t.updates.disruptionsTitle}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700">{t.updates.noDisruptions}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => (
            <DisruptionCard
              key={row.disruption.id}
              disruption={row.disruption}
              relevance={row.relevance ?? undefined}
              dictionary={t}
              now={now}
              route={{ ...row.route, locale }}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * How many changes land ahead of this reader, by level. The relevance summary §14 asks for.
 *
 * Counts of situations, never a score: each is "this many changes are on steps you have not
 * finished", grouped by the level the contributor gave them. Nothing reads these numbers.
 */
function AheadOfYou({
  viewer,
  reports,
  dictionary: t,
}: {
  viewer: boolean
  reports: readonly FollowedRouteReport[]
  dictionary: Dictionary
}) {
  if (!viewer || reports.length === 0) {
    return <p className="text-meta leading-5 text-ink-700">{t.updates.summarySignedOut}</p>
  }

  const ahead = reports.flatMap(({ report }) =>
    report.changes.filter((entry) => entry.relevance.weight === 'caution'),
  )
  const disruptionsAhead = reports.reduce(
    (total, { report }) =>
      total + report.disruptions.filter((entry) => entry.relevance.weight === 'caution').length,
    0,
  )
  const counts = [...CHANGE_SEVERITIES]
    .reverse()
    .map((severity) => ({
      severity,
      count: ahead.filter((entry) => entry.change.severity === severity).length,
    }))
    .filter((entry) => entry.count > 0)

  return (
    <>
      <p className="text-meta text-ink-700">{t.updates.summaryLede(reports.length)}</p>
      {counts.length === 0 && disruptionsAhead === 0 ? (
        <p className="mt-2 text-meta text-ink-700">{t.updates.summaryNone}</p>
      ) : (
        <>
          {counts.length === 0 ? null : (
            <ul className="mt-2 space-y-1.5">
              {counts.map((entry) => (
                <li key={entry.severity} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-meta font-semibold text-ink-900">
                    {entry.count}
                  </span>
                  <SeverityChip severity={entry.severity} dictionary={t} />
                </li>
              ))}
            </ul>
          )}
          {disruptionsAhead === 0 ? null : (
            <p className="mt-2 text-meta text-ink-700">
              {t.updates.summaryDisruptions(disruptionsAhead)}
            </p>
          )}
        </>
      )}
    </>
  )
}

/**
 * VR-10's "Filter Updates" panel, as a GET form. Deep-linkable, and it works with no script.
 */
function FilterForm({
  action,
  show,
  severities,
  dictionary: t,
}: {
  action: string
  show: Show
  severities: readonly ChangeSeverity[]
  dictionary: Dictionary
}) {
  return (
    <form method="get" action={action}>
      <fieldset>
        <legend className="text-meta font-medium text-ink-900">{t.updates.filterType}</legend>
        <ul className="mt-1 space-y-1">
          {SHOW_VALUES.map((value) => (
            <li key={value}>
              <label className="flex items-center gap-2 text-meta text-ink-700">
                <input type="radio" name="show" value={value} defaultChecked={value === show} />
                {t.updates.type[value]}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-meta font-medium text-ink-900">{t.updates.filterSeverity}</legend>
        <ul className="mt-1 space-y-1">
          {[...CHANGE_SEVERITIES].reverse().map((severity) => (
            <li key={severity}>
              <label className="flex items-center gap-2 text-meta text-ink-700">
                <input
                  type="checkbox"
                  name="severity"
                  value={severity}
                  defaultChecked={severities.includes(severity)}
                />
                {t.changes.severity[severity]}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-micro text-ink-500">{t.updates.filterSeverityHint}</p>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass('primary', { size: 'compact' })}>
          {t.updates.apply}
        </button>
        <Link href={action} className="text-meta text-brand-700 underline">
          {t.updates.clear}
        </Link>
      </div>
    </form>
  )
}
