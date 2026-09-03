import type { ChangeRelevance, DisruptionRelevance, FollowerPosition } from '@/domain/changes'
import { changeRelevance, disruptionRelevance, NOT_FOLLOWING } from '@/domain/changes'
import type { FollowerChangeStance } from '@/domain/enums'
import { JourneyStepStatus as Status } from '@/domain/enums'
import { changesForRoute, disruptionsForRoute } from '@/server/changes/read'
import type { ChangeView, DisruptionView } from '@/server/changes/read'
import { prisma } from '@/server/db/client'

/**
 * What the public route's changes mean for one follower — Phase 10.
 *
 * FR-28, FR-29, FR-30, FR-61, §13.1, §13.2, §13.3, §14.2, §41.3. BR-17, BR-26. Invariants 8,
 * 18, 21.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **This file is in `src/server/journeys/` and obeys that directory's absolute rule: every
 * exported function takes `userId`, and every query against private state filters on it.**
 *
 * It reads public data too — the changes and the route graph — and that is the point. The
 * combination is what nobody else may see: *which* public changes matter to *this* person is
 * derived from their private progress, so the result is as private as the progress itself
 * (FR-26, BR-16, D-10, invariant 5).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Nothing here writes to journey progress, and nothing may be added that does.**
 *
 * FR-30, BR-17 and invariant 8: a public change must never reset, rewrite or reinterpret a
 * follower's completions, dates, tasks or notes. The way that guarantee is kept is not
 * discipline but shape — relevance is computed at *read* time from progress the follower
 * entered, and there is no code path from a route revision to a journey row at all. The only
 * write in this file is the follower's own stance on a change, which they ask for (§13.3).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Nothing here imports the revision engine, and an architecture test enforces it.**
 *
 * That rule bit during Phase 10 and was right to. The first draft loaded both sides of the
 * shadow comparison here, which pulled `@/server/revisions/read` into the journey directory —
 * the exact coupling the guard exists to prevent, since it is the path by which private state
 * could one day acquire a public history (invariant 5).
 *
 * Following the rule produced the better separation anyway. **The comparison is public; only
 * the date it is drawn against is private.** So this returns `startedAt` and the page asks
 * `shadowSince` in `@/server/changes/read` for the graphs — which also means an anonymous
 * reader and a follower get the identical comparison code, differing only in the date.
 */

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Reading
   ══════════════════════════════════════════════════════════════════════════════════════════ */

export interface RelevantChange {
  readonly change: ChangeView
  readonly relevance: ChangeRelevance
  readonly stance: FollowerChangeStance | null
}

export interface RelevantDisruption {
  readonly disruption: DisruptionView
  readonly relevance: DisruptionRelevance
}

export interface FollowerChangeReport {
  /**
   * When this follower began — the date the shadow comparison is drawn against (§14.2).
   *
   * The *date* is private; the comparison it produces is not. So this returns the date and
   * the caller asks the public read layer for the graphs, which is why nothing in this
   * directory imports the revision engine (see the note at the top of this file).
   */
  readonly startedAt: Date
  /** Changes announced since they started, newest first, each placed against their progress. */
  readonly changes: readonly RelevantChange[]
  readonly disruptions: readonly RelevantDisruption[]
  /**
   * How many changes ask something of them — changes on steps they have not finished, minus
   * any they have already said do not apply.
   *
   * A count of *situations*, not a score. It exists so a tab can say "3 need your attention"
   * rather than "12 changes", which is the difference between change relevance and change
   * volume (FR-29, FR-76, CLAUDE.md §7).
   */
  readonly needsAttention: number
}

/**
 * Everything the change views need for one follower on one route — FR-28, FR-29, §14.2.
 *
 * The shadow is drawn against `journey.startedAt`, which is §14.2 exactly: "A user may
 * compare the route they originally followed with the current live route." No snapshot was
 * taken when they followed, and none was needed — the ledger can be asked what the route
 * looked like that day (see `loadRouteGraphAt`).
 *
 * Returns `null` when this user does not follow this route. Not an empty report: "you follow
 * this and nothing changed" and "you do not follow this" are different answers, and a page
 * that conflated them would offer a comparison against a start date that does not exist.
 */
export async function followerChangeReport(
  userId: string,
  routeId: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<FollowerChangeReport | null> {
  const journey = await prisma.journey.findFirst({
    where: { userId, routeId, archivedAt: null },
    select: {
      id: true,
      startedAt: true,
      progress: {
        select: { stepId: true, status: true, actualDate: true, targetDate: true },
      },
      changeNotes: { select: { changeId: true, stance: true } },
    },
  })
  if (journey === null) return null

  const [changes, disruptions] = await Promise.all([
    changesForRoute(routeId),
    disruptionsForRoute(routeId, { now }),
  ])

  const progressByStep = new Map(journey.progress.map((row) => [row.stepId, row]))
  const stanceByChange = new Map(journey.changeNotes.map((row) => [row.changeId, row.stance]))

  const positionFor = (stepId: string | null, changeId: string | null): FollowerPosition => {
    const stance = changeId === null ? null : (stanceByChange.get(changeId) ?? null)
    if (stepId === null) return { ...NOT_FOLLOWING, stance }
    const row = progressByStep.get(stepId)
    if (row === undefined) {
      // Following the route but with no record for this step yet. That is a real position —
      // they have not started it — and is materially different from not following at all.
      return { status: Status.not_started, actualDate: null, targetDate: null, stance }
    }
    return {
      status: row.status,
      actualDate: row.actualDate,
      targetDate: row.targetDate,
      stance,
    }
  }

  const placed: RelevantChange[] = changes
    // Changes announced before they began are already part of the route they chose to follow.
    // Showing them as news would bury the ones that actually arrived underneath (§14.2).
    .filter((change) => change.announcedAt.getTime() > journey.startedAt.getTime())
    .map((change) => ({
      change,
      relevance: changeRelevance(change, positionFor(change.stepId, change.id), now),
      stance: stanceByChange.get(change.id) ?? null,
    }))

  const placedDisruptions: RelevantDisruption[] = disruptions.map((disruption) => ({
    disruption,
    relevance: disruptionRelevance(disruption, positionFor(disruption.stepId, null), now),
  }))

  return {
    startedAt: journey.startedAt,
    changes: placed,
    disruptions: placedDisruptions,
    needsAttention:
      placed.filter((entry) => entry.relevance.weight === 'caution').length +
      placedDisruptions.filter((entry) => entry.relevance.weight === 'caution').length,
  }
}

/**
 * Just the headline: does this follower have anything to look at? — FR-28.
 *
 * Cheap enough to call from the route header on every view, so the Changes tab can carry a
 * count without the page loading a full comparison it may never show.
 */
export async function followerChangeCount(
  userId: string,
  routeId: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ total: number; needsAttention: number } | null> {
  const report = await followerChangeReport(userId, routeId, { now })
  if (report === null) return null
  return { total: report.changes.length, needsAttention: report.needsAttention }
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The follower's own answer — §13.3
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Record what this follower thinks a change means for them — §13.3.
 *
 * "Where the platform cannot confidently determine whether a rule change applies to a
 * follower, the follower should be shown the change and allowed to mark it as applicable,
 * already handled, or not applicable to their case."
 *
 * This is the only write in this file, and it changes nothing public: it is a private note
 * attached to a private journey, invisible to every other reader including the contributor
 * who announced the change (invariant 5). It also does not touch step progress — saying "this
 * does not apply to me" is not the same statement as marking a step not applicable, and
 * collapsing the two would let a change quietly rewrite progress, which is precisely what
 * invariant 8 forbids.
 */
export async function setChangeStance({
  userId,
  routeId,
  changeId,
  stance,
}: {
  readonly userId: string
  readonly routeId: string
  readonly changeId: string
  readonly stance: FollowerChangeStance
}): Promise<void> {
  const journey = await prisma.journey.findFirst({
    where: { userId, routeId, archivedAt: null },
    select: { id: true },
  })
  if (journey === null) return

  // The change must belong to the route this person actually follows. Without this a crafted
  // id could attach a note to somebody else's route — harmless to read, but it would make the
  // uniqueness constraint meaningless and the record incoherent.
  const change = await prisma.routeChange.findFirst({
    where: { id: changeId, routeId },
    select: { id: true },
  })
  if (change === null) return

  await prisma.journeyChangeNote.upsert({
    where: { journeyId_changeId: { journeyId: journey.id, changeId } },
    create: { journeyId: journey.id, changeId, stance },
    update: { stance },
  })
}

/** Withdraw a stance, returning the change to "the platform does not know" (§13.3). */
export async function clearChangeStance({
  userId,
  routeId,
  changeId,
}: {
  readonly userId: string
  readonly routeId: string
  readonly changeId: string
}): Promise<void> {
  const journey = await prisma.journey.findFirst({
    where: { userId, routeId, archivedAt: null },
    select: { id: true },
  })
  if (journey === null) return

  await prisma.journeyChangeNote.deleteMany({ where: { journeyId: journey.id, changeId } })
}
