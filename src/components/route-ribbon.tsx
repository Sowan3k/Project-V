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
    <li className="rounded-xl border border-hairline bg-surface transition-shadow hover:shadow-sm">
      <Link href={`/${locale}/routes/${route.slug}`} className="block p-4 focus:outline-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-base font-semibold text-ink-900">{route.title}</h3>
          <p className="text-xs text-ink-500">
            {route.originCountry} → {route.destinationCountry} ·{' '}
            {t.studyLevel[route.studyLevel]} · {t.route.stepCount(route.stepCount)}
          </p>
        </div>

        {route.summary === null ? null : (
          <p className="mt-1 text-sm leading-6 text-ink-700">{route.summary}</p>
        )}

        <div className="mt-3 overflow-x-auto" aria-label={t.route.ribbonLabel}>
          <Ribbon graph={route.graph} strings={rendererStrings(t)} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
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
