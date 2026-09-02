import { describe, expect, it } from 'vitest'

import {
  CHALLENGE_REASONS,
  ROUTE_MECHANISMS,
  STEP_CATEGORIES,
  STEP_EDGE_KINDS,
  STUDY_LEVELS,
  CHANGE_SEVERITIES,
  DOMAIN_ENUMS,
  FIELD_CATEGORIES,
  LINK_TRUST_CLASSES,
  REPORT_REASONS,
  ROUTE_LIFECYCLE_STATES,
  SOURCE_CLASSES,
} from '../../src/domain/enums'

/**
 * These assertions pin the vocabulary to the frozen baseline, so a later refactor that
 * quietly drops or renames a value fails here rather than in production data.
 */
describe('domain vocabulary matches the requirements baseline', () => {
  it('has 11 field categories (FR-51, REQUIREMENTS.md §39.1)', () => {
    expect(FIELD_CATEGORIES).toHaveLength(11)
  })

  it('has 5 source classes (REQUIREMENTS.md §21)', () => {
    expect(SOURCE_CLASSES).toHaveLength(5)
  })

  it('has 9 route lifecycle states (FR-11, REQUIREMENTS.md §19)', () => {
    expect(ROUTE_LIFECYCLE_STATES).toHaveLength(9)
  })

  it('has 4 change severities (FR-60, REQUIREMENTS.md §41.2)', () => {
    expect(CHANGE_SEVERITIES).toHaveLength(4)
  })

  it('has 3 link trust classes (FR-34, REQUIREMENTS.md §22.1)', () => {
    expect(LINK_TRUST_CLASSES).toHaveLength(3)
  })

  it('has 8 challenge reasons (REQUIREMENTS.md §17.4)', () => {
    expect(CHALLENGE_REASONS).toHaveLength(8)
  })

  it('has 8 report reasons (REQUIREMENTS.md §23.1)', () => {
    expect(REPORT_REASONS).toHaveLength(8)
  })

  it('has 4 study levels (FR-01, REQUIREMENTS.md §9)', () => {
    // Three named in the baseline plus its own "another supported level" escape hatch.
    expect(STUDY_LEVELS).toEqual(['bachelors', 'masters', 'phd', 'other'])
  })

  it('has 4 route mechanisms (REQUIREMENTS.md §9, §40.1)', () => {
    expect(ROUTE_MECHANISMS).toHaveLength(4)
  })

  it('has 4 step edge kinds (FR-57, D-37)', () => {
    // These four are what make a route a graph rather than a list (invariant 22).
    expect(STEP_EDGE_KINDS).toEqual(['sequential', 'optional_branch', 'alternative', 'rejoin'])
  })

  it('has 6 step categories, distinct from the field categories (CLAUDE.md §8.5)', () => {
    expect(STEP_CATEGORIES).toHaveLength(6)
    // A step is a stage; a field is information inside it. The vocabularies must not blur.
    const overlap = STEP_CATEGORIES.filter((c) => (FIELD_CATEGORIES as readonly string[]).includes(c))
    expect(overlap).toEqual([])
  })

  it('keeps challenge and report as separate vocabularies (CLAUDE.md §5)', () => {
    // A challenge means "this may be wrong". A report means "this may be dangerous".
    // Sharing a reason list would collapse that distinction.
    expect(CHALLENGE_REASONS).not.toEqual(REPORT_REASONS)
    expect(DOMAIN_ENUMS.ChallengeReason).not.toBe(DOMAIN_ENUMS.ReportReason)
  })

  it('registers every exported enum in DOMAIN_ENUMS', () => {
    expect(Object.values(DOMAIN_ENUMS)).toEqual(
      expect.arrayContaining([
        STUDY_LEVELS,
        ROUTE_MECHANISMS,
        STEP_EDGE_KINDS,
        STEP_CATEGORIES,
        FIELD_CATEGORIES,
        SOURCE_CLASSES,
        ROUTE_LIFECYCLE_STATES,
        CHANGE_SEVERITIES,
        LINK_TRUST_CLASSES,
        CHALLENGE_REASONS,
        REPORT_REASONS,
      ]),
    )
    expect(Object.keys(DOMAIN_ENUMS)).toHaveLength(11)
  })
})
