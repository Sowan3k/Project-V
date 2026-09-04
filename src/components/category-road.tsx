import { STEP_CATEGORIES, StepEdgeKind } from '@/domain/enums'
import type { RouteGraph } from '@/domain/graph/types'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { Road, ROAD_COMPACT } from '@/renderer'

import { rendererStrings } from './route-shared'

/**
 * The landing-page illustration — Phase 12D, VR-01.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What this is.** A road showing the six step categories in journey order, drawn by the
 * ordinary renderer from an ordinary graph. It exists because VR-01's defining element is an
 * illustrated road and the homepage had no visualisation at all.
 *
 * **What it is not, and why that mattered enough to change the design.** VR-01 draws a
 * Bangladesh → Germany road with named stages and durations. Reproducing that would mean
 * putting a plausible-looking route on the front page of a platform whose entire value rests
 * on a reader being able to tell a researched route from an invented one. Gate 2 requires
 * zero values traceable to the mockups; §45 names the cold start as a real risk and answers
 * it with honest emptiness rather than decoration. A visitor who cannot tell which routes are
 * real has been given nothing.
 *
 * So this draws the **categories** — which are real product vocabulary, not fabricated route
 * content — and the caption beside it says outright that it is not a route you can follow.
 *
 * **It is still not an exception to invariant 24.** There is no artwork here: the graph is
 * built from `STEP_CATEGORIES`, the labels come from the dictionary, and it goes through the
 * same `layout()` and the same primitives as every real route. If the renderer breaks, this
 * breaks with it — which is the right coupling, because a homepage illustration that kept
 * working while the product's roads did not would hide the failure.
 * ═════════════════════════════════════════════════════════════════════════════════════════
 */
export function CategoryRoad({ dictionary: t }: { dictionary: Dictionary }) {
  /**
   * One step per category, joined in order.
   *
   * Ids are stable strings rather than generated, so two renders produce identical geometry
   * and this cannot become a source of layout churn.
   */
  const graph: RouteGraph = {
    steps: STEP_CATEGORIES.map((category) => ({
      id: category,
      // The short name: the full one truncates to "Documents and pre…" on a step card, and a
      // label a reader cannot tell has been cut is worse than a short label. The renderer's
      // `<title>` still carries the full category name for assistive technology.
      label: t.stepCategoryShort[category],
      category,
      archived: false,
      earliestStartOffsetDays: null,
      // Deliberately null. A duration here would be a number a reader could take for a fact,
      // and this illustration has no route behind it to make it true (invariant 16).
      typicalDurationDays: null,
    })),
    edges: STEP_CATEGORIES.slice(1).map((category, index) => ({
      id: `${category}-edge`,
      fromStepId: STEP_CATEGORIES[index] ?? category,
      toStepId: category,
      kind: StepEdgeKind.sequential,
      archived: false,
    })),
  }

  return (
    <div className="overflow-x-auto">
      <Road graph={graph} strings={rendererStrings(t)} density={ROAD_COMPACT} />
    </div>
  )
}
