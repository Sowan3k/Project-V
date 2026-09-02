import { StepEdgeKind } from '@/domain/enums'

import type { GraphEdge, GraphStep, RouteGraph } from './types'

/**
 * Graph validators — Phase 2.
 *
 * Postgres cannot express "this edge set forms a DAG", so these rules live here and are the
 * gate every write must pass. Phase 3 makes that gate the only door: no route handler, seed
 * script or UI writes edges without going through a service that validates first.
 *
 * They operate on the ACTIVE graph. Archived steps and edges are excluded, because archived
 * is not deleted (invariant 4) and history is allowed to contain shapes that current views
 * no longer show — a route that once had a cycle-free branch which was later archived must
 * still validate today.
 */

export type GraphViolationCode =
  | 'unknown_step'
  | 'self_loop'
  | 'duplicate_edge'
  | 'cycle'
  | 'orphan_step'
  | 'unreachable_step'
  | 'no_start'
  | 'dangling_rejoin'

export interface GraphViolation {
  readonly code: GraphViolationCode
  readonly message: string
  /** Step or edge ids the violation implicates, so a UI can point at them. */
  readonly subjects: readonly string[]
}

export class GraphValidationError extends Error {
  constructor(readonly violations: readonly GraphViolation[]) {
    super(`route graph is invalid: ${violations.map((v) => v.message).join('; ')}`)
    this.name = 'GraphValidationError'
  }
}

/** The active subgraph: archived nodes and edges, and edges touching archived nodes, drop out. */
export function activeGraph(graph: RouteGraph): {
  steps: readonly GraphStep[]
  edges: readonly GraphEdge[]
} {
  const steps = graph.steps.filter((s) => !s.archived)
  const live = new Set(steps.map((s) => s.id))
  const edges = graph.edges.filter(
    (e) => !e.archived && live.has(e.fromStepId) && live.has(e.toStepId),
  )
  return { steps, edges }
}

export function validateGraph(graph: RouteGraph): readonly GraphViolation[] {
  const violations: GraphViolation[] = []
  const allStepIds = new Set(graph.steps.map((s) => s.id))

  // Referential integrity is checked across ALL edges, archived included: an edge pointing
  // at a step that does not exist is corruption, not history.
  for (const edge of graph.edges) {
    if (!allStepIds.has(edge.fromStepId) || !allStepIds.has(edge.toStepId)) {
      violations.push({
        code: 'unknown_step',
        message: `edge ${edge.id} references a step that does not exist`,
        subjects: [edge.id],
      })
    }
    if (edge.fromStepId === edge.toStepId) {
      violations.push({
        code: 'self_loop',
        message: `edge ${edge.id} connects step ${edge.fromStepId} to itself`,
        subjects: [edge.id, edge.fromStepId],
      })
    }
  }

  const { steps, edges } = activeGraph(graph)
  if (steps.length === 0) return violations

  // Duplicate ACTIVE edges. The schema has no unique constraint on (from, to) on purpose —
  // archiving a connection and later re-adding it is legitimate — so the rule is enforced
  // here, where it can be scoped to active edges only.
  const seen = new Map<string, string[]>()
  for (const edge of edges) {
    const key = `${edge.fromStepId}->${edge.toStepId}`
    const list = seen.get(key) ?? []
    list.push(edge.id)
    seen.set(key, list)
  }
  for (const [pair, ids] of seen) {
    if (ids.length > 1) {
      violations.push({
        code: 'duplicate_edge',
        message: `${ids.length} active edges duplicate the connection ${pair}`,
        subjects: ids,
      })
    }
  }

  const outgoing = new Map<string, GraphEdge[]>(steps.map((s) => [s.id, []]))
  const incoming = new Map<string, GraphEdge[]>(steps.map((s) => [s.id, []]))
  for (const edge of edges) {
    outgoing.get(edge.fromStepId)?.push(edge)
    incoming.get(edge.toStepId)?.push(edge)
  }

  // Acyclicity, by depth-first colouring.
  const colour = new Map<string, 'open' | 'closed'>()
  const cycles: string[] = []
  const walk = (id: string): void => {
    const state = colour.get(id)
    if (state === 'closed') return
    if (state === 'open') {
      cycles.push(id)
      return
    }
    colour.set(id, 'open')
    for (const edge of outgoing.get(id) ?? []) walk(edge.toStepId)
    colour.set(id, 'closed')
  }
  for (const step of steps) walk(step.id)
  if (cycles.length > 0) {
    violations.push({
      code: 'cycle',
      message: `the route loops back on itself through ${[...new Set(cycles)].join(', ')}`,
      subjects: [...new Set(cycles)],
    })
  }

  // Orphans: a multi-step route may not contain a step connected to nothing.
  if (steps.length > 1) {
    const orphans = steps
      .filter((s) => (outgoing.get(s.id)?.length ?? 0) === 0 && (incoming.get(s.id)?.length ?? 0) === 0)
      .map((s) => s.id)
    if (orphans.length > 0) {
      violations.push({
        code: 'orphan_step',
        message: `step(s) ${orphans.join(', ')} connect to nothing`,
        subjects: orphans,
      })
    }
  }

  const starts = steps.filter((s) => (incoming.get(s.id)?.length ?? 0) === 0)
  if (starts.length === 0) {
    violations.push({
      code: 'no_start',
      message: 'the route has no starting step',
      subjects: steps.map((s) => s.id),
    })
  }

  // Reachability — only meaningful if there is a start and no cycle to walk forever in.
  if (starts.length > 0 && cycles.length === 0) {
    const reached = new Set<string>()
    const queue = starts.map((s) => s.id)
    while (queue.length > 0) {
      const id = queue.shift()
      if (id === undefined || reached.has(id)) continue
      reached.add(id)
      for (const edge of outgoing.get(id) ?? []) queue.push(edge.toStepId)
    }
    const unreachable = steps.filter((s) => !reached.has(s.id)).map((s) => s.id)
    if (unreachable.length > 0) {
      violations.push({
        code: 'unreachable_step',
        message: `step(s) ${unreachable.join(', ')} cannot be reached from the start`,
        subjects: unreachable,
      })
    }
  }

  // A rejoin must actually rejoin: its target needs at least two distinct paths arriving,
  // otherwise the edge claims a branch reconverges where nothing diverged (§40.3).
  for (const edge of edges.filter((e) => e.kind === StepEdgeKind.rejoin)) {
    const arriving = incoming.get(edge.toStepId) ?? []
    const distinctSources = new Set(arriving.map((e) => e.fromStepId))
    if (distinctSources.size < 2) {
      violations.push({
        code: 'dangling_rejoin',
        message: `edge ${edge.id} is a rejoin into ${edge.toStepId}, but nothing diverged to rejoin`,
        subjects: [edge.id, edge.toStepId],
      })
    }
  }

  return violations
}

/** Throws unless the graph is valid. The form Phase 3's write service will call. */
export function assertValidGraph(graph: RouteGraph): void {
  const violations = validateGraph(graph)
  if (violations.length > 0) throw new GraphValidationError(violations)
}
