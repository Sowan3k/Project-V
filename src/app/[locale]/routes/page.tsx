import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ROUTE_MECHANISMS, STUDY_LEVELS } from '@/domain/enums'
import type { RouteMechanism, StudyLevel } from '@/domain/enums'
import { GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import { isLocale } from '@/i18n/config'
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
  const [routes, options] = await Promise.all([searchRoutes(filters), availableFilters()])

  return (
    <PageCanvas className="py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{t.search.title}</h1>
      <p className="mt-2 text-sm text-ink-700">{t.search.lede}</p>

      <PageGrid className="mt-8">
        <GridRegion span={4}>
      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:sticky lg:top-6">
        <label className="text-sm">
          <span className="block text-ink-700">{t.search.origin}</span>
          <select
            name="from"
            defaultValue={one(query.from) ?? ''}
            className="mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2"
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
            className="mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2"
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
            className="mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2"
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
            className="mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2"
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
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
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
          {t.search.resultCount(routes.length)}
        </p>
        {/* FR-13, where a student actually notices the gap: at the moment their own route is
            not in the results. Offered to everyone; signing in happens when they act. */}
        <Link href={`/${locale}/routes/new`} className="text-sm text-brand-700 hover:underline">
          {t.contribute.createRoute}
        </Link>
      </div>

      {routes.length === 0 ? (
        <div className="mt-3 rounded-xl border border-hairline bg-surface p-6">
          <h2 className="font-medium text-ink-900">{t.search.emptyTitle}</h2>
          {/* An empty platform is the first risk in §45. Saying so plainly is better than
              an apologetic error, and far better than inventing routes to look populated. */}
          <p className="mt-2 text-sm leading-6 text-ink-700">
            {hasFilters ? t.search.emptyBody : t.search.emptyBodyNoFilters}
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {routes.map((route) => (
            <RouteRibbon key={route.id} route={route} dictionary={t} locale={locale} />
          ))}
        </ul>
      )}
        </GridRegion>
      </PageGrid>
    </PageCanvas>
  )
}
