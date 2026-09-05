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
    <li className="group rounded-panel border border-hairline bg-surface shadow-panel transition-shadow hover:shadow-raised">
      <Link href={`/${locale}/routes/${route.slug}`} className="block p-4 focus:outline-2 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-meta font-medium text-brand-700">
              {route.originCountry} → {route.destinationCountry} ·{' '}
              {t.studyLevel[route.studyLevel]} · {t.route.stepCount(route.stepCount)}
            </p>
            <h3 className="text-section font-semibold tracking-tight text-ink-900 group-hover:text-brand-700">{route.title}</h3>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-brand-700 group-hover:border-brand-500 group-hover:bg-brand-50" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </span>
        </div>

        {route.summary === null ? null : (
          <p className="mt-1 text-sm leading-6 text-ink-700">{route.summary}</p>
        )}

        <div className="my-4 overflow-x-auto" aria-label={t.route.ribbonLabel}>
          <Ribbon graph={route.graph} strings={rendererStrings(t)} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-3 text-xs">
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
