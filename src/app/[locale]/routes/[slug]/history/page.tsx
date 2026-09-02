import { notFound } from 'next/navigation'

import { ContentColumn } from '@/components/layout'
import { RouteContext } from '@/components/route-context'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
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

  const history = await getRouteHistory(route.id)

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
      </ContentColumn>
    </RouteContext>
  )
}
