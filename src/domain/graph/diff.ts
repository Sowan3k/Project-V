import { StepEdgeKind } from '@/domain/enums'

import { stepOrder } from './order'
import { activeGraph } from './validate'
import type { RouteGraph } from './types'

/**
 * Structural diff between two versions of a route — Phase 3.
 *
 * It has to name what changed in the route's *shape*, not just count field edits. A diff
 * that could only say "3 fields changed" cannot power a shadow route, which must answer
 * what changed, where, how much, and whether it affects this follower (FR-77, CLAUDE.md §7).
 *
 * Proved viable in Phase 1, Spike B; this is the production form, working on the same graph
 * shape the validators and renderer use.
 */

export interface EdgeSummary {
  readonly id: string
  readonly fromStepId: string
  readonly toStepId: string
  readonly kind: string
}

export interface RouteDiff {
  readonly stepsAdded: readonly string[]
  readonly stepsArchived: readonly string[]
  /** Steps present in both versions whose position in the order moved. */
  readonly stepsReordered: readonly string[]
  readonly stepsRelabelled: readonly string[]
  readonly edgesAdded: readonly EdgeSummary[]
  readonly edgesArchived: readonly EdgeSummary[]
  readonly edgesRetyped: readonly { id: string; from: string; to: string }[]
  /** True when the route's shape changed, not merely its wording. */
  readonly structureChanged: boolean
  /** How many changed connections are branch-forming rather than plain sequence. */
  readonly branchConnectionsChanged: number
  /** Plain-language summary in the shape the shadow route needs. */
  readonly summary: string
}

const plural = (n: number): string => (n === 1 ? '' : 's')

export function diffRouteGraphs(before: RouteGraph, after: RouteGraph): RouteDiff {
  const a = activeGraph(before)
  const b = activeGraph(after)

  const beforeSteps = new Map(a.steps.map((s) => [s.id, s]))
  const afterSteps = new Map(b.steps.map((s) => [s.id, s]))

  const stepsAdded = [...afterSteps.keys()].filter((id) => !beforeSteps.has(id)).sort()
  const stepsArchived = [...beforeSteps.keys()].filter((id) => !afterSteps.has(id)).sort()

  const survivors = [...beforeSteps.keys()].filter((id) => afterSteps.has(id))
  const stepsRelabelled = survivors
    .filter((id) => beforeSteps.get(id)?.label !== afterSteps.get(id)?.label)
    .sort()

  // Reordering compares only steps present in both. Comparing raw positions would report
  // every step after an insertion as "moved", which is noise rather than news.
  const beforeOrder = stepOrder(before).filter((id) => survivors.includes(id))
  const afterOrder = stepOrder(after).filter((id) => survivors.includes(id))
  const stepsReordered = survivors
    .filter((id) => beforeOrder.indexOf(id) !== afterOrder.indexOf(id))
    .sort()

  const beforeEdges = new Map(a.edges.map((e) => [e.id, e]))
  const afterEdges = new Map(b.edges.map((e) => [e.id, e]))
  const summarise = (e: { id: string; fromStepId: string; toStepId: string; kind: string }): EdgeSummary => ({
    id: e.id,
    fromStepId: e.fromStepId,
    toStepId: e.toStepId,
    kind: e.kind,
  })

  const edgesAdded = [...afterEdges.values()].filter((e) => !beforeEdges.has(e.id)).map(summarise)
  const edgesArchived = [...beforeEdges.values()].filter((e) => !afterEdges.has(e.id)).map(summarise)
  const edgesRetyped = [...afterEdges.values()]
    .filter((e) => {
      const was = beforeEdges.get(e.id)
      return was !== undefined && was.kind !== e.kind
    })
    .map((e) => ({ id: e.id, from: e.fromStepId, to: e.toStepId }))

  const changedEdges = [...edgesAdded, ...edgesArchived]
  const branchConnectionsChanged =
    changedEdges.filter((e) => e.kind !== StepEdgeKind.sequential).length + edgesRetyped.length

  const structureChanged =
    stepsAdded.length > 0 ||
    stepsArchived.length > 0 ||
    stepsReordered.length > 0 ||
    edgesAdded.length > 0 ||
    edgesArchived.length > 0 ||
    edgesRetyped.length > 0

  const parts: string[] = []
  if (stepsAdded.length) parts.push(`${stepsAdded.length} step${plural(stepsAdded.length)} added`)
  if (stepsArchived.length) parts.push(`${stepsArchived.length} step${plural(stepsArchived.length)} archived`)
  if (stepsReordered.length) parts.push(`${stepsReordered.length} step${plural(stepsReordered.length)} reordered`)
  if (stepsRelabelled.length) parts.push(`${stepsRelabelled.length} step${plural(stepsRelabelled.length)} renamed`)
  if (branchConnectionsChanged > 0) {
    parts.push(
      `route structure changed (${branchConnectionsChanged} branch connection${plural(branchConnectionsChanged)})`,
    )
  } else if (edgesAdded.length || edgesArchived.length) {
    parts.push('route structure changed')
  }

  return {
    stepsAdded,
    stepsArchived,
    stepsReordered,
    stepsRelabelled,
    edgesAdded,
    edgesArchived,
    edgesRetyped,
    structureChanged,
    branchConnectionsChanged,
    summary: parts.length > 0 ? parts.join(', ') : 'no change',
  }
}
