import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentColumn } from '@/components/layout'
import { LifecycleHistory, MergedFromList } from '@/components/lifecycle'
import { RouteContext } from '@/components/route-context'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { lifecycleHistory, mergedIntoThis } from '@/server/lifecycle/read'
import { getRouteBySlug, getRouteHistory } from '@/server/routes/read'

/**
 * Route history — FR-08, FR-31, §17.2.
 *
 * "If multiple contributors change a field over time, the history should remain visible so
 * that mistakes can be reversed and contradictory periods can be understood."
 *
 * A sibling view of the same route, rendered inside the same persistent context with the tab
 * bar. It has its own URL — deep-linkable and shareable — but the route's title, maturity and
 * fly window stay on screen, so this reads as a different view of one object rather than a
 * different place.
 *
 * The plain chronological record. The shadow comparison that answers *how much* changed and
 * *whether it affects you* is Phase 10.
 */
export const dynamic = 'force-dynamic'

/**
 * The route's own name in the browser tab - Phase 12.
 *
 * A reader comparing three routes has three tabs; identical titles make that impossible to
 * work with, and a bookmark or a shared link carries the same title into somebody else's
 * history. `notPublished` rather than a blank for a route that does not exist, so a broken
 * link is legible in a tab too.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  const route = await getRouteBySlug(slug)
  if (route === null) return { title: t.notPublished.title }
  return { title: t.meta.routeHistory(route.title), description: route.summary ?? t.meta.description }
}

export default async function RouteHistoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const route = await getRouteBySlug(slug)
  if (!route) notFound()

  const [history, standing, mergedFrom] = await Promise.all([
    getRouteHistory(route.id),
    // Phase 11 — how the route's standing has moved, beside how its content has. Both belong
    // on the History tab: they are the same question at two levels (FR-11, FR-31, §19).
    lifecycleHistory(route.id),
    mergedIntoThis(route.id),
  ])

  return (
    <RouteContext route={route} dictionary={t} locale={locale} tab="history">
      <ContentColumn width="wide">
        <h2 className="text-lg font-semibold text-ink-900">{t.route.history}</h2>
        <ContentColumn width="reading">
          <p className="mt-2 text-sm leading-6 text-ink-700">{t.route.historyLede}</p>
        </ContentColumn>

        {history.length === 0 ? (
          <p className="mt-6 text-sm text-ink-700">{t.route.historyEmpty}</p>
        ) : (
          <ol className="mt-6 space-y-3">
            {history.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-hairline bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                    {entry.kind}
                  </p>
                  <time dateTime={entry.createdAt.toISOString()} className="text-xs text-ink-500">
                    {entry.createdAt.toISOString().slice(0, 10)}
                  </time>
                </div>
                <p className="mt-1 text-sm leading-6 text-ink-900">{entry.value}</p>
                {entry.reason === null ? null : (
                  <p className="mt-1 text-xs text-ink-700">“{entry.reason}”</p>
                )}
                {entry.authorHandle === null ? null : (
                  <p className="mt-1 text-xs text-ink-500">{entry.authorHandle}</p>
                )}
              </li>
            ))}
          </ol>
        )}

        <MergedFromList routes={mergedFrom} locale={locale} dictionary={t} />
        <LifecycleHistory events={standing} dictionary={t} />
      </ContentColumn>
    </RouteContext>
  )
}
