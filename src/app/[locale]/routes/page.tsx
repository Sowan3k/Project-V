import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ROUTE_MECHANISMS, STUDY_LEVELS } from '@/domain/enums'
import { buttonClass } from '@/components/ui'
import type { RouteMechanism, StudyLevel } from '@/domain/enums'
import { GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import { Chip, EmptyState, LinkButton } from '@/components/ui'
import { isLocale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { getDictionary } from '@/i18n/get-dictionary'
import { RouteRibbon } from '@/components/route-ribbon'
import { availableFilters, searchRoutes, type RouteSearchFilters } from '@/server/routes/read'

/**
 * Route search — FR-01, FR-02, VR-12.
 *
 * A plain form that submits with GET, so results are server-rendered, deep-linkable,
 * shareable and work without JavaScript. Search is the first thing a visitor does and it
 * must never depend on a bundle loading (§8.1).
 *
 * Anonymous throughout: there is no session read anywhere in this file.
 */
export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

const one = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value) || undefined

/**
 * A title of this page's own - Phase 12.
 *
 * Before Phase 12 every page in the application shared one title, so a reader with three
 * routes open had three identical tabs and a useless history. The layout supplies the
 * "<subject> - Vindeshi Express" template; this supplies the subject.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  return { title: t.meta.searchTitle }
}

export default async function RouteSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)
  const query = await searchParams

  const level = one(query.level)
  const mechanism = one(query.mechanism)

  const filters: RouteSearchFilters = {
    ...(one(query.from) ? { originCountry: one(query.from) } : {}),
    ...(one(query.to) ? { destinationCountry: one(query.to) } : {}),
    ...(level && (STUDY_LEVELS as readonly string[]).includes(level)
      ? { studyLevel: level as StudyLevel }
      : {}),
    ...(one(query.intake) ? { intake: one(query.intake) } : {}),
    ...(mechanism && (ROUTE_MECHANISMS as readonly string[]).includes(mechanism)
      ? { mechanism: mechanism as RouteMechanism }
      : {}),
  }

  const hasFilters = Object.keys(filters).length > 0
  const page = Number.parseInt(one(query.page) ?? '1', 10)
  const [results, options] = await Promise.all([
    searchRoutes(filters, new Date(), page),
    availableFilters(),
  ])

  return (
    <PageCanvas className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h1 className="text-title font-semibold tracking-tight text-ink-900">{t.search.title}</h1>
          <p className="mt-2 text-sm text-ink-700">{t.search.lede}</p>
        </div>
        {/* VR-12 leads with these three promises beside the heading. They are the product's
            actual guarantees rather than marketing: free (§28), community-maintained (§16),
            and no document upload (invariant 6, §24.1). */}
        <ul className="flex flex-wrap gap-2">
          <li>
            <Chip>{t.principles.free}</Chip>
          </li>
          <li>
            <Chip>{t.principles.communityMaintained}</Chip>
          </li>
          <li>
            <Chip>{t.principles.noDocumentUpload}</Chip>
          </li>
        </ul>
      </div>

      <PageGrid className="mt-8">
        <GridRegion span={4}>
      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:sticky lg:top-6">
        <label className="text-sm">
          <span className="block text-ink-700">{t.search.origin}</span>
          <select
            name="from"
            defaultValue={one(query.from) ?? ''}
            className="mt-1 w-full rounded-control border border-hairline bg-surface px-3 py-2"
          >
            <option value="">{t.search.any}</option>
            {options.origins.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-ink-700">{t.search.destination}</span>
          <select
            name="to"
            defaultValue={one(query.to) ?? ''}
            className="mt-1 w-full rounded-control border border-hairline bg-surface px-3 py-2"
          >
            <option value="">{t.search.any}</option>
            {options.destinations.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-ink-700">{t.search.studyLevel}</span>
          <select
            name="level"
            defaultValue={level ?? ''}
            className="mt-1 w-full rounded-control border border-hairline bg-surface px-3 py-2"
          >
            <option value="">{t.search.any}</option>
            {STUDY_LEVELS.map((value) => (
              <option key={value} value={value}>
                {t.studyLevel[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-ink-700">{t.search.mechanism}</span>
          <select
            name="mechanism"
            defaultValue={mechanism ?? ''}
            className="mt-1 w-full rounded-control border border-hairline bg-surface px-3 py-2"
          >
            <option value="">{t.search.any}</option>
            {ROUTE_MECHANISMS.map((value) => (
              <option key={value} value={value}>
                {t.routeMechanism[value]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            className={buttonClass()}
          >
            {t.search.submit}
          </button>
          {hasFilters ? (
            <a href={`/${locale}/routes`} className="text-sm text-brand-700 hover:underline">
              {t.search.reset}
            </a>
          ) : null}
        </div>
      </form>

        </GridRegion>

        <GridRegion span={8}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-ink-500" role="status">
              {t.search.resultCount(results.total)}
              {results.pageCount > 1 ? (
                <span className="text-ink-500">
                  {' · '}
                  {t.search.pageOf(results.page, results.pageCount)}
                </span>
              ) : null}
            </p>
            {/* FR-13, where a student actually notices the gap: at the moment their own route
                is not in the results. Outside the boundary, so it is there to click before
                the results have arrived. */}
            <Link
              href={`/${locale}/routes/new`}
              className="ml-auto text-sm text-brand-700 hover:underline"
            >
              {t.contribute.createRoute}
            </Link>
          </div>

          <SearchResults
            results={results}
            hasFilters={hasFilters}
            locale={locale}
            dictionary={t}
            query={query}
          />
        </GridRegion>
      </PageGrid>
    </PageCanvas>
  )
}

/**
 * The results.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Phase 12 tried two loading states here and removed both. The reasons are worth keeping,
 * because each looked obviously right until it was tested.**
 *
 * A segment-level `loading.tsx` went first. Under `[locale]` it replaces everything inside
 * the layout — including the persistent route header and tabs that CLAUDE.md §7.1 exists to
 * keep on screen — so every tab click would have blanked the route a reader was looking at.
 *
 * A Suspense boundary around just these results replaced it, and looked like the correct
 * pattern: the filters paint immediately and the ribbons stream in underneath. **It broke
 * the platform for anybody without JavaScript**, and the Phase 5 spec that exists to protect
 * that caught it. React streams the fallback first and swaps in the real markup with an
 * inline script; with no script, the swap never happens and the reader is left looking at a
 * skeleton for ever.
 *
 * Search is the first thing a visitor does, on a phone browser, often on a poor connection
 * (CLAUDE.md §7). Working without JavaScript is worth more than a shimmer, so the query is
 * awaited and the page renders complete. There is no loading state on this page, and that is
 * the decision rather than an omission.
 */
function SearchResults({
  results,
  hasFilters,
  locale,
  dictionary: t,
  query,
}: {
  results: Awaited<ReturnType<typeof searchRoutes>>
  hasFilters: boolean
  locale: string
  dictionary: Dictionary
  query: SearchParams
}) {
  if (results.routes.length === 0) {
    return (
      <div className="mt-3">
        {/* An empty platform is the first risk in §45. Saying so plainly is better than an
            apologetic error, and far better than inventing routes to look populated. */}
        <EmptyState
          title={t.search.emptyTitle}
          body={hasFilters ? t.search.emptyBody : t.search.emptyBodyNoFilters}
          action={
            <LinkButton href={`/${locale}/routes/new`} tone="secondary">
              {t.contribute.createRoute}
            </LinkButton>
          }
        />
      </div>
    )
  }

  return (
    <>
      <ul className="mt-3 space-y-3">
        {results.routes.map((route) => (
          <RouteRibbon key={route.id} route={route} dictionary={t} locale={locale} />
        ))}
      </ul>
      <Pagination results={results} query={query} dictionary={t} />
    </>
  )
}

/**
 * Page links — Phase 12D.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Plain links, not a control.** Every page is a real URL that can be bookmarked, shared,
 * opened in a new tab and reached with JavaScript disabled — the same rule as `?step=` on a
 * route (§7.1, Phase 5). A "load more" button would be none of those things and would need a
 * client component, which the read path does not have.
 *
 * The existing filters are carried across rather than rebuilt, so paging never silently
 * widens a search. That is a real failure mode: a reader who filtered to Germany and clicked
 * page 2 into an unfiltered list would have no way of knowing their filter had gone.
 *
 * First and last are offered as well as previous and next, because with a page count in the
 * dozens "back to the start" is otherwise a dozen clicks.
 */
function Pagination({
  results,
  query,
  dictionary: t,
}: {
  results: Awaited<ReturnType<typeof searchRoutes>>
  query: SearchParams
  dictionary: Dictionary
}) {
  if (results.pageCount <= 1) return null

  const href = (page: number): string => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (key === 'page') continue
      const single = Array.isArray(value) ? value[0] : value
      if (single) params.set(key, single)
    }
    if (page > 1) params.set('page', String(page))
    const search = params.toString()
    return search === '' ? '?' : `?${search}`
  }

  const first = results.page > 1
  const last = results.page < results.pageCount

  return (
    <nav
      aria-label={t.search.pagination}
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5"
    >
      <div className="flex items-center gap-2">
        {first ? (
          <>
            <LinkButton href={href(1)} tone="secondary">
              {t.search.firstPage}
            </LinkButton>
            <LinkButton href={href(results.page - 1)} tone="secondary">
              {t.search.previousPage}
            </LinkButton>
          </>
        ) : null}
      </div>
      <p className="text-meta text-ink-500">{t.search.pageOf(results.page, results.pageCount)}</p>
      <div className="flex items-center gap-2">
        {last ? (
          <>
            <LinkButton href={href(results.page + 1)} tone="secondary">
              {t.search.nextPage}
            </LinkButton>
            <LinkButton href={href(results.pageCount)} tone="secondary">
              {t.search.lastPage}
            </LinkButton>
          </>
        ) : null}
      </div>
    </nav>
  )
}
