import Link from 'next/link'

import { ContentColumn, PageCanvas } from '@/components/layout'
import { FlyWindowNote } from '@/components/route-shared'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { RouteDetail } from '@/server/routes/read'

/**
 * The persistent context every view of a route sits inside.
 *
 * Overview and History are **sibling views of the same object**, not separate destinations.
 * Before this existed, opening the history navigated to a page with its own `<h1>Route
 * history</h1>` and nothing but a back link — the route's title, origin, destination, maturity
 * and fly window all vanished, so it read as leaving the route for somewhere unrelated.
 *
 * Tabs keep the object on screen while the view changes. They remain real URLs, so they are
 * still deep-linkable, shareable and server-rendered — the navigation model is GitHub-shaped
 * (persistent context, meaningful URL changes, tabs for major sibling views), not
 * one-page-per-click.
 */
export type RouteTab = 'overview' | 'history'

export function RouteContext({
  route,
  dictionary: t,
  locale,
  tab,
  children,
}: {
  route: RouteDetail
  dictionary: Dictionary
  locale: string
  tab: RouteTab
  children: React.ReactNode
}) {
  const base = `/${locale}/routes/${route.slug}`
  const tabs: { id: RouteTab; label: string; href: string }[] = [
    { id: 'overview', label: t.route.tabOverview, href: base },
    { id: 'history', label: t.route.tabHistory, href: `${base}/history` },
  ]

  return (
    <>
      <div className="border-b border-hairline bg-surface">
        <PageCanvas className="pt-6">
          <Link href={`/${locale}/routes`} className="text-sm text-brand-700 hover:underline">
            ← {t.route.backToSearch}
          </Link>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink-900">
                {route.title}
              </h1>
              <p className="mt-1 text-sm text-ink-500">
                {route.originCountry} → {route.destinationCountry} ·{' '}
                {t.studyLevel[route.studyLevel]}
                {route.mechanism === null ? '' : ` · ${t.routeMechanism[route.mechanism]}`}
                {route.intake === null ? '' : ` · ${route.intake}`}
              </p>
              {route.summary === null ? null : (
                <ContentColumn width="reading">
                  <p className="mt-3 text-base leading-7 text-ink-700">{route.summary}</p>
                </ContentColumn>
              )}
              <p className="mt-3">
                <span className="rounded-full border border-hairline px-3 py-1 text-xs text-ink-700">
                  {t.routeLifecycle[route.lifecycleState as keyof typeof t.routeLifecycle]}
                </span>
              </p>
            </div>

            <div className="w-full max-w-sm shrink-0">
              <FlyWindowNote window={route.flyWindow} dictionary={t} />
            </div>
          </div>

          {/* Tabs, not links away. The route stays above them on every view. */}
          <nav aria-label={t.route.tabsLabel} className="mt-6 -mb-px flex gap-1">
            {tabs.map((entry) => {
              const active = entry.id === tab
              return (
                <Link
                  key={entry.id}
                  href={entry.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-t-lg border-b-2 px-4 py-2 text-sm ${
                    active
                      ? 'border-brand-700 font-medium text-brand-900'
                      : 'border-transparent text-ink-700 hover:border-hairline hover:text-ink-900'
                  }`}
                >
                  {entry.label}
                </Link>
              )
            })}
          </nav>
        </PageCanvas>
      </div>

      <PageCanvas className="py-8">{children}</PageCanvas>
    </>
  )
}
