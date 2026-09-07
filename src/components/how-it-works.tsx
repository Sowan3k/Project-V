import Link from 'next/link'

import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * How this product works, at two densities — Phase 12J, VR-12's "How Vindeshi Express Works".
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **The problem this answers.** A visitor arriving at a platform whose central object is a
 * "ribbon" that "unfolds into a road" has no idea what any of that means, and nothing on the
 * site told them. The landing page carried three lines of small text; everything else assumed
 * the vocabulary. A product can be entirely honest and still be unusable because nobody knows
 * what they are looking at.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Two densities, and the split is what keeps §8.5.1 intact.**
 *
 * `HowItWorksTiles` is the four-tile band VR-12 draws: what you do, in order, once. It goes on
 * the landing page and nowhere else, and it is deliberately shallow — CLAUDE.md §8.5.1 is
 * explicit that the homepage must never expose the whole application, and the answer to "the
 * homepage is thin" is not to thicken the homepage.
 *
 * The depth lives on `/how-it-works`, which is where VR-01's secondary call to action and
 * VR-03's "New Here? See How It Works" have both been pointing at nothing. A page can explain
 * a ribbon properly; a band above the fold cannot.
 *
 * **No modal, no tour, no dismissible overlay.** An onboarding overlay is a thing a reader
 * closes and can never find again, it needs state, and state on the read path needs a client
 * component. A page is linkable, re-readable, indexable and free.
 *
 * The icons are hand-drawn here, which invariant 24 permits without qualification: they are
 * fixed furniture, no route data reaches them, and they render identically for every
 * destination. Nothing in this file draws a route.
 */

/** VR-12's band: the loop in four tiles, once, on the landing page. */
export function HowItWorksTiles({
  dictionary: t,
  locale,
}: {
  dictionary: Dictionary
  locale: string
}) {
  const icons = [<SearchIcon key="s" />, <RoadIcon key="r" />, <JourneyIcon key="j" />, <CommunityIcon key="c" />]

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-section font-semibold text-ink-900">{t.landing.howItWorks}</h2>
        <Link
          href={`/${locale}/how-it-works`}
          className="vx-underline text-sm font-medium text-brand-700"
        >
          {t.howItWorks.readMore}
        </Link>
      </div>

      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {t.landing.steps.map((entry, index) => (
          <li
            key={entry.title}
            className="vx-tile rounded-panel border border-hairline bg-surface p-5"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-control border border-hairline bg-surface-muted text-brand-700"
              >
                {icons[index]}
              </span>
              <span className="text-micro font-medium tracking-wide text-ink-500 uppercase">
                {t.howItWorks.stepOf(index + 1, t.landing.steps.length)}
              </span>
            </div>
            <p className="mt-3 text-panel font-semibold text-ink-900">{entry.title}</p>
            <p className="mt-1 text-meta leading-5 text-ink-700">{entry.body}</p>
          </li>
        ))}
      </ol>
    </>
  )
}

/*
 * Four marks. Deliberately drawn from this product's own vocabulary rather than a generic set:
 * a magnifier for search, the road for a route, a marked road for a private journey, and a
 * pen over a line for the community keeping it right.
 */

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 L20 20" />
    </svg>
  )
}

/** The same curve as the brand mark: this product's road. */
function RoadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20 C 5 14, 12 14, 12 9 C 12 5, 16 4, 19 5" />
      <circle cx="5" cy="20" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** The road again, with your own position marked on it. */
function JourneyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20 C 5 14, 12 14, 12 9 C 12 5, 16 4, 19 5" />
      <path d="M9.4 12.2 l1.6 1.6 3.4 -3.6" />
    </svg>
  )
}

/** A pen over a line: somebody correcting what is written. */
function CommunityIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20 h16" />
      <path d="M6 16.5 L15.5 7 a1.8 1.8 0 0 1 2.6 2.6 L8.6 19.1 L5 20 l0.9 -3.6 Z" />
    </svg>
  )
}
