import type { AnnouncedChange, Disruption, ShadowComparison } from '@/domain/changes'
import { compareVersions, isDisruptionActive } from '@/domain/changes'
import type { ChangeSeverity, FieldApplicability, RouteChangeKind } from '@/domain/enums'
import type { RouteGraph } from '@/domain/graph/types'
import { prisma } from '@/server/db/client'
import { loadRouteGraph, loadRouteGraphAt } from '@/server/revisions/read'

/**
 * Reading changes, disruptions and the shadow comparison — Phase 10.
 *
 * **Takes no identity, exactly like the rest of the public read path.** Change history and
 * the shadow route are readable with no account (FR-01, FR-31, D-03) — a student deciding
 * whether to trust a route needs to see how much it moves *before* they sign in, not after.
 *
 * Everything follower-specific lives in `src/server/journeys/changes.ts` instead, where every
 * function is required to take a user id. The two files are on opposite sides of the same
 * line, and separate architecture tests hold each of them to its own rule.
 */

export interface ChangeView extends AnnouncedChange {
  readonly title: string
  readonly detail: string | null
  readonly stepLabel: string | null
  readonly authorHandle: string | null
}

export interface DisruptionView extends Disruption {
  readonly title: string
  readonly detail: string | null
  readonly resolvedNote: string | null
  readonly stepLabel: string | null
  readonly authorHandle: string | null
  readonly active: boolean
}

const CHANGE_SELECT = {
  id: true,
  kind: true,
  severity: true,
  title: true,
  detail: true,
  announcedAt: true,
  effectiveAt: true,
  stepId: true,
  fieldId: true,
  step: { select: { currentRevision: { select: { label: true } } } },
  field: { select: { currentRevision: { select: { applicability: true } } } },
  author: { select: { handle: true } },
} as const

/**
 * Every announced change on a route, newest first — FR-28, FR-31.
 *
 * The applicability of the changed field travels with the change, because it is what lets the
 * reader be told the scope is narrow without the platform pretending to know whether it
 * applies to them (FR-81, §13.3).
 */
export async function changesForRoute(routeId: string, limit = 50): Promise<readonly ChangeView[]> {
  const rows = await prisma.routeChange.findMany({
    where: { routeId },
    select: CHANGE_SELECT,
    orderBy: [{ announcedAt: 'desc' }, { id: 'desc' }],
    take: limit,
  })

  return rows.map(toChangeView)
}

function toChangeView(row: {
  id: string
  kind: RouteChangeKind
  severity: ChangeSeverity
  title: string
  detail: string | null
  announcedAt: Date
  effectiveAt: Date | null
  stepId: string | null
  fieldId: string | null
  step: { currentRevision: { label: string } | null } | null
  field: { currentRevision: { applicability: FieldApplicability[] } | null } | null
  author: { handle: string } | null
}): ChangeView {
  return {
    id: row.id,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    detail: row.detail,
    announcedAt: row.announcedAt,
    effectiveAt: row.effectiveAt,
    stepId: row.stepId,
    fieldId: row.fieldId,
    applicability: row.field?.currentRevision?.applicability ?? [],
    stepLabel: row.step?.currentRevision?.label ?? null,
    authorHandle: row.author?.handle ?? null,
  }
}

const DISRUPTION_SELECT = {
  id: true,
  severity: true,
  title: true,
  detail: true,
  startsAt: true,
  endsAt: true,
  resolvedAt: true,
  resolvedNote: true,
  locationScope: true,
  stepId: true,
  step: { select: { currentRevision: { select: { label: true } } } },
  author: { select: { handle: true } },
} as const

/**
 * Disruptions on a route — FR-32, FR-63, §41.5.
 *
 * `activeOnly` is filtered **in the database, against `now`**, using the same comparison
 * `isDisruptionActive` makes in the domain. There is no status column to read, so a disruption
 * cannot be left showing after its window because a job failed to run — expiry is not an
 * event that can be missed (BR-08, invariant 19).
 *
 * With `activeOnly` false this returns the lot, expired ones included, because "what was
 * disrupted last September" is exactly what a student planning this September wants.
 */
export async function disruptionsForRoute(
  routeId: string,
  { activeOnly = false, now = new Date() }: { activeOnly?: boolean; now?: Date } = {},
): Promise<readonly DisruptionView[]> {
  const rows = await prisma.temporaryDisruption.findMany({
    where: {
      routeId,
      ...(activeOnly
        ? {
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
            AND: [{ OR: [{ resolvedAt: null }, { resolvedAt: { gt: now } }] }],
          }
        : {}),
    },
    select: DISRUPTION_SELECT,
    orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
  })

  return rows.map((row) => {
    const disruption: Disruption = {
      id: row.id,
      severity: row.severity,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      resolvedAt: row.resolvedAt,
      locationScope: row.locationScope,
      stepId: row.stepId,
    }
    return {
      ...disruption,
      title: row.title,
      detail: row.detail,
      resolvedNote: row.resolvedNote,
      stepLabel: row.step?.currentRevision?.label ?? null,
      authorHandle: row.author?.handle ?? null,
      active: isDisruptionActive(disruption, now),
    }
  })
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The shadow comparison
   ══════════════════════════════════════════════════════════════════════════════════════════ */

export interface ShadowView {
  readonly since: Date
  readonly before: RouteGraph
  readonly after: RouteGraph
  readonly comparison: ShadowComparison
  /** Material field edits in the window. FR-77's "3 fields changed" — counted, never scored. */
  readonly fieldsChanged: number
  /** Whether anything at all moved. False means an honest "nothing has changed". */
  readonly anyChange: boolean
}

/**
 * The route as it was, the route as it is, and what moved between them — FR-22, FR-77, §14.
 *
 * Both sides are plain `RouteGraph`s, which matters more than it looks: they are the exact
 * shape the generic renderer already consumes, so the comparison view draws each with the
 * same `Road` component and the same layout pass as every other page. There is no comparison
 * renderer, and nothing here knows which route it is looking at (invariant 24).
 *
 * Field edits are counted separately from structural ones because they are a different kind
 * of news. §14.1's example summary — "2 steps added, 1 archived, 3 fields changed" — needs
 * both, and a route can change materially with no step moving at all.
 */
export async function shadowSince(routeId: string, since: Date): Promise<ShadowView> {
  const [before, after, fieldsChanged] = await Promise.all([
    loadRouteGraphAt(routeId, since),
    loadRouteGraph(routeId),
    // Revisions authored after the cut, on fields belonging to this route. The first revision
    // of a field is its creation, so this counts genuine edits plus genuine additions and
    // nothing else.
    prisma.fieldRevision.count({
      where: { createdAt: { gt: since }, field: { step: { routeId } } },
    }),
  ])

  const comparison = compareVersions(before, after)

  return {
    since,
    before,
    after,
    comparison,
    fieldsChanged,
    anyChange: comparison.structureChanged || fieldsChanged > 0,
  }
}

/**
 * When the route last moved in a way a comparison would show — the default "since" for a
 * reader who is not following and so has no start date of their own.
 *
 * Returns the second-newest distinct revision moment, so the default comparison shows the
 * most recent change rather than an empty diff against now. Null when the route has only ever
 * had one state, which renders as "nothing has changed yet" — an honest answer, and one a new
 * route should be giving (FR-74).
 */
export async function lastChangePoint(routeId: string): Promise<Date | null> {
  const [steps, edges, fields] = await Promise.all([
    prisma.stepRevision.findMany({
      where: { step: { routeId } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.stepEdgeRevision.findMany({
      where: { stepEdge: { routeId } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.fieldRevision.findMany({
      where: { field: { step: { routeId } } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const moments = [...steps, ...edges, ...fields]
    .map((row) => row.createdAt.getTime())
    .sort((a, b) => b - a)

  // Distinct, because a single contribution writes several revisions in one transaction and
  // they share a timestamp closely enough to be one moment to a reader.
  const distinct = [...new Set(moments)]
  const previous = distinct[1]
  return previous === undefined ? null : new Date(previous)
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The comparison an announcement names explicitly — no dates anywhere
   ══════════════════════════════════════════════════════════════════════════════════════════ */

export interface FieldValueChange {
  readonly fieldId: string
  readonly revisionId: string
  readonly before: string | null
  readonly after: string
}

export interface ChangeShadow {
  readonly changeId: string
  readonly before: RouteGraph
  readonly after: RouteGraph
  readonly comparison: ShadowComparison
  readonly fieldChanges: readonly FieldValueChange[]
  /** How many revisions the announcement names. Zero means it offers no precise comparison. */
  readonly namedRevisions: number
}

/**
 * The before/after an announcement points at — FR-22, FR-31, FR-77.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **This function contains no timestamp comparison, and that is the point.**
 *
 * `shadowSince` answers a temporal question — "what did this route look like on the day I
 * started following it?" — and a date is the right key for it. This answers a different one:
 * "what did *this change* do?" A date cannot key that reliably, because
 *
 *   - revisions written in one transaction share a `createdAt` to the millisecond, so a cut
 *     taken between two of them is arbitrary;
 *   - `previousRevisionId` is deliberately non-unique, so a chain forks and two revisions can
 *     both be "the newest" at a given moment (FR-70, invariant 15); and
 *   - announcements cluster, so two changes minutes apart describe edits made together.
 *
 * So the announcement names the revision rows, and this reads them.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **How the two sides are built.**
 *
 *   `after`   the current graph, with every named entity set to the content of the revision
 *             the announcement names.
 *   `before`  the same graph, with every named entity set to that revision's
 *             `previousRevisionId` — or removed entirely when there is no predecessor,
 *             which is how "this change added a step" reads.
 *
 * Note that `after` uses the *named* revision rather than today's current one. If somebody
 * revised the same step again afterwards, this still shows what this change did, which is
 * the question being asked. Both sides therefore come from immutable rows: the database
 * refuses UPDATE and DELETE on every revision table, so a comparison rendered today and the
 * same comparison rendered next year are the same comparison.
 *
 * Returns `null` when the change names nothing — an honest absence, not an invented diff.
 */
export async function shadowForChange(changeId: string): Promise<ChangeShadow | null> {
  const change = await prisma.routeChange.findUnique({
    where: { id: changeId },
    select: {
      id: true,
      routeId: true,
      revisions: {
        select: {
          stepRevision: {
            select: {
              id: true,
              stepId: true,
              label: true,
              category: true,
              earliestStartOffsetDays: true,
              typicalDurationDays: true,
              previous: {
                select: {
                  label: true,
                  category: true,
                  earliestStartOffsetDays: true,
                  typicalDurationDays: true,
                },
              },
            },
          },
          stepEdgeRevision: {
            select: {
              id: true,
              stepEdgeId: true,
              kind: true,
              previous: { select: { kind: true } },
            },
          },
          fieldRevision: {
            select: {
              id: true,
              fieldId: true,
              valueText: true,
              previous: { select: { valueText: true } },
            },
          },
          routeRevisionId: true,
        },
      },
    },
  })
  if (change === null) return null

  const named = change.revisions
  if (named.length === 0) return null

  const current = await loadRouteGraph(change.routeId, { includeArchived: true })

  const stepsById = new Map(current.steps.map((step) => [step.id, step]))
  const edgesById = new Map(current.edges.map((edge) => [edge.id, edge]))

  const afterSteps = new Map(stepsById)
  const beforeSteps = new Map(stepsById)
  const afterEdges = new Map(edgesById)
  const beforeEdges = new Map(edgesById)
  const fieldChanges: FieldValueChange[] = []

  for (const link of named) {
    const stepRevision = link.stepRevision
    if (stepRevision !== null) {
      const base = stepsById.get(stepRevision.stepId)
      if (base !== undefined) {
        afterSteps.set(stepRevision.stepId, {
          ...base,
          label: stepRevision.label,
          category: stepRevision.category,
          earliestStartOffsetDays: stepRevision.earliestStartOffsetDays,
          typicalDurationDays: stepRevision.typicalDurationDays,
          archived: false,
        })

        const was = stepRevision.previous
        if (was === null) {
          // No predecessor: the step did not exist before this change.
          beforeSteps.delete(stepRevision.stepId)
        } else {
          beforeSteps.set(stepRevision.stepId, {
            ...base,
            label: was.label,
            category: was.category,
            earliestStartOffsetDays: was.earliestStartOffsetDays,
            typicalDurationDays: was.typicalDurationDays,
            archived: false,
          })
        }
      }
    }

    const edgeRevision = link.stepEdgeRevision
    if (edgeRevision !== null) {
      const base = edgesById.get(edgeRevision.stepEdgeId)
      if (base !== undefined) {
        afterEdges.set(edgeRevision.stepEdgeId, {
          ...base,
          kind: edgeRevision.kind,
          archived: false,
        })
        const was = edgeRevision.previous
        if (was === null) beforeEdges.delete(edgeRevision.stepEdgeId)
        else beforeEdges.set(edgeRevision.stepEdgeId, { ...base, kind: was.kind, archived: false })
      }
    }

    const fieldRevision = link.fieldRevision
    if (fieldRevision !== null) {
      fieldChanges.push({
        fieldId: fieldRevision.fieldId,
        revisionId: fieldRevision.id,
        before: fieldRevision.previous?.valueText ?? null,
        after: fieldRevision.valueText,
      })
    }
  }

  // An edge whose endpoints did not both exist yet cannot be drawn, and leaving it would hand
  // the layout pass a connector to nowhere.
  const beforeStepIds = new Set(beforeSteps.keys())
  const before: RouteGraph = {
    steps: [...beforeSteps.values()],
    edges: [...beforeEdges.values()].filter(
      (edge) => beforeStepIds.has(edge.fromStepId) && beforeStepIds.has(edge.toStepId),
    ),
  }
  const afterStepIds = new Set(afterSteps.keys())
  const after: RouteGraph = {
    steps: [...afterSteps.values()],
    edges: [...afterEdges.values()].filter(
      (edge) => afterStepIds.has(edge.fromStepId) && afterStepIds.has(edge.toStepId),
    ),
  }

  return {
    changeId: change.id,
    before,
    after,
    comparison: compareVersions(before, after),
    fieldChanges,
    namedRevisions: named.length,
  }
}

/** What kind of revision a picker entry points at. Prefixes the form value, e.g. `step:abc`. */
export const REVISION_REF_KINDS = ['step', 'edge', 'field', 'route'] as const
export type RevisionRefKind = (typeof REVISION_REF_KINDS)[number]

export interface RevisionOption {
  readonly kind: RevisionRefKind
  readonly revisionId: string
  /** What a contributor needs to recognise the edit: what changed, and when. */
  readonly label: string
  readonly createdAt: Date
  readonly authorHandle: string | null
}

/**
 * Recent edits on a route, so a contributor can say which one they are announcing.
 *
 * This is what makes the explicit link a real product feature rather than a schema
 * capability nothing populates. The alternative — quietly attaching whichever revision is
 * newest — would look like the same thing and be a guess, which is exactly what the link
 * exists to stop.
 *
 * Ordered newest first with a deterministic tie-break, for the same reason as everywhere
 * else here: revisions written together share a timestamp.
 */
export async function recentRevisionsForRoute(
  routeId: string,
  limit = 20,
): Promise<readonly RevisionOption[]> {
  const order = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]

  const [steps, edges, fields] = await Promise.all([
    prisma.stepRevision.findMany({
      where: { step: { routeId } },
      select: { id: true, label: true, createdAt: true, author: { select: { handle: true } } },
      orderBy: order,
      take: limit,
    }),
    prisma.stepEdgeRevision.findMany({
      where: { stepEdge: { routeId } },
      select: { id: true, kind: true, createdAt: true, author: { select: { handle: true } } },
      orderBy: order,
      take: limit,
    }),
    prisma.fieldRevision.findMany({
      where: { field: { step: { routeId } } },
      select: {
        id: true,
        valueText: true,
        createdAt: true,
        author: { select: { handle: true } },
        field: { select: { step: { select: { currentRevision: { select: { label: true } } } } } },
      },
      orderBy: order,
      take: limit,
    }),
  ])

  const excerpt = (text: string): string =>
    text.length <= 60 ? text : `${text.slice(0, 57)}…`

  const options: RevisionOption[] = [
    ...steps.map((row) => ({
      kind: 'step' as const,
      revisionId: row.id,
      label: row.label,
      createdAt: row.createdAt,
      authorHandle: row.author?.handle ?? null,
    })),
    ...edges.map((row) => ({
      kind: 'edge' as const,
      revisionId: row.id,
      label: row.kind,
      createdAt: row.createdAt,
      authorHandle: row.author?.handle ?? null,
    })),
    ...fields.map((row) => ({
      kind: 'field' as const,
      revisionId: row.id,
      label: `${row.field.step.currentRevision?.label ?? ''} — ${excerpt(row.valueText)}`,
      createdAt: row.createdAt,
      authorHandle: row.author?.handle ?? null,
    })),
  ]

  return options
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.revisionId.localeCompare(a.revisionId))
    .slice(0, limit)
}
