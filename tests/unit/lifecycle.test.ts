import { describe, expect, it } from 'vitest'

import { RouteLifecycleState, ROUTE_LIFECYCLE_STATES } from '../../src/domain/enums'
import {
  appearsInSearch,
  DORMANCY_DAYS,
  lifecycleWarrantsCaution,
  proposeLifecycle,
  SEARCHABLE_LIFECYCLE_STATES,
  type LifecycleEvidence,
} from '../../src/domain/lifecycle'
import { snapshotCautions, type RouteTrustSnapshot } from '../../src/domain/trust'

/**
 * Phase 11 — the lifecycle rules, proved without a database.
 *
 * **Invariant 23 is the thing this file exists for**, and it is one sentence: dormancy is for
 * unused new routes, and an established route that has gone quiet is never treated as invalid.
 * §19.1 refined the original "everything is inactive after 30 days" idea into exactly that
 * distinction, and it is the distinction most likely to be lost in a later refactor — which is
 * why it is asserted here from several directions rather than once.
 */

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-03T00:00:00.000Z')
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * DAY)

const WINDOW = { recentWindowDays: 90 }

const evidence = (over: Partial<LifecycleEvidence> = {}): LifecycleEvidence => ({
  current: RouteLifecycleState.experimental,
  createdAt: daysAgo(1),
  followerCount: 0,
  confirmationCount: 0,
  lastActivityAt: null,
  needsReviewCount: 0,
  informationCount: 3,
  ...over,
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Invariant 23 — dormancy is for unused NEW routes only
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('FR-38, D-20, BR-09, invariant 23 — dormancy', () => {
  it('uses the baseline period, not an invented one', () => {
    expect(DORMANCY_DAYS).toBe(30)
  })

  it('parks a new route that was created and then never used', () => {
    const result = proposeLifecycle(evidence({ createdAt: daysAgo(31) }), NOW, WINDOW)
    expect(result).toEqual({
      from: RouteLifecycleState.experimental,
      to: RouteLifecycleState.dormant,
      reason: 'unused_since_creation',
    })
  })

  it('leaves a new route alone before the period has passed', () => {
    expect(proposeLifecycle(evidence({ createdAt: daysAgo(29) }), NOW, WINDOW)).toBeNull()
  })

  /**
   * Each of the three kinds of use, on its own, is enough to keep a route out of dormancy —
   * because §19 defines the dormant case as "no meaningful activity **or** followers".
   */
  it('spares a new route that anybody has used, by any of the three measures', () => {
    for (const used of [
      { followerCount: 1 },
      { confirmationCount: 1 },
      // Activity inside the dormancy window keeps it out too — the third of §19's signals.
      { lastActivityAt: daysAgo(3) },
    ]) {
      expect(
        proposeLifecycle(evidence({ createdAt: daysAgo(400), ...used }), NOW, WINDOW),
        JSON.stringify(used),
      ).toBeNull()
    }
  })

  it('brings a dormant route back the moment somebody uses it', () => {
    const result = proposeLifecycle(
      evidence({
        current: RouteLifecycleState.dormant,
        followerCount: 1,
        lastActivityAt: daysAgo(200),
      }),
      NOW,
      WINDOW,
    )
    expect(result).toEqual({
      from: RouteLifecycleState.dormant,
      to: RouteLifecycleState.experimental,
      reason: 'activity_resumed',
    })
  })

  /**
   * **The defect the integration suite caught, kept as a unit test.**
   *
   * An earlier version asked "were any revisions written after the route was created?" —
   * which is true of every route in existence, because building one writes its steps, edges
   * and fields milliseconds after the route row. Nothing could ever have gone dormant, and
   * every unit test passed because the fixtures set the count by hand.
   *
   * This asserts the case that was broken: a route built at creation time and untouched
   * since, whose `lastActivityAt` is therefore its own birth.
   */
  it('parks a route whose only activity was being built', () => {
    const built = evidence({ createdAt: daysAgo(45), lastActivityAt: daysAgo(45) })
    expect(proposeLifecycle(built, NOW, WINDOW)?.to).toBe(RouteLifecycleState.dormant)
  })

  it('spares a route that was touched inside the dormancy window', () => {
    const touched = evidence({ createdAt: daysAgo(45), lastActivityAt: daysAgo(3) })
    expect(proposeLifecycle(touched, NOW, WINDOW)).toBeNull()
  })

  it('leaves a dormant route dormant while nothing happens', () => {
    expect(
      proposeLifecycle(
        evidence({ current: RouteLifecycleState.dormant, lastActivityAt: daysAgo(200) }),
        NOW,
        WINDOW,
      ),
    ).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The distinction that is invariant 23
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('BR-10, FR-39, §19.1 — an established route is never made dormant by silence', () => {
  /**
   * **The single most important assertion in Phase 11.**
   *
   * The same evidence that parks an experimental route — created long ago, no followers, no
   * confirmations, no edits, nothing for years — must never park an established one. §19.1:
   * a 30-day rule is "appropriate mainly for newly created routes"; established routes
   * "should instead display their last confirmation".
   *
   * Run over every non-experimental, non-administrative state, so a future state added to the
   * enum cannot quietly acquire dormancy by default.
   */
  it('never proposes dormant for any state other than experimental', () => {
    const silent = evidence({ createdAt: daysAgo(3650), lastActivityAt: daysAgo(3000) })

    for (const state of ROUTE_LIFECYCLE_STATES) {
      if (state === RouteLifecycleState.experimental) continue
      const result = proposeLifecycle({ ...silent, current: state }, NOW, WINDOW)
      expect(result?.to, `${state} must never become dormant`).not.toBe(
        RouteLifecycleState.dormant,
      )
    }
  })

  it('turns a long-silent established route quiet, and nothing worse', () => {
    const result = proposeLifecycle(
      evidence({
        current: RouteLifecycleState.established,
        createdAt: daysAgo(900),
        followerCount: 40,
        confirmationCount: 12,
        lastActivityAt: daysAgo(400),
      }),
      NOW,
      WINDOW,
    )
    expect(result).toEqual({
      from: RouteLifecycleState.established,
      to: RouteLifecycleState.quiet,
      reason: 'no_recent_activity',
    })
  })

  /**
   * FR-39: "Established routes shall not be treated as false merely because of 30 days
   * without activity; they shall instead expose freshness/last-confirmed information."
   *
   * So `quiet` carries **no caution** — the trust surface and the transition rules agree,
   * because both read `lifecycleWarrantsCaution`.
   */
  it('treats quiet as no reason for caution', () => {
    expect(lifecycleWarrantsCaution(RouteLifecycleState.quiet)).toBe(false)
    expect(lifecycleWarrantsCaution(RouteLifecycleState.established)).toBe(false)

    for (const state of ROUTE_LIFECYCLE_STATES) {
      if (state === RouteLifecycleState.quiet || state === RouteLifecycleState.established) {
        continue
      }
      expect(lifecycleWarrantsCaution(state), state).toBe(true)
    }
  })

  it('produces no lifecycle caution on a quiet route, end to end through the trust surface', () => {
    const snapshot = (state: RouteLifecycleState): RouteTrustSnapshot => ({
      lifecycleState: state,
      informationCount: 5,
      confirmedCount: 5,
      needsReviewCount: 0,
      disputedCount: 0,
      quarantinedCount: 0,
    })

    expect(snapshotCautions(snapshot(RouteLifecycleState.quiet))).toEqual([])
    expect(snapshotCautions(snapshot(RouteLifecycleState.established))).toEqual([])
    // And the states that genuinely do warrant one still do.
    expect(snapshotCautions(snapshot(RouteLifecycleState.stale))).toContain(
      'lifecycle_not_established',
    )
    expect(snapshotCautions(snapshot(RouteLifecycleState.dormant))).toContain(
      'lifecycle_not_established',
    )
  })

  it('brings a quiet route back to established when activity returns', () => {
    const result = proposeLifecycle(
      evidence({
        current: RouteLifecycleState.quiet,
        followerCount: 10,
        confirmationCount: 4,
        lastActivityAt: daysAgo(2),
      }),
      NOW,
      WINDOW,
    )
    expect(result).toEqual({
      from: RouteLifecycleState.quiet,
      to: RouteLifecycleState.established,
      reason: 'activity_resumed',
    })
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Staleness is a different concept from dormancy
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('FR-39 — staleness comes from stored dates, never from silence', () => {
  /**
   * The two are about different things and must not be reachable from the same evidence.
   * Dormancy is "nobody ever used this"; staleness is "this route's own information says it
   * is due for review". A route can be busy and stale, or silent and perfectly fresh.
   */
  it('marks a route stale only when its own information is overdue', () => {
    const busyButOverdue = evidence({
      current: RouteLifecycleState.established,
      followerCount: 50,
      lastActivityAt: daysAgo(1),
      needsReviewCount: 2,
    })
    expect(proposeLifecycle(busyButOverdue, NOW, WINDOW)).toEqual({
      from: RouteLifecycleState.established,
      to: RouteLifecycleState.stale,
      reason: 'review_overdue',
    })
  })

  it('does not mark a silent route stale when nothing is overdue', () => {
    const silentButFresh = evidence({
      current: RouteLifecycleState.established,
      lastActivityAt: daysAgo(500),
      needsReviewCount: 0,
    })
    expect(proposeLifecycle(silentButFresh, NOW, WINDOW)?.to).toBe(RouteLifecycleState.quiet)
  })

  it('lets a stale route recover once nothing is overdue', () => {
    const caughtUp = evidence({
      current: RouteLifecycleState.stale,
      lastActivityAt: daysAgo(1),
      needsReviewCount: 0,
    })
    expect(proposeLifecycle(caughtUp, NOW, WINDOW)).toEqual({
      from: RouteLifecycleState.stale,
      to: RouteLifecycleState.established,
      reason: 'review_caught_up',
    })
  })

  it('sends a stale route that is also silent to quiet, not straight to established', () => {
    const caughtUpButSilent = evidence({
      current: RouteLifecycleState.stale,
      lastActivityAt: daysAgo(400),
      needsReviewCount: 0,
    })
    expect(proposeLifecycle(caughtUpButSilent, NOW, WINDOW)?.to).toBe(RouteLifecycleState.quiet)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Invariant 14 — the direction rule
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('FR-71, BR-32, invariant 14 — automation never raises a route’s standing', () => {
  /**
   * **No count promotes anything.** The only upward moves this module can make are undoing
   * moves it made itself — dormant back to experimental, quiet back to established. Nothing
   * reaches `established` from below, and nothing reaches `developing` at all, because the
   * only evidence for either is counts and FR-71 forbids counts alone conferring standing.
   */
  it('never proposes developing, and never promotes an experimental route', () => {
    for (const followerCount of [0, 1, 10, 1_000, 10_000_000]) {
      for (const confirmationCount of [0, 1, 50, 5_000]) {
        const result = proposeLifecycle(
          evidence({
            current: RouteLifecycleState.experimental,
            createdAt: daysAgo(500),
            followerCount,
            confirmationCount,
            lastActivityAt: daysAgo(1),
          }),
          NOW,
          WINDOW,
        )
        expect(result?.to, `${followerCount}/${confirmationCount}`).not.toBe(
          RouteLifecycleState.established,
        )
        expect(result?.to).not.toBe(RouteLifecycleState.developing)
      }
    }
  })

  it('never proposes an administrative state', () => {
    const forbidden = [
      RouteLifecycleState.archived,
      RouteLifecycleState.removed,
      RouteLifecycleState.disputed,
    ]
    for (const state of ROUTE_LIFECYCLE_STATES) {
      for (const overdue of [0, 5]) {
        const result = proposeLifecycle(
          { ...evidence({ current: state, needsReviewCount: overdue, createdAt: daysAgo(900) }) },
          NOW,
          WINDOW,
        )
        if (result !== null) expect(forbidden, `${state} → ${result.to}`).not.toContain(result.to)
      }
    }
  })

  it('leaves an administrator’s decision alone entirely', () => {
    for (const state of [
      RouteLifecycleState.archived,
      RouteLifecycleState.removed,
      RouteLifecycleState.disputed,
    ]) {
      expect(
        proposeLifecycle(
          evidence({ current: state, createdAt: daysAgo(9000), needsReviewCount: 9 }),
          NOW,
          WINDOW,
        ),
        state,
      ).toBeNull()
    }
  })

  /** Idempotent: a second pass over an unchanged record proposes nothing. */
  it('proposes nothing when the route is already where it belongs', () => {
    const parked = evidence({
      current: RouteLifecycleState.dormant,
      createdAt: daysAgo(900),
      lastActivityAt: daysAgo(900),
    })
    expect(proposeLifecycle(parked, NOW, WINDOW)).toBeNull()

    const settled = evidence({
      current: RouteLifecycleState.established,
      lastActivityAt: daysAgo(2),
    })
    expect(proposeLifecycle(settled, NOW, WINDOW)).toBeNull()
  })

  it('returns no score of any kind', () => {
    const result = proposeLifecycle(
      evidence({ createdAt: daysAgo(60), lastActivityAt: daysAgo(60) }),
      NOW,
      WINDOW,
    )
    expect(result).not.toBeNull()
    expect(Object.entries(result ?? {}).filter(([, v]) => typeof v === 'number')).toEqual([])
    expect(Object.keys(result ?? {}).sort()).toEqual(['from', 'reason', 'to'])
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Search visibility
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('§19, FR-45, BR-15 — leaving search is not leaving existence', () => {
  it('keeps dormant, archived and removed routes out of the listing and nothing else', () => {
    expect(appearsInSearch(RouteLifecycleState.dormant)).toBe(false)
    expect(appearsInSearch(RouteLifecycleState.archived)).toBe(false)
    expect(appearsInSearch(RouteLifecycleState.removed)).toBe(false)

    for (const state of [
      RouteLifecycleState.experimental,
      RouteLifecycleState.developing,
      RouteLifecycleState.established,
      RouteLifecycleState.quiet,
      RouteLifecycleState.stale,
      RouteLifecycleState.disputed,
    ]) {
      expect(appearsInSearch(state), state).toBe(true)
    }
  })

  /**
   * The list the database query uses is derived from the function, not written out beside it.
   * Two hand-kept copies of one rule is how a state gets added to the enum, handled in the
   * function and forgotten in the query — and a dormant route quietly reappearing in search
   * is a silent failure nobody would notice.
   */
  it('derives the query’s list from the same rule', () => {
    expect([...SEARCHABLE_LIFECYCLE_STATES].sort()).toEqual(
      ROUTE_LIFECYCLE_STATES.filter(appearsInSearch).sort(),
    )
    expect(SEARCHABLE_LIFECYCLE_STATES).not.toContain(RouteLifecycleState.dormant)
    expect(SEARCHABLE_LIFECYCLE_STATES).toContain(RouteLifecycleState.quiet)
  })
})
