import type { StepCategory, StepEdgeKind } from '@/domain/enums'

/**
 * The shape the graph functions operate on.
 *
 * Deliberately a plain structure rather than Prisma types: validation and ordering are pure
 * domain logic, must be testable without a database, and must be usable by the renderer,
 * which may not import persistence concerns (CLAUDE.md invariant 24).
 *
 * Note what is absent: there is no index, position or order field anywhere. Ordering is
 * derived from edges, every time (invariant 22).
 */

export interface GraphStep {
  readonly id: string
  readonly label: string
  readonly category: StepCategory
  readonly archived: boolean
  /** Days after the route's notional start before this step can begin (§20.3). */
  readonly earliestStartOffsetDays: number | null
  /** Typical elapsed days. With the offset, this is what expresses overlap (§20.2). */
  readonly typicalDurationDays: number | null
}

export interface GraphEdge {
  readonly id: string
  readonly fromStepId: string
  readonly toStepId: string
  readonly kind: StepEdgeKind
  readonly archived: boolean
}

export interface RouteGraph {
  readonly steps: readonly GraphStep[]
  readonly edges: readonly GraphEdge[]
}
