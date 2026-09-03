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

/** Changes announced strictly after a moment — the "since you started following" query. */
export async function changesSince(routeId: string, since: Date): Promise<readonly ChangeView[]> {
  const rows = await prisma.routeChange.findMany({
    where: { routeId, announcedAt: { gt: since } },
    select: CHANGE_SELECT,
    orderBy: [{ announcedAt: 'desc' }, { id: 'desc' }],
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
