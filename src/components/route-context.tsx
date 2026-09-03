import Link from 'next/link'

import { ContentColumn, PageCanvas } from '@/components/layout'
import { FlyWindowNote } from '@/components/route-shared'
import { RoutePassportPanel } from '@/components/trust'
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
export type RouteTab = 'overview' | 'history' | 'journey' | 'changes'

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
  // "My journey" is a tab, not a separate destination, and it is shown to everyone.
  //
  // A journey is a *view of this route* for one reader — the same object at a different
  // density of personal detail — so it belongs beside Overview and History rather than at
  // some other address that loses the route (CLAUDE.md §7.1). Showing the tab to anonymous
  // visitors too keeps the URL stable and deep-linkable; the page itself explains what
  // signing in would give them, which is more useful than a tab that appears from nowhere.
  const tabs: { id: RouteTab; label: string; href: string }[] = [
    { id: 'overview', label: t.route.tabOverview, href: base },
    { id: 'journey', label: t.journey.tab, href: `${base}/journey` },
    // Phase 10. Sits between the journey and the full history on purpose: "what changed
    // recently, and does it touch me" is a different and far more common question than
    // "show me every revision ever made" (FR-28 vs FR-31).
    { id: 'changes', label: t.changes.tab, href: `${base}/changes` },
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
            </div>

            {/* Standing and timing sit together, beside the route rather than under it, and
                stay on screen across both tabs. A reader who opens the history should not
                lose sight of how mature the route they are reading actually is (FR-74). */}
            <div className="w-full max-w-sm shrink-0 space-y-3">
              <RoutePassportPanel trust={route.trust} dictionary={t} />
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
