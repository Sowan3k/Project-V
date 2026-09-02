import { buildTimeline } from './graph/order'
import type { RouteGraph } from './graph/types'

/**
 * Expected fly window — FR-56, REQUIREMENTS.md §20.1.
 *
 * "The route should normally display a window such as 'Expected fly: August–October 2027'
 * rather than a precise guaranteed date."
 *
 * Two things this must never do, and the shape of the result is designed to make both hard:
 *
 *   - It must never produce a single date. The return type is a *range* of months, so there
 *     is no field a UI could accidentally render as a promise (invariant 16, BR-18, D-30).
 *   - It must never claim confidence it does not have. When a route has no timing at all,
 *     this returns `null` rather than a guess, and the caller shows nothing rather than
 *     something reassuring and invented.
 *
 * The width of the window is deliberate slack, not a calculation: real journeys slip on
 * appointments, processing queues and university replies that nobody controls.
 */

/** How much later than the modelled duration a realistic journey can run. */
const SLACK_RATIO = 0.25
/** Minimum window width, so even a short route reads as a period rather than a date. */
const MIN_WINDOW_MONTHS = 2

export interface FlyWindow {
  /** Inclusive first month of the window. */
  readonly from: { readonly year: number; readonly month: number }
  /** Inclusive last month. Always at least MIN_WINDOW_MONTHS after `from`. */
  readonly to: { readonly year: number; readonly month: number }
  /** The modelled span the window was derived from. */
  readonly estimatedDays: number
  /**
   * True when the route's timing is partial — some steps carry no duration. The window is
   * then a floor, not an estimate, and the UI must say so.
   */
  readonly partialTiming: boolean
}

function addMonths(from: Date, months: number): { year: number; month: number } {
  const d = new Date(from.getFullYear(), from.getMonth() + months, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

/**
 * Derives a departure window from the route's own timing.
 *
 * Returns null when the route carries no duration information at all — an honest absence is
 * better than a fabricated window, and a route with no timing is exactly the kind of new
 * route that must not look as complete as an established one (FR-74).
 */
export function expectedFlyWindow(graph: RouteGraph, startingFrom: Date = new Date()): FlyWindow | null {
  const timeline = buildTimeline(graph)
  if (timeline.totalDays <= 0) return null

  const timedSteps = graph.steps.filter((s) => !s.archived && s.typicalDurationDays !== null)
  const activeSteps = graph.steps.filter((s) => !s.archived)
  const partialTiming = timedSteps.length < activeSteps.length

  const estimatedDays = timeline.totalDays
  const earliestMonths = Math.floor(estimatedDays / 30)
  const latestMonths = Math.max(
    earliestMonths + MIN_WINDOW_MONTHS,
    Math.ceil((estimatedDays * (1 + SLACK_RATIO)) / 30),
  )

  return {
    from: addMonths(startingFrom, earliestMonths),
    to: addMonths(startingFrom, latestMonths),
    estimatedDays,
    partialTiming,
  }
}

/**
 * Total modelled duration, in days, accounting for overlap.
 *
 * Not the sum of every step: two steps that run concurrently take as long as the longer one,
 * and summing them would inflate every route (§20.2).
 */
export function estimatedDurationDays(graph: RouteGraph): number | null {
  const timeline = buildTimeline(graph)
  return timeline.totalDays > 0 ? timeline.totalDays : null
}
