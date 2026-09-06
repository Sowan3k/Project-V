import type { Dictionary } from '@/i18n/dictionaries/en'
import { ResponsiveRoad, type RouteVisualProps } from '@/renderer'
import type { RouteSummary } from '@/server/routes/read'

import { rendererStrings } from './route-shared'

/**
 * The route's wayfinding frame. Place names belong in the page, while the renderer only
 * receives a graph and presentation annotations (invariants 24 and 25). The departure
 * estimate already lives in RouteContext; this frame does not calculate a second timeline.
 */
export function RouteMap({
  route,
  dictionary: t,
  selectedStepId,
  stepHrefs,
  annotations,
  privateJourney = false,
}: {
  route: Pick<RouteSummary, 'graph' | 'originCountry' | 'destinationCountry'>
  dictionary: Dictionary
  selectedStepId?: string
  stepHrefs?: Readonly<Record<string, string>>
  annotations?: RouteVisualProps['annotations']
  privateJourney?: boolean
}) {
  return (
    <div id="route-map" className="scroll-mt-6 rounded-panel border border-hairline bg-surface">
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-micro text-ink-500">{t.route.start}</p>
          <p className="text-panel font-semibold text-ink-900">{route.originCountry}</p>
        </div>
        <div className="flex min-w-6 flex-1 items-center" aria-hidden="true">
          <span className="h-2 w-2 shrink-0 rounded-full border-2 border-brand-700" />
          <span className="h-px flex-1 bg-hairline" />
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" className="shrink-0 text-brand-700">
            <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-micro text-ink-500">{t.route.destination}</p>
          <p className="text-panel font-semibold text-ink-900">{route.destinationCountry}</p>
        </div>
      </div>

      <p className="px-4 pt-4 text-meta leading-6 text-ink-500 sm:px-5">
        {privateJourney ? t.journey.mapGuide : t.route.mapGuide}
      </p>
      {/* The map owns its overflow; a long/branching route never widens the page. */}
      <div className="overflow-x-auto px-2 pb-3 pt-1 sm:px-4">
        <ResponsiveRoad
          graph={route.graph}
          strings={rendererStrings(t)}
          selectedStepId={selectedStepId}
          stepHrefs={stepHrefs}
          annotations={annotations}
        />
      </div>
    </div>
  )
}
