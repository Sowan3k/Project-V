import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, LOCALES, LOCALE_HTML_LANG, isLocale } from '../../src/i18n/config'
import { en } from '../../src/i18n/dictionaries/en'
import { DOMAIN_ENUMS } from '../../src/domain/enums'

describe('i18n scaffolding', () => {
  it('has exactly one active locale, with Bangla deferred by decision', () => {
    // CLAUDE.md §10: multilingual UI beyond English plus Bengali brand is deferred.
    expect([...LOCALES]).toEqual(['en'])
    expect(isLocale(DEFAULT_LOCALE)).toBe(true)
    expect(isLocale('xx')).toBe(false)
  })

  it('maps every locale to an html lang tag', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_HTML_LANG[locale]).toBeTruthy()
    }
  })

  it('carries the Bengali brand identity alongside the English interface', () => {
    expect(en.brand.nameBn).toBe('ভিনদেশী এক্সপ্রেস')
    expect(en.brand.nameEn).toBe('Vindeshi Express')
    // D-32: the public brand name is not frozen. The dictionary says so explicitly.
    expect(en.brand.nameIsProvisional).toBe(true)
  })

  it('labels every field category, source class and lifecycle state', () => {
    expect(Object.keys(en.fieldCategory).sort()).toEqual([...DOMAIN_ENUMS.FieldCategory].sort())
    expect(Object.keys(en.sourceClass).sort()).toEqual([...DOMAIN_ENUMS.SourceClass].sort())
    expect(Object.keys(en.routeLifecycle).sort()).toEqual(
      [...DOMAIN_ENUMS.RouteLifecycleState].sort(),
    )
  })

  it('never claims content is verified by the platform (BR-20, CLAUDE.md §8.6)', () => {
    const strings = JSON.stringify(en).toLowerCase()
    // 'unverified' is required wording; a bare 'verified' claim is forbidden.
    expect(strings).not.toMatch(/(?<!un)verified/)
    expect(strings).not.toContain('guaranteed')
    expect(strings).not.toContain('safe route')
  })

  /**
   * Invariant 9: a community submission must render visibly as uncorroborated.
   *
   * Phase 0 asserted this against `sourceClass.community_submission`, because the label was
   * then the only place the marking could live. Phase 6 moved it to a caution — an icon, a
   * border and its own words — and left the label to state plain provenance, so that a field
   * no longer says the same thing three times over.
   *
   * The assertion moved with it rather than being dropped. It is now stronger, because it
   * covers the link path too: an uncorroborated *link* is the case FR-34 and FR-65 actually
   * care about, and the old label check never touched it.
   */
  it('marks an uncorroborated community claim, in the words a reader sees', () => {
    expect(en.trust.fieldSignal.unverified_submission).toMatch(/not corroborated/i)
    expect(en.trust.linkCaution.not_corroborated).toMatch(/not corroborated/i)

    // And provenance labels stay distinguishable from one another.
    expect(en.sourceClass.official).not.toBe(en.sourceClass.community_submission)
    expect(en.sourceClass.community_confirmed).not.toBe(en.sourceClass.community_submission)
  })
})
