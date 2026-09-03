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

/**
 * The same route as it stood at a moment in the past — Phase 10. FR-22, FR-77, §14.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The shadow route is reconstructed, not stored.**
 *
 * There is no snapshot table and no version pointer on a journey, because Phase 3 already
 * bought the ability to answer this question: revisions are append-only, every one carries
 * `createdAt`, and nothing is ever overwritten or deleted. So "what did this route look like
 * on 10 August?" is a query, not a record — which means it can be asked of *any* date, stays
 * correct if a revision is added later, and cannot drift from the ledger the way a second
 * copy of the truth eventually does.
 *
 * Three rules, one per thing that can vary over time:
 *
 *   **Existence.** A step or edge is in the graph only if it had been created by then. Rows
 *   created afterwards did not exist and must not appear, or the older version would be shown
 *   containing steps that had not been invented yet.
 *
 *   **Archival.** `archivedAt` is a column rather than a revision, so archival is read the
 *   same way: archived *as of that date*, not archived now. A step archived last week was
 *   still live in a comparison drawn against a date before that.
 *
 *   **Content.** Label, category and timing come from the newest revision that existed by
 *   then — not from `currentRevision`, which is today's answer to a question about the past.
 *
 * Rows the caller has no business seeing are not a concern here: this is public revision
 * history, readable anonymously like the rest of the read path (FR-31, FR-45, invariant 4).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What this function is, and is not, the right tool for.**
 *
 * It answers a genuinely temporal question — "what did this route look like on the day I
 * started following it?" — where a date is the correct key and the only one available, since
 * a journey records when it began and not which revisions were current.
 *
 * It is **not** the way to find out what a particular change did. Timestamps tie, and
 * `previousRevisionId` is deliberately non-unique so a chain can fork, which means "the
 * revision current at time T" may have two correct answers. A change announcement therefore
 * names its revisions outright and `shadowForChange` reads those; see
 * `src/server/changes/read.ts`.
 */
export async function loadRouteGraphAt(routeId: string, at: Date): Promise<RouteGraph> {
  const [steps, edges] = await Promise.all([
    prisma.step.findMany({
      where: { routeId, createdAt: { lte: at } },
      select: {
        id: true,
        archivedAt: true,
        revisions: {
          where: { createdAt: { lte: at } },
          // Tie-broken by id, so the result is a total order rather than whichever row the
          // planner returned first. Revisions written in one transaction share a `createdAt`
          // to the millisecond; without a second key this query is non-deterministic in
          // exactly the case Phase 10 hit in CI (Test.md §18).
          //
          // The tie-break makes the answer *stable*, not *meaningful* — there is no sense in
          // which a larger cuid is "later". Where the answer has to be meaningful, an
          // announcement names the revision explicitly and `shadowForChange` reads that
          // instead of any date at all.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            label: true,
            category: true,
            earliestStartOffsetDays: true,
            typicalDurationDays: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    }),
    prisma.stepEdge.findMany({
      where: { routeId, createdAt: { lte: at } },
      select: {
        id: true,
        fromStepId: true,
        toStepId: true,
        archivedAt: true,
        revisions: {
          where: { createdAt: { lte: at } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { kind: true },
        },
      },
      orderBy: { id: 'asc' },
    }),
  ])

  const archivedBy = (archivedAt: Date | null): boolean =>
    archivedAt !== null && archivedAt.getTime() <= at.getTime()

  // A step whose every revision postdates `at` cannot be rendered — there is no label to draw
  // and no category to colour it by. That is a genuine "did not exist yet", so it is dropped
  // rather than shown blank, which would read as a step that had no name.
  const knownSteps = steps.filter((step) => step.revisions.length > 0)
  const known = new Set(knownSteps.map((step) => step.id))

  return {
    steps: knownSteps.map((step) => {
      const revision = step.revisions[0]
      return {
        id: step.id,
        label: revision?.label ?? '',
        category: revision?.category ?? StepCategory.documents_preparation,
        archived: archivedBy(step.archivedAt),
        earliestStartOffsetDays: revision?.earliestStartOffsetDays ?? null,
        typicalDurationDays: revision?.typicalDurationDays ?? null,
      }
    }),
    // An edge is only meaningful if both its ends existed then. Keeping a dangling edge would
    // hand the layout pass a connector to nowhere.
    edges: edges
      .filter((edge) => known.has(edge.fromStepId) && known.has(edge.toStepId))
      .map((edge) => ({
        id: edge.id,
        fromStepId: edge.fromStepId,
        toStepId: edge.toStepId,
        kind: edge.revisions[0]?.kind ?? StepEdgeKind.sequential,
        archived: archivedBy(edge.archivedAt),
      })),
  }
}
