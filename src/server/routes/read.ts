import type {
  ChallengeReason,
  FieldApplicability,
  FieldCategory,
  LinkTrustClass,
  RouteLifecycleState,
  RouteMechanism,
  SourceClass,
  StudyLevel,
} from '@/domain/enums'
import { SourceClass as Source, StepCategory, StepEdgeKind } from '@/domain/enums'
import { expectedFlyWindow, type FlyWindow } from '@/domain/fly-window'
import { SEARCHABLE_LIFECYCLE_STATES } from '@/domain/lifecycle'
import type { RouteGraph } from '@/domain/graph/types'
import {
  RECENT_ACTIVITY_WINDOW_DAYS,
  type RouteTrustInput,
  type RouteTrustSnapshot,
} from '@/domain/trust'
import { cache } from 'react'

import { prisma } from '@/server/db/client'

/**
 * The anonymous read path — Phase 5.
 *
 * Every function here is readable with no account. FR-01 and D-03: search, ribbons, roads,
 * steps, fields and history are all open. Nothing in this file takes a session, checks a
 * role, or has any parameter a caller could use to gate access — that is the simplest way to
 * guarantee an anonymous visitor is never blocked.
 *
 * Writes go through src/server/revisions. This file never mutates.
 */

export interface RouteSearchFilters {
  readonly originCountry?: string
  readonly destinationCountry?: string
  readonly studyLevel?: StudyLevel
  readonly intake?: string
  readonly mechanism?: RouteMechanism
}

export interface RouteSummary {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly summary: string | null
  readonly originCountry: string
  readonly destinationCountry: string
  readonly studyLevel: StudyLevel
  readonly intake: string | null
  readonly mechanism: RouteMechanism | null
  readonly lifecycleState: RouteLifecycleState
  readonly createdAt: Date
  /** The graph, so the ribbon draws from the same data the road will (invariant 25). */
  readonly graph: RouteGraph
  readonly stepCount: number
  readonly flyWindow: FlyWindow | null
  /**
   * What the ribbon may say about this route's standing — Phase 6.
   *
   * A strict subset of what the route page sees, so a ribbon can show fewer concerns than
   * the road but never a different set (`RouteTrustInput extends RouteTrustSnapshot`).
   */
  readonly trust: RouteTrustSnapshot
}

const toGraph = (
  steps: { id: string; archivedAt: Date | null; currentRevision: { label: string; category: string; earliestStartOffsetDays: number | null; typicalDurationDays: number | null } | null }[],
  edges: { id: string; fromStepId: string; toStepId: string; archivedAt: Date | null; currentRevision: { kind: string } | null }[],
): RouteGraph => ({
  steps: steps.map((s) => ({
    id: s.id,
    label: s.currentRevision?.label ?? '',
    category: (s.currentRevision?.category ?? StepCategory.documents_preparation) as RouteGraph['steps'][number]['category'],
    archived: s.archivedAt !== null,
    earliestStartOffsetDays: s.currentRevision?.earliestStartOffsetDays ?? null,
    typicalDurationDays: s.currentRevision?.typicalDurationDays ?? null,
  })),
  edges: edges.map((e) => ({
    id: e.id,
    fromStepId: e.fromStepId,
    toStepId: e.toStepId,
    kind: (e.currentRevision?.kind ?? StepEdgeKind.sequential) as RouteGraph['edges'][number]['kind'],
    archived: e.archivedAt !== null,
  })),
})

const ROUTE_INCLUDE = {
  currentRevision: true,
  steps: { where: { archivedAt: null }, include: { currentRevision: true }, orderBy: { id: 'asc' } },
  edges: { where: { archivedAt: null }, include: { currentRevision: true }, orderBy: { id: 'asc' } },
} as const

interface FieldStanding extends Omit<RouteTrustSnapshot, 'lifecycleState'> {
  readonly lastConfirmedAt: Date | null
}

/**
 * The field-derived half of a route's standing, for many routes at once — Phase 6.
 *
 * Two queries whatever the number of routes, rather than one per route: the fields
 * themselves, and a grouped scan for **forked revision history**. A fork — two revisions of
 * one field sharing a `previousRevisionId` — is a structural disagreement between two
 * contributors that Phase 3 deliberately preserves, and this is where it finally becomes
 * visible to a reader (invariant 15, FR-70).
 *
 * Counting a fork as disputed here, rather than only on the route page, is what keeps the
 * ribbon and the road from disagreeing about whether a route has contested information.
 */
async function fieldStandings(
  routeIds: readonly string[],
  now: Date,
): Promise<Map<string, FieldStanding>> {
  const byRoute = new Map<string, FieldStanding>()
  if (routeIds.length === 0) return byRoute

  const [fields, forkedGroups] = await Promise.all([
    prisma.field.findMany({
      where: { archivedAt: null, step: { routeId: { in: [...routeIds] } } },
      select: {
        id: true,
        lastConfirmedAt: true,
        reviewDueAt: true,
        step: { select: { routeId: true } },
        quarantinedAt: true,
        currentRevision: { select: { sourceClass: true, expiresAt: true } },
        _count: { select: { challenges: { where: { resolvedAt: null } } } },
      },
    }),
    prisma.fieldRevision.groupBy({
      by: ['fieldId', 'previousRevisionId'],
      where: {
        previousRevisionId: { not: null },
        field: { archivedAt: null, step: { routeId: { in: [...routeIds] } } },
      },
      _count: { _all: true },
      having: { previousRevisionId: { _count: { gt: 1 } } },
    }),
  ])

  const forkedFieldIds = new Set(forkedGroups.map((group) => group.fieldId))

  // Note what this map does NOT carry: `lifecycleState`. The stored state is the caller's,
  // and there is deliberately no placeholder here that a later edit could start deriving
  // from counts (invariant 14).
  for (const routeId of routeIds) {
    byRoute.set(routeId, {
      informationCount: 0,
      confirmedCount: 0,
      needsReviewCount: 0,
      disputedCount: 0,
      quarantinedCount: 0,
      lastConfirmedAt: null,
    })
  }

  for (const field of fields) {
    const routeId = field.step.routeId
    const current = byRoute.get(routeId)
    if (!current || field.currentRevision === null) continue

    const past = (date: Date | null): boolean => date !== null && date.getTime() <= now.getTime()
    const needsReview = past(field.reviewDueAt) || past(field.currentRevision.expiresAt)
    // Three independent ways a field counts as disputed, and a reader should see any of
    // them: somebody said so in the source class, two contributors disagreed structurally,
    // or somebody raised a challenge nobody has answered (FR-18, FR-49, FR-70).
    const disputed =
      field.currentRevision.sourceClass === Source.disputed_under_review ||
      forkedFieldIds.has(field.id) ||
      field._count.challenges > 0

    byRoute.set(routeId, {
      informationCount: current.informationCount + 1,
      confirmedCount: current.confirmedCount + (field.lastConfirmedAt === null ? 0 : 1),
      needsReviewCount: current.needsReviewCount + (needsReview ? 1 : 0),
      disputedCount: current.disputedCount + (disputed ? 1 : 0),
      quarantinedCount: current.quarantinedCount + (field.quarantinedAt === null ? 0 : 1),
      lastConfirmedAt: laterOf(current.lastConfirmedAt, field.lastConfirmedAt),
    })
  }

  return byRoute
}

function laterOf(a: Date | null, b: Date | null): Date | null {
  if (a === null) return b
  if (b === null) return a
  return a.getTime() >= b.getTime() ? a : b
}

/**
 * Route search — FR-01, FR-02, REQUIREMENTS.md §9.
 *
 * Deliberately few filters: "route discovery should start with a small number of
 * understandable filters" and must not "require a detailed student profile before showing
 * useful information."
 *
 * Removed and archived routes never appear. Everything else does, including experimental
 * ones — a new route is shown, honestly labelled, rather than hidden (FR-74).
 */
export async function searchRoutes(
  filters: RouteSearchFilters = {},
  now: Date = new Date(),
): Promise<readonly RouteSummary[]> {
  const routes = await prisma.route.findMany({
    where: {
      archivedAt: null,
      mergedIntoId: null,
      // Phase 11 — dormant, archived and removed routes leave the listing. None is deleted
      // and every one stays reachable at its own address with its history intact (§19,
      // FR-45, BR-15, invariant 4). `appearsInSearch` in src/domain/lifecycle.ts is the
      // single definition of which states those are.
      lifecycleState: { in: [...SEARCHABLE_LIFECYCLE_STATES] },
      ...(filters.originCountry ? { originCountry: filters.originCountry } : {}),
      ...(filters.destinationCountry ? { destinationCountry: filters.destinationCountry } : {}),
      ...(filters.studyLevel ? { studyLevel: filters.studyLevel } : {}),
      ...(filters.intake ? { intake: filters.intake } : {}),
      ...(filters.mechanism ? { mechanism: filters.mechanism } : {}),
    },
    include: ROUTE_INCLUDE,
    // Newest first, and nothing else. There is no relevance score, no boost and no sponsored
    // slot to insert one into — ordering that money could influence is exactly what
    // invariant 13 (FR-78, BR-13, BR-14) forbids.
    orderBy: [{ createdAt: 'desc' }],
  })

  const standings = await fieldStandings(routes.map((route) => route.id), now)

  return routes.map((route) => {
    const graph = toGraph(route.steps, route.edges)
    const standing = standings.get(route.id)
    return {
      id: route.id,
      slug: route.slug,
      title: route.currentRevision?.title ?? route.slug,
      summary: route.currentRevision?.summary ?? null,
      originCountry: route.originCountry,
      destinationCountry: route.destinationCountry,
      studyLevel: route.studyLevel,
      intake: route.intake,
      mechanism: route.mechanism,
      lifecycleState: route.lifecycleState,
      createdAt: route.createdAt,
      graph,
      stepCount: graph.steps.filter((s) => !s.archived).length,
      flyWindow: expectedFlyWindow(graph),
      trust: {
        lifecycleState: route.lifecycleState,
        informationCount: standing?.informationCount ?? 0,
        confirmedCount: standing?.confirmedCount ?? 0,
        needsReviewCount: standing?.needsReviewCount ?? 0,
        disputedCount: standing?.disputedCount ?? 0,
        quarantinedCount: standing?.quarantinedCount ?? 0,
      },
    }
  })
}

/** The distinct values actually present, so the search form offers only useful options. */
export async function availableFilters(): Promise<{
  origins: readonly string[]
  destinations: readonly string[]
  intakes: readonly string[]
}> {
  const routes = await prisma.route.findMany({
    where: {
      archivedAt: null,
      mergedIntoId: null,
      lifecycleState: { in: [...SEARCHABLE_LIFECYCLE_STATES] },
    },
    select: { originCountry: true, destinationCountry: true, intake: true },
  })

  return {
    origins: [...new Set(routes.map((r) => r.originCountry))].sort(),
    destinations: [...new Set(routes.map((r) => r.destinationCountry))].sort(),
    intakes: [...new Set(routes.map((r) => r.intake).filter((i): i is string => i !== null))].sort(),
  }
}

export interface FieldView {
  readonly id: string
  /**
   * What the contributor is correcting *from*.
   *
   * Carried into the update form and back, so that if somebody else revises the same field
   * while the form is open, both corrections land on the same parent and are preserved as a
   * fork rather than one silently overwriting the other (BR-21, FR-70, invariant 15).
   */
  readonly currentRevisionId: string | null
  readonly category: FieldCategory
  readonly valueText: string
  readonly valueAmount: string | null
  readonly valueCurrency: string | null
  readonly valueDate: Date | null
  readonly valueDurationDays: number | null
  /**
   * Where the value came from. Shown always, never inferred: an official requirement and a
   * community experience are different claim types and must not look alike (FR-54, BR-07,
   * invariant 11). The fuller trust surface — badges, freshness, dispute markers — is
   * Phase 6; this is the honest minimum without which the page would misrepresent its data.
   */
  readonly sourceClass: SourceClass
  /**
   * How widely this claim applies (FR-81). Empty means the contributor did not state it —
   * rendered as "scope not stated", never as "applies everywhere", because silence is not a
   * claim of universality.
   */
  readonly applicability: readonly FieldApplicability[]
  readonly sourceUrl: string | null
  readonly sourceNote: string | null
  readonly lastConfirmedAt: Date | null
  readonly revisionCount: number

  // ── Phase 6 trust inputs. Raw stored values only: nothing here is judged, scored or
  // thresholded in the read layer. `src/domain/trust.ts` turns these into signals, which is
  // what lets invariants 9-17 be tested without a database (FR-49, FR-52, FR-53, FR-70).
  /** A date a contributor stored, meaning "look at this again after". Never inferred. */
  readonly reviewDueAt: Date | null
  readonly effectiveFrom: Date | null
  readonly expiresAt: Date | null
  readonly lastRevisedAt: Date | null
  /**
   * Two revisions of this field share a `previousRevisionId`: two contributors corrected the
   * same starting value and Phase 3 kept both. Structural evidence of disagreement, not a
   * heuristic (invariant 15, FR-70, BR-21).
   */
  readonly hasForkedHistory: boolean
  /** Only meaningful for links. `null` means never classified — treated as unverified. */
  readonly linkTrustClass: LinkTrustClass | null

  // ── Phase 8 community signals ────────────────────────────────────────────────────────
  /** Distinct people who have vouched that this is still current (FR-17, FR-55). */
  readonly confirmationCount: number
  /** Challenges no revision has answered yet — FR-18, FR-49. */
  readonly openChallenges: readonly ChallengeView[]

  // ── Phase 9 safety ───────────────────────────────────────────────────────────────────
  /**
   * Quarantined by an administrator — FR-36, §23.2.
   *
   * When true, **`valueText` and `sourceUrl` have been withheld by this function**, not
   * merely flagged for a component to hide. A phishing URL that reaches the page has already
   * done most of its work: it is in the HTML, in the browser's history heuristics, and one
   * careless copy away from being followed. Withholding server-side is the difference between
   * containment and a `display: none`.
   *
   * Nothing is deleted. The real value is intact in the field's revisions and is returned by
   * the history view, which is what makes this reversible and reviewable (invariants 1, 4).
   */
  readonly quarantined: boolean
  /** Why it was withheld. Containment without explanation reads as censorship. */
  readonly quarantineNote: string | null
}

/** One unanswered challenge, as a reader sees it. */
export interface ChallengeView {
  readonly id: string
  readonly reason: ChallengeReason
  readonly note: string | null
  readonly authorHandle: string | null
  readonly createdAt: Date
}

export interface StepView {
  readonly id: string
  readonly label: string
  readonly category: string
  readonly earliestStartOffsetDays: number | null
  readonly typicalDurationDays: number | null
  readonly hardDeadline: Date | null
  readonly fieldCount: number
}

export interface RouteDetail extends RouteSummary {
  readonly steps: readonly StepView[]
  /**
   * Set when this route has been merged into another — FR-40, FR-58, §40.4, invariant 20.
   *
   * The route is still fully readable, with every step, field, revision and follower it ever
   * had. What changes is that it leaves search and says where the community now maintains
   * this journey. §40.4: "Archived duplicate routes may point visitors toward the active
   * route rather than simply disappearing."
   */
  readonly mergedInto: { readonly slug: string; readonly title: string } | null
  /**
   * The full standing, which is a superset of the ribbon's — same shape, more of it. The
   * route page can afford the extra aggregation that a page of search results cannot.
   */
  readonly trust: RouteTrustInput
}

/**
 * Contributor count and change activity for one route — FR-10, FR-62.
 *
 * One query, computed in Postgres, returning three scalars.
 *
 * The first version was four `findMany` calls — one per revision table — pulling every
 * revision row for the route across the network so Node could count them. That is
 * O(revisions) transfer to produce three numbers, and on the Germany fixture alone it is
 * over four hundred rows. It also meant `getRouteBySlug` opened seven queries, six of them
 * concurrent, which on a slow link is six chances to hit the connection timeout instead of
 * one (Test.md §12).
 *
 * Raw SQL is deliberate here rather than incidental: a UNION across four revision tables has
 * no Prisma expression. The cost is that table and column names are written out, so a rename
 * would not be caught by the compiler — which is why `tests/db/trust-surface.db.test.ts`
 * asserts the exact revision count this returns rather than merely that it is positive. A
 * broken join shows up as a wrong number, loudly.
 *
 * `recentChangeCount` is a plain count inside a stated display window. It is not a
 * volatility grade — see the note on thresholds in src/domain/trust.ts.
 */
interface ActivityRow {
  readonly contributorCount: number
  readonly recentChangeCount: number
  readonly lastChangedAt: Date | null
}

/**
 * Public follower aggregates — FR-10, FR-41.
 *
 * Lives here, on the anonymous read path, rather than in `src/server/journeys/` — where every
 * function is required to take a user id. A count over everybody's journeys legitimately has
 * no user, and putting it here keeps that rule absolute instead of carving an exception into
 * it (invariant 5).
 *
 * Two counts and nothing else. Archived journeys are excluded: somebody who unfollowed is not
 * a follower, even though their private data is deliberately kept.
 */
async function followerAggregates(
  routeId: string,
): Promise<{ followerCount: number; selfReportedCompletionCount: number }> {
  const [followerCount, selfReportedCompletionCount] = await Promise.all([
    prisma.journey.count({ where: { routeId, archivedAt: null } }),
    prisma.journey.count({
      where: { routeId, archivedAt: null, selfReportedCompletedAt: { not: null } },
    }),
  ])

  return { followerCount, selfReportedCompletionCount }
}

async function routeActivity(routeId: string, now: Date): Promise<ActivityRow> {
  const since = new Date(now.getTime() - RECENT_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const rows = await prisma.$queryRaw<ActivityRow[]>`
    WITH revisions AS (
      SELECT r."authorId", r."createdAt"
        FROM route_revisions r
       WHERE r."routeId" = ${routeId}
      UNION ALL
      SELECT sr."authorId", sr."createdAt"
        FROM step_revisions sr
        JOIN steps s ON s.id = sr."stepId"
       WHERE s."routeId" = ${routeId}
      UNION ALL
      SELECT er."authorId", er."createdAt"
        FROM step_edge_revisions er
        JOIN step_edges e ON e.id = er."stepEdgeId"
       WHERE e."routeId" = ${routeId}
      UNION ALL
      SELECT fr."authorId", fr."createdAt"
        FROM field_revisions fr
        JOIN fields f ON f.id = fr."fieldId"
        JOIN steps fs ON fs.id = f."stepId"
       WHERE fs."routeId" = ${routeId}
    )
    SELECT
      -- COUNT(DISTINCT ...) ignores NULLs, which is what we want: a seed or system write
      -- has no author and is not a person who has looked at this route.
      COUNT(DISTINCT "authorId")::int                       AS "contributorCount",
      COUNT(*) FILTER (WHERE "createdAt" >= ${since})::int   AS "recentChangeCount",
      MAX("createdAt")                                      AS "lastChangedAt"
    FROM revisions
  `

  return rows[0] ?? { contributorCount: 0, recentChangeCount: 0, lastChangedAt: null }
}

/**
 * Deduplicated per request — Phase 12.
 *
 * `generateMetadata` and the page body both need the route, and without this each one issued
 * its own set of queries: every route page was doing twice the database work it needed, and
 * against a Neon compute that can be cold that is the difference between a page and a wait.
 *
 * `cache` keys on arguments, so both callers must pass the same ones — which is why `now` is
 * left to its default rather than being passed explicitly by either.
 */
export const getRouteBySlug = cache(_getRouteBySlug)

async function _getRouteBySlug(
  slug: string,
  now: Date = new Date(),
): Promise<RouteDetail | null> {
  const route = await prisma.route.findUnique({
    where: { slug },
    include: {
      ...ROUTE_INCLUDE,
      steps: {
        where: { archivedAt: null },
        include: { currentRevision: true, _count: { select: { fields: { where: { archivedAt: null } } } } },
        orderBy: { id: 'asc' },
      },
      mergedInto: { select: { slug: true, currentRevision: { select: { title: true } } } },
    },
  })
  // A merged route is deliberately NOT excluded here. It leaves search, and it keeps its own
  // address, its content and its history — which is what makes a merge non-destructive and
  // what lets its followers carry on (FR-58, BR-25, §40.4, invariant 20).
  if (!route || route.archivedAt !== null) return null

  const graph = toGraph(route.steps, route.edges)
  const standings = await fieldStandings([route.id], now)
  const activity = await routeActivity(route.id, now)
  const followers = await followerAggregates(route.id)
  const standing = standings.get(route.id)

  return {
    id: route.id,
    slug: route.slug,
    title: route.currentRevision?.title ?? route.slug,
    summary: route.currentRevision?.summary ?? null,
    originCountry: route.originCountry,
    destinationCountry: route.destinationCountry,
    studyLevel: route.studyLevel,
    intake: route.intake,
    mechanism: route.mechanism,
    lifecycleState: route.lifecycleState,
    createdAt: route.createdAt,
    mergedInto:
      route.mergedInto === null
        ? null
        : {
            slug: route.mergedInto.slug,
            title: route.mergedInto.currentRevision?.title ?? route.mergedInto.slug,
          },
    graph,
    stepCount: graph.steps.filter((s) => !s.archived).length,
    flyWindow: expectedFlyWindow(graph),
    trust: {
      lifecycleState: route.lifecycleState,
      createdAt: route.createdAt,
      informationCount: standing?.informationCount ?? 0,
      confirmedCount: standing?.confirmedCount ?? 0,
      needsReviewCount: standing?.needsReviewCount ?? 0,
      disputedCount: standing?.disputedCount ?? 0,
      quarantinedCount: standing?.quarantinedCount ?? 0,
      lastConfirmedAt: standing?.lastConfirmedAt ?? null,
      ...activity,
      ...followers,
    },
    steps: route.steps.map((s) => ({
      id: s.id,
      label: s.currentRevision?.label ?? '',
      category: s.currentRevision?.category ?? StepCategory.documents_preparation,
      earliestStartOffsetDays: s.currentRevision?.earliestStartOffsetDays ?? null,
      typicalDurationDays: s.currentRevision?.typicalDurationDays ?? null,
      hardDeadline: s.currentRevision?.hardDeadline ?? null,
      fieldCount: s._count.fields,
    })),
  }
}

/** The fields inside one step — the smallest community-maintained unit (FR-51, VR-05). */
export async function getStepFields(stepId: string): Promise<readonly FieldView[]> {
  const fields = await prisma.field.findMany({
    where: { stepId, archivedAt: null },
    include: {
      currentRevision: true,
      quarantinedBy: { select: { handle: true } },
      // Revision metadata only — never the historical values, which the history tab owns.
      // One step's fields, so this stays a small read rather than a scan of the ledger.
      revisions: { select: { previousRevisionId: true, createdAt: true } },
      _count: { select: { confirmations: true } },
      // Only the unanswered ones. A resolved challenge stays in the record but is no longer
      // something a reader must act on (FR-49).
      challenges: {
        where: { resolvedAt: null },
        include: { author: { select: { handle: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  })

  return fields.flatMap((field) => {
    const current = field.currentRevision
    if (!current) return []

    const parents = field.revisions
      .map((revision) => revision.previousRevisionId)
      .filter((id): id is string => id !== null)
    const hasForkedHistory = new Set(parents).size !== parents.length

    const lastRevisedAt = field.revisions.reduce<Date | null>(
      (latest, revision) => laterOf(latest, revision.createdAt),
      null,
    )

    /**
     * A quarantined field's value never leaves the server (FR-36, §23.2, §42.5).
     *
     * The reader is told that something was withheld and why — silence would be worse than
     * the content, because a reader cannot distinguish a hidden field from a missing one.
     */
    const quarantined = field.quarantinedAt !== null

    return [
      {
        id: field.id,
        currentRevisionId: field.currentRevisionId,
        category: field.category,
        valueText: quarantined ? '' : current.valueText,
        valueAmount: current.valueAmount?.toString() ?? null,
        valueCurrency: current.valueCurrency,
        valueDate: current.valueDate,
        valueDurationDays: current.valueDurationDays,
        sourceClass: current.sourceClass,
        applicability: current.applicability,
        sourceUrl: quarantined ? null : current.sourceUrl,
        sourceNote: quarantined ? null : current.sourceNote,
        lastConfirmedAt: field.lastConfirmedAt,
        revisionCount: field.revisions.length,
        reviewDueAt: field.reviewDueAt,
        effectiveFrom: current.effectiveFrom,
        expiresAt: current.expiresAt,
        lastRevisedAt,
        hasForkedHistory,
        linkTrustClass: field.linkTrustClass,
        quarantined,
        quarantineNote: field.quarantineNote,
        confirmationCount: field._count.confirmations,
        openChallenges: field.challenges.map((challenge) => ({
          id: challenge.id,
          reason: challenge.reason,
          note: challenge.note,
          authorHandle: challenge.author?.handle ?? null,
          createdAt: challenge.createdAt,
        })),
      },
    ]
  })
}

export interface HistoryEntry {
  readonly id: string
  readonly kind: 'route' | 'step' | 'field'
  readonly subject: string
  readonly value: string
  readonly reason: string | null
  readonly authorHandle: string | null
  readonly createdAt: Date
}

/**
 * Route history — FR-08, FR-31.
 *
 * Every revision of the route, its steps and its fields, newest first. Archived content is
 * included: that is the whole point of history, and the difference between archived and
 * deleted (FR-45, invariant 4).
 */
export async function getRouteHistory(routeId: string, limit = 100): Promise<readonly HistoryEntry[]> {
  const [routeRevisions, stepRevisions, fieldRevisions] = await Promise.all([
    prisma.routeRevision.findMany({
      where: { routeId },
      include: { author: { select: { handle: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    }),
    prisma.stepRevision.findMany({
      where: { step: { routeId } },
      include: { author: { select: { handle: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    }),
    prisma.fieldRevision.findMany({
      where: { field: { step: { routeId } } },
      include: { author: { select: { handle: true } }, field: { select: { category: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    }),
  ])

  const entries: HistoryEntry[] = [
    ...routeRevisions.map((r) => ({
      id: r.id,
      kind: 'route' as const,
      subject: r.title,
      value: r.summary ?? r.title,
      reason: r.reason,
      authorHandle: r.author?.handle ?? null,
      createdAt: r.createdAt,
    })),
    ...stepRevisions.map((r) => ({
      id: r.id,
      kind: 'step' as const,
      subject: r.label,
      value: r.label,
      reason: r.reason,
      authorHandle: r.author?.handle ?? null,
      createdAt: r.createdAt,
    })),
    ...fieldRevisions.map((r) => ({
      id: r.id,
      kind: 'field' as const,
      subject: r.field.category,
      value: r.valueText,
      reason: r.reason,
      authorHandle: r.author?.handle ?? null,
      createdAt: r.createdAt,
    })),
  ]

  return entries
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
    .slice(0, limit)
}
