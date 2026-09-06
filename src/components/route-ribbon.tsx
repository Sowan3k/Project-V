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
    <li className="group border-b border-hairline bg-surface first:border-t">
      <Link href={`/${locale}/routes/${route.slug}`} className="block rounded-control px-2 py-6 focus:outline-2 hover:bg-surface-muted sm:px-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-meta font-medium text-brand-700">
              {route.originCountry} → {route.destinationCountry}
            </p>
            <h3 className="text-section font-semibold tracking-tight text-ink-900 group-hover:text-brand-700">{route.title}</h3>
            <p className="mt-1 text-meta text-ink-500">
              {t.studyLevel[route.studyLevel]}
              {route.mechanism === null ? '' : ` · ${t.routeMechanism[route.mechanism]}`}
              {route.intake === null ? '' : ` · ${route.intake}`}
              {` · ${t.route.stepCount(route.stepCount)}`}
            </p>
          </div>
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-brand-700" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </span>
        </div>

        {route.summary === null ? null : (
          <p className="mt-1 text-sm leading-6 text-ink-700">{route.summary}</p>
        )}

        <div className="mt-5 overflow-x-auto pb-1" aria-label={t.route.ribbonLabel}>
          <Ribbon graph={route.graph} strings={rendererStrings(t)} />
        </div>
        <p className="mt-1 text-micro text-ink-500 sm:hidden">{t.route.ribbonContinue}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {/* Maturity and a count of things to know — not the list. A search result is a
              place to choose what to open; the passport on the route itself is where the
              detail belongs (FR-74). Both start from `snapshotCautions`, so this can never
              look calmer than the route page it leads to. */}
          <RibbonTrust trust={route.trust} dictionary={t} />
          <FlyWindowNote window={route.flyWindow} dictionary={t} compact />
        </div>
      </Link>
    </li>
  )
}
