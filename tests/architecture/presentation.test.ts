import { describe, expect, it } from 'vitest'

import { SUPPORT_HOST, SUPPORT_URL } from '../../src/lib/support'
import { read, stripComments, walk } from '../support/source-files'

/**
 * Phase 12 — presentation, accessibility and the support link.
 *
 * Everything here guards a property that fails **silently**. A colour utility with no theme
 * token renders as nothing; a contrast ratio a tenth below AA looks fine to the person who
 * chose it; a client component added to the read path costs a bundle nobody measures; a
 * payment table would be a schema change nobody notices in review. None of these break a
 * test that is not written to look for them, which is why they are written here.
 */

const SOURCE_FILES = walk('src', ['.ts', '.tsx'])
const CSS = read('src/app/globals.css')
const SCHEMA = walk('prisma/schema', ['.prisma']).map(read).join('\n')

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Colour — WCAG contrast, computed rather than eyeballed
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/** oklch → linear sRGB. The same transform browsers apply. */
function oklchToRgb(L: number, C: number, hDeg: number): [number, number, number] {
  const gamma = (t: number): number =>
    t > 0.0031308 ? 1.055 * Math.pow(t, 1 / 2.4) - 0.055 : 12.92 * t
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

function luminance(rgb: readonly number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = Math.min(1, Math.max(0, v))
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

function contrast(a: readonly number[], b: readonly number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

/** Reads the tokens out of `globals.css` itself, so the test cannot drift from the theme. */
function themeTokens(): Map<string, [number, number, number]> {
  const tokens = new Map<string, [number, number, number]>()
  for (const match of CSS.matchAll(
    /--color-([a-z0-9-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g,
  )) {
    tokens.set(match[1] ?? '', [Number(match[2]), Number(match[3]), Number(match[4])])
  }
  return tokens
}

describe('WCAG contrast — every text token against every background it sits on', () => {
  /**
   * **Phase 12 found `ink-500` at 4.28:1 against white — below AA.**
   *
   * It carries almost every explanatory line in the product, and those lines are `text-xs`,
   * so the 3:1 large-text allowance never applied. The copy that was failing is the copy that
   * explains the things a reader most needs explained: what a source class means, why a route
   * is quiet, that their progress is untouched. Darkened to L=0.55.
   *
   * Recomputed here rather than recorded, so a later palette adjustment cannot quietly undo
   * it — and read out of the CSS, so the numbers cannot drift from the theme.
   */
  const TEXT_TOKENS = ['ink-900', 'ink-700', 'ink-500', 'brand-900', 'brand-700', 'brand-500', 'caution-900']
  const BACKGROUNDS = ['surface', 'surface-muted', 'caution-50']

  it('reads the palette out of globals.css', () => {
    const tokens = themeTokens()
    for (const name of [...TEXT_TOKENS, ...BACKGROUNDS]) {
      expect(tokens.has(name), `${name} missing from globals.css`).toBe(true)
    }
  })

  it('meets AA (4.5:1) for normal text on every background in use', () => {
    const tokens = themeTokens()
    const failures: string[] = []

    for (const fg of TEXT_TOKENS) {
      for (const bg of BACKGROUNDS) {
        const a = tokens.get(fg)
        const b = tokens.get(bg)
        if (!a || !b) continue
        const ratio = contrast(oklchToRgb(...a), oklchToRgb(...b))
        if (ratio < 4.5) failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)}`)
      }
    }

    expect(failures, 'These pairs are below WCAG AA for normal text').toEqual([])
  })

  it('would catch a regression', () => {
    // The value this token had before Phase 12, which failed.
    const before = contrast(oklchToRgb(0.58, 0.015, 258), oklchToRgb(1, 0, 0))
    expect(before).toBeLessThan(4.5)
  })

  /**
   * `hairline` is deliberately not in the list. It is a border, never text, and a decorative
   * boundary beside a background change is not a "user interface component" under WCAG 1.4.11.
   * Asserting 4.5:1 on it would force a hairline dark enough to look like a table rule, which
   * would make the interface worse for everyone in the name of a rule it does not fall under.
   */
  it('uses hairline only as a border, never as text', () => {
    for (const file of SOURCE_FILES) {
      expect(stripComments(read(file)), file).not.toMatch(/\btext-hairline\b/)
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Colour utilities that resolve to nothing
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('every colour utility resolves to a token that exists', () => {
  /**
   * **This class of bug is completely silent.** Tailwind emits no CSS for an undefined
   * utility and no warning either, so `bg-canvas` and `bg-brand-50` — both written in earlier
   * phases, neither ever defined — simply rendered as no background at all. Nothing failed;
   * the elements were just transparent, and on a white page that is invisible.
   */
  const BUILT_IN =
    /^(white|black|transparent|current|inherit|red|green|blue|slate|gray|zinc|neutral|stone|amber|yellow|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|orange)(-\d{1,3})?$/

  it('has no bg-, text- or border- utility naming an undefined colour', () => {
    const defined = new Set(themeTokens().keys())
    const offenders: string[] = []

    for (const file of SOURCE_FILES) {
      const code = stripComments(read(file))
      // Only inside className strings, so prose and identifiers cannot false-positive.
      for (const attr of code.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
        const classes = attr[1] ?? attr[2] ?? attr[3] ?? ''
        for (const util of classes.split(/\s+/)) {
          const match = /^(?:\w+:)*(bg|text|border|fill|stroke|ring|divide)-([a-z][a-z0-9-]*)(?:\/\d+)?$/.exec(
            util,
          )
          if (!match) continue
          const token = match[2] ?? ''
          if (defined.has(token) || BUILT_IN.test(token)) continue
          /**
           * These prefixes are shared with non-colour utilities, and the list is where this
           * guard earns or loses its usefulness. Getting it wrong in the permissive direction
           * lets a broken colour through; getting it wrong the other way floods the result
           * with `border-t` and the guard gets deleted by whoever is next.
           *
           *   sides and axes   border-t, border-b-2, divide-y, border-x
           *   sizes            text-xs … text-4xl, ring-2, border-4, stroke-1
           *   alignment        text-left, text-center, text-balance, text-nowrap
           *   keywords         bg-none, fill-none, border-solid, bg-cover
           */
          const NOT_A_COLOUR =
            /^([tblrxyse](-\d+)?|\d+|xs|sm|base|lg|\d?xl|left|right|center|justify|start|end|balance|pretty|wrap|nowrap|ellipsis|clip|solid|dashed|dotted|double|none|hidden|auto|top|bottom|cover|contain|repeat|fixed|local|scroll|inset|origin|clip-text)$/
          if (NOT_A_COLOUR.test(token)) continue
          offenders.push(`${file}: ${util}`)
        }
      }
    }

    expect(offenders, 'These utilities name a colour with no theme token').toEqual([])
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Performance — the read path ships no JavaScript
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('the read path stays server rendered', () => {
  /**
   * Zero client components was true through Phase 11 and is most of why the read path is
   * fast. Phase 12 added exactly one — the error boundary, which Next requires to be a client
   * component so it can offer a retry, and which ships only after something has already
   * failed.
   *
   * The list is explicit so the next one is a decision rather than a drift.
   */
  const ALLOWED = ['src/app/[locale]/error.tsx']

  it('has no client component outside the allowed list', () => {
    const clientFiles = SOURCE_FILES.filter((file) => /^\s*'use client'/m.test(read(file)))
    expect(clientFiles.sort()).toEqual(ALLOWED.sort())
  })

  /**
   * The responsive road is a media query, not a hook. A `useMediaQuery` here would put a
   * bundle in front of the one page a student on a slow connection must not wait for.
   */
  it('chooses road density with CSS, not JavaScript', () => {
    const renderer = stripComments(read('src/renderer/route-visual.tsx'))
    expect(renderer).toMatch(/sm:hidden/)
    expect(renderer).toMatch(/hidden sm:block/)
    expect(renderer).not.toMatch(/useState|useEffect|matchMedia|window\./)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The voluntary support link — CLAUDE.md §10.1, invariant 13
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('§10.1, invariant 13 — the support link is a link and nothing more', () => {
  /**
   * §10.1 permits exactly one thing: an outbound link. Everything below is what it forbids,
   * and each is asserted as an absence rather than trusted as an intention.
   *
   * The load-bearing one is the supporter flag. Invariant 13 says trust is never purchasable,
   * and the strongest form of that is not a rule about how a flag may be used — it is having
   * no flag, so nothing *could* condition on it.
   */
  it('is an outbound link to one host, and nothing calls that host', () => {
    expect(SUPPORT_URL.startsWith('https://')).toBe(true)
    expect(SUPPORT_HOST).toBe(new URL(SUPPORT_URL).host)

    for (const file of SOURCE_FILES) {
      const code = stripComments(read(file))
      expect(code, file).not.toMatch(/fetch\([^)]*gumroad/i)
      expect(code, file).not.toMatch(/gumroad.*(api|webhook|secret|token|key)/i)
    }
  })

  it('has no payment, donation or supporter model in the schema', () => {
    expect(SCHEMA).not.toMatch(
      /model \w*(Payment|Donation|Supporter|Subscription|Order|Invoice)\b/i,
    )
    expect(SCHEMA).not.toMatch(/\b(isSupporter|supporterSince|donorId|patronTier|paidUntil)\b/i)
  })

  it('has no supporter concept anywhere in src/', () => {
    const SUPPORTER = /\b(isSupporter|supporterTier|donorStatus|hasDonated|patron|premium)\b/i
    for (const file of SOURCE_FILES) {
      expect(stripComments(read(file)), file).not.toMatch(SUPPORTER)
    }
    expect(SUPPORTER.test('if (user.isSupporter) boost(route)')).toBe(true)
  })

  it('appears once, in the footer, and never in route content', () => {
    const users = SOURCE_FILES.filter((file) =>
      stripComments(read(file)).includes('@/lib/support'),
    )
    expect(users).toEqual(['src/components/site-footer.tsx'])
  })

  it('says it changes nothing, and never says "donate"', () => {
    const dictionary = read('src/i18n/dictionaries/en.ts')
    // §10.1: "Support", not "Donate" — the latter implies tax-deductible charitable framing.
    expect(stripComments(dictionary)).not.toMatch(/\bdonate\b/i)
    expect(dictionary).toMatch(/supporting it affects no route/i)
  })

  it('opens externally and declares where it goes', () => {
    const footer = read('src/components/site-footer.tsx')
    // Invariant 10: never hide a link's destination.
    expect(footer).toMatch(/rel="noreferrer noopener external"/)
    expect(footer).toMatch(/supportOpensExternal/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Production presentation
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('the application presents itself as a finished product', () => {
  it('gives every page its own title through a template', () => {
    const layout = read('src/app/[locale]/layout.tsx')
    expect(layout).toMatch(/template:/)

    // Every page a reader can reach by typing a URL carries its own subject.
    for (const page of [
      'src/app/[locale]/routes/page.tsx',
      'src/app/[locale]/routes/[slug]/page.tsx',
      'src/app/[locale]/routes/[slug]/changes/page.tsx',
      'src/app/[locale]/routes/[slug]/history/page.tsx',
      'src/app/[locale]/routes/[slug]/journey/page.tsx',
      'src/app/[locale]/journeys/page.tsx',
      'src/app/[locale]/signin/page.tsx',
      'src/app/[locale]/routes/new/page.tsx',
    ]) {
      expect(read(page), page).toMatch(/export async function generateMetadata/)
    }
  })

  it('has an icon and a theme colour', () => {
    expect(read('src/app/icon.svg')).toMatch(/<svg/)
    expect(read('src/app/[locale]/layout.tsx')).toMatch(/export const viewport: Viewport/)
  })

  /**
   * Phase 0 set `index: false` with a note that Phase 5 would open it. Phase 5 opened the
   * read path and this was missed for six phases — every public route page has been
   * unlisted since. FR-01 and D-03 make the read path public on purpose.
   */
  it('lets the public read path be indexed, and keeps admin and journeys out', () => {
    expect(read('src/app/[locale]/layout.tsx')).toMatch(/robots: \{ index: true/)
    const robots = read('src/app/robots.ts')
    expect(robots).toMatch(/\/en\/admin\//)
    expect(robots).toMatch(/\/en\/journeys/)
  })

  it('has an error boundary and a loading state', () => {
    expect(read('src/app/[locale]/error.tsx')).toMatch(/reset/)
    expect(read('src/app/[locale]/loading.tsx')).toMatch(/aria-busy/)
    // An error page must not leak what failed.
    const boundary = stripComments(read('src/app/[locale]/error.tsx'))
    expect(boundary).not.toMatch(/error\.message|error\.stack/)
  })

  /**
   * Disabling pinch-zoom is one of the most common accessibility failures on the mobile web,
   * and Next's default viewport does not do it — so this guards against somebody adding it.
   *
   * **Comments stripped.** The fourth time in this project (Test.md §19, §21): the note in
   * `layout.tsx` explaining that `maximum-scale` must never be set made this guard report
   * that `maximum-scale` was set. An absence guard reads code, never prose.
   */
  it('never disables pinch-zoom', () => {
    for (const file of SOURCE_FILES) {
      const code = stripComments(read(file))
      expect(code, file).not.toMatch(/maximum-scale|user-scalable\s*[:=]\s*['"]?no/)
      expect(code, file).not.toMatch(/userScalable:\s*false/)
    }
    // Not vacuous.
    expect(/userScalable:\s*false/.test('export const viewport = { userScalable: false }')).toBe(
      true,
    )
  })
})
