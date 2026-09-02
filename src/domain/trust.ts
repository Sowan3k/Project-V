import type { FieldApplicability, RouteLifecycleState, SourceClass } from '@/domain/enums'
import {
  FieldApplicability as Applicability,
  RouteLifecycleState as Lifecycle,
  SourceClass as Source,
} from '@/domain/enums'

/**
 * The trust surface — Phase 6.
 *
 * Pure. No database, no React, no copy. It takes what is stored and returns *which signals
 * are true*; the dictionary supplies the words and the components decide the pixels. That
 * separation is what makes invariants 9-17 testable without a browser or a database.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * The rule this module exists to encode: **a signal earns prominence by changing what the
 * reader should do.**
 *
 * By Phase 6 the data carries source class, applicability, freshness, review dates, expiry,
 * revision counts, fork history, lifecycle state, contributor counts and change activity.
 * Rendering all of that at equal weight produces a wall of badges, which is not transparency
 * — it is noise that hides the one marker that mattered. So every signal is weighted:
 *
 *   caution  The reader would draw a wrong conclusion without it. Shown, worded, unmissable.
 *   context  Worth knowing, never alarming. One quiet line.
 *   (none)   The unremarkable case renders as nothing at all.
 *
 * The last line is the important one. An official, route-wide, recently confirmed fact is
 * the *expected* case and gets no badge — because a badge on everything is a badge on
 * nothing. `route_wide` in particular is deliberately not a chip: it is the default a reader
 * already assumes, and decorating it would drown the `programme`-scoped fact sitting beside
 * it, which is exactly the confusion FR-81 exists to prevent.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * What this module refuses to invent:
 *
 *   **Thresholds.** CLAUDE.md §11 lists "exact staleness thresholds for established routes"
 *   as an open decision, so nothing here decides that a fact has gone stale after N days.
 *   Staleness comes only from `reviewDueAt` and `expiresAt` — dates a contributor actually
 *   stored. Where no stored date exists, the last-confirmed date is shown as a date and the
 *   reader judges. A made-up threshold would look like knowledge and be a guess.
 *
 *   **Percentages.** VR-14 shows "20% freshness, 28% confidence" and VR-03 shows "Community
 *   Verified 98%". Those are illustrative sample data (CLAUDE.md §8.6), and a percentage
 *   implies a precision we do not have. Evidence is reported as counts and dates.
 *
 *   **Verification.** No output of this module asserts that anything is correct, safe or
 *   checked. We are not an admission or immigration authority (BR-20).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Invariant 12, structurally: `RouteTrustInput` has no report count, and no other field
 * from which one could be inferred. A function that cannot see reports cannot derive a
 * "safe" badge from their absence (BR-04, D-19). Phase 9 introduces reports; it must add
 * them to a *caution* path, never to this one.
 *
 * Invariant 14, structurally: `routePassport` echoes the stored `lifecycleState` and never
 * computes one. Counts here describe; they do not promote, archive or confer trust
 * (FR-71, BR-32). Lifecycle transitions are Phase 11's, driven by the revision record.
 */

/**
 * The window used to describe *recent* activity, in days.
 *
 * This is a display window — "how much has moved lately" — and deliberately **not** the
 * staleness threshold that CLAUDE.md §11 leaves open. Nothing is judged stale, fresh,
 * settled or volatile by it; it only decides which changes are counted as recent, in the
 * same way the history view shows the most recent hundred entries.
 */
export const RECENT_ACTIVITY_WINDOW_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

export function isWithinRecentWindow(when: Date | null, now: Date): boolean {
  if (when === null) return false
  return now.getTime() - when.getTime() <= RECENT_ACTIVITY_WINDOW_DAYS * DAY_MS
}

/** How loudly a signal should be rendered. See the module note above. */
export type SignalWeight = 'caution' | 'context'

// ─────────────────────────────────────────────────────────────────────────────────────────
// Field-level signals — FR-33, FR-49, FR-52, FR-53, FR-54, FR-70, FR-74, FR-81
// ─────────────────────────────────────────────────────────────────────────────────────────

export interface FieldTrustInput {
  readonly sourceClass: SourceClass
  readonly applicability: readonly FieldApplicability[]
  readonly lastConfirmedAt: Date | null
  /** A date a contributor stored. Never inferred (see the note on thresholds). */
  readonly reviewDueAt: Date | null
  readonly effectiveFrom: Date | null
  readonly expiresAt: Date | null
  readonly revisionCount: number
  readonly lastRevisedAt: Date | null
  /**
   * True when two revisions of this field share one `previousRevisionId`.
   *
   * That is a **structural** disagreement, not a heuristic: two contributors started from
   * the same value and wrote different corrections. Phase 3 preserves both rather than
   * letting the later one win silently, and this is where the reader finally sees it
   * (invariant 15, FR-70, BR-21).
   */
  readonly hasForkedHistory: boolean
}

export type FieldSignalId =
  /** The stored source class says the claim is contested. */
  | 'source_disputed'
  /** The revision chain forked: two corrections from one starting point. */
  | 'history_forked'
  /** A community submission nobody has corroborated (invariant 9). */
  | 'unverified_submission'
  /** Past a stored `expiresAt`. */
  | 'past_expiry'
  /** Past a stored `reviewDueAt`. */
  | 'review_due'
  /** Applies to something narrower than the route (FR-81). */
  | 'narrow_scope'
  /** Nobody stated the scope. Silence is not a claim of universality. */
  | 'scope_not_stated'
  /** Not effective yet, so it is not the rule today. */
  | 'not_yet_effective'
  /** Changed more than once inside the recent window. A fact, not a judgement. */
  | 'changed_recently'
  /** No one has ever confirmed this. */
  | 'never_confirmed'

export interface FieldSignal {
  readonly id: FieldSignalId
  readonly weight: SignalWeight
  /**
   * Detail the copy needs, where the signal is about something countable or scoped.
   * Kept structured rather than pre-formatted so the dictionary owns every word.
   */
  readonly scopes?: readonly FieldApplicability[]
  readonly count?: number
}

const COMMUNITY_UNCORROBORATED: ReadonlySet<SourceClass> = new Set([Source.community_submission])

/**
 * Which signals are true of one field, most consequential first.
 *
 * The order is the render order, and it is not alphabetical or arbitrary: a reader scanning
 * a long step must meet "this is disputed" before "this changed twice recently".
 */
export function fieldSignals(input: FieldTrustInput, now: Date): readonly FieldSignal[] {
  const signals: FieldSignal[] = []

  // ── caution: the reader would be misled without these ────────────────────────────────
  if (input.sourceClass === Source.disputed_under_review) {
    signals.push({ id: 'source_disputed', weight: 'caution' })
  }

  if (input.hasForkedHistory) {
    signals.push({ id: 'history_forked', weight: 'caution' })
  }

  if (input.expiresAt !== null && input.expiresAt.getTime() <= now.getTime()) {
    signals.push({ id: 'past_expiry', weight: 'caution' })
  }

  if (input.effectiveFrom !== null && input.effectiveFrom.getTime() > now.getTime()) {
    signals.push({ id: 'not_yet_effective', weight: 'caution' })
  }

  if (COMMUNITY_UNCORROBORATED.has(input.sourceClass)) {
    signals.push({ id: 'unverified_submission', weight: 'caution' })
  }

  // Scope narrower than the route changes whether the fact follows this particular reader,
  // so it is a caution rather than decoration. `route_wide` deliberately produces nothing.
  const narrow = input.applicability.filter((scope) => scope !== Applicability.route_wide)
  if (narrow.length > 0) {
    signals.push({ id: 'narrow_scope', weight: 'caution', scopes: narrow })
  }

  // ── context: worth knowing, said quietly ─────────────────────────────────────────────
  if (input.applicability.length === 0) {
    signals.push({ id: 'scope_not_stated', weight: 'context' })
  }

  if (input.reviewDueAt !== null && input.reviewDueAt.getTime() <= now.getTime()) {
    signals.push({ id: 'review_due', weight: 'context' })
  }

  if (input.revisionCount > 1 && isWithinRecentWindow(input.lastRevisedAt, now)) {
    signals.push({ id: 'changed_recently', weight: 'context', count: input.revisionCount })
  }

  if (input.lastConfirmedAt === null) {
    signals.push({ id: 'never_confirmed', weight: 'context' })
  }

  return signals
}

/**
 * Which of the three presentation groups a field belongs to.
 *
 * Invariant 11 and FR-54 say an official requirement and a community experience must never
 * look alike or occupy one another's space. Phase 3 already keeps them in separate rows;
 * this keeps them in separate *regions* of the page, under a heading that says what the
 * region is. Separation by position rather than by badge is also what lets the per-field
 * markers stay few — the group heading carries the provenance once, so eleven fields do not
 * repeat it eleven times.
 */
export type FieldGroupId = 'group_disputed' | 'group_official' | 'group_community'

export function fieldGroup(sourceClass: SourceClass): FieldGroupId {
  if (sourceClass === Source.disputed_under_review) return 'group_disputed'
  if (sourceClass === Source.official || sourceClass === Source.institutional_public) {
    return 'group_official'
  }
  return 'group_community'
}

/** Render order. Disputed first: a reader must not scroll past a contested claim. */
export const FIELD_GROUP_ORDER: readonly FieldGroupId[] = ['group_disputed', 'group_official', 'group_community']

// ─────────────────────────────────────────────────────────────────────────────────────────
// Route-level passport — FR-10, FR-11, FR-62, FR-74
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * What a ribbon in search results can see about a route's standing.
 *
 * Deliberately a strict subset of `RouteTrustInput`: a ribbon must not run a per-route
 * contributor and revision-activity aggregation for every search result, and showing a
 * *different* set of concerns in search than on the route itself would be worse than showing
 * fewer. The subset relationship is enforced by the type below extending this one, and the
 * shared cautions are computed by one function both callers use — so a ribbon can only ever
 * show a subset of what the route page shows, never something it contradicts.
 */
export interface RouteTrustSnapshot {
  /** Stored, never computed here. Transitions are Phase 11 (invariant 14, FR-71, BR-32). */
  readonly lifecycleState: RouteLifecycleState
  readonly informationCount: number
  /** Information items confirmed by somebody at least once. Starts at 0, honestly. */
  readonly confirmedCount: number
  /** Items past a stored `reviewDueAt` or `expiresAt`. */
  readonly needsReviewCount: number
  /** Items whose source class is disputed, or whose revision history has forked. */
  readonly disputedCount: number
}

/**
 * Everything the full route passport is allowed to see.
 *
 * **There is no report count here, and there must never be one.** Invariant 12 (BR-04,
 * D-19): "no reports" is not evidence of safety, and the surest way never to render a badge
 * derived from the absence of reports is to build the summary in a function that cannot
 * observe reports at all. Phase 9 adds reporting; when it does, a report must reach the
 * reader as a caution, never as an input that could make this summary look better.
 */
export interface RouteTrustInput extends RouteTrustSnapshot {
  readonly createdAt: Date
  /** Distinct authors across every revision of the route, its steps, edges and fields. */
  readonly contributorCount: number
  /**
   * How many people follow this route, and how many of them say they finished — FR-10, FR-41.
   *
   * **Counts, and only counts.** No ids, no dates, no per-step breakdown, nothing that could
   * be narrowed back to one person's progress (§12.3, invariant 5, test 5b). A follower count
   * says how many; it can never say who, or where they have got to.
   *
   * `selfReportedCompletionCount` is exactly what its name says. Nobody verified it, nobody
   * was asked to prove anything, and the copy that renders it must read "users marked this
   * completed" rather than anything resembling a verified visa (FR-41, §26, invariant 17).
   *
   * And note where they sit: as *evidence* in the passport, never as a lever. A route with
   * ten thousand followers does not thereby become established (invariant 14, FR-71, BR-32).
   */
  readonly followerCount: number
  readonly selfReportedCompletionCount: number
  /** Revisions inside the recent window — FR-62 activity, reported as a count. */
  readonly recentChangeCount: number
  readonly lastChangedAt: Date | null
  readonly lastConfirmedAt: Date | null
}

export type RouteCautionId =
  /** The stored lifecycle state is something other than established. */
  | 'lifecycle_not_established'
  /** The route has a shape but no information inside it yet. */
  | 'no_information'
  /** At least one item is disputed or contested. */
  | 'disputed_information'
  /** At least one item is past its stored review or expiry date. */
  | 'information_needs_review'
  /** Nobody has confirmed anything on this route yet. */
  | 'no_confirmations'
  /** One contributor means nobody has independently corroborated it. */
  | 'single_contributor'

/**
 * The cautions derivable from the ribbon-sized snapshot, most consequential first.
 *
 * Shared by the ribbon and the route passport so the two can never disagree about a route.
 */
export function snapshotCautions(input: RouteTrustSnapshot): readonly RouteCautionId[] {
  const cautions: RouteCautionId[] = []

  // `established` is the one stored state that is not, by itself, a reason for caution.
  if (input.lifecycleState !== Lifecycle.established) cautions.push('lifecycle_not_established')
  if (input.informationCount === 0) cautions.push('no_information')
  if (input.disputedCount > 0) cautions.push('disputed_information')
  if (input.needsReviewCount > 0) cautions.push('information_needs_review')
  if (input.informationCount > 0 && input.confirmedCount === 0) cautions.push('no_confirmations')

  return cautions
}

export interface RoutePassport extends RouteTrustInput {
  readonly cautions: readonly RouteCautionId[]
}

/**
 * The route's observable standing, as evidence rather than as a score — FR-11, FR-74.
 *
 * Deliberately not a grade. It reports what is countable and lets the reader weigh it,
 * because the alternative is a number that looks authoritative and is not. A route with
 * excellent research and zero confirmations is honest; a route displaying "92% confidence"
 * because a formula said so is not (§21.1, BR-05).
 *
 * The route maturity *label* is CLAUDE.md §11's open decision, so this reuses the stored
 * lifecycle vocabulary rather than inventing a parallel one. And note what it does **not**
 * do: it never writes, never changes `lifecycleState`, and has no branch in which a large
 * count promotes a route to anything (invariant 14, FR-71, BR-32).
 */
export function routePassport(input: RouteTrustInput): RoutePassport {
  const cautions = [...snapshotCautions(input)]

  // Only the full input can see this one, which is exactly why the snapshot is a subset
  // rather than a second, drifting definition.
  if (input.contributorCount <= 1) cautions.push('single_contributor')

  return { ...input, cautions }
}
