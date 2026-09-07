import { LinkButton } from '@/components/ui'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { PlatformActivity } from '@/server/activity/read'

/**
 * How much of this record exists, and when it last moved — Phase 13C, from VR-12.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * The mockup runs a band across the bottom of the browse page: four big figures under "Built
 * by Students. For Students." The idea is good — a community-maintained record should show how
 * much community there is. The figures as drawn are not: see `src/server/activity/read.ts` for
 * which three had to go and why, and the dictionary for what replaced the wording.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Two states, and the empty one is the one that ships.**
 *
 * Production holds no routes. A scoreboard of four zeros looks like a bug, so the empty state
 * says instead what an empty community record *is* — the platform has no content of its own,
 * the first route has to be written by somebody — and offers the one action that changes it.
 * That is the same answer `EmptyState` already gives everywhere else, and it is the opposite
 * of the mockup's "50K+", which would have been the single most damaging invented number on
 * the site (§45, Gate 2, CLAUDE.md §10.2).
 *
 * **Nothing here is a trust signal** (invariant 14). Nothing reads `platformActivity()` except
 * this component; no count feeds ranking, standing, archival or a badge. The lede says so in
 * the reader's own words, because a large number beside a route is exactly the thing a reader
 * over-reads as endorsement.
 *
 * Numbers are `tabular-nums` so a row of figures aligns on its digits rather than wobbling.
 */
export function ActivityBand({
  activity,
  dictionary: t,
  locale,
}: {
  activity: PlatformActivity
  dictionary: Dictionary
  locale: string
}) {
  const empty = activity.routes === 0 && activity.contributions === 0

  if (empty) {
    return (
      <section aria-labelledby="activity-heading" className="rounded-panel border border-hairline bg-surface p-6">
        <h2 id="activity-heading" className="text-section font-semibold tracking-tight text-ink-900">
          {t.activity.emptyTitle}
        </h2>
        <p className="mt-3 max-w-prose text-base leading-7 text-ink-700">
          {t.activity.emptyBody}
        </p>
        <div className="mt-5">
          <LinkButton href={`/${locale}/routes/new`} tone="secondary">
            {t.activity.emptyAction}
          </LinkButton>
        </div>
      </section>
    )
  }

  const figures = [
    { value: activity.routes, label: t.activity.routes },
    { value: activity.destinations, label: t.activity.destinations },
    { value: activity.contributors, label: t.activity.contributors },
    { value: activity.contributions, label: t.activity.contributions },
    { value: activity.updates, label: t.activity.updates },
  ]

  return (
    <section
      aria-labelledby="activity-heading"
      className="rounded-panel border border-hairline bg-surface p-6"
    >
      <h2 id="activity-heading" className="text-section font-semibold tracking-tight text-ink-900">
        {t.activity.title}
      </h2>
      <p className="mt-2 max-w-prose text-meta leading-5 text-ink-500">{t.activity.lede}</p>

      {/*
        A `<dl>`, not a row of divs: each figure is a term and its value, and a screen reader
        reading "routes, 7" is the whole content of the band. Five across on a desktop, two on
        a phone — they reflow rather than shrinking (§7.2).
      */}
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        {figures.map((figure) => (
          <div key={figure.label}>
            <dd className="text-title font-semibold tabular-nums tracking-tight text-brand-900">
              {figure.value.toLocaleString('en')}
            </dd>
            <dt className="mt-1 text-meta leading-5 text-ink-700">{figure.label}</dt>
          </div>
        ))}
      </dl>

      {activity.lastActivityAt === null ? null : (
        // A date, not "3 days ago". A relative phrase has to be computed against *now*, which
        // makes the page uncacheable and, worse, wrong the moment it is cached anyway.
        <p className="mt-5 text-meta text-ink-500">
          {t.activity.lastActivity(activity.lastActivityAt.toISOString().slice(0, 10))}
        </p>
      )}
    </section>
  )
}
