import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ROUTE_MECHANISMS, STUDY_LEVELS } from '@/domain/enums'
import { buttonClass } from '@/components/ui'
import type { RouteMechanism, StudyLevel } from '@/domain/enums'
import { GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import { CategoryLegend } from '@/components/category-legend'
import { Chip, EmptyState, FormField, inputClass, LinkButton, Panel, Rail } from '@/components/ui'
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

/** The band's controls, from the one input style the design system owns (Phase 12E). */
const SELECT = inputClass()

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

      {/*
        VR-12's filter band — Phase 12H.

        ───────────────────────────────────────────────────────────────────────────────────
        **The filters were a left column, and it was the single worst use of space in the
        product.** Four selects and a button occupy about 270 vertical pixels. They sat in a
        four-of-twelve column beside a results list nearly four thousand pixels tall — so for
        roughly 3,600 pixels of scrolling, a third of the page width was blank. On a 1440px
        screen that is a strip of nothing about 220 pixels wide and eleven screens long.

        VR-12 draws them as a horizontal band above the results: From, Destination, Study
        Level, Intake, and the button, on one row. That is better on every count. The filters
        are read once and then scrolled past, which is what a band is for and what a rail is
        not; the results get the full canvas, so a ribbon has the width it was designed for;
        and the first screen shows three or four routes instead of one and a half.
      */}
      <Panel as="section" tone="sunken" className="mt-6">
        <h2 className="sr-only">{t.search.filtersLabel}</h2>
        <form method="get" className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FormField label={t.search.origin}>
            <select name="from" defaultValue={one(query.from) ?? ''} className={SELECT}>
              <option value="">{t.search.any}</option>
              {options.origins.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t.search.destination}>
            <select name="to" defaultValue={one(query.to) ?? ''} className={SELECT}>
              <option value="">{t.search.any}</option>
              {options.destinations.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t.search.studyLevel}>
            <select name="level" defaultValue={level ?? ''} className={SELECT}>
              <option value="">{t.search.any}</option>
              {STUDY_LEVELS.map((value) => (
                <option key={value} value={value}>
                  {t.studyLevel[value]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t.search.mechanism}>
            <select name="mechanism" defaultValue={mechanism ?? ''} className={SELECT}>
              <option value="">{t.search.any}</option>
              {ROUTE_MECHANISMS.map((value) => (
                <option key={value} value={value}>
                  {t.routeMechanism[value]}
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex items-center gap-3">
            <button type="submit" className={buttonClass()}>
              {t.search.submit}
            </button>
            {hasFilters ? (
              <a href={`/${locale}/routes`} className="text-sm text-brand-700 hover:underline">
                {t.search.reset}
              </a>
            ) : null}
          </div>
        </form>
      </Panel>

      {/*
        Results in a column tuned for a ribbon, and a rail that is not empty — Phase 12H.

        ───────────────────────────────────────────────────────────────────────────────────
        **Why the results are not full-width now that the filters have left the side.**

        Giving them the whole canvas was tried and measured, and it made the page *taller* —
        3,917px to 4,364px. A ribbon is an SVG with a viewBox and `w-full`, so it scales to its
        container in both dimensions: widening the column from 826px to 1,280px scaled every
        band by 1.55×, and a route with parallel stages, whose ribbon carries lane gaps, grew
        by two hundred pixels. More width bought more height, which is the opposite of the
        point. `RIBBON.fitWidth` is 680 and tuned for this column; the honest fix is to keep
        the column it was tuned for rather than to blow the drawing up and call it density.

        So the width the filters gave back goes to a rail instead, which is what VR-12 does
        with that side of the page anyway.
      */}
      <PageGrid className="mt-6">
        <GridRegion span={8} tablet={4}>
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
          </div>

          <SearchResults
            results={results}
            hasFilters={hasFilters}
            locale={locale}
            dictionary={t}
            query={query}
          />
        </GridRegion>

        <GridRegion span={4} tablet={2}>
          <div className="space-y-3 lg:sticky lg:top-6">
            {/*
              The key to the thing the reader is looking at. Every ribbon on this page is six
              categories in journey order, each an icon in its own colour, and nothing said
              what any of them meant — information present and unreadable.
            */}
            <Rail title={t.search.legendTitle} level={2}>
              <p className="mb-3 text-meta leading-5 text-ink-500">{t.search.legendLede}</p>
              <CategoryLegend dictionary={t} />
            </Rail>

            {/* FR-13, where a student actually notices the gap: at the moment their own route
                is not in the results. */}
            {/* VR-03's rail carries "New Here? … See How It Works". It pointed at nothing
                until Phase 12J. This is the moment a reader is most likely to be confused:
                looking at six coloured bands for the first time. */}
            <Rail title={t.howItWorks.newHereTitle} level={2}>
              <p className="text-meta leading-5 text-ink-700">{t.howItWorks.newHereBody}</p>
              <div className="mt-3">
                <LinkButton href={`/${locale}/how-it-works`} tone="secondary">
                  {t.nav.howItWorks}
                </LinkButton>
              </div>
            </Rail>

            <Rail title={t.search.missingTitle} level={2}>
              <p className="text-meta leading-5 text-ink-700">{t.search.missingLede}</p>
              <div className="mt-3">
                <LinkButton href={`/${locale}/routes/new`} tone="secondary">
                  {t.contribute.createRoute}
                </LinkButton>
              </div>
            </Rail>
          </div>
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
