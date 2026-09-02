import { describe, expect, it } from 'vitest'

import { LINK_TRUST_CLASSES, LinkTrustClass } from '../../src/domain/enums'
import { classifyLink, LINK_TRUST_RANK } from '../../src/domain/links'

/**
 * Phase 6 — external link handling. Invariant test 10, and half of test 9.
 *
 * FR-64: the destination is visible before the reader leaves.
 * FR-65: a shortened or obscured link is never treated as an official process link.
 * FR-66: a recognised official domain is distinguishable from an ordinary submitted one.
 * FR-34: a quarantined link is not simply clickable.
 */

const rank = (trust: LinkTrustClass): number => LINK_TRUST_RANK[trust]

describe('the reader always sees where a link actually goes — FR-64', () => {
  it('reports the host, not the contributor’s words', () => {
    expect(classifyLink('https://www.auswaertiges-amt.de/en/visa-service').host).toBe(
      'www.auswaertiges-amt.de',
    )
  })

  /**
   * The case that makes host-before-click worth building.
   *
   * `https://embassy.example.de@evil.example.com/apply` reads as an embassy and resolves to
   * `evil.example.com`. Printing the raw string would show the reader the disguise; printing
   * the parsed host shows them the destination.
   */
  it('unmasks credentials written before the host', () => {
    const link = classifyLink('https://embassy.example.de@evil.example.com/apply')
    expect(link.host).toBe('evil.example.com')
    expect(link.cautions).toContain('embedded_credentials')
    expect(link.trust).toBe(LinkTrustClass.community_submitted)
  })

  it('refuses to link an address it cannot parse, rather than guessing', () => {
    const link = classifyLink('not a url at all')
    expect(link.href).toBeNull()
    expect(link.host).toBeNull()
    expect(link.cautions).toContain('unparseable')
  })

  it('never hands a browser a scheme it should not follow', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<h1>hi', 'file:///etc/passwd']) {
      const link = classifyLink(url, LinkTrustClass.trusted)
      expect(link.href).toBeNull()
      expect(link.cautions).toContain('unsupported_scheme')
    }
  })
})

describe('trust can only ever fall — FR-65, FR-66, invariant 10', () => {
  /**
   * The property that makes the whole module safe. If classification could raise trust, a
   * URL crafted to look official could earn the standing of one; because it can only lower,
   * the worst a hostile URL achieves is the class it was already given.
   */
  it('never returns a higher class than the one it was given, for any input', () => {
    const urls = [
      'https://www.daad.de/en/',
      'http://insecure.example.com',
      'https://bit.ly/3xYzAbC',
      'https://sub.tinyurl.com/abc',
      'https://192.168.1.1/apply',
      'https://[2001:db8::1]/apply',
      'https://xn--pple-43d.com/login',
      'https://official.example.de@evil.example.com',
      'https://user:pw@example.com',
      'javascript:void(0)',
      'nonsense',
      '',
      'https://example.com/path?query=1#fragment',
    ]

    for (const url of urls) {
      for (const declared of [...LINK_TRUST_CLASSES, null]) {
        const ceiling = declared ?? LinkTrustClass.community_submitted
        expect(rank(classifyLink(url, declared).trust)).toBeLessThanOrEqual(rank(ceiling))
      }
    }
  })

  it('never lets a shortener hold trusted standing, however it was declared', () => {
    for (const url of [
      'https://bit.ly/3xYzAbC',
      'https://tinyurl.com/abcdef',
      'https://t.co/abcdef',
      'https://links.rebrand.ly/promo',
    ]) {
      const link = classifyLink(url, LinkTrustClass.trusted)
      expect(link.trust).toBe(LinkTrustClass.community_submitted)
      expect(link.cautions).toContain('known_shortener')
    }
  })

  it('withholds trust from a bare IP address and from punycode', () => {
    expect(classifyLink('https://203.0.113.9/apply', LinkTrustClass.trusted).cautions).toContain(
      'ip_address_host',
    )
    expect(classifyLink('https://xn--pple-43d.com', LinkTrustClass.trusted).cautions).toContain(
      'punycode_host',
    )
  })

  it('keeps a declared trusted domain trusted when nothing is wrong with it', () => {
    // FR-66: the point of the class is that it can still be distinguished. A rule that
    // downgraded everything would satisfy the safety half and lose the useful half.
    const link = classifyLink('https://www.auswaertiges-amt.de/en', LinkTrustClass.trusted)
    expect(link.trust).toBe(LinkTrustClass.trusted)
    expect(link.cautions).toEqual([])
    expect(link.href).not.toBeNull()
  })
})

describe('quarantine and uncorroborated links — FR-34, invariant 9', () => {
  it('never gives a quarantined link an href, whatever the URL looks like', () => {
    const link = classifyLink('https://www.daad.de/en/', LinkTrustClass.quarantined)
    expect(link.href).toBeNull()
    expect(link.trust).toBe(LinkTrustClass.quarantined)
    expect(link.cautions).toEqual(['link_quarantined'])
    // Still shows where it claims to go — quarantine hides the click, not the fact.
    expect(link.host).toBe('www.daad.de')
  })

  it('treats an unclassified link as a community submission, not as unremarkable', () => {
    const link = classifyLink('https://someone-blog.example.com/guide')
    expect(link.trust).toBe(LinkTrustClass.community_submitted)
    expect(link.cautions).toContain('not_corroborated')
  })

  it('says nothing extra about a recognised official domain', () => {
    expect(classifyLink('https://www.daad.de/en/', LinkTrustClass.trusted).cautions).not.toContain(
      'not_corroborated',
    )
  })

  it('flags plain http even on an otherwise ordinary host', () => {
    expect(classifyLink('http://example.com').cautions).toContain('insecure_scheme')
  })
})
