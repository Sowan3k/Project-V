import { describe, expect, it } from 'vitest'

import { read, stripComments, walk } from '../support/source-files'

/**
 * Phase 6 — the things that must never appear.
 *
 * Invariant tests 12, 13, 16 and the vocabulary half of 17. These are not testable by
 * calling a function, because they are about the *absence* of a capability: there is no
 * `renderVerifiedBadge()` to assert against, and the whole point is that there never is one.
 *
 * So they are enforced as source guards, each with a planted-violation check proving the
 * guard actually fires. A guard that cannot fail is worse than no guard, because it reads
 * like coverage.
 *
 * Comments are stripped before scanning. This very file, and the modules it guards, discuss
 * verification and sponsorship at length in prose; prose cannot drift into behaviour.
 */

const SOURCE_FILES = walk('src', ['.ts', '.tsx'])
const CODE = SOURCE_FILES.map((file) => ({ file, code: stripComments(read(file)) }))

/** Matches for a pattern across `src/`, as `file:line` locations. */
function findAll(pattern: RegExp): string[] {
  const hits: string[] = []
  for (const { file, code } of CODE) {
    code.split('\n').forEach((line, index) => {
      if (new RegExp(pattern.source, pattern.flags.replace('g', '')).test(line)) {
        hits.push(`${file}:${index + 1}  ${line.trim()}`)
      }
    })
  }
  return hits
}

describe('invariant 12 / test 12 — nothing claims to be verified or safe', () => {
  /**
   * BR-04, D-19, BR-20. Two failures are being prevented at once: claiming an authority we
   * do not have, and — more insidiously — letting a clean page imply one. The mockups show
   * "Verified Route" (VR-13, VR-14) and "Community Verified 98%" (VR-03); CLAUDE.md §8.6
   * lists all of them as exceptions not to build.
   *
   * `verify` in the negative ("does not verify") is deliberately still allowed: denying the
   * claim is the opposite of making it, and the passport's closing paragraph depends on it.
   */
  const FORBIDDEN = /\b(verified|certified|trustworthy|guaranteed|100% safe)\b/i

  it('never uses verification vocabulary in any string in src/', () => {
    expect(findAll(FORBIDDEN)).toEqual([])
  })

  it('would catch a planted violation', () => {
    for (const planted of [
      'const label = "Verified Route"',
      'summary: `Community Verified 98%`',
      "badge: 'certified by us'",
    ]) {
      expect(FORBIDDEN.test(planted)).toBe(true)
    }
    // ...and does not fire on the denial the passport actually renders.
    expect(FORBIDDEN.test('Vindeshi Express does not verify routes.')).toBe(false)
  })

  /**
   * The structural half, and the one that will still hold in Phase 9.
   *
   * `RouteTrustInput` is what the route passport is allowed to see. If a report count is
   * ever added to it, some later refactor will start reading "zero reports" as good news.
   * The guarantee is that the function cannot observe reports at all.
   */
  it('gives the route passport no way to observe reports, flags or complaints', () => {
    const trust = stripComments(read('src/domain/trust.ts'))
    const start = trust.indexOf('export interface RouteTrustInput')
    expect(start).toBeGreaterThan(-1)
    const block = trust.slice(start, trust.indexOf('}', start))

    expect(block).not.toMatch(/\b(report|reports|reportCount|flagged|abuse|complaint)\b/i)
    // Not vacuous: the block really does contain the fields it is supposed to.
    expect(block).toMatch(/contributorCount/)
  })
})

describe('invariant 13 / test 13 — trust is never purchasable', () => {
  /**
   * FR-78, BR-13, BR-14, D-28, D-43. There is no sponsorship, ad placement or payment
   * concept anywhere in the application, so there is no variable for ordering, confidence,
   * source class or badges to be conditioned on.
   *
   * The approved voluntary support link (CLAUDE.md §10.1) is an outbound Gumroad link with
   * no supporter flag, by construction: "a supporter and a non-supporter are
   * indistinguishable to the system." `supporter` is therefore forbidden as an identifier
   * here even though the link itself is approved for Phase 12.
   */
  /**
   * Deliberately unanchored stems rather than `\b...\b` words.
   *
   * The first version of this guard used word boundaries and failed its own planted-violation
   * check: `sponsoredRoutes` has no boundary after `sponsored`, so the exact identifier shape
   * a real violation would take slipped straight through. Violations arrive as identifiers —
   * `isSponsored`, `promotedRank`, `premiumTier` — not as standalone words, so the stems are
   * matched anywhere. Comments are already stripped, which is what makes that safe.
   */
  const MONETISATION = /(sponsor|promoted|advertis|premium|paywall|supporter|donor|boosted)/i

  it('has no monetisation or sponsorship concept in src/', () => {
    expect(findAll(MONETISATION)).toEqual([])
  })

  it('would catch a planted violation', () => {
    for (const planted of [
      'const sponsoredRoutes = await prisma.route.findMany()',
      'if (route.promoted) rank += 10',
      'const isSponsored = route.sponsorshipTier !== null',
      'orderBy: [{ premiumTier: "desc" }]',
    ]) {
      expect(MONETISATION.test(planted)).toBe(true)
    }
  })

  /**
   * Ordering is the place money would enter if it ever did, so it is asserted directly:
   * search returns routes newest-first and there is no score to weight.
   */
  it('orders search results by nothing but recency', () => {
    const readLayer = stripComments(read('src/server/routes/read.ts'))
    const orderings = readLayer.match(/orderBy:[\s\S]{0,120}?\]/g) ?? []
    expect(orderings.length).toBeGreaterThan(0)

    for (const ordering of orderings) {
      expect(ordering).not.toMatch(/\b(rank|score|weight|boost|priority|featured)\b/i)
    }
    expect(readLayer).toMatch(/orderBy: \[\{ createdAt: 'desc' \}\]/)
  })
})

describe('FR-67 / invariant 9 — external content never wears our chrome', () => {
  /**
   * "Unknown external content shall remain clearly external and shall not visually inherit
   * the platform's authority." The way that is guaranteed is that nothing external is ever
   * embedded: no iframe, no object, no embed, no fetched preview card or thumbnail.
   *
   * An external source is a link showing its own host, and nothing more (FR-64).
   */
  const EMBEDDING = /<\s*(iframe|embed|object)\b|dangerouslySetInnerHTML/i

  it('embeds no external content anywhere in src/', () => {
    expect(findAll(EMBEDDING)).toEqual([])
  })

  it('would catch a planted violation', () => {
    expect(EMBEDDING.test('<iframe src={field.sourceUrl} />')).toBe(true)
    expect(EMBEDDING.test('<div dangerouslySetInnerHTML={{ __html: html }} />')).toBe(true)
  })

  it('opens every external link with the full rel guard', () => {
    const trust = read('src/components/trust.tsx')
    // `noopener noreferrer` so the opened page cannot reach back into ours; `external` and
    // `nofollow` so we neither vouch for it nor pass it standing.
    expect(trust).toMatch(/rel="nofollow noopener noreferrer external"/)
  })
})

describe('invariant 16 / test 16 — estimates read as estimates', () => {
  it('phrases the fly window as a range and says it is not a guarantee', () => {
    const dictionary = read('src/i18n/dictionaries/en.ts')
    expect(dictionary).toMatch(/estimate: '[^']*not a guarantee/)
    expect(dictionary).toMatch(/value: \(from: string, to: string\) => `Roughly \$\{from\} to \$\{to\}`/)
  })

  it('has no single-date variant of the fly window component', () => {
    // A planning aid rendered as one date is a promise. The component takes a `FlyWindow`,
    // which has two ends, and there is no other way to render it.
    const shared = stripComments(read('src/components/route-shared.tsx'))
    expect(shared).toMatch(/window: FlyWindow \| null/)
    expect(shared).not.toMatch(/flyDate|departureDate|arrivalDate/i)
  })
})

describe('the trust surface works without JavaScript', () => {
  /**
   * Phase 5 proved the read path works with JS disabled, and Phase 6 must not quietly undo
   * it: a student on a slow phone should still be able to see that a route is disputed.
   * Every disclosure here is a `<details>` element, and no trust component is a client one.
   */
  it('uses no client components for trust', () => {
    for (const file of ['src/components/trust.tsx', 'src/components/step-fields.tsx']) {
      expect(read(file)).not.toMatch(/^'use client'/m)
    }
  })

  it('discloses detail with <details>, not with state', () => {
    const trust = read('src/components/trust.tsx')
    expect(trust).toMatch(/<details/)
    expect(trust).not.toMatch(/useState|onClick/)
  })
})
