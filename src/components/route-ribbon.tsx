import Link from 'next/link'

import { RibbonTrust } from '@/components/trust'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { Ribbon } from '@/renderer'
import type { RouteSummary } from '@/server/routes/read'

import { FlyWindowNote, rendererStrings } from './route-shared'

/**
 * A route in search results — VR-03, VR-12.
 *
 * The ribbon is drawn by the same renderer, from the same graph, that the road will use.
 * It is not a card with a picture on it: it *is* the route, compressed (D-33, invariant 25).
 * That is why the whole thing links to the road rather than opening a separate detail page.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Two columns above the band — Phase 12H, the density pass.**
 *
 * Every fact about the route used to run down the left in a single stack: origin and
 * destination, title, level and step count, summary, then the band, then maturity, then the
 * fly window on a line of its own. Six stacked rows and a drawing, about 310px per result —
 * so a 1440px screen showed one and a half routes, and the right half of every row was blank
 * except for a chevron.
 *
 * What the reader is doing here is *comparing*, and the two things they compare on are what a
 * route is and how much it can be relied on. So those become two columns: identity on the
 * left, standing and timing on the right, the band across both. Nothing was removed and no
 * wording changed — in particular the fly window keeps its visible "an estimate, not a
 * guarantee" in full (invariant 16, BR-18), which is precisely the sort of qualification that
 * gets quietly trimmed in a density pass. It reads better in a column than stretched across a
 * whole row anyway.
 */
export function RouteRibbon({
  route,
  dictionary: t,
  locale,
}: {
  route: RouteSummary
  dictionary: Dictionary
  locale: string
}) {
  return (
    <li className="vx-tile group border-b border-hairline bg-surface first:border-t">
      <Link
        href={`/${locale}/routes/${route.slug}`}
        className="block rounded-control px-2 py-4 focus:outline-2 hover:bg-surface-muted sm:px-3"
      >
        <div className="flex items-start gap-x-6 gap-y-3 max-sm:flex-col sm:justify-between">
          {/* What this route is. */}
          <div className="min-w-0 flex-1">
            <p className="text-meta font-medium text-brand-700">
              {route.originCountry} → {route.destinationCountry}
            </p>
            <h3 className="mt-0.5 text-panel font-semibold tracking-tight text-ink-900 group-hover:text-brand-700">
              {route.title}
            </h3>
            <p className="mt-1 text-meta text-ink-500">
              {t.studyLevel[route.studyLevel]}
              {route.mechanism === null ? '' : ` · ${t.routeMechanism[route.mechanism]}`}
              {route.intake === null ? '' : ` · ${route.intake}`}
              {` · ${t.route.stepCount(route.stepCount)}`}
            </p>
            {route.summary === null ? null : (
              <p className="mt-1 line-clamp-2 text-meta leading-5 text-ink-700">{route.summary}</p>
            )}
          </div>

          {/*
            How far it can be relied on, and roughly when it lands.

            Maturity and a count of things to know — not the list. A search result is a place
            to choose what to open; the passport on the route itself is where the detail
            belongs (FR-74). Both start from `snapshotCautions`, so this can never look calmer
            than the route page it leads to.

            `sm:max-w-72` keeps it a column rather than letting it grow into a second body of
            text: at that width the fly window wraps to two or three short lines beside the
            title, which is what makes the row shorter than the stack it replaced.
          */}
          <div className="flex shrink-0 items-start gap-3 max-sm:w-full sm:max-w-72">
            <div className="min-w-0 flex-1 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <RibbonTrust trust={route.trust} dictionary={t} />
              </div>
              <p className="mt-1.5 leading-5">
                <FlyWindowNote window={route.flyWindow} dictionary={t} compact />
              </p>
            </div>
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-brand-700"
              aria-hidden="true"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto pb-1" aria-label={t.route.ribbonLabel}>
          <Ribbon graph={route.graph} strings={rendererStrings(t)} />
        </div>
        <p className="mt-1 text-micro text-ink-500 sm:hidden">{t.route.ribbonContinue}</p>
      </Link>
    </li>
  )
}
