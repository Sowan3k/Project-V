import { activeGraph } from './validate'
import type { GraphStep, RouteGraph } from './types'

/**
 * Ordering and timeline — Phase 2.
 *
 * Ordering is DERIVED from edges on every read. Nothing is stored, so nothing can drift out
 * of step with the graph, and there is no index column for a later refactor to start
 * trusting (CLAUDE.md invariant 22).
 *
 * The timeline exists so overlap survives into the visual. Summing every duration into a
 * straight line would misrepresent a journey where language preparation runs alongside
 * document collection (§20.2) — so concurrent steps get parallel lanes.
 */

export interface RankedStep {
  readonly step: GraphStep
  /** Longest path from a start step. Equal rank means structurally concurrent. */
  readonly rank: number
}

/**
 * Longest-path rank over the active graph.
 *
 * Longest path rather than shortest, so a step that a branch must reconverge into lands
 * after every path that reaches it rather than beside the earliest one.
 */
export function rankSteps(graph: RouteGraph): readonly RankedStep[] {
  const { steps, edges } = activeGraph(graph)
  const incoming = new Map<string, string[]>(steps.map((s) => [s.id, []]))
  for (const edge of edges) incoming.get(edge.toStepId)?.push(edge.fromStepId)

  const ranks = new Map<string, number>()
  const resolving = new Set<string>()

  const resolve = (id: string): number => {
    const known = ranks.get(id)
    if (known !== undefined) return known
    // Guard rather than trust: a cycle is a validation error, but ordering must not hang if
    // it is ever called on an unvalidated graph.
    if (resolving.has(id)) return 0
    resolving.add(id)
    const parents = incoming.get(id) ?? []
    const value = parents.length === 0 ? 0 : Math.max(...parents.map(resolve)) + 1
    resolving.delete(id)
    ranks.set(id, value)
    return value
  }

  return steps
    .map((step) => ({ step, rank: resolve(step.id) }))
    .sort((a, b) => a.rank - b.rank || a.step.id.localeCompare(b.step.id))
}

/** Step ids in canonical order. Ties broken by id so the result is deterministic. */
export function stepOrder(graph: RouteGraph): readonly string[] {
  return rankSteps(graph).map((r) => r.step.id)
}

export interface TimelineEntry {
  readonly stepId: string
  readonly rank: number
  readonly startDay: number
  readonly endDay: number
  /**
   * Lane index. Steps whose day windows overlap get different lanes, so a timeline draws
   * them side by side rather than one after another.
   */
  readonly lane: number
}

export interface Timeline {
  readonly entries: readonly TimelineEntry[]
  readonly laneCount: number
  readonly totalDays: number
}

/**
 * Places steps on a day timeline and assigns lanes so overlapping work is visibly parallel.
 *
 * A step starts at its declared offset when it has one, and otherwise as soon as everything
 * feeding it has finished. That means an author who supplies no timing still gets a sensible
 * sequential timeline, while an author who says "this can start on day 0 and takes 90 days"
 * gets genuine overlap — without either needing a separate "is parallel" flag.
 */
export function buildTimeline(graph: RouteGraph): Timeline {
  const { edges } = activeGraph(graph)
  const ranked = rankSteps(graph)
  const incoming = new Map<string, string[]>(ranked.map((r) => [r.step.id, []]))
  for (const edge of edges) incoming.get(edge.toStepId)?.push(edge.fromStepId)

  const start = new Map<string, number>()
  const end = new Map<string, number>()

  for (const { step } of ranked) {
    const parents = incoming.get(step.id) ?? []
    const earliestByDependency =
      parents.length === 0 ? 0 : Math.max(...parents.map((p) => end.get(p) ?? 0))
    const startDay = step.earliestStartOffsetDays ?? earliestByDependency
    const duration = step.typicalDurationDays ?? 0
    start.set(step.id, startDay)
    end.set(step.id, startDay + duration)
  }

  // Lane assignment: greedily place each step in the lowest lane whose occupant has already
  // finished. Steps that genuinely overlap end up in different lanes; a purely sequential
  // route collapses to one.
  const laneEnds: number[] = []
  const byStart = [...ranked].sort((a, b) => {
    const sa = start.get(a.step.id) ?? 0
    const sb = start.get(b.step.id) ?? 0
    return sa - sb || a.rank - b.rank || a.step.id.localeCompare(b.step.id)
  })

  const lanes = new Map<string, number>()
  for (const { step } of byStart) {
    const s = start.get(step.id) ?? 0
    const e = end.get(step.id) ?? 0
    let lane = laneEnds.findIndex((occupiedUntil) => occupiedUntil <= s)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(e)
    } else {
      laneEnds[lane] = e
    }
    lanes.set(step.id, lane)
  }

  const entries = ranked.map((r) => ({
    stepId: r.step.id,
    rank: r.rank,
    startDay: start.get(r.step.id) ?? 0,
    endDay: end.get(r.step.id) ?? 0,
    lane: lanes.get(r.step.id) ?? 0,
  }))

  return {
    entries,
    laneCount: laneEnds.length,
    totalDays: Math.max(0, ...entries.map((e) => e.endDay)),
  }
}
