import { describe, expect, it } from 'vitest'

import {
  FieldApplicability,
  ROUTE_LIFECYCLE_STATES,
  SOURCE_CLASSES,
  SourceClass,
  type RouteLifecycleState,
} from '../../src/domain/enums'
import {
  FIELD_GROUP_ORDER,
  fieldGroup,
  fieldSignals,
  RECENT_ACTIVITY_WINDOW_DAYS,
  routePassport,
  snapshotCautions,
  type FieldSignalId,
  type FieldTrustInput,
  type RouteTrustInput,
} from '../../src/domain/trust'

/**
 * Phase 6 — the trust surface, tested where it is pure.
 *
 * Invariant tests 11, 12, 14, 15 and part of 9 live here rather than in a browser, because
 * the rules they hold are decisions about data, not about pixels. `src/domain/trust.ts`
 * carries no copy and no markup precisely so these can be written this directly.
 */

const NOW = new Date('2026-09-03T00:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * DAY)
const daysAhead = (n: number): Date => new Date(NOW.getTime() + n * DAY)

/** An unremarkable field: official, route-wide, confirmed, settled. */
function baselineField(overrides: Partial<FieldTrustInput> = {}): FieldTrustInput {
  return {
    sourceClass: SourceClass.official,
    applicability: [FieldApplicability.route_wide],
    lastConfirmedAt: daysAgo(10),
    reviewDueAt: null,
    effectiveFrom: null,
    expiresAt: null,
    revisionCount: 1,
    lastRevisedAt: daysAgo(30),
    hasForkedHistory: false,
    openChallengeCount: 0,
    quarantined: false,
    ...overrides,
  }
}

const idsOf = (input: FieldTrustInput): FieldSignalId[] =>
  fieldSignals(input, NOW).map((signal) => signal.id)

const cautionIdsOf = (input: FieldTrustInput): FieldSignalId[] =>
  fieldSignals(input, NOW)
    .filter((signal) => signal.weight === 'caution')
    .map((signal) => signal.id)

describe('the unremarkable case renders as unremarkable', () => {
  /**
   * The single most important assertion in this file.
   *
   * If an official, route-wide, recently confirmed, never-revised fact produces a caution,
   * then every field on the page produces a caution, and the reader learns to ignore all of
   * them — including the one that mattered. "Do not make every metadata dimension visually
   * loud" is a product requirement, and this is where it is enforced.
   */
  it('produces no caution at all for an official, route-wide, confirmed field', () => {
    expect(cautionIdsOf(baselineField())).toEqual([])
  })

  it('does not treat route_wide as something to announce', () => {
    const signals = idsOf(baselineField({ applicability: [FieldApplicability.route_wide] }))
    expect(signals).not.toContain('narrow_scope')
    expect(signals).not.toContain('scope_not_stated')
  })
})

describe('applicability — FR-81, invariant 11', () => {
  it('raises a caution when a claim is narrower than the route, and names the dimensions', () => {
    const signals = fieldSignals(
      baselineField({
        applicability: [FieldApplicability.institution, FieldApplicability.programme],
      }),
      NOW,
    )
    const narrow = signals.find((signal) => signal.id === 'narrow_scope')

    expect(narrow?.weight).toBe('caution')
    expect(narrow?.scopes).toEqual([FieldApplicability.institution, FieldApplicability.programme])
  })

  it('strips route_wide out of a mixed set rather than listing it as a narrowing', () => {
    const signals = fieldSignals(
      baselineField({
        applicability: [FieldApplicability.route_wide, FieldApplicability.intake],
      }),
      NOW,
    )
    expect(signals.find((signal) => signal.id === 'narrow_scope')?.scopes).toEqual([
      FieldApplicability.intake,
    ])
  })

  it('says the scope is unstated rather than assuming it is universal', () => {
    // Silence is not a claim. Every row written before FR-81 existed has an empty set, and
    // rendering those as route-wide would invent a claim nobody made.
    expect(idsOf(baselineField({ applicability: [] }))).toContain('scope_not_stated')
  })

  it('keeps a narrow scope quiet in weight terms only for the unstated case', () => {
    const unstated = fieldSignals(baselineField({ applicability: [] }), NOW)
    expect(unstated.find((signal) => signal.id === 'scope_not_stated')?.weight).toBe('context')
  })
})

describe('source class and applicability are independent — D-47', () => {
  /**
   * The Germany research case that produced Amendment 001, as an assertion.
   *
   * Both facts are `official`, so source class cannot tell them apart. Only applicability
   * can, and a reader who cannot tell them apart concludes that Germany demands both.
   */
  it('separates two official facts with different scopes', () => {
    const blockedAccount = baselineField({
      sourceClass: SourceClass.official,
      applicability: [FieldApplicability.origin_specific],
    })
    const greRequirement = baselineField({
      sourceClass: SourceClass.official,
      applicability: [FieldApplicability.institution, FieldApplicability.programme],
    })

    expect(blockedAccount.sourceClass).toBe(greRequirement.sourceClass)
    expect(cautionIdsOf(blockedAccount)).toContain('narrow_scope')
    expect(cautionIdsOf(greRequirement)).toContain('narrow_scope')

    const scopesOf = (input: FieldTrustInput) =>
      fieldSignals(input, NOW).find((signal) => signal.id === 'narrow_scope')?.scopes
    expect(scopesOf(blockedAccount)).not.toEqual(scopesOf(greRequirement))
  })
})

describe('invariant 9 — a community submission never passes as corroborated', () => {
  it('marks a community submission as uncorroborated', () => {
    expect(cautionIdsOf(baselineField({ sourceClass: SourceClass.community_submission }))).toContain(
      'unverified_submission',
    )
  })

  it('does not mark an official or institutional claim as uncorroborated', () => {
    for (const sourceClass of [SourceClass.official, SourceClass.institutional_public]) {
      expect(cautionIdsOf(baselineField({ sourceClass }))).not.toContain('unverified_submission')
    }
  })
})

describe('invariant 15 / test 15 — conflict is shown, not hidden', () => {
  it('raises a caution when the revision chain has forked', () => {
    // Two contributors corrected the same starting value. Phase 3 keeps both rather than
    // letting the later win; this is where a reader finally sees that (FR-70, BR-21).
    expect(cautionIdsOf(baselineField({ hasForkedHistory: true }))).toContain('history_forked')
  })

  it('raises a caution when the stored source class says disputed', () => {
    expect(cautionIdsOf(baselineField({ sourceClass: SourceClass.disputed_under_review }))).toContain(
      'source_disputed',
    )
  })

  it('reports a recently re-revised field as changed, quietly, with its count', () => {
    const signal = fieldSignals(
      baselineField({ revisionCount: 4, lastRevisedAt: daysAgo(3) }),
      NOW,
    ).find((s) => s.id === 'changed_recently')

    expect(signal?.weight).toBe('context')
    expect(signal?.count).toBe(4)
  })

  it('does not call a field changed when its only revision is its first', () => {
    expect(idsOf(baselineField({ revisionCount: 1, lastRevisedAt: daysAgo(1) }))).not.toContain(
      'changed_recently',
    )
  })

  it('does not call an old flurry of edits recent', () => {
    expect(
      idsOf(
        baselineField({
          revisionCount: 9,
          lastRevisedAt: daysAgo(RECENT_ACTIVITY_WINDOW_DAYS + 1),
        }),
      ),
    ).not.toContain('changed_recently')
  })
})

describe('freshness comes only from stored dates — FR-49, FR-52', () => {
  /**
   * CLAUDE.md §11 leaves "exact staleness thresholds for established routes" open, so
   * nothing here may decide a fact has gone stale after N days. A field confirmed long ago
   * with no stored review date shows its date and raises nothing.
   */
  it('invents no staleness threshold', () => {
    const ancient = baselineField({ lastConfirmedAt: daysAgo(3650), reviewDueAt: null })
    expect(cautionIdsOf(ancient)).toEqual([])
    expect(idsOf(ancient)).not.toContain('review_due')
  })

  it('honours a stored review date once it has passed', () => {
    expect(idsOf(baselineField({ reviewDueAt: daysAgo(1) }))).toContain('review_due')
    expect(idsOf(baselineField({ reviewDueAt: daysAhead(1) }))).not.toContain('review_due')
  })

  it('treats a passed expiry as a caution, not as context', () => {
    const signals = fieldSignals(baselineField({ expiresAt: daysAgo(1) }), NOW)
    expect(signals.find((signal) => signal.id === 'past_expiry')?.weight).toBe('caution')
  })

  it('says so when a value is not in effect yet', () => {
    expect(cautionIdsOf(baselineField({ effectiveFrom: daysAhead(30) }))).toContain(
      'not_yet_effective',
    )
    expect(idsOf(baselineField({ effectiveFrom: daysAgo(30) }))).not.toContain('not_yet_effective')
  })

  it('reports never-confirmed quietly — zero confirmations is honest, not alarming', () => {
    const signals = fieldSignals(baselineField({ lastConfirmedAt: null }), NOW)
    expect(signals.find((signal) => signal.id === 'never_confirmed')?.weight).toBe('context')
  })
})

describe('invariant 11 — official and community occupy different regions', () => {
  it('assigns every source class to exactly one group', () => {
    for (const sourceClass of SOURCE_CLASSES) {
      expect(FIELD_GROUP_ORDER).toContain(fieldGroup(sourceClass))
    }
  })

  it('never puts an official claim in the same group as a community one', () => {
    const official = [SourceClass.official, SourceClass.institutional_public].map(fieldGroup)
    const community = [SourceClass.community_confirmed, SourceClass.community_submission].map(
      fieldGroup,
    )
    expect(new Set(official).size).toBe(1)
    expect(new Set(community).size).toBe(1)
    expect(official[0]).not.toBe(community[0])
  })

  it('shows disputed information before anything else', () => {
    expect(FIELD_GROUP_ORDER[0]).toBe(fieldGroup(SourceClass.disputed_under_review))
  })

  it('lists each group exactly once', () => {
    expect(new Set(FIELD_GROUP_ORDER).size).toBe(FIELD_GROUP_ORDER.length)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────
// Route level
// ─────────────────────────────────────────────────────────────────────────────────────────

function baselineRoute(overrides: Partial<RouteTrustInput> = {}): RouteTrustInput {
  return {
    lifecycleState: 'established',
    createdAt: daysAgo(400),
    contributorCount: 6,
    informationCount: 20,
    confirmedCount: 15,
    needsReviewCount: 0,
    disputedCount: 0,
    quarantinedCount: 0,
    recentChangeCount: 3,
    lastChangedAt: daysAgo(20),
    lastConfirmedAt: daysAgo(5),
    followerCount: 12,
    selfReportedCompletionCount: 3,
    ...overrides,
  }
}

describe('invariant 14 / test 14 — counts describe, they never decide', () => {
  /**
   * FR-71 and BR-32: raw counts must never trigger archival, deletion, ranking boosts or
   * trusted status. The strongest form of that guarantee is that the function which reads
   * the counts cannot write the state, so this asserts the stored lifecycle survives every
   * count we can throw at it — including absurd ones.
   */
  it('returns the stored lifecycle state unchanged for every state and every count', () => {
    const extremes = [0, 1, 5, 1_000, 10_000_000]

    for (const state of ROUTE_LIFECYCLE_STATES) {
      for (const count of extremes) {
        const passport = routePassport(
          baselineRoute({
            lifecycleState: state,
            contributorCount: count,
            confirmedCount: count,
            informationCount: count,
            recentChangeCount: count,
          }),
        )
        expect(passport.lifecycleState).toBe(state)
      }
    }
  })

  it('never promotes a route to established through popularity', () => {
    const adored = routePassport(
      baselineRoute({
        lifecycleState: 'experimental',
        contributorCount: 5_000,
        confirmedCount: 100_000,
        informationCount: 100_000,
        // Phase 7 added followers, which is exactly the number a ranking system would reach
        // for first. It changes nothing here (FR-71, BR-32, invariant 14).
        followerCount: 250_000,
        selfReportedCompletionCount: 90_000,
      }),
    )
    expect(adored.lifecycleState).toBe<RouteLifecycleState>('experimental')
    expect(adored.cautions).toContain('lifecycle_not_established')
  })

  it('does not let followers or completions silence any caution', () => {
    const popular = routePassport(
      baselineRoute({
        lifecycleState: 'experimental',
        contributorCount: 1,
        confirmedCount: 0,
        disputedCount: 4,
        followerCount: 100_000,
        selfReportedCompletionCount: 40_000,
      }),
    )
    for (const caution of ['lifecycle_not_established', 'no_confirmations', 'single_contributor', 'disputed_information'] as const) {
      expect(popular.cautions).toContain(caution)
    }
  })
})

describe('the route passport reports evidence — FR-11, FR-74', () => {
  it('raises no caution for a mature, confirmed, multi-contributor route', () => {
    expect(routePassport(baselineRoute()).cautions).toEqual([])
  })

  it('says so when nobody has confirmed anything', () => {
    expect(routePassport(baselineRoute({ confirmedCount: 0 })).cautions).toContain(
      'no_confirmations',
    )
  })

  it('does not claim missing confirmations on a route with no information at all', () => {
    const empty = routePassport(baselineRoute({ informationCount: 0, confirmedCount: 0 }))
    expect(empty.cautions).toContain('no_information')
    expect(empty.cautions).not.toContain('no_confirmations')
  })

  it('says so when one person wrote all of it', () => {
    expect(routePassport(baselineRoute({ contributorCount: 1 })).cautions).toContain(
      'single_contributor',
    )
    expect(routePassport(baselineRoute({ contributorCount: 0 })).cautions).toContain(
      'single_contributor',
    )
  })

  it('surfaces disputed and review-due information', () => {
    const shaky = routePassport(baselineRoute({ disputedCount: 2, needsReviewCount: 4 }))
    expect(shaky.cautions).toContain('disputed_information')
    expect(shaky.cautions).toContain('information_needs_review')
  })

  it('passes the evidence through untouched — no score, no rounding, no derivation', () => {
    const input = baselineRoute({ recentChangeCount: 17, contributorCount: 3 })
    const passport = routePassport(input)
    expect(passport.recentChangeCount).toBe(17)
    expect(passport.contributorCount).toBe(3)
    expect(passport.lastChangedAt).toBe(input.lastChangedAt)
    expect(passport.lastConfirmedAt).toBe(input.lastConfirmedAt)
  })
})

describe('a ribbon can never look calmer than the route it leads to', () => {
  /**
   * The ribbon sees a strict subset of the route page's inputs, so it may legitimately show
   * fewer concerns. What it must never do is show a *different* set — a reader who opens a
   * quiet-looking ribbon and finds a disputed route was misled by the search results.
   */
  it('produces a subset of the passport cautions for every combination that matters', () => {
    const lifecycles: RouteLifecycleState[] = ['established', 'experimental', 'disputed']
    for (const lifecycleState of lifecycles) {
      for (const informationCount of [0, 12]) {
        for (const confirmedCount of [0, 12]) {
          for (const disputedCount of [0, 3]) {
            for (const needsReviewCount of [0, 3]) {
              for (const contributorCount of [1, 9]) {
                const input = baselineRoute({
                  lifecycleState,
                  informationCount,
                  confirmedCount: Math.min(confirmedCount, informationCount),
                  disputedCount,
                  needsReviewCount,
                  contributorCount,
                })
                const ribbon = snapshotCautions(input)
                const page = routePassport(input).cautions

                for (const caution of ribbon) expect(page).toContain(caution)
              }
            }
          }
        }
      }
    }
  })
})
