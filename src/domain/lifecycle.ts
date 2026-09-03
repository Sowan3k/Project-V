import type { RouteLifecycleState } from '@/domain/enums'
import { ROUTE_LIFECYCLE_STATES, RouteLifecycleState as Lifecycle } from '@/domain/enums'

/**
 * Route lifecycle — Phase 11. FR-11, FR-38, FR-39, BR-09, BR-10, D-20, §19, §19.1.
 * Invariants 14 and 23.
 *
 * Pure. No database, no React, no copy — the same split Phases 6 and 10 used, and for the
 * same reason: the rules here decide what a reader is told about a route's standing, and a
 * rule that needs a Prisma client to test is a rule that ends up under-tested.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **The one rule this module exists to encode — invariant 23.**
 *
 * §19.1: "The original idea of automatically treating all routes as inactive after 30 days
 * without activity was refined. A 30-day dormancy rule is appropriate mainly for **newly
 * created routes with no followers, confirmations or useful activity**. Established routes
 * should instead display their last confirmation and become stale only after a more
 * meaningful period or lack of verification."
 *
 * So dormancy and staleness are **different concepts about different routes**, and conflating
 * them is the failure this module is built to make impossible:
 *
 *   **Dormant** is about a route nobody ever used. It says "this was created and then
 *   nothing happened", which is a fact about the route's whole life. It reduces prominence.
 *
 *   **Quiet** is about an established route that has simply gone still. §19 defines it as
 *   "no recent activity, but **no strong evidence of a problem**" — so it is not a warning,
 *   and this module never lets it become one. FR-39 says exactly what to do instead: expose
 *   freshness and last-confirmed information.
 *
 *   **Stale** is about information that is *overdue for review* — not about silence. It comes
 *   only from dates a contributor actually stored on a field (`reviewDueAt`, `expiresAt`).
 *
 * An established route with no activity for a year becomes `quiet`, and `quiet` is not a
 * defect. It becomes `stale` only if its own information says it is due for review. Nothing
 * here can turn silence into a claim that a route is wrong (BR-10, FR-39).
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **The direction rule: automation may only ever lower prominence or ask for review. Raising
 * a route's standing requires a person.**
 *
 * Invariant 14 and FR-71: "Follower counts, vote totals or report volume alone must never
 * trigger deletion, archival, ranking boosts or trusted status." Promotion to `developing` or
 * `established` is precisely a trust increase, and the only evidence available for it is
 * counts. So this module never proposes one. FR-46 gives that job to the administrator's
 * periodic review, where a person looks and decides.
 *
 * Demotion to `dormant` is different in kind and explicitly permitted: FR-38 says new routes
 * with no meaningful use "may automatically become dormant", and dormancy removes a route
 * from prominence without deleting anything or asserting it is wrong (§19: "removed from
 * normal prominence but preserved").
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What is never an input here.**
 *
 *   **Reports.** `LifecycleEvidence` has no report field and must never gain one. A route
 *   does not change standing because people reported it; that is a safety matter, handled by
 *   an administrator in Phase 9, and letting report volume move a lifecycle state would make
 *   brigading a way to bury a route (invariant 12, BR-04, BR-11, D-19).
 *
 *   **Popularity as a ranking.** `followerCount` appears, and only ever as a **zero test**:
 *   dormancy requires *no* followers, because FR-38 and §19 define an unused route that way.
 *   Nothing compares one route's followers to another's, and no count promotes anything.
 *
 *   **Invented thresholds.** The 30 days is the baseline's own number (FR-38, §19, D-20).
 *   The staleness period is deliberately absent — CLAUDE.md §11 leaves it open, so nothing
 *   here decides a route has gone stale after N days. Staleness comes only from stored dates.
 */

/** FR-38, §19, D-20 — the baseline's own number, for unused new routes only. */
export const DORMANCY_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Everything a lifecycle decision is allowed to look at.
 *
 * The absences are as deliberate as the presences. There is no report count, no rank, no
 * score, and no comparison against any other route.
 */
export interface LifecycleEvidence {
  /** The stored state. A proposal is always relative to where the route already is. */
  readonly current: RouteLifecycleState
  readonly createdAt: Date
  /**
   * Journeys following this route. Used **only** as a zero test for dormancy, because FR-38
   * and §19 define an unused route as one with no followers. Never as a ranking, never as a
   * promotion, never compared to another route's (invariant 14, BR-05, BR-32, D-21).
   */
  readonly followerCount: number
  /** Confirmations anyone has left on this route's information. Also only a zero test. */
  readonly confirmationCount: number
  /**
   * When anything last happened to this route — any revision to it, or any confirmation.
   * Null only if nothing ever has, which cannot occur for a route that has steps.
   *
   * **This replaced a "revisions written after the route was created" count, which was
   * wrong in a way only the integration suite could show.** Building a route writes its
   * steps, edges and fields milliseconds *after* the route row, so every route in existence
   * had "activity after creation" from the moment it was born and nothing could ever have
   * gone dormant. FR-38 would have been dead on arrival with every unit test passing.
   *
   * A date compared against the same 30 days has no such edge: a route built on day zero and
   * left alone is untouched on day 31, and one that gained a field on day 25 is not.
   */
  readonly lastActivityAt: Date | null
  /** Information items past a stored `reviewDueAt` or `expiresAt`. Dates, not a period. */
  readonly needsReviewCount: number
  readonly informationCount: number
}

export type LifecycleReasonId =
  /** Created, never used, and the dormancy period has passed (FR-38, D-20). */
  | 'unused_since_creation'
  /** It was dormant and something happened — a follower, a confirmation, an edit. */
  | 'activity_resumed'
  /** Established, still standing, simply nothing recent. Not a problem (FR-39, §19). */
  | 'no_recent_activity'
  /** Information is past a review or expiry date its own contributor set (FR-39). */
  | 'review_overdue'
  /** Information is no longer overdue, so the route leaves stale. */
  | 'review_caught_up'

export interface LifecycleProposal {
  readonly from: RouteLifecycleState
  readonly to: RouteLifecycleState
  readonly reason: LifecycleReasonId
}

/** States automation may never touch. Each is a person's decision, in both directions. */
const ADMINISTRATIVE: readonly RouteLifecycleState[] = [
  // Archival and removal are FR-46 administrator actions and, in the case of removal, a
  // safety one. Nothing automatic may archive a route (invariant 14: counts must never
  // "trigger deletion, archival…").
  Lifecycle.archived,
  Lifecycle.removed,
  // Dispute is about unresolved disagreement over content, surfaced per field by Phase 6.
  // Escalating a whole route to `disputed` on evidence is a judgement, and demoting it back
  // even more so, so both stay with a person.
  Lifecycle.disputed,
]

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / DAY_MS
}

/**
 * Has anybody used this route — followed it, confirmed anything on it, or touched it lately?
 *
 * The three signals §19 names, and each is a **zero test or a date**, never a ranking. Any one
 * of them keeps a route out of dormancy, because FR-38 describes the dormant case as one with
 * "no meaningful use **or** activity".
 */
function everUsed(evidence: LifecycleEvidence, now: Date): boolean {
  if (evidence.followerCount > 0) return true
  if (evidence.confirmationCount > 0) return true
  return (
    evidence.lastActivityAt !== null &&
    daysBetween(evidence.lastActivityAt, now) < DORMANCY_DAYS
  )
}

/**
 * What state this route's own record suggests it should be in — or `null` for "leave it".
 *
 * A *proposal*, deliberately: it is the caller that decides whether to apply it, and every
 * application is recorded as an event with this reason attached. Nothing in this file writes.
 *
 * The order of the rules is the order of their authority, and each is a complete answer:
 *
 *   1. Administrative states are left alone entirely.
 *   2. A never-used new route past 30 days becomes dormant (FR-38).
 *   3. A dormant route that saw any activity comes back (dormancy is reversible; §19 says it
 *      is "removed from normal prominence but preserved", not ended).
 *   4. An established route whose information is overdue for review becomes stale (FR-39).
 *   5. An established route with nothing recent becomes quiet — and quiet is not a fault.
 *
 * Nothing promotes. There is no rule here whose effect is to raise a route's standing beyond
 * returning it to where it already was.
 */
export function proposeLifecycle(
  evidence: LifecycleEvidence,
  now: Date,
  { recentWindowDays }: { recentWindowDays: number },
): LifecycleProposal | null {
  const { current } = evidence
  if (ADMINISTRATIVE.includes(current)) return null

  const propose = (to: RouteLifecycleState, reason: LifecycleReasonId): LifecycleProposal | null =>
    to === current ? null : { from: current, to, reason }

  // ── Dormancy: unused NEW routes only ────────────────────────────────────────────────────
  //
  // Every condition is necessary. `experimental` is the guard that makes invariant 23 true:
  // an established route can never reach this branch however quiet it goes, because it is not
  // experimental. That is the whole distinction §19.1 draws, expressed as a type check rather
  // than as a comment somebody has to remember.
  if (current === Lifecycle.experimental) {
    const old = daysBetween(evidence.createdAt, now) >= DORMANCY_DAYS
    if (old && !everUsed(evidence, now)) return propose(Lifecycle.dormant, 'unused_since_creation')
    return null
  }

  // A dormant route that somebody used is no longer unused. Returning it to `experimental`
  // rather than anywhere better is the direction rule: automation may restore what it took,
  // and may not grant more than that.
  if (current === Lifecycle.dormant) {
    if (everUsed(evidence, now)) return propose(Lifecycle.experimental, 'activity_resumed')
    return null
  }

  // ── Established, quiet and stale ────────────────────────────────────────────────────────
  //
  // Reachable only for `developing`, `established`, `quiet` and `stale` — never for a route
  // that was never used, and never for one an administrator has parked.
  //
  // **Staleness is about overdue information, not about silence** (FR-39: "become stale only
  // after a more meaningful period **or lack of verification**"). The evidence is dates a
  // contributor stored on a field, so no threshold is invented here; CLAUDE.md §11 leaves the
  // period open and it stays open.
  if (evidence.needsReviewCount > 0) return propose(Lifecycle.stale, 'review_overdue')

  const quiet =
    evidence.lastActivityAt === null ||
    daysBetween(evidence.lastActivityAt, now) > recentWindowDays

  if (current === Lifecycle.stale) {
    // Nothing is overdue any more. It goes to quiet or back to established depending only on
    // whether anything has happened lately — never higher than it was.
    return propose(quiet ? Lifecycle.quiet : Lifecycle.established, 'review_caught_up')
  }

  if (quiet) return propose(Lifecycle.quiet, 'no_recent_activity')

  // Activity has returned to a route that had gone quiet. This restores rather than promotes:
  // it is the only upward move in the module and it can only ever undo `no_recent_activity`.
  if (current === Lifecycle.quiet) return propose(Lifecycle.established, 'activity_resumed')

  return null
}

/**
 * **Is this state a reason for a reader to be careful?** — FR-39, BR-10, §19.
 *
 * `quiet` is deliberately *not*. §19 defines it as "no recent activity, but no strong
 * evidence of a problem", and FR-39 is explicit that an established route "shall not be
 * treated as false merely because of 30 days without activity". A caution saying otherwise
 * would be the platform inventing a defect out of silence — which is exactly what invariant
 * 23 forbids, expressed in the trust surface rather than in the transition rules.
 *
 * What a quiet route shows instead is its last-confirmed date, as context. That is FR-39's
 * own remedy: "they shall instead expose freshness/last-confirmed information."
 */
export function lifecycleWarrantsCaution(state: RouteLifecycleState): boolean {
  return state !== Lifecycle.established && state !== Lifecycle.quiet
}

/**
 * Whether a route in this state belongs in ordinary search results.
 *
 * Dormant and archived routes leave the listing; neither is deleted, and both remain
 * reachable by their own address with their history intact (§19, FR-45, BR-15, invariant 4).
 */
export function appearsInSearch(state: RouteLifecycleState): boolean {
  return (
    state !== Lifecycle.dormant && state !== Lifecycle.archived && state !== Lifecycle.removed
  )
}

/**
 * The same rule as a list, so a database query can use it without restating it.
 *
 * **Derived from `appearsInSearch`, not written out beside it.** Two hand-maintained copies
 * of one rule is how a state gets added to the enum, remembered in the function and forgotten
 * in the query — and the failure mode there is a dormant route quietly reappearing in search.
 */
export const SEARCHABLE_LIFECYCLE_STATES: readonly RouteLifecycleState[] =
  ROUTE_LIFECYCLE_STATES.filter(appearsInSearch)
