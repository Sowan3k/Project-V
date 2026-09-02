import { StepCategory, StepEdgeKind } from '@/domain/enums'
import type { RouteGraph } from '@/domain/graph/types'
import { prisma } from '@/server/db/client'

/**
 * Reading revisioned knowledge.
 *
 * Reads are unrestricted — anonymous visitors see everything (FR-01, D-03) — but they live
 * beside the write service because both need the Prisma client, and only `src/server/**`
 * may import it.
 */

export interface RevisionSummary {
  readonly id: string
  readonly authorId: string | null
  readonly reason: string | null
  readonly previousRevisionId: string | null
  readonly createdAt: Date
  readonly value: string
}

export interface FieldHistory {
  readonly fieldId: string
  readonly archived: boolean
  readonly currentRevisionId: string | null
  /** Oldest first. Ordered by creation, with id as a deterministic tiebreak. */
  readonly revisions: readonly RevisionSummary[]
  /**
   * True when two or more revisions share a parent — a genuine concurrent edit that the
   * community has not yet resolved. Shown, never auto-resolved (FR-70, invariant 15).
   */
  readonly contested: boolean
  /** The competing revisions, when contested. */
  readonly forks: readonly (readonly RevisionSummary[])[]
}

/**
 * Every revision a field has ever had, archived or not.
 *
 * Archived content stays queryable here — that is the whole difference between archived and
 * deleted (FR-45, BR-15, invariant 4).
 */
export async function fieldHistory(fieldId: string): Promise<FieldHistory> {
  const field = await prisma.field.findUniqueOrThrow({
    where: { id: fieldId },
    select: {
      id: true,
      archivedAt: true,
      currentRevisionId: true,
      revisions: {
        // Deterministic order under concurrency: two revisions can share a timestamp, so id
        // breaks the tie rather than leaving the order to the database's whim.
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          authorId: true,
          reason: true,
          previousRevisionId: true,
          createdAt: true,
          valueText: true,
        },
      },
    },
  })

  const revisions = field.revisions.map((r) => ({
    id: r.id,
    authorId: r.authorId,
    reason: r.reason,
    previousRevisionId: r.previousRevisionId,
    createdAt: r.createdAt,
    value: r.valueText,
  }))

  const byParent = new Map<string, RevisionSummary[]>()
  for (const revision of revisions) {
    if (revision.previousRevisionId === null) continue
    const siblings = byParent.get(revision.previousRevisionId) ?? []
    siblings.push(revision)
    byParent.set(revision.previousRevisionId, siblings)
  }
  const forks = [...byParent.values()].filter((group) => group.length > 1)

  return {
    fieldId: field.id,
    archived: field.archivedAt !== null,
    currentRevisionId: field.currentRevisionId,
    revisions,
    contested: forks.length > 0,
    forks,
  }
}

/**
 * Loads a route as the graph shape the domain functions consume.
 *
 * `includeArchived` is what makes history views possible: the same route, read twice, once
 * as it currently stands and once with everything that was ever archived.
 */
export async function loadRouteGraph(
  routeId: string,
  options: { readonly includeArchived?: boolean } = {},
): Promise<RouteGraph> {
  const includeArchived = options.includeArchived ?? false

  const [steps, edges] = await Promise.all([
    prisma.step.findMany({
      where: { routeId, ...(includeArchived ? {} : { archivedAt: null }) },
      include: { currentRevision: true },
      orderBy: { id: 'asc' },
    }),
    prisma.stepEdge.findMany({
      where: { routeId, ...(includeArchived ? {} : { archivedAt: null }) },
      include: { currentRevision: true },
      orderBy: { id: 'asc' },
    }),
  ])

  return {
    steps: steps.map((s) => ({
      id: s.id,
      label: s.currentRevision?.label ?? '',
      category: s.currentRevision?.category ?? StepCategory.documents_preparation,
      archived: s.archivedAt !== null,
      earliestStartOffsetDays: s.currentRevision?.earliestStartOffsetDays ?? null,
      typicalDurationDays: s.currentRevision?.typicalDurationDays ?? null,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      fromStepId: e.fromStepId,
      toStepId: e.toStepId,
      kind: e.currentRevision?.kind ?? StepEdgeKind.sequential,
      archived: e.archivedAt !== null,
    })),
  }
}
