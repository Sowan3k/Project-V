/**
 * Spike A — route graph shape.
 *
 * Deliberately close to what Phase 2 will commit (Phases.md): steps are nodes and ordering
 * lives in typed **edges**, never in array position or a single `orderIndex`. If the spike
 * used an ordered array it would prove nothing, because the whole question is whether a
 * branching, overlapping graph can be drawn.
 *
 * THROWAWAY. Phase 2 owns the real schema; Phase 4 owns the real renderer.
 */

/** How one step leads to another (CLAUDE.md invariant 22, FR-57, D-37). */
export type EdgeKind =
  /** Ordinary progression. */
  | 'sequential'
  /** Reachable but skippable — the route still completes without it. */
  | 'optional_branch'
  /** Mutually exclusive with its siblings — IELTS *or* PTE, never both. */
  | 'alternative'
  /** Divergent paths reconverging on a shared downstream step. */
  | 'rejoin'

/** Presentation state of a step. Not lifecycle — that belongs to the route (FR-11). */
export type StepState = 'current' | 'archived' | 'added'

/**
 * Semantic category. Placeholder set: the real palette and labels are an open decision
 * (CLAUDE.md §11) and a spike must not settle them.
 */
export type StepCategory =
  | 'documents'
  | 'language'
  | 'admission'
  | 'funding'
  | 'immigration'
  | 'travel'

export interface StepNode {
  readonly id: string
  readonly label: string
  readonly category: StepCategory
  readonly state?: StepState
}

export interface StepEdge {
  readonly from: string
  readonly to: string
  readonly kind: EdgeKind
}

export interface RouteGraph {
  readonly id: string
  readonly title: string
  readonly destination: string
  readonly steps: readonly StepNode[]
  readonly edges: readonly StepEdge[]
  /** A prior version, used only to prove the shadow overlay draws. */
  readonly previous?: Omit<RouteGraph, 'previous'>
  /** Step ids carrying a time- and place-scoped disruption (FR-32, invariant 19). */
  readonly disruptedStepIds?: readonly string[]
}
