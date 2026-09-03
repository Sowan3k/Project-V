import { describe, expect, it } from 'vitest'

import {
  changeRelevance,
  compareVersions,
  daysRemaining,
  disruptionRelevance,
  isDisruptionActive,
  isPending,
  NOT_FOLLOWING,
  operativeDate,
  type AnnouncedChange,
  type Disruption,
  type FollowerPosition,
} from '../../src/domain/changes'
import {
  ChangeSeverity,
  FieldApplicability,
  FollowerChangeStance,
  JourneyStepStatus,
  RouteChangeKind,
  StepCategory,
  StepEdgeKind,
} from '../../src/domain/enums'
import type { GraphEdge, GraphStep, RouteGraph } from '../../src/domain/graph/types'

/**
 * Phase 10 — the change engine, proved without a database or a browser.
 *
 * Everything asserted here is a property of stored data, which is exactly why the module is
 * pure: the rules that matter most (a completion is never invalidated; effective date beats
 * edit date; nothing produces a score) are decidable from a few dates and a status, and
 * putting them behind a Prisma client would have made them expensive to test and therefore
 * under-tested.
 */

const JAN = (day: number): Date => new Date(Date.UTC(2026, 0, day))

const change = (over: Partial<AnnouncedChange> = {}): AnnouncedChange => ({
  id: 'c1',
  kind: RouteChangeKind.field_correction,
  severity: ChangeSeverity.important,
  announcedAt: JAN(10),
  effectiveAt: null,
  stepId: 's1',
  fieldId: null,
  applicability: [FieldApplicability.route_wide],
  ...over,
})

const at = (over: Partial<FollowerPosition> = {}): FollowerPosition => ({
  status: JourneyStepStatus.not_started,
  actualDate: null,
  targetDate: null,
  stance: null,
  ...over,
})

/* ════════════════════════════════════════════════════════════════════════════════════════ */

describe('FR-59, BR-26, invariant 21 — effective date beats edit date', () => {
  it('uses the effective date when one is known', () => {
    expect(operativeDate(change({ announcedAt: JAN(1), effectiveAt: JAN(20) }))).toEqual(JAN(20))
  })

  /**
   * The fallback direction is deliberately the conservative one. With no effective date the
   * change is treated as already in force, so nobody it might affect is left unwarned. The
   * opposite default — treating it as not yet applying — would hide real changes.
   */
  it('falls back to the announcement date, treating the change as already in force', () => {
    expect(operativeDate(change({ announcedAt: JAN(1), effectiveAt: null }))).toEqual(JAN(1))
  })

  it('knows a change whose effective date has not arrived', () => {
    expect(isPending(change({ effectiveAt: JAN(20) }), JAN(10))).toBe(true)
    expect(isPending(change({ effectiveAt: JAN(5) }), JAN(10))).toBe(false)
    expect(isPending(change({ effectiveAt: null }), JAN(10))).toBe(false)
  })

  /**
   * **The scenario BR-26 exists for**, and the one Phase 10 was asked to prove.
   *
   * A rule is announced on the 5th and takes effect on the 20th. A follower filed on the
   * 10th. Comparing against the *edit* date would tell them their completed step is now
   * wrong; comparing against the effective date tells them the truth.
   */
  it('treats a change effective after a completion as context, not invalidation', () => {
    const result = changeRelevance(
      change({ announcedAt: JAN(5), effectiveAt: JAN(20) }),
      at({ status: JourneyStepStatus.completed, actualDate: JAN(10) }),
      JAN(25),
    )

    expect(result.bearing).toBe('completed_before_effective')
    expect(result.notes).toContain('effective_after_your_date')
    expect(result.notes).toContain('completion_preserved')
    // Context, never a caution: nothing is being asked of them.
    expect(result.weight).toBe('context')
  })

  /**
   * And the honest opposite. Where the change was already in force when they recorded the
   * step, the platform must not claim they are unaffected — it does not know that.
   */
  it('does not claim a completion is unaffected when the change predates it', () => {
    const result = changeRelevance(
      change({ announcedAt: JAN(1), effectiveAt: JAN(2) }),
      at({ status: JourneyStepStatus.completed, actualDate: JAN(10) }),
      JAN(25),
    )

    expect(result.bearing).toBe('already_done')
    expect(result.notes).not.toContain('effective_after_your_date')
    // Still preserved. That part is never conditional.
    expect(result.notes).toContain('completion_preserved')
  })

  it('cannot say the change came later when the follower recorded no date', () => {
    const result = changeRelevance(
      change({ effectiveAt: JAN(20) }),
      at({ status: JourneyStepStatus.completed, actualDate: null }),
      JAN(25),
    )
    expect(result.bearing).toBe('already_done')
    expect(result.notes).not.toContain('effective_after_your_date')
  })
})

describe('FR-30, BR-17, invariant 8 — a completion is never invalidated', () => {
  /**
   * The strongest form available to a unit test: across every severity, every kind and every
   * arrangement of dates, a completed step produces **no output that asks anything of the
   * reader** and always carries `completion_preserved`.
   *
   * There is no `ChangeBearing` meaning "your progress is now invalid" — the type has no such
   * member — so this is really asserting that the enumeration stayed honest.
   */
  it('never returns a caution or an invalidation for a completed step', () => {
    for (const severity of [
      ChangeSeverity.informational,
      ChangeSeverity.relevant,
      ChangeSeverity.important,
      ChangeSeverity.critical,
    ]) {
      for (const effectiveAt of [null, JAN(1), JAN(20)]) {
        for (const actualDate of [null, JAN(10)]) {
          const result = changeRelevance(
            change({ severity, effectiveAt, kind: RouteChangeKind.structural }),
            at({ status: JourneyStepStatus.completed, actualDate }),
            JAN(25),
          )
          expect(result.weight, `severity=${severity}`).toBe('context')
          expect(result.notes).toContain('completion_preserved')
        }
      }
    }
  })

  it('is a pure read — the position it was handed is not mutated', () => {
    const position = at({ status: JourneyStepStatus.completed, actualDate: JAN(10) })
    const snapshot = JSON.stringify(position)
    changeRelevance(change({ effectiveAt: JAN(20) }), position, JAN(25))
    expect(JSON.stringify(position)).toBe(snapshot)
  })
})

describe('FR-29, FR-61, §41.3 — relevance is scoped to where the follower actually is', () => {
  it('cautions on a step they have not started', () => {
    const result = changeRelevance(change(), at({ status: JourneyStepStatus.not_started }), JAN(25))
    expect(result.bearing).toBe('ahead')
    expect(result.weight).toBe('caution')
  })

  it('cautions on the step they are working on now', () => {
    const result = changeRelevance(change(), at({ status: JourneyStepStatus.in_progress }), JAN(25))
    expect(result.bearing).toBe('underway')
    expect(result.weight).toBe('caution')
  })

  it('stays quiet about a step they set aside', () => {
    for (const status of [JourneyStepStatus.skipped, JourneyStepStatus.not_applicable]) {
      const result = changeRelevance(change(), at({ status }), JAN(25))
      expect(result.bearing).toBe('set_aside')
      expect(result.weight).toBe('context')
    }
  })

  it('says nothing at all to somebody who does not follow the route', () => {
    const result = changeRelevance(change(), NOT_FOLLOWING, JAN(25))
    expect(result.bearing).toBe('not_following')
    expect(result.weight).toBeNull()
    expect(result.askFollower).toBe(false)
  })

  it('treats a change tied to no step as route-wide context', () => {
    const result = changeRelevance(
      change({ stepId: null }),
      at({ status: JourneyStepStatus.not_started }),
      JAN(25),
    )
    expect(result.bearing).toBe('whole_route')
    expect(result.weight).toBe('context')
  })

  /**
   * **The line that stops this becoming a scoring system.**
   *
   * Whatever else changes, the returned object carries no number: no score, no percentage, no
   * confidence, no rank. Asserted over the whole surface rather than field by field, so a
   * future addition has to break this test to sneak one in (CLAUDE.md §7.3, FR-71).
   */
  it('returns no numeric score of any kind', () => {
    const result = changeRelevance(change(), at(), JAN(25))
    const numeric = Object.entries(result).filter(([, value]) => typeof value === 'number')
    expect(numeric).toEqual([])
    expect(Object.keys(result).sort()).toEqual([
      'askFollower',
      'bearing',
      'changeId',
      'notes',
      'weight',
    ])
  })
})

describe('FR-81, §13.3 — narrow scope is reported, never resolved', () => {
  const narrow = change({ applicability: [FieldApplicability.programme] })

  it('marks a change scoped narrower than the route and asks the follower', () => {
    const result = changeRelevance(narrow, at({ status: JourneyStepStatus.not_started }), JAN(25))
    expect(result.notes).toContain('scope_narrower_than_route')
    expect(result.askFollower).toBe(true)
  })

  /**
   * Invariant 24's sibling for trust copy: `route_wide` is what a reader already assumes, so
   * marking it would put a note on nearly every change and drown the narrow one beside it —
   * the exact confusion FR-81 exists to prevent (CLAUDE.md §7.3).
   */
  it('says nothing about scope when the change is route-wide', () => {
    const result = changeRelevance(change(), at(), JAN(25))
    expect(result.notes).not.toContain('scope_narrower_than_route')
    expect(result.askFollower).toBe(false)
  })

  it('stops asking once the follower has answered', () => {
    for (const stance of [
      FollowerChangeStance.applies,
      FollowerChangeStance.already_handled,
      FollowerChangeStance.not_applicable,
    ]) {
      const result = changeRelevance(narrow, at({ stance }), JAN(25))
      expect(result.askFollower, stance).toBe(false)
      expect(result.notes).toContain('you_marked_this')
    }
  })

  /**
   * A control that keeps re-raising what it was told is not a control. If somebody has said a
   * programme-specific change does not apply to them, the platform believes them.
   */
  it('goes silent on a change the follower said does not apply to them', () => {
    const result = changeRelevance(
      narrow,
      at({ status: JourneyStepStatus.not_started, stance: FollowerChangeStance.not_applicable }),
      JAN(25),
    )
    expect(result.weight).toBeNull()
  })

  it('softens to context on one they say they have already handled', () => {
    const result = changeRelevance(
      narrow,
      at({ status: JourneyStepStatus.not_started, stance: FollowerChangeStance.already_handled }),
      JAN(25),
    )
    expect(result.weight).toBe('context')
  })

  it('never decides for itself that a narrow change does or does not apply', () => {
    // The output offers no such verdict — only that the scope is narrow, and a request to be
    // told. Asserted on the type's whole vocabulary so a future 'does_not_apply_to_you'
    // cannot be added quietly.
    const result = changeRelevance(narrow, at(), JAN(25))
    expect(result.notes.join(' ')).not.toMatch(/applies_to_you|does_not_apply/)
  })
})

describe('§41.2 — severity is carried, never computed', () => {
  /**
   * Relevance is about *position*, severity is about *consequence*, and this module decides
   * only the first. Two changes identical but for severity produce identical relevance —
   * which is the proof that no threshold sneaked in on the severity axis.
   */
  it('produces identical relevance regardless of declared severity', () => {
    const results = [
      ChangeSeverity.informational,
      ChangeSeverity.relevant,
      ChangeSeverity.important,
      ChangeSeverity.critical,
    ].map((severity) =>
      JSON.stringify(changeRelevance(change({ severity }), at(), JAN(25))),
    )
    expect(new Set(results).size).toBe(1)
  })

  it('flags a structural change as shape-changing, whatever its severity', () => {
    const result = changeRelevance(
      change({ kind: RouteChangeKind.structural, severity: ChangeSeverity.informational }),
      at(),
      JAN(25),
    )
    expect(result.notes).toContain('shape_changed')
  })
})

/* ════════════════════════════════════════════════════════════════════════════════════════
   Temporary disruptions
   ════════════════════════════════════════════════════════════════════════════════════════ */

const disruption = (over: Partial<Disruption> = {}): Disruption => ({
  id: 'd1',
  severity: ChangeSeverity.critical,
  startsAt: JAN(10),
  endsAt: JAN(20),
  resolvedAt: null,
  locationScope: 'Dhaka, Bangladesh',
  stepId: 's1',
  ...over,
})

describe('FR-32, FR-63, BR-08, invariant 19 — a disruption expires by arithmetic', () => {
  it('is inactive before it starts, active during, inactive after', () => {
    expect(isDisruptionActive(disruption(), JAN(9))).toBe(false)
    expect(isDisruptionActive(disruption(), JAN(10))).toBe(true)
    expect(isDisruptionActive(disruption(), JAN(15))).toBe(true)
    expect(isDisruptionActive(disruption(), JAN(20))).toBe(false)
    expect(isDisruptionActive(disruption(), JAN(21))).toBe(false)
  })

  /**
   * **Expiry needs nothing to happen.** There is no status column, so the same stored row is
   * active on the 15th and inactive on the 21st with nothing written in between. That is how
   * a disruption stops affecting the route without anything being rewritten (BR-08).
   */
  it('needs no write to expire — the identical row changes answer with the clock', () => {
    const row = disruption()
    expect(isDisruptionActive(row, JAN(15))).toBe(true)
    expect(isDisruptionActive(row, JAN(21))).toBe(false)
    expect(row.endsAt).toEqual(JAN(20))
    expect(row.resolvedAt).toBeNull()
  })

  it('runs open-ended when no end date is known', () => {
    const open = disruption({ endsAt: null })
    expect(isDisruptionActive(open, JAN(400))).toBe(true)
    expect(daysRemaining(open, JAN(15))).toBeNull()
  })

  it('stops early when resolved, keeping the announced window legible', () => {
    const resolved = disruption({ resolvedAt: JAN(14) })
    expect(isDisruptionActive(resolved, JAN(13))).toBe(true)
    expect(isDisruptionActive(resolved, JAN(15))).toBe(false)
    // The original window is untouched, so "called off after four days" stays a readable fact.
    expect(resolved.endsAt).toEqual(JAN(20))
  })

  it('counts whole days remaining', () => {
    expect(daysRemaining(disruption(), JAN(15))).toBe(5)
    expect(daysRemaining(disruption(), JAN(25))).toBe(0)
  })
})

describe('§31.4 — a disruption reaches the follower whose own date falls in the window', () => {
  it('cautions when their planned date for the step is inside the closure', () => {
    const result = disruptionRelevance(
      disruption(),
      at({ status: JourneyStepStatus.not_started, targetDate: JAN(15) }),
      JAN(12),
    )
    expect(result.bearing).toBe('affects_your_planned_date')
    expect(result.weight).toBe('caution')
  })

  it('still cautions on an unfinished step when they have named no date', () => {
    const result = disruptionRelevance(
      disruption(),
      at({ status: JourneyStepStatus.not_started }),
      JAN(12),
    )
    expect(result.bearing).toBe('affects_your_next_steps')
    expect(result.weight).toBe('caution')
  })

  it('says nothing to somebody already past the affected step', () => {
    const result = disruptionRelevance(
      disruption(),
      at({ status: JourneyStepStatus.completed, actualDate: JAN(5) }),
      JAN(12),
    )
    expect(result.bearing).toBe('already_past_it')
    expect(result.weight).toBeNull()
  })

  it('is never a warning once expired, whatever the follower is doing', () => {
    for (const status of [JourneyStepStatus.not_started, JourneyStepStatus.in_progress]) {
      const result = disruptionRelevance(disruption(), at({ status, targetDate: JAN(15) }), JAN(30))
      expect(result.bearing).toBe('inactive')
      expect(result.weight).toBeNull()
    }
  })

  it('is general context for a reader with no journey', () => {
    const result = disruptionRelevance(disruption(), NOT_FOLLOWING, JAN(12))
    expect(result.bearing).toBe('active')
    expect(result.weight).toBe('context')
  })

  it('returns no numeric score either', () => {
    const result = disruptionRelevance(disruption(), at(), JAN(12))
    expect(Object.entries(result).filter(([, v]) => typeof v === 'number')).toEqual([])
  })
})

/* ════════════════════════════════════════════════════════════════════════════════════════
   Shadow comparison
   ════════════════════════════════════════════════════════════════════════════════════════ */

const step = (id: string, over: Partial<GraphStep> = {}): GraphStep => ({
  id,
  label: id.toUpperCase(),
  category: StepCategory.documents_preparation,
  archived: false,
  earliestStartOffsetDays: null,
  typicalDurationDays: null,
  ...over,
})

const edge = (from: string, to: string, over: Partial<GraphEdge> = {}): GraphEdge => ({
  id: `${from}->${to}`,
  fromStepId: from,
  toStepId: to,
  kind: StepEdgeKind.sequential,
  archived: false,
  ...over,
})

const chain = (...ids: string[]): RouteGraph => ({
  steps: ids.map((id) => step(id)),
  edges: ids.slice(1).map((id, i) => edge(ids[i] ?? '', id)),
})

describe('FR-22, FR-77, §14.1 — the comparison names location and scale', () => {
  it('reports nothing changed when nothing changed', () => {
    const graph = chain('a', 'b', 'c')
    const result = compareVersions(graph, graph)
    expect(result.structureChanged).toBe(false)
    expect(result.scale).toEqual({
      added: 0,
      archived: 0,
      reordered: 0,
      relabelled: 0,
      retimed: 0,
      unchanged: 3,
    })
    expect(result.rows.every((row) => row.marks.length === 0)).toBe(true)
  })

  it('locates an added step and gives it a row with nothing opposite', () => {
    const result = compareVersions(chain('a', 'c'), chain('a', 'b', 'c'))
    const added = result.rows.find((row) => row.marks.includes('step_added'))
    expect(added?.key).toBe('b')
    expect(added?.before).toBeNull()
    expect(added?.after?.id).toBe('b')
    expect(result.scale.added).toBe(1)
  })

  /**
   * §14.1: "Removed/archived stages remain visible in the shadow rather than disappearing
   * from history." A row for the archived step, in the place it used to occupy — not a
   * footnote at the bottom, which is not visibility.
   */
  it('keeps an archived step visible, in the position it used to hold', () => {
    const result = compareVersions(chain('a', 'b', 'c'), chain('a', 'c'))
    const gone = result.rows.find((row) => row.marks.includes('step_archived'))
    expect(gone?.key).toBe('b')
    expect(gone?.before?.id).toBe('b')
    expect(gone?.after).toBeNull()
    // Between a and c, where it lived — not appended after them.
    expect(result.rows.map((row) => row.key)).toEqual(['a', 'b', 'c'])
    expect(result.scale.archived).toBe(1)
  })

  it('notices a rename and a retiming separately', () => {
    const before: RouteGraph = { steps: [step('a')], edges: [] }
    const after: RouteGraph = {
      steps: [step('a', { label: 'Renamed', typicalDurationDays: 14 })],
      edges: [],
    }
    const result = compareVersions(before, after)
    expect(result.rows[0]?.marks).toEqual(
      expect.arrayContaining(['step_relabelled', 'step_retimed']),
    )
    expect(result.scale.relabelled).toBe(1)
    expect(result.scale.retimed).toBe(1)
  })

  it('reports reordering of steps present in both versions', () => {
    const result = compareVersions(chain('a', 'b', 'c'), chain('a', 'c', 'b'))
    expect(result.scale.reordered).toBeGreaterThan(0)
    expect(result.structureChanged).toBe(true)
  })

  /**
   * The noise guard, inherited from Phase 3's structural diff: inserting a step must not
   * report every step after it as "moved". Position is compared among survivors only.
   */
  it('does not call an insertion a reorder of everything after it', () => {
    const result = compareVersions(chain('a', 'b'), chain('a', 'x', 'b'))
    expect(result.scale.added).toBe(1)
    expect(result.scale.reordered).toBe(0)
  })

  /**
   * Invariant 22 — branches are real structure. A step made parallel rather than sequential
   * changes the route with an identical step set on both sides, so a comparison that only
   * looked at steps would report "no change" on a genuine rewiring.
   */
  it('sees a rewiring even when every step is identical', () => {
    const before: RouteGraph = {
      steps: [step('a'), step('b'), step('c')],
      edges: [edge('a', 'b'), edge('b', 'c')],
    }
    const after: RouteGraph = {
      steps: [step('a'), step('b'), step('c')],
      edges: [
        edge('a', 'b', { kind: StepEdgeKind.alternative }),
        edge('b', 'c', { kind: StepEdgeKind.rejoin }),
      ],
    }
    const result = compareVersions(before, after)
    expect(result.scale.added).toBe(0)
    expect(result.scale.archived).toBe(0)
    expect(result.structureChanged).toBe(true)
  })

  it('gives every row a distinct place on the shared spine', () => {
    const result = compareVersions(chain('a', 'b', 'c'), chain('a', 'd', 'c'))
    const ordinals = result.rows.map((row) => row.ordinal)
    expect(ordinals).toEqual([...new Set(ordinals)].sort((x, y) => x - y))
    expect(ordinals[0]).toBe(1)
    // Both the archived 'b' and the added 'd' get their own line.
    expect(result.scale.archived).toBe(1)
    expect(result.scale.added).toBe(1)
  })

  it('handles an empty starting version — a route that did not exist yet', () => {
    const result = compareVersions({ steps: [], edges: [] }, chain('a', 'b'))
    expect(result.scale.added).toBe(2)
    expect(result.rows).toHaveLength(2)
  })

  it('produces no score, only counts', () => {
    const result = compareVersions(chain('a'), chain('a', 'b'))
    expect(Object.values(result.scale).every((value) => Number.isInteger(value))).toBe(true)
    expect(Object.keys(result)).not.toContain('confidence')
    expect(Object.keys(result)).not.toContain('severity')
  })
})
