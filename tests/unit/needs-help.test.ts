import { describe, expect, it } from 'vitest'

import { SourceClass } from '../../src/domain/enums'
import { fieldAttention, type FieldAttentionInput } from '../../src/domain/trust'

/**
 * Phase 15: the one rule for "needs review" and "contested" on a field. FR-50, FR-53, FR-70.
 *
 * The passport counts with this and the needs-help list lists with it, so these cases are what
 * both surfaces mean. Every reason is a stored fact; none is a threshold (CLAUDE.md §11).
 */

const NOW = new Date('2026-10-01T00:00:00Z')
const DAY = 24 * 60 * 60 * 1000

const settled: FieldAttentionInput = {
  reviewDueAt: null,
  expiresAt: null,
  sourceClass: SourceClass.official,
  hasForkedHistory: false,
  openChallengeCount: 0,
}

describe('fieldAttention', () => {
  it('finds nothing to say about an ordinary official field', () => {
    expect(fieldAttention(settled, NOW)).toEqual({ needsReview: [], contested: [] })
  })

  it('needs review only once a stored date has passed, never by age', () => {
    const due = { ...settled, reviewDueAt: new Date(NOW.getTime() - DAY) }
    expect(fieldAttention(due, NOW).needsReview).toEqual(['review_due'])

    const notYet = { ...settled, reviewDueAt: new Date(NOW.getTime() + DAY) }
    expect(fieldAttention(notYet, NOW).needsReview).toEqual([])

    const expired = { ...settled, expiresAt: new Date(NOW.getTime() - DAY) }
    expect(fieldAttention(expired, NOW).needsReview).toEqual(['expired'])
  })

  it('is contested for each of the three reasons, and says which', () => {
    expect(
      fieldAttention({ ...settled, sourceClass: SourceClass.disputed_under_review }, NOW).contested,
    ).toEqual(['disputed_source'])
    expect(fieldAttention({ ...settled, hasForkedHistory: true }, NOW).contested).toEqual([
      'forked',
    ])
    expect(fieldAttention({ ...settled, openChallengeCount: 2 }, NOW).contested).toEqual([
      'challenged',
    ])
  })

  it('keeps the two lists independent: a field can be both', () => {
    const both = {
      ...settled,
      reviewDueAt: new Date(NOW.getTime() - DAY),
      openChallengeCount: 1,
    }
    expect(fieldAttention(both, NOW)).toEqual({
      needsReview: ['review_due'],
      contested: ['challenged'],
    })
  })
})
