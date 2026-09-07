import { describe, expect, it } from 'vitest'

import { read } from '../support/source-files'

/**
 * The owner's house style, held the same way the other vocabulary rules are.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Why a test and not a note.** The owner asked for this on 2026-09-06. It was written down,
 * and then ignored across an entire session: by 2026-09-07 there were **83 em dashes in
 * user-facing copy** and nine in the README, all added after the request. A convention nobody
 * enforces is a convention that decays, and this one decayed inside a day.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why em dashes specifically, since they are not bad writing.**
 *
 * They are not. Good writers use them. The problem is frequency: language models produce them
 * at rates far above human prose, so at density they read as machine-written. This platform's
 * whole claim is that it is maintained by people who have actually been through these
 * processes, and copy that pattern-matches to generated text quietly undercuts exactly that.
 * It is a credibility cost, not a matter of taste.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Scope: what a reader sees.** The dictionary, because it is the product's voice, and the
 * README, because it is the repository's face. **Code comments are deliberately excluded** —
 * they are addressed to whoever maintains this, an em dash is the right punctuation in several
 * of them, and rewriting seventy comments would be churn with no reader on the other end.
 */

const DASH = '—'

/** Strips block and line comments, so this reads code rather than prose about code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('house style', () => {
  /**
   * Every string literal in the dictionary is something somebody reads on a screen.
   */
  it('uses no em dash in any user-facing string', () => {
    const code = stripComments(read('src/i18n/dictionaries/en.ts'))
    const offenders = (code.match(/'(?:[^'\\]|\\.)*'/g) ?? []).filter((literal) =>
      literal.includes(DASH),
    )
    expect(
      offenders.map((literal) => literal.slice(0, 90)),
      'Use a comma, a colon, a full stop or parentheses instead',
    ).toEqual([])
  })

  it('uses no em dash in the README', () => {
    const lines = read('README.md')
      .split('\n')
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes(DASH))
      .map(({ line, index }) => `${index + 1}: ${line.trim().slice(0, 80)}`)
    expect(lines, 'The README is the project’s public face').toEqual([])
  })

  /**
   * Not vacuous: the check finds a dash when one is present.
   */
  it('would catch a planted em dash', () => {
    const planted = `const a = 'this is copy ${DASH} with a dash'`
    const found = (planted.match(/'(?:[^'\\]|\\.)*'/g) ?? []).filter((s) => s.includes(DASH))
    expect(found).toHaveLength(1)
  })

  /**
   * **The copy directs more than it explains itself.**
   *
   * The owner's other observation, 2026-09-07: *"the design guides people where to go, what to
   * do, but in my website all the other pages has info scattered like saying what our building
   * documents are saying."* They were right, and it was measurable — 108 of 271 substantial
   * strings were defensive or system-explaining, against 27 that told a reader to do anything.
   *
   * The cause was a category error: the invariants are a specification for what the *code* must
   * not do, and they had been transposed into sentences aimed at readers. Invariant 12 became
   * "it does not check anything", invariant 13 became "nobody can buy a better position". A
   * student arriving from Dhaka has none of those questions.
   *
   * This guard does not police the ratio — a number would be arbitrary and gameable. It pins
   * the specific sentences that were cut back, so that "say it once, where it matters" (the
   * owner's decision) does not quietly become "say it on every panel" again.
   */
  it('keeps the epistemic disclaimers short and in one place', () => {
    const dictionary = read('src/i18n/dictionaries/en.ts')

    // This one renders on EVERY route page, above the road. It was 41 words.
    const passport = /noVerificationClaim:\s*\n?\s*'([^']*)'/.exec(dictionary)?.[1] ?? ''
    expect(passport, 'noVerificationClaim not found').not.toBe('')
    expect(
      passport.split(/\s+/).length,
      'This sits above the road on every route. Keep it to a line.',
    ).toBeLessThanOrEqual(20)

    // A counter does not need to explain that it is not a ranking signal.
    expect(dictionary).not.toContain('none of it decides how a route ranks')
  })
})
