import type { LifecycleEvidence, LifecycleProposal } from '@/domain/lifecycle'
import { proposeLifecycle } from '@/domain/lifecycle'
import type { RouteLifecycleState } from '@/domain/enums'
import { UserRole } from '@/domain/enums'
import { RECENT_ACTIVITY_WINDOW_DAYS } from '@/domain/trust'
import { prisma } from '@/server/db/client'
import { setRouteLifecycleState, setRouteMergePointer } from '@/server/revisions/service'

/**
 * Lifecycle transitions, duplicate flags and merge — Phase 11.
 *
 * FR-38, FR-39, FR-40, FR-45, FR-46, FR-58. BR-09, BR-10, BR-15, BR-25, BR-32. D-20, D-38.
 * §18.4, §19, §19.2, §40.4. Invariants 1, 4, 14, 20, 23.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Nothing in this file deletes anything, and nothing writes a revision.**
 *
 * A lifecycle change is not an edit to route knowledge — the title, steps and fields are
 * untouched by it — so it does not belong in the revision engine (CLAUDE.md §9). It is an
 * event about a route, recorded in `RouteLifecycleEvent`, which is `communitySignal` and
 * therefore undeletable. Archival sets a column; it never removes a row (FR-45, BR-15,
 * invariant 4).
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Who may do what, and the direction rule.**
 *
 *   `applyProposedLifecycle`  no actor. It may only apply what `proposeLifecycle` returns,
 *                             which never promotes and never touches an administrative state.
 *   `setLifecycleState`       administrator only. FR-46's periodic review: promote, archive,
 *                             restore, mark disputed — with a reason, recorded.
 *   `mergeRoutes` / `unmerge` administrator only. FR-46, §19.2.
 *   `flagDuplicate`           any signed-in contributor. §40.4 says users flag; a flag asks
 *                             a person to look and changes nothing on its own.
 *
 * The asymmetry is deliberate and is invariant 14 in practice: **automation may lower a
 * route's prominence or ask for review, and only a person may raise its standing.** Every
 * piece of evidence available for promotion is a count, and FR-71 forbids counts alone
 * conferring trusted status.
 */

export class LifecycleError extends Error {}
export class NotAnAdministratorError extends LifecycleError {}

/**
 * The only authorisation check in this module, and it is checked here rather than in a page.
 *
 * Same shape as `src/server/safety/service.ts` deliberately: a hidden button is not a
 * permission (CLAUDE.md §9).
 *
 * Exported so the periodic-review action can gate its button on the same check the mutating
 * functions use, rather than reading `user.role` itself and giving the rule a second home.
 */
export async function requireAdministrator(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role !== UserRole.admin) {
    throw new NotAnAdministratorError('This action is limited to administrators')
  }
}

/** Reason recorded when a person, rather than the record, decided (FR-46). */
const ADMINISTRATIVE_REASON = 'administrative'

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Evidence and automatic transitions
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Everything the lifecycle rules are allowed to see about one route.
 *
 * **There is no report count here and there must never be one.** A route does not change
 * standing because people reported it — that is a safety matter for an administrator, and
 * letting report volume move a lifecycle state would make brigading a way to bury a route
 * (invariant 12, BR-04, BR-11, D-19). An architecture test asserts this function never reads
 * the `Report` table.
 */
export async function lifecycleEvidenceFor(routeId: string): Promise<LifecycleEvidence> {
  const route = await prisma.route.findUniqueOrThrow({
    where: { id: routeId },
    select: { lifecycleState: true, createdAt: true },
  })

  const [followerCount, confirmationCount, informationCount, revisions, lastConfirmation] =
    await Promise.all([
      prisma.journey.count({ where: { routeId, archivedAt: null } }),
      prisma.confirmation.count({ where: { field: { step: { routeId } } } }),
      prisma.field.count({ where: { archivedAt: null, step: { routeId } } }),
      // Revisions written *after* the route was created — edits, rather than the act of
      // creating it. A route whose only revisions are its own birth has had nothing happen.
      Promise.all([
        prisma.routeRevision.count({
          where: { routeId, createdAt: { gt: route.createdAt } },
        }),
        prisma.stepRevision.count({
          where: { step: { routeId }, createdAt: { gt: route.createdAt } },
        }),
        prisma.fieldRevision.count({
          where: { field: { step: { routeId } }, createdAt: { gt: route.createdAt } },
        }),
      ]),
      prisma.confirmation.findFirst({
        where: { field: { step: { routeId } } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

  const lastRevision = await prisma.fieldRevision.findFirst({
    where: { field: { step: { routeId } } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })

  const now = new Date()
  // The same rule Phase 6 uses for `needsReviewCount`, against the same two stored dates:
  // `reviewDueAt` lives on the field and `expiresAt` on its current revision. Both are dates
  // a contributor entered — no period is assumed, and CLAUDE.md §11's open staleness
  // threshold stays open.
  const needsReviewCount = await prisma.field.count({
    where: {
      archivedAt: null,
      step: { routeId },
      OR: [{ reviewDueAt: { lte: now } }, { currentRevision: { expiresAt: { lte: now } } }],
    },
  })

  const activity = [lastConfirmation?.createdAt, lastRevision?.createdAt].filter(
    (date): date is Date => date !== undefined,
  )

  return {
    current: route.lifecycleState,
    createdAt: route.createdAt,
    followerCount,
    confirmationCount,
    revisionsAfterCreation: revisions.reduce((sum, n) => sum + n, 0),
    lastActivityAt:
      activity.length === 0
        ? null
        : new Date(Math.max(...activity.map((date) => date.getTime()))),
    needsReviewCount,
    informationCount,
  }
}

export interface TransitionResult {
  readonly routeId: string
  readonly applied: LifecycleProposal | null
}

/**
 * Apply whatever this route's own record proposes — FR-38, FR-39, D-20, invariant 23.
 *
 * Idempotent: running it twice changes nothing the second time, because `proposeLifecycle`
 * returns `null` when the route is already where it belongs. That matters because this is
 * the kind of function somebody eventually runs on a schedule, and one that logged a new
 * event on every pass would fill the record with noise.
 *
 * Takes no actor. An automatic transition is not an anonymous action by a person; it is the
 * absence of one, and recording a user id against it would misattribute the decision.
 */
export async function applyProposedLifecycle(
  routeId: string,
  now: Date = new Date(),
): Promise<TransitionResult> {
  const evidence = await lifecycleEvidenceFor(routeId)
  const proposal = proposeLifecycle(evidence, now, {
    // Reuses Phase 6's display window rather than introducing a second number. It decides
    // only what counts as *recent*; it is emphatically not a staleness threshold, which
    // CLAUDE.md §11 leaves open and which nothing here decides (see `src/domain/lifecycle.ts`).
    recentWindowDays: RECENT_ACTIVITY_WINDOW_DAYS,
  })
  if (proposal === null) return { routeId, applied: null }

  // The write to `Route` goes through the revision service, which is the only module
  // permitted to write a revisioned model — the boundary Phase 9's quarantine work had to
  // respect, and the architecture test that enforces it caught this too.
  await setRouteLifecycleState({ routeId, state: proposal.to, actorId: null })
  await prisma.$transaction([
    prisma.routeLifecycleEvent.create({
      data: {
        routeId,
        fromState: proposal.from,
        toState: proposal.to,
        reason: proposal.reason,
        // What the decision actually saw, so it can be re-examined later against the facts of
        // the day rather than against today's. No report count appears in it.
        evidence: {
          followerCount: evidence.followerCount,
          confirmationCount: evidence.confirmationCount,
          revisionsAfterCreation: evidence.revisionsAfterCreation,
          needsReviewCount: evidence.needsReviewCount,
          informationCount: evidence.informationCount,
          lastActivityAt: evidence.lastActivityAt?.toISOString() ?? null,
        },
      },
    }),
  ])

  return { routeId, applied: proposal }
}

/**
 * §19.2's periodic review, in the form a person can actually run.
 *
 * Returns what changed rather than a count, because "12 routes transitioned" is not something
 * anybody can check and "these three went dormant, with this evidence" is.
 */
export async function reviewAllRoutes(now: Date = new Date()): Promise<readonly TransitionResult[]> {
  const routes = await prisma.route.findMany({ select: { id: true }, orderBy: { id: 'asc' } })
  const results: TransitionResult[] = []
  for (const route of routes) {
    results.push(await applyProposedLifecycle(route.id, now))
  }
  return results.filter((result) => result.applied !== null)
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Administrator transitions — FR-46, §19.2
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * A person sets the state, with a reason — FR-46, §19.2.
 *
 * This is the **only** path to `established`, `developing`, `disputed`, `archived` or
 * `removed`. Every one of those is either a trust increase or a removal from view, and
 * invariant 14 forbids counts alone triggering either. A person looks and decides.
 *
 * Archival here sets the lifecycle state; it does not touch `Route.archivedAt`, which the
 * read path uses to hide a route entirely. That separation is deliberate — an archived
 * *lifecycle* keeps the route readable with its history, which is what FR-45 and BR-15 ask
 * for: "Historical or archived route information should remain viewable for transparency
 * where safety does not require removal."
 */
export async function setLifecycleState({
  adminId,
  routeId,
  state,
  note,
}: {
  readonly adminId: string
  readonly routeId: string
  readonly state: RouteLifecycleState
  readonly note?: string | null
}): Promise<void> {
  await requireAdministrator(adminId)

  const route = await prisma.route.findUniqueOrThrow({
    where: { id: routeId },
    select: { lifecycleState: true },
  })
  if (route.lifecycleState === state) return

  await setRouteLifecycleState({ routeId, state, actorId: adminId })
  await prisma.$transaction([
    prisma.routeLifecycleEvent.create({
      data: {
        routeId,
        fromState: route.lifecycleState,
        toState: state,
        reason: ADMINISTRATIVE_REASON,
        note: note?.trim() || null,
        actorId: adminId,
      },
    }),
  ])
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Duplicate flagging — §40.4, FR-40
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * "These two look like the same journey" — §40.4.
 *
 * Any signed-in contributor. It changes nothing: no state moves, no route is hidden, and
 * nothing is counted toward a threshold. §40.1 is explicit that two routes may legitimately
 * coexist when the journeys differ, and no number of flags can establish that they do not, so
 * a flag is a request for a person to compare them and nothing more (invariant 14).
 */
export async function flagDuplicate({
  reporterId,
  routeId,
  duplicateOfId,
  note,
}: {
  readonly reporterId: string
  readonly routeId: string
  readonly duplicateOfId: string
  readonly note?: string | null
}): Promise<{ flagId: string }> {
  if (routeId === duplicateOfId) {
    throw new LifecycleError('A route cannot duplicate itself')
  }

  const existing = await prisma.duplicateFlag.findUnique({
    where: {
      routeId_duplicateOfId_reporterId: { routeId, duplicateOfId, reporterId },
    },
    select: { id: true },
  })
  // One standing opinion per person per pair. Flagging again is the same opinion, not a
  // second one, so it updates the note rather than accumulating rows.
  if (existing) {
    await prisma.duplicateFlag.update({
      where: { id: existing.id },
      data: { note: note?.trim() || null, resolvedAt: null, resolvedById: null },
    })
    return { flagId: existing.id }
  }

  const created = await prisma.duplicateFlag.create({
    data: { routeId, duplicateOfId, reporterId, note: note?.trim() || null },
    select: { id: true },
  })
  return { flagId: created.id }
}

/**
 * Close a flag — either because the routes were merged, or because they are genuinely
 * different.
 *
 * The second outcome is a real answer, not a failure. §40.1 exists to protect routes that
 * overlap heavily but describe different journeys, and an administrator saying so is the
 * mechanism that protects them.
 */
export async function resolveDuplicateFlag({
  adminId,
  flagId,
  note,
}: {
  readonly adminId: string
  readonly flagId: string
  readonly note?: string | null
}): Promise<void> {
  await requireAdministrator(adminId)
  await prisma.duplicateFlag.update({
    where: { id: flagId },
    data: { resolvedAt: new Date(), resolvedById: adminId, resolutionNote: note?.trim() || null },
  })
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Merge — FR-40, FR-58, BR-25, D-38, §40.4, invariant 20
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Declare `canonicalRouteId` the surviving route for `duplicateRouteId` — invariant 20.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What this does, and the reason it does so little.**
 *
 * The duplicate keeps every step, field, revision, contributor attribution and follower it
 * ever had. It gains a pointer to the route that supersedes it and leaves ordinary search.
 * Nothing is copied, moved, rewritten or deleted.
 *
 * The obvious alternative — physically moving the duplicate's steps and fields into the
 * survivor — was rejected, and not for effort. It would put revision chains under a route
 * that did not author them, detach `JourneyStepProgress` rows from the route their owner
 * chose to follow, and create two histories for one fact. FR-58 requires that "follower
 * progress, useful contribution history and route history shall not be lost"; the reliable
 * way to not lose something is not to move it.
 *
 * So **both follower sets survive because neither is touched.** A follower of the duplicate
 * keeps their journey, their dates, their notes and their completed steps exactly as they
 * were, and is shown that the route now points somewhere newer — which is a thing they can
 * act on, unlike a journey that was silently relocated to a route with different steps.
 *
 * §40.4 describes precisely this: "Archived duplicate routes may point visitors toward the
 * active route rather than simply disappearing."
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Refuses a merge into itself, and a merge that would form a cycle. A cycle would make
 * `resolveCanonical` non-terminating and would leave every route in the loop pointing at
 * another that points back — no route in it would be reachable as canonical.
 */
export async function mergeRoutes({
  adminId,
  duplicateRouteId,
  canonicalRouteId,
  note,
}: {
  readonly adminId: string
  readonly duplicateRouteId: string
  readonly canonicalRouteId: string
  readonly note?: string | null
}): Promise<void> {
  await requireAdministrator(adminId)

  if (duplicateRouteId === canonicalRouteId) {
    throw new LifecycleError('A route cannot be merged into itself')
  }

  const [duplicate, canonical] = await Promise.all([
    prisma.route.findUniqueOrThrow({
      where: { id: duplicateRouteId },
      select: { lifecycleState: true, mergedIntoId: true },
    }),
    prisma.route.findUniqueOrThrow({
      where: { id: canonicalRouteId },
      select: { id: true },
    }),
  ])

  if (duplicate.mergedIntoId !== null) {
    throw new LifecycleError('That route has already been merged')
  }

  // Walking from the intended target: if we reach the duplicate, this merge closes a loop.
  let cursor: string | null = canonical.id
  const seen = new Set<string>()
  while (cursor !== null) {
    if (cursor === duplicateRouteId) {
      throw new LifecycleError('That merge would form a cycle')
    }
    if (seen.has(cursor)) break
    seen.add(cursor)
    const next: { mergedIntoId: string | null } | null = await prisma.route.findUnique({
      where: { id: cursor },
      select: { mergedIntoId: true },
    })
    cursor = next?.mergedIntoId ?? null
  }

  await setRouteMergePointer({
    routeId: duplicateRouteId,
    mergedIntoId: canonicalRouteId,
    actorId: adminId,
    note: note?.trim() || null,
  })
  await prisma.$transaction([
    prisma.routeLifecycleEvent.create({
      data: {
        routeId: duplicateRouteId,
        fromState: duplicate.lifecycleState,
        toState: duplicate.lifecycleState,
        reason: ADMINISTRATIVE_REASON,
        note: `Merged into ${canonicalRouteId}${note?.trim() ? `: ${note.trim()}` : ''}`,
        actorId: adminId,
      },
    }),
  ])
}

/**
 * Undo a merge — FR-45, invariant 4 applied to a decision rather than to content.
 *
 * A merge that turns out to be wrong must be reversible, because §40.1 protects routes that
 * overlap heavily but are genuinely different, and telling those apart is a judgement a person
 * can get wrong. Nothing was destroyed by the merge, so nothing has to be reconstructed to
 * undo it: the pointer is cleared and the record of both decisions stays.
 */
export async function unmergeRoute({
  adminId,
  routeId,
  note,
}: {
  readonly adminId: string
  readonly routeId: string
  readonly note?: string | null
}): Promise<void> {
  await requireAdministrator(adminId)

  const route = await prisma.route.findUniqueOrThrow({
    where: { id: routeId },
    select: { lifecycleState: true, mergedIntoId: true },
  })
  if (route.mergedIntoId === null) return

  await setRouteMergePointer({ routeId, mergedIntoId: null, actorId: adminId })
  await prisma.$transaction([
    prisma.routeLifecycleEvent.create({
      data: {
        routeId,
        fromState: route.lifecycleState,
        toState: route.lifecycleState,
        reason: ADMINISTRATIVE_REASON,
        note: `Merge reversed${note?.trim() ? `: ${note.trim()}` : ''}`,
        actorId: adminId,
      },
    }),
  ])
}
