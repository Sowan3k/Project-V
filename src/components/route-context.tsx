import Link from 'next/link'

import { ContentColumn, GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import { Breadcrumb, Stat } from '@/components/ui'
import { LifecycleNote, MergedNotice } from '@/components/lifecycle'
import { FlyWindowValue } from '@/components/route-shared'
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
        <PageCanvas className="pt-5">
          {/*
           * Breadcrumbs rather than a lone back link — Phase 12D, VR-05/VR-08/VR-13.
           *
           * "← Back to search" answers only "how do I leave"; a breadcrumb also answers
           * "where am I", which on a route three levels deep is the question a reader
           * actually has. Each segment is a real link, and the last is the page itself
           * rather than a link to where you already are.
           */}
          <Breadcrumb
            label={t.common.breadcrumb}
            crumbs={[
              { label: t.nav.routes, href: `/${locale}/routes` },
              {
                label: `${route.originCountry} → ${route.destinationCountry}`,
                href: `/${locale}/routes?from=${encodeURIComponent(route.originCountry)}&to=${encodeURIComponent(route.destinationCountry)}`,
              },
              { label: route.title },
            ]}
          />

          <div className="mt-3 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-title font-semibold tracking-tight text-balance text-ink-900">
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
              {/* Phase 11 — what this route's standing means, where it needs saying. Quiet
                  is explained rather than warned about: FR-39 and BR-10 are explicit that an
                  established route does not become false through inactivity. */}
              <ContentColumn width="reading">
                <LifecycleNote state={route.lifecycleState} dictionary={t} />
              </ContentColumn>

              {/*
               * The route's own facts, on the route — Phase 12D, VR-04/VR-05.
               *
               * Until now this column held a title, one grey line and, for a route with no
               * summary, nothing else — so beside a tall passport the header was about
               * three hundred and fifty pixels of empty page. VR-04 and VR-05 both put the
               * duration, the fly window and the activity counts across the top, which is
               * both better composition and the information a reader wants before deciding
               * whether to open anything.
               *
               * Every one of these is a **count or a stored date**. No score, no percentage,
               * no maturity arithmetic: the standing lives in the passport beside it, and
               * `routePassport` is the only thing allowed to speak to it (invariant 14).
               */}
              <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
                <Stat value={route.stepCount} label={t.route.stepsLabel} />
                <Stat value={<FlyWindowValue window={route.flyWindow} dictionary={t} />} label={t.flyWindow.label} />
                <Stat value={route.trust.contributorCount} label={t.route.contributorsLabel} />
                {/* "users marked this completed", never "verified" — FR-41, §26,
                    invariant 17. The wording lives in the dictionary where it is
                    reviewable as copy. */}
                <Stat value={route.trust.followerCount} label={t.route.followersLabel} />
              </div>
            </div>
          </div>

          {/* §40.4 — a merged route points readers at the survivor rather than vanishing,
              and says plainly that nothing was moved or lost (FR-58, BR-25, invariant 20). */}
          <ContentColumn width="reading">
            <MergedNotice route={route} locale={locale} dictionary={t} />
          </ContentColumn>

          {/*
           * Tabs, not links away. The route stays above them on every view.
           *
           * **`flex-wrap` is a bug fix, not styling.** This was a non-wrapping row of four
           * tabs, and at 360px the fourth pushed the row four pixels past the viewport — the
           * horizontal overflow the Phase 12 E2E has been failing on since run #53. A tab
           * strip that wraps onto a second line at phone width is the correct behaviour
           * anyway: the alternative is a row the reader has to drag sideways to discover
           * that History exists.
           */}
          <nav aria-label={t.route.tabsLabel} className="mt-6 -mb-px flex flex-wrap gap-1">
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

      {/*
       * Body: the view, and a rail that stays with it — Phase 12D, VR-04/VR-05/VR-07.
       *
       * The passport used to sit in the header beside the title. It is a tall panel and the
       * title column is short, so on a route without a summary the header was a stat band
       * and then roughly two hundred and fifty pixels of empty page — the taller column set
       * the height and nothing filled the rest.
       *
       * VR-04 and VR-05 both put route maturity in a **right rail beside the roadmap**, not
       * in the header, and that is also where it composes: the rail is as long as the view
       * next to it. It still appears on every tab, which is what FR-74 asks for — a reader
       * who opens the history should not lose sight of how mature the route is.
       */}
      <PageCanvas className="py-8">
        <PageGrid>
          <GridRegion span={8}>{children}</GridRegion>
          <GridRegion span={4}>
            <div className="space-y-3 lg:sticky lg:top-6">
              <RoutePassportPanel trust={route.trust} dictionary={t} />
            </div>
          </GridRegion>
        </PageGrid>
      </PageCanvas>
    </>
  )
}
