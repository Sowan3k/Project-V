import { describe, expect, it } from 'vitest'

import { generateHandle, isGeneratedHandle } from '../../src/server/auth/handle'

/**
 * Pseudonymous handles — §24.3, invariant 7.
 *
 * "Contributors need not expose their real identity publicly."
 *
 * The way to honour that is to never hold an identity in the first place, so a handle is
 * generated rather than taken from the sign-in provider. These assert the two properties that
 * make a generated handle safe: it carries no information about the person, and it cannot
 * accidentally say something about them either.
 */
describe('a handle reveals nothing about the person', () => {
  it('is generated, not derived from anything', () => {
    // Same input, different output. If a handle were derived from an email or a name, two
    // calls would agree — and the handle would be a hash of an identity rather than a label.
    const handles = new Set(Array.from({ length: 200 }, () => generateHandle()))
    expect(handles.size).toBeGreaterThan(190)
  })

  it('always has the shape the platform promises', () => {
    for (let i = 0; i < 200; i += 1) expect(isGeneratedHandle(generateHandle())).toBe(true)
  })

  /**
   * No vowels in the alphabet, deliberately.
   *
   * An alphabet that can spell a word by chance will eventually spell a slur, and every
   * handle it produces is attached to a real person who did not choose it. Removing the
   * vowels removes the whole class of problem rather than blocklisting its instances.
   */
  it('cannot spell a word by accident', () => {
    const suffixes = Array.from({ length: 500 }, () => generateHandle().split('-')[1] ?? '')
    for (const suffix of suffixes) expect(suffix).not.toMatch(/[aeiou]/)
  })

  it('excludes characters that are read wrongly', () => {
    // 0/o and 1/l are misread and mistyped, and a handle is something people copy by hand.
    const suffixes = Array.from({ length: 300 }, () => generateHandle().split('-')[1] ?? '')
    for (const suffix of suffixes) expect(suffix).not.toMatch(/[01lo]/)
  })

  it('rejects anything it did not produce', () => {
    for (const notOurs of ['nur-mohammad', 'traveller-AEIOU123', 'traveller-short', 'admin']) {
      expect(isGeneratedHandle(notOurs)).toBe(false)
    }
  })
})
