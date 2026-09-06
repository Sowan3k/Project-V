import { StepEdgeKind } from '@/domain/enums'

import type { GraphEdge, GraphStep, RouteGraph } from './types'

/**
 * Graph validators — Phase 2.
 *
 * Postgres cannot express "this edge set forms a DAG", so these rules live here.
 *
 * **Phase 12E note.** This file used to claim that Phase 3 made it "the gate every write must
 * pass" and "the only door". That was aspirational: nothing outside the tests ever called it,
 * and a structural write could produce a cycle unopposed. It did not bite, because the only
 * way to create an edge was "connect this new step after that existing one" — which cannot
 * form a cycle. Phase 12E lets a contributor connect two steps that already exist, and that
 * makes the gate load-bearing, so `assertNoGraphCorruption` is now called inside the revision
 * service's transaction on every structural write. See the note further down on why it is
 * corruption that is refused and incompleteness that is merely shown.
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

/** Throws unless the graph is valid in every respect. Used by tests and by seed tooling. */
export function assertValidGraph(graph: RouteGraph): void {
  const violations = validateGraph(graph)
  if (violations.length > 0) throw new GraphValidationError(violations)
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Corruption versus incompleteness — Phase 12E
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * **Not every violation means the same thing, and treating them alike would make the route
 * graph un-editable.**
 *
 * This distinction did not matter while the only way to create an edge was "connect this new
 * step after that existing one". Phase 12E lets a contributor connect two steps that already
 * exist, mark a branch optional or alternative, archive a connection and restore it — and at
 * that point the difference between "this graph is malformed" and "this road is not finished
 * yet" becomes the difference between a validator that protects the data and one that stops
 * people contributing.
 *
 * The test that separates them: **can a later ADDITION fix it, without touching what is
 * already there?**
 *
 *   No  → corruption. A cycle, a self-loop, a duplicated connection or an edge pointing at a
 *         step that does not exist are all wrong in a way nothing added later repairs. The
 *         offending edge itself has to go. These must never commit, because the renderer, the
 *         ordering pass and the shadow diff all assume a DAG — `rankSteps` and `buildTimeline`
 *         would not terminate sensibly on a cycle — and because an append-only ledger means a
 *         bad edge is archived rather than deleted, leaving the wrong shape in the history.
 *
 *   Yes → incompleteness. A step connected to nothing, a step unreachable from the start, a
 *         route with no starting step, and a `rejoin` edge into a step nothing else has
 *         diverged into — every one of these is repaired by adding the missing connection,
 *         and every one is the ordinary state of a road halfway through being built.
 *         Somebody adding three stages before wiring them together passes through all four.
 *
 * So corruption is refused at the write boundary and incompleteness is *shown to the
 * contributor*, which is the §7.3 treatment: a caution where a reader would otherwise draw a
 * wrong conclusion, never a silent block and never a silent pass. Blocking incompleteness
 * would force a contributor to build a road in one exact order, which is not how anybody
 * knows a route.
 */
export const CORRUPTING_VIOLATIONS = [
  'unknown_step',
  'self_loop',
  'duplicate_edge',
  'cycle',
] as const satisfies readonly GraphViolationCode[]

export const INCOMPLETENESS_VIOLATIONS = [
  'orphan_step',
  'unreachable_step',
  'no_start',
  'dangling_rejoin',
] as const satisfies readonly GraphViolationCode[]

export type CorruptingViolationCode = (typeof CORRUPTING_VIOLATIONS)[number]
export type IncompletenessViolationCode = (typeof INCOMPLETENESS_VIOLATIONS)[number]

export function isCorrupting(code: GraphViolationCode): code is CorruptingViolationCode {
  return (CORRUPTING_VIOLATIONS as readonly string[]).includes(code)
}

/** Only the violations that no later addition can repair. */
export function corruptingViolations(graph: RouteGraph): readonly GraphViolation[] {
  return validateGraph(graph).filter((violation) => isCorrupting(violation.code))
}

/** Only the violations a contributor fixes by connecting something. Shown, never enforced. */
export function incompletenessViolations(graph: RouteGraph): readonly GraphViolation[] {
  return validateGraph(graph).filter((violation) => !isCorrupting(violation.code))
}

/**
 * The gate every structural write passes — Phase 12E.
 *
 * Called inside the revision service's own transaction, against the graph *as it would be
 * after the write*, so a refusal rolls the write back. Validating the outcome rather than the
 * intent is what makes it complete: there is no combination of arguments that produces a
 * malformed graph without this seeing it.
 */
export function assertNoGraphCorruption(graph: RouteGraph): void {
  const violations = corruptingViolations(graph)
  if (violations.length > 0) throw new GraphValidationError(violations)
}
