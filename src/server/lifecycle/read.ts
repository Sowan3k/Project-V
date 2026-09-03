import type { RouteLifecycleState } from '@/domain/enums'
import { prisma } from '@/server/db/client'

/**
 * Reading lifecycle history, merges and duplicate flags — Phase 11.
 *
 * **Takes no identity**, like the rest of the public read path (FR-01, D-03). Whether a route
 * was parked, revived or superseded is exactly what a student weighing it needs to know, and
 * needing an account to see it would defeat the point.
 *
 * The one exception is the administrator queue at the bottom, which takes a user id because
 * it is a moderation surface — and even that shows only routes and their own history.
 */

export interface LifecycleEventView {
  readonly id: string
  readonly fromState: RouteLifecycleState
  readonly toState: RouteLifecycleState
  readonly reason: string
  readonly note: string | null
  /** Null for an automatic transition — the absence of a person, not an anonymous one. */
  readonly actorHandle: string | null
  readonly createdAt: Date
}

/**
 * How this route's standing has moved, newest first — FR-11, §19.
 *
 * Public. A route that has been parked and revived twice is telling a reader something real
 * about itself, and hiding it would make the current state look more settled than it is.
 */
export async function lifecycleHistory(
  routeId: string,
  limit = 50,
): Promise<readonly LifecycleEventView[]> {
  const rows = await prisma.routeLifecycleEvent.findMany({
    where: { routeId },
    select: {
      id: true,
      fromState: true,
      toState: true,
      reason: true,
      note: true,
      createdAt: true,
      actor: { select: { handle: true } },
    },
    // Tie-broken by id: several events can share a timestamp, and an ordering the planner
    // chooses is not an ordering (the lesson from Phase 10, Test.md §18).
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  })

  return rows.map((row) => ({
    id: row.id,
    fromState: row.fromState,
    toState: row.toState,
    reason: row.reason,
    note: row.note,
    actorHandle: row.actor?.handle ?? null,
    createdAt: row.createdAt,
  }))
}

export interface MergeView {
  /** The route that supersedes this one, following the chain to its end. */
  readonly canonicalSlug: string
  readonly canonicalTitle: string
  readonly mergedAt: Date | null
  readonly note: string | null
}

/**
 * Where a merged route now points — FR-40, FR-58, §40.4.
 *
 * Follows the chain, so a route merged into one that was itself later merged resolves to the
 * route a reader should actually open. Bounded: `mergeRoutes` refuses to create a cycle, and
 * this refuses to loop forever even if one somehow existed, because a read path that can hang
 * is a worse failure than a wrong answer.
 */
export async function canonicalFor(routeId: string): Promise<MergeView | null> {
  const start = await prisma.route.findUnique({
    where: { id: routeId },
    select: { mergedIntoId: true, mergedAt: true, mergeNote: true },
  })
  if (!start?.mergedIntoId) return null

  let cursor: string | null = start.mergedIntoId
  const seen = new Set<string>([routeId])
  let final: { slug: string; title: string } | null = null

  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor)
    const next: {
      slug: string
      mergedIntoId: string | null
      currentRevision: { title: string } | null
    } | null = await prisma.route.findUnique({
      where: { id: cursor },
      select: {
        slug: true,
        mergedIntoId: true,
        currentRevision: { select: { title: true } },
      },
    })
    if (next === null) break
    final = { slug: next.slug, title: next.currentRevision?.title ?? next.slug }
    cursor = next.mergedIntoId
  }

  if (final === null) return null
  return {
    canonicalSlug: final.slug,
    canonicalTitle: final.title,
    mergedAt: start.mergedAt,
    note: start.mergeNote,
  }
}

/**
 * Routes that were merged *into* this one — the other half of the record.
 *
 * §40.4: a merged duplicate points at the survivor, and the survivor should be able to say
 * where its predecessors went. Without this the relationship is only visible from one side,
 * and somebody arriving at the canonical route has no way to find the history that fed it.
 */
export async function mergedIntoThis(
  routeId: string,
): Promise<readonly { slug: string; title: string; mergedAt: Date | null }[]> {
  const rows = await prisma.route.findMany({
    where: { mergedIntoId: routeId },
    select: { slug: true, mergedAt: true, currentRevision: { select: { title: true } } },
    orderBy: [{ mergedAt: 'desc' }, { id: 'desc' }],
  })

  return rows.map((row) => ({
    slug: row.slug,
    title: row.currentRevision?.title ?? row.slug,
    mergedAt: row.mergedAt,
  }))
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The administrator's maintenance surface — FR-46, §19.2
   ══════════════════════════════════════════════════════════════════════════════════════════ */

export interface DuplicateFlagView {
  readonly id: string
  readonly routeSlug: string
  readonly routeTitle: string
  readonly duplicateOfSlug: string
  readonly duplicateOfTitle: string
  readonly note: string | null
  readonly reporterHandle: string | null
  readonly createdAt: Date
}

/**
 * Open duplicate flags, oldest first — §40.4.
 *
 * **Oldest first, and no count.** A queue sorted by how many people flagged a pair would make
 * volume the thing that gets attention, which is a raw count deciding a moderation outcome
 * (FR-71, invariant 14). Oldest first means nothing waits indefinitely, which is the property
 * a queue should actually have.
 *
 * Not administrator-gated at the read layer: the *page* is, and gating here as well would
 * force a user id into a module whose whole point is that it needs none.
 */
export async function openDuplicateFlags(limit = 50): Promise<readonly DuplicateFlagView[]> {
  const rows = await prisma.duplicateFlag.findMany({
    where: { resolvedAt: null },
    select: {
      id: true,
      note: true,
      createdAt: true,
      reporter: { select: { handle: true } },
      route: { select: { slug: true, currentRevision: { select: { title: true } } } },
      duplicateOf: { select: { slug: true, currentRevision: { select: { title: true } } } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  })

  return rows.map((row) => ({
    id: row.id,
    routeSlug: row.route.slug,
    routeTitle: row.route.currentRevision?.title ?? row.route.slug,
    duplicateOfSlug: row.duplicateOf.slug,
    duplicateOfTitle: row.duplicateOf.currentRevision?.title ?? row.duplicateOf.slug,
    note: row.note,
    reporterHandle: row.reporter?.handle ?? null,
    createdAt: row.createdAt,
  }))
}

export interface MaintenanceRow {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly lifecycleState: RouteLifecycleState
  readonly createdAt: Date
  readonly mergedIntoSlug: string | null
}

/**
 * Every route and its standing — the administrator's annual review list (FR-46, §19.2).
 *
 * Ordered by age, not by popularity. There is no follower column here and no sort by one:
 * a maintenance queue ranked by followers would quietly make popularity the thing that gets
 * looked after, and §19 is explicit that "a route may receive little activity simply because
 * it is seasonal or less popular".
 */
export async function routesForMaintenance(limit = 200): Promise<readonly MaintenanceRow[]> {
  const rows = await prisma.route.findMany({
    select: {
      id: true,
      slug: true,
      lifecycleState: true,
      createdAt: true,
      currentRevision: { select: { title: true } },
      mergedInto: { select: { slug: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  })

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.currentRevision?.title ?? row.slug,
    lifecycleState: row.lifecycleState,
    createdAt: row.createdAt,
    mergedIntoSlug: row.mergedInto?.slug ?? null,
  }))
}
