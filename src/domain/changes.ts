import type {
  ChangeSeverity,
  FieldApplicability,
  FollowerChangeStance,
  JourneyStepStatus,
  RouteChangeKind,
} from '@/domain/enums'
import {
  FieldApplicability as Applicability,
  FollowerChangeStance as Stance,
  JourneyStepStatus as Status,
  RouteChangeKind as Kind,
} from '@/domain/enums'
import { stepOrder } from '@/domain/graph/order'
import type { GraphStep, RouteGraph } from '@/domain/graph/types'
import { activeGraph } from '@/domain/graph/validate'

/**
 * Change propagation and follower relevance — Phase 10.
 *
 * Pure. No database, no React, no copy — the same split Phase 6 used for trust, and for the
 * same reason: what is *true* about a change is decidable from stored data and testable
 * without a browser, while what a reader is *told* belongs to the dictionary and the pixels
 * belong to components.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The line this module draws, and why it is the whole design.**
 *
 * A change to a public route has two halves, and they have completely different epistemic
 * status:
 *
 *   **Derived — a fact about stored data.** Which steps were added, archived, reordered or
 *   relabelled; where in the route it happened; how much of it there is. This falls out of
 *   the append-only revision ledger by comparing two points in time. It needs no judgement,
 *   no threshold and no contributor, so it is *always available* — every follower can always
 *   see that the route moved and where, even if nobody wrote a word about it (FR-28, FR-77,
 *   FR-22).
 *
 *   **Declared — a judgement about the world.** Severity and effective date. §41.2 defines
 *   severity by consequence — "may require action before the user reaches that stage", "can
 *   invalidate or seriously disrupt the planned path" — and no diff contains that. Neither
 *   does any date in the ledger tell you when a visa rule starts applying. A contributor
 *   states these or they are absent, and absent renders as absent (FR-59, FR-60).
 *
 * The failure this avoids is a system that infers "important" from "three fields changed".
 * That is precisely the opaque heuristic FR-71 forbids and CLAUDE.md §11 leaves open, and it
 * would be wrong in both directions: a phone-number correction is not important because it
 * touched many rows, and a single word becoming "mandatory" can be critical.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What this module refuses to invent.**
 *
 *   **A relevance score.** There is no number, no percentage, no weighting sum anywhere here.
 *   Relevance is a small closed set of *positions* a follower can be in relative to a change,
 *   each of which is a checkable fact — they completed the step, they have not reached it,
 *   the change takes effect next month. A "73% relevant" would imply a precision nobody has.
 *
 *   **Applicability.** Where a change concerns a fact scoped narrower than the route — one
 *   programme, one intake, one application channel — this module reports *that the scope is
 *   narrow*, and stops. It never decides the change does or does not apply to a given reader,
 *   because it does not know which programme they applied to. §13.3 says exactly what to do
 *   instead: show it and let the follower mark it. `FollowerChangeStance` is that mark.
 *
 *   **Any reason to touch private state.** Nothing in this file mutates anything. Relevance
 *   is computed at read time from progress the follower recorded, and a route change can no
 *   more reset a completion than a weather forecast can move a Tuesday (FR-30, BR-17, D-12,
 *   invariant 8).
 */

const DAY_MS = 24 * 60 * 60 * 1000

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Dates: which one decides
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * A change as it was announced. The declared half.
 *
 * `effectiveAt` is nullable because §41.1 says "where known" — and a great many real changes
 * genuinely have no published start date. Nullable is the honest representation; defaulting
 * it to the announcement date would silently manufacture a fact.
 */
export interface AnnouncedChange {
  readonly id: string
  readonly kind: RouteChangeKind
  readonly severity: ChangeSeverity
  /** When this was recorded here — the edit date. */
  readonly announcedAt: Date
  /** When it starts applying in the world, where known (FR-59, §41.1). */
  readonly effectiveAt: Date | null
  /** The step this concerns, or null for a route-wide change. This is the "where". */
  readonly stepId: string | null
  readonly fieldId: string | null
  /** Applicability of the fact that changed, where the change concerns one field (FR-81). */
  readonly applicability: readonly FieldApplicability[]
}

/**
 * **The date that decides whether a change reaches a follower — BR-26, invariant 21.**
 *
 * "Where known, effective date matters more than edit date for deciding whether a
 * requirement affects a follower."
 *
 * The distinction is not academic. A visa rule announced on 1 March and effective 1 June
 * does not retroactively invalidate an application filed in April, and a platform that
 * compared against the *edit* date would tell that applicant their completed step was now
 * wrong. Comparing against the effective date tells them the truth: it takes effect after
 * what they already did.
 *
 * Falling back to `announcedAt` when no effective date is known is the conservative
 * direction — it treats the change as already in force, so nothing is hidden from somebody
 * it might affect.
 */
export function operativeDate(change: AnnouncedChange): Date {
  return change.effectiveAt ?? change.announcedAt
}

/** A change whose stated effective date has not arrived. Real, published, not yet in force. */
export function isPending(change: AnnouncedChange, now: Date): boolean {
  return change.effectiveAt !== null && change.effectiveAt.getTime() > now.getTime()
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Relevance to one follower
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Where a follower stands relative to a change. One of these, always, and never a number.
 *
 * The ordering here is roughly "how much this asks of the reader", and the dictionary words
 * follow it, but nothing in the code sums or ranks these — `bearing` is a label for a
 * situation, not a score to be compared.
 */
export type ChangeBearing =
  /** Not following this route. The change is news about a route, not about them. */
  | 'not_following'
  /** The change concerns a step they have not started. This is the actionable case (FR-29). */
  | 'ahead'
  /** They are working on the changed step right now. */
  | 'underway'
  /**
   * They recorded this step done, and the change took effect *after* that date.
   *
   * The completion stands and the change is context — the case BR-26 and §13.2 exist for.
   */
  | 'completed_before_effective'
  /**
   * They recorded this step done, and we cannot say the change came later — either no
   * effective date is known or it precedes their date.
   *
   * The completion still stands (nothing may reset it), but the platform must not claim they
   * are unaffected, because it does not know that.
   */
  | 'already_done'
  /** They marked the step skipped or not applicable to them. */
  | 'set_aside'
  /** The change is not tied to a step, so no position relative to progress exists. */
  | 'whole_route'

/**
 * Facts worth stating alongside the bearing. Each is checkable; none is a judgement.
 *
 * These are ids, not sentences. The dictionary owns the words (CLAUDE.md §9).
 */
export type ChangeNote =
  /** Its stated effective date is in the future (§41.1). */
  | 'not_yet_effective'
  /** It took effect after the date the follower recorded for this step (BR-26). */
  | 'effective_after_your_date'
  /** Their recorded completion is untouched and stays that way (FR-30, BR-17). */
  | 'completion_preserved'
  /** It concerns a fact scoped narrower than the route, so it may not apply (FR-81, §13.3). */
  | 'scope_narrower_than_route'
  /** It changes the shape of the route, not only wording — later steps may move. */
  | 'shape_changed'
  /** The follower has already said what they think this means for them (§13.3). */
  | 'you_marked_this'

/**
 * How loudly to render. The same three weights Phase 6 established for trust, deliberately.
 *
 * `caution` means the reader would plan wrongly without reading it. `context` means worth
 * knowing and never alarming. Absence — the third weight — is expressed by `null`, and is the
 * load-bearing one: a change to a step somebody finished last month should not shout.
 */
export type ChangeWeight = 'caution' | 'context'

export interface FollowerPosition {
  /** The follower's status on the changed step, or null if they have no record for it. */
  readonly status: JourneyStepStatus | null
  /** The date they recorded actually doing it, where they gave one. */
  readonly actualDate: Date | null
  /** Their planned date for it, where they gave one. */
  readonly targetDate: Date | null
  /** What they already decided about this change, if anything (§13.3). */
  readonly stance: FollowerChangeStance | null
}

export const NOT_FOLLOWING: FollowerPosition = {
  status: null,
  actualDate: null,
  targetDate: null,
  stance: null,
}

export interface ChangeRelevance {
  readonly changeId: string
  readonly bearing: ChangeBearing
  readonly notes: readonly ChangeNote[]
  /** `null` means render it plainly, with no marker at all. */
  readonly weight: ChangeWeight | null
  /**
   * True when the platform cannot tell whether this applies to this follower, and should
   * therefore ask rather than assert (§13.3).
   */
  readonly askFollower: boolean
}

/** Applicability values narrower than the whole route. `route_wide` is the reader's default. */
function isNarrow(applicability: readonly FieldApplicability[]): boolean {
  return applicability.some((value) => value !== Applicability.route_wide)
}

/**
 * Where one follower stands relative to one change — FR-29, FR-61, §41.3, BR-26.
 *
 * The one rule that matters most, stated plainly: **a completed step stays completed.** This
 * function has no way to say otherwise; there is no output meaning "your progress is now
 * invalid", because no such conclusion is ever correct. §41.3: "A user who already completed
 * a step before an effective date should retain that completion and see the change in
 * context."
 *
 * Weighting follows from bearing, and is deliberately stingy. Only two situations earn a
 * caution: a change to a step the follower has not finished, and a change they have said
 * applies to them. Everything else is context or nothing. A page that cautioned on every
 * revision would train followers to ignore the one that mattered — the same argument Phase 6
 * made about badges, applied to change.
 */
export function changeRelevance(
  change: AnnouncedChange,
  position: FollowerPosition,
  now: Date,
): ChangeRelevance {
  const notes: ChangeNote[] = []
  if (isPending(change, now)) notes.push('not_yet_effective')
  if (change.kind === Kind.structural) notes.push('shape_changed')
  if (isNarrow(change.applicability)) notes.push('scope_narrower_than_route')
  if (position.stance !== null) notes.push('you_marked_this')

  const bearing = bearingOf(change, position, notes)

  // §13.3 — ask only where the answer is genuinely unknowable here *and* the follower has not
  // already given it. Asking somebody a question they have answered is not respect for their
  // judgement, it is nagging.
  const askFollower =
    notes.includes('scope_narrower_than_route') &&
    position.stance === null &&
    bearing !== 'not_following' &&
    bearing !== 'whole_route'

  return { changeId: change.id, bearing, notes, weight: weigh(bearing, position), askFollower }
}

function bearingOf(
  change: AnnouncedChange,
  position: FollowerPosition,
  notes: ChangeNote[],
): ChangeBearing {
  if (change.stepId === null) return 'whole_route'
  if (position.status === null) return 'not_following'

  switch (position.status) {
    case Status.completed: {
      // Completion is preserved either way. What differs is whether we can *say* the change
      // came afterwards, and we may only say it when both dates are known (BR-26).
      notes.push('completion_preserved')
      const done = position.actualDate
      const operative = operativeDate(change)
      if (done !== null && operative.getTime() > done.getTime()) {
        notes.push('effective_after_your_date')
        return 'completed_before_effective'
      }
      return 'already_done'
    }
    case Status.in_progress:
      return 'underway'
    case Status.skipped:
    case Status.not_applicable:
      return 'set_aside'
    case Status.not_started:
      return 'ahead'
  }
}

function weigh(bearing: ChangeBearing, position: FollowerPosition): ChangeWeight | null {
  // A follower who has said "this does not apply to me" has answered the question. Respecting
  // that is the whole point of asking (§13.3) — re-raising it would make the control a lie.
  if (position.stance === Stance.not_applicable) return null
  if (position.stance === Stance.already_handled) return 'context'

  switch (bearing) {
    case 'ahead':
    case 'underway':
      return 'caution'
    case 'whole_route':
      return 'context'
    case 'completed_before_effective':
    case 'already_done':
    case 'set_aside':
      return 'context'
    case 'not_following':
      return null
  }
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Temporary disruptions — invariant 19, FR-32, FR-63, BR-08, BR-27
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * A time-, location- and process-scoped overlay. **Never a route revision.**
 *
 * §41.5: temporary events "should appear as time- and location-scoped disruptions layered on
 * top of the normal route. They should expire or resolve without rewriting the permanent
 * process." The scope lives in three fields, one per dimension the baseline names:
 *
 *   `startsAt` / `endsAt`   date scope — "closed 18–30 Sep"
 *   `locationScope`         location scope — "Dhaka, Bangladesh"
 *   `stepId`                process scope — "affects the IELTS step"
 */
export interface Disruption {
  readonly id: string
  readonly severity: ChangeSeverity
  readonly startsAt: Date
  /** When it stops. Null means open-ended — still running until somebody resolves it. */
  readonly endsAt: Date | null
  /** Set when it ended early, or was found never to have applied. */
  readonly resolvedAt: Date | null
  readonly locationScope: string | null
  readonly stepId: string | null
}

/**
 * **Expiry is a comparison, not an event.**
 *
 * This is the entire mechanism by which a disruption stops affecting the current experience
 * without anything being rewritten (BR-08, invariant 19). There is no scheduled job, no
 * status column to flip, and above all no edit to the route: a disruption whose `endsAt` has
 * passed simply stops matching, and the road underneath it was never touched to begin with.
 *
 * The row stays. It remains readable as history — "the Dhaka centre was shut that fortnight"
 * is exactly the kind of thing a student a year later wants to find (invariants 1 and 4).
 */
export function isDisruptionActive(disruption: Disruption, now: Date): boolean {
  if (disruption.resolvedAt !== null && disruption.resolvedAt.getTime() <= now.getTime()) {
    return false
  }
  if (disruption.startsAt.getTime() > now.getTime()) return false
  if (disruption.endsAt !== null && disruption.endsAt.getTime() <= now.getTime()) return false
  return true
}

export type DisruptionBearing =
  /** Over, or not yet begun. Shown as history, never as a warning. */
  | 'inactive'
  /** Active, but the reader has no journey — general awareness. */
  | 'active'
  /** Active and touching a step this follower has not finished. */
  | 'affects_your_next_steps'
  /** Active and their own planned date for the step falls inside the window (§31.4). */
  | 'affects_your_planned_date'
  /** Active, but the step it touches is behind them. */
  | 'already_past_it'

export interface DisruptionRelevance {
  readonly disruptionId: string
  readonly bearing: DisruptionBearing
  readonly weight: ChangeWeight | null
}

/**
 * Whether an active disruption is this follower's problem — §31.4, FR-63.
 *
 * The scenario the baseline actually describes: "A temporary event causes certain IELTS
 * sessions in Dhaka to be rescheduled... Followers whose **personal test date** may be
 * affected see a relevant warning when they return to their journey."
 *
 * So the sharpest signal available is the follower's own `targetDate` for the affected step
 * landing inside the disruption window. That is not a heuristic — it is the follower's own
 * stated plan compared against the disruption's own stated dates. Both numbers were entered
 * by people; this only checks whether they overlap.
 */
export function disruptionRelevance(
  disruption: Disruption,
  position: FollowerPosition,
  now: Date,
): DisruptionRelevance {
  if (!isDisruptionActive(disruption, now)) {
    return { disruptionId: disruption.id, bearing: 'inactive', weight: null }
  }

  if (disruption.stepId === null || position.status === null) {
    return { disruptionId: disruption.id, bearing: 'active', weight: 'context' }
  }

  if (position.status === Status.completed) {
    return { disruptionId: disruption.id, bearing: 'already_past_it', weight: null }
  }
  if (position.status === Status.skipped || position.status === Status.not_applicable) {
    return { disruptionId: disruption.id, bearing: 'already_past_it', weight: null }
  }

  const planned = position.targetDate
  if (planned !== null && withinWindow(disruption, planned)) {
    return { disruptionId: disruption.id, bearing: 'affects_your_planned_date', weight: 'caution' }
  }

  return { disruptionId: disruption.id, bearing: 'affects_your_next_steps', weight: 'caution' }
}

function withinWindow(disruption: Disruption, when: Date): boolean {
  if (when.getTime() < disruption.startsAt.getTime()) return false
  if (disruption.endsAt === null) return true
  return when.getTime() <= disruption.endsAt.getTime()
}

/** Whole days a disruption still has to run, for copy that says "for another 6 days". */
export function daysRemaining(disruption: Disruption, now: Date): number | null {
  if (disruption.endsAt === null) return null
  return Math.max(0, Math.ceil((disruption.endsAt.getTime() - now.getTime()) / DAY_MS))
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Shadow comparison — FR-22, FR-77, §14
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * What happened to one step between two versions of a route.
 *
 * A row can carry several — a step can be both renamed and reordered — so this is a set per
 * row rather than a single verdict. Collapsing them to one would silently drop the news.
 */
export type StepChangeMark = 'step_added' | 'step_archived' | 'step_reordered' | 'step_relabelled' | 'step_retimed'

/**
 * One line of the comparison: the same step in both versions, or its absence from one.
 *
 * `ordinal` is the shared spine down the middle of VR-07 — the thing that makes two columns
 * legible as one comparison rather than two lists.
 */
export interface ComparisonRow {
  readonly key: string
  readonly ordinal: number
  readonly before: GraphStep | null
  readonly after: GraphStep | null
  readonly marks: readonly StepChangeMark[]
}

export interface ShadowComparison {
  readonly rows: readonly ComparisonRow[]
  /** FR-77's counts: how much changed, by kind. Facts, not a score. */
  readonly scale: {
    readonly added: number
    readonly archived: number
    readonly reordered: number
    readonly relabelled: number
    readonly retimed: number
    readonly unchanged: number
  }
  readonly structureChanged: boolean
}

function timingOf(step: GraphStep): string {
  return `${step.earliestStartOffsetDays ?? ''}|${step.typicalDurationDays ?? ''}`
}

/**
 * Aligns two versions of a route into one comparison — the data behind the shadow route.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **This is where Phase 4's overlap problem is actually solved.**
 *
 * Phase 4 built the shadow primitives and found the flaw: drawing the previous version's
 * geometry underneath the current one makes it *invisible* whenever the two shapes are
 * similar, which is the overwhelmingly common case — a route with one new step is 90%
 * identical, so 90% of the shadow hides exactly behind the road on top of it. The comparison
 * disappears precisely when it is easiest to understand.
 *
 * The fix is not a cleverer overlay. It is to stop asking geometry to carry the comparison,
 * and give the two versions **their own space, aligned by step identity**. Step ids are
 * stable across revisions — Phase 3 made sure of that — so the same step can be found on both
 * sides and put on the same line, and a step present on only one side leaves a visible gap
 * opposite it. That is exactly what VR-07 shows: two columns, a numbered spine between them,
 * and a per-row verdict.
 *
 * Crucially this is a *layout* decision made outside the renderer. Both versions are still
 * drawn by the same generic `Road`, from the same layout pass, with no knowledge that a
 * comparison is happening. No second renderer exists, and nothing here is route-specific
 * (invariant 24).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Ordering: the current version leads, because that is the one a reader is going to act on.
 * Steps that exist only in the older version are slotted in after whichever surviving step
 * preceded them, so an archived step appears where it used to live rather than in a bin at the
 * bottom — §14.1 requires removed stages to "remain visible in the shadow" and a footnote is
 * not visibility.
 */
export function compareVersions(before: RouteGraph, after: RouteGraph): ShadowComparison {
  const a = activeGraph(before)
  const b = activeGraph(after)

  const beforeSteps = new Map(a.steps.map((s) => [s.id, s]))
  const afterSteps = new Map(b.steps.map((s) => [s.id, s]))

  const beforeOrder = stepOrder(before)
  const afterOrder = stepOrder(after)

  // Position among survivors only. Comparing raw indices would report every step after an
  // insertion as "moved", which is noise dressed up as news — the same correction Phase 3's
  // structural diff already had to make.
  const survivors = afterOrder.filter((id) => beforeSteps.has(id))
  const beforeRank = new Map(beforeOrder.filter((id) => afterSteps.has(id)).map((id, i) => [id, i]))
  const afterRank = new Map(survivors.map((id, i) => [id, i]))

  // Where each archived step should be slotted back in: after the last surviving step that
  // preceded it in the old order.
  const reinsertAfter = new Map<string | null, string[]>()
  let anchor: string | null = null
  for (const id of beforeOrder) {
    if (afterSteps.has(id)) {
      anchor = id
      continue
    }
    const list = reinsertAfter.get(anchor) ?? []
    list.push(id)
    reinsertAfter.set(anchor, list)
  }

  const rows: ComparisonRow[] = []
  let ordinal = 0

  const pushArchived = (afterKey: string | null): void => {
    for (const id of reinsertAfter.get(afterKey) ?? []) {
      const step = beforeSteps.get(id)
      if (!step) continue
      ordinal += 1
      rows.push({ key: id, ordinal, before: step, after: null, marks: ['step_archived'] })
    }
  }

  pushArchived(null)

  for (const id of afterOrder) {
    const nowStep = afterSteps.get(id)
    if (!nowStep) continue
    const wasStep = beforeSteps.get(id) ?? null
    ordinal += 1

    const marks: StepChangeMark[] = []
    if (wasStep === null) {
      marks.push('step_added')
    } else {
      if (wasStep.label !== nowStep.label) marks.push('step_relabelled')
      if (timingOf(wasStep) !== timingOf(nowStep)) marks.push('step_retimed')
      if (beforeRank.get(id) !== afterRank.get(id)) marks.push('step_reordered')
    }

    rows.push({ key: id, ordinal, before: wasStep, after: nowStep, marks })
    pushArchived(id)
  }

  const count = (mark: StepChangeMark): number =>
    rows.filter((row) => row.marks.includes(mark)).length

  const scale = {
    added: count('step_added'),
    archived: count('step_archived'),
    reordered: count('step_reordered'),
    relabelled: count('step_relabelled'),
    retimed: count('step_retimed'),
    unchanged: rows.filter((row) => row.marks.length === 0).length,
  }

  // Edges carry branch structure, and a route can be rewired without any step changing —
  // a step made parallel rather than sequential is a real structural change with identical
  // step sets on both sides (invariant 22).
  const beforeEdges = new Map(a.edges.map((e) => [e.id, e]))
  const afterEdges = new Map(b.edges.map((e) => [e.id, e]))
  const edgesChanged =
    [...afterEdges.values()].some((e) => {
      const was = beforeEdges.get(e.id)
      return was === undefined || was.kind !== e.kind
    }) || [...beforeEdges.keys()].some((id) => !afterEdges.has(id))

  return {
    rows,
    scale,
    structureChanged:
      scale.added > 0 || scale.archived > 0 || scale.reordered > 0 || scale.retimed > 0 || edgesChanged,
  }
}
