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

/**
 * Non-colour scale tokens, by family — Phase 12B.
 *
 * `text-` is shared between the font-size scale and the text-colour utilities, so the
 * "undefined colour" guard below has to know both or it reports every `text-panel` as a
 * broken colour. Reading them from the CSS keeps that automatic: adding a step to the type
 * scale needs no test change.
 */
function scaleTokens(prefix: string): Set<string> {
  const names = new Set<string>()
  for (const match of CSS.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+):`, 'g'))) {
    const name = match[1] ?? ''
    // `--text-panel--line-height` declares a property of `panel`, not a token called
    // `panel--line-height`.
    names.add(name.split('--')[0] ?? name)
  }
  return names
}

/** True when the sRGB conversion of an oklch triple lands inside the displayable cube. */
function inGamut(rgb: readonly number[]): boolean {
  return rgb.every((v) => v >= -0.001 && v <= 1.001)
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
   The category palette — Phase 12B, closing a CLAUDE.md §11 open decision
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('the six step categories are a measured palette, not a chosen one', () => {
  const CATEGORIES = [
    'documents',
    'language',
    'admission',
    'funding',
    'immigration',
    'travel',
  ] as const

  it('defines three tones for every category', () => {
    const tokens = themeTokens()
    for (const category of CATEGORIES) {
      for (const tone of ['ink', 'line', 'fill'] as const) {
        expect(tokens.has(`cat-${category}-${tone}`), `cat-${category}-${tone} missing`).toBe(true)
      }
    }
  })

  /**
   * **A token written out of gamut is a token that is not the colour it was measured as.**
   *
   * The browser clamps it, silently, and every contrast figure computed from the written
   * value is then wrong about what is on screen. Three of the first eighteen tones were
   * written 0.3% outside sRGB by rounding up after the chroma fit — far too small to see and
   * more than enough to make the measurement a fiction.
   */
  it('keeps every category tone inside sRGB', () => {
    const tokens = themeTokens()
    const clipping: string[] = []
    for (const [name, value] of tokens) {
      if (!name.startsWith('cat-')) continue
      if (!inGamut(oklchToRgb(...value))) clipping.push(name)
    }
    expect(clipping, 'These tokens are outside sRGB and will be clamped by the browser').toEqual([])
  })

  it('meets AA for category ink on white and on its own fill', () => {
    const tokens = themeTokens()
    const white = oklchToRgb(1, 0, 0)
    const failures: string[] = []

    for (const category of CATEGORIES) {
      const ink = tokens.get(`cat-${category}-ink`)
      const fill = tokens.get(`cat-${category}-fill`)
      if (!ink || !fill) continue
      const onWhite = contrast(oklchToRgb(...ink), white)
      const onFill = contrast(oklchToRgb(...ink), oklchToRgb(...fill))
      if (onWhite < 4.5) failures.push(`${category} ink on white: ${onWhite.toFixed(2)}`)
      if (onFill < 4.5) failures.push(`${category} ink on its fill: ${onFill.toFixed(2)}`)
    }

    expect(failures).toEqual([])
  })

  /**
   * The road segment is a graphical object rather than text, so the bar is WCAG 1.4.11's
   * 3:1 — but it *is* a bar. A pastel road on a white page is invisible to a reader with low
   * vision, and the road is the product's primary metaphor (§8.5.3).
   */
  it('meets 3:1 for every category line against the page', () => {
    const tokens = themeTokens()
    const white = oklchToRgb(1, 0, 0)
    for (const category of CATEGORIES) {
      const line = tokens.get(`cat-${category}-line`)
      if (!line) continue
      const ratio = contrast(oklchToRgb(...line), white)
      expect(ratio, `${category} line on white`).toBeGreaterThanOrEqual(3)
    }
  })

  /**
   * Lightness constant across the family is what makes six hues read as one set rather than
   * as six unrelated colours — and it is also what keeps the ribbon legible in greyscale,
   * where every segment lands at the same value and the glyphs do the work instead.
   */
  it('holds lightness constant across the family, per tone', () => {
    const tokens = themeTokens()
    for (const tone of ['ink', 'line', 'fill'] as const) {
      const lightnesses = new Set(
        CATEGORIES.map((c) => tokens.get(`cat-${c}-${tone}`)?.[0]).filter((v) => v !== undefined),
      )
      expect(lightnesses.size, `${tone} lightness varies across categories`).toBe(1)
    }
  })

  /**
   * **The decision recorded in globals.css is that there is NO maturity palette** — maturity
   * is carried by weight, word and icon, from tokens that already exist. A
   * `--color-lifecycle-established` appearing here later would be someone re-opening a closed
   * decision by accident, and would put a coloured badge on the ordinary case (§7.3), or a
   * green one on a route we have not verified (invariant 12, BR-20).
   */
  it('assigns no colour to any lifecycle state', () => {
    const tokens = [...themeTokens().keys()]
    const offenders = tokens.filter((name) =>
      /^(lifecycle|maturity|established|experimental|developing|disputed|dormant|quiet|stale)/.test(
        name,
      ),
    )
    expect(offenders, 'A per-state colour re-opens a decision closed in globals.css').toEqual([])
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
    const FONT_SIZES = scaleTokens('text')
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
          // `text-` also addresses the font-size scale, and `text-panel` is a size, not a
          // colour. Read from the CSS rather than listed, so adding a step to the scale
          // needs no change here.
          if (match[1] === 'text' && FONT_SIZES.has(token)) continue
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
   The design system — Phase 12B
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('components build from the scale rather than from ad-hoc values', () => {
  /**
   * **This is the guard that keeps the design system a system.**
   *
   * A scale that components are free to ignore is documentation, not a system. One
   * `text-[13px]` is harmless; the hundredth is how the product got here — eleven pages each
   * inventing their own sizes, and a result that reads as an undifferentiated field of grey
   * cards because nothing was ever decided once.
   *
   * Scoped to the type, space and radius families deliberately. Widths are *not* included:
   * `max-w-[68ch]` is a reading measure, which is a typographic quantity rather than a step
   * on a spacing scale, and the canvas guard below already forbids a second page width.
   */
  it('uses no arbitrary type, spacing or radius value', () => {
    const ARBITRARY = /\b(?:\w+:)*(text|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|rounded|space-x|space-y)-\[[^\]]+\]/g
    const offenders: string[] = []

    for (const file of SOURCE_FILES) {
      const code = stripComments(read(file))
      for (const attr of code.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
        const classes = attr[1] ?? attr[2] ?? attr[3] ?? ''
        for (const match of classes.matchAll(ARBITRARY)) {
          // Tracking is a typographic detail with no scale of its own and no meaningful
          // step — an uppercase wordmark needs the exact letter-spacing it needs.
          if (match[0].includes('tracking')) continue
          offenders.push(`${file}: ${match[0]}`)
        }
      }
    }

    expect(offenders, 'These bypass the token scale in globals.css').toEqual([])
  })

  /**
   * §10.4 and §8.5.4: colour never carries meaning on its own. The category palette runs
   * green → amber → rose in journey order, and those three are precisely the ones deutan and
   * protan vision collapse — so for a substantial number of readers the icon *is* the signal,
   * not a decoration beside it.
   *
   * Asserted on the data rather than on a rendering, because it is the data that would go
   * missing: a category added later with no icon would still compile and still draw.
   */
  it('gives every step category an icon, not only a colour', async () => {
    const { CATEGORY_STYLE } = await import('../../src/renderer/primitives')
    const { STEP_CATEGORIES } = await import('../../src/domain/enums')

    for (const category of STEP_CATEGORIES) {
      const style = CATEGORY_STYLE[category]
      expect(style, `${category} has no presentation`).toBeDefined()
      expect(style.icon.length, `${category} has no icon path`).toBeGreaterThan(10)
      expect(style.ink, `${category} ink is not a token`).toMatch(/^var\(--color-/)
      expect(style.fill, `${category} fill is not a token`).toMatch(/^var\(--color-/)
      expect(style.line, `${category} line is not a token`).toMatch(/^var\(--color-/)
    }
  })

  /**
   * The palette lives in one place. A hex literal in the renderer is a second source that
   * can disagree with `globals.css` — and the contrast test reads the CSS, so the value it
   * certifies would not be the value being painted.
   *
   * `var(--token, #fallback)` is allowed and is why the pattern is anchored: the fallback is
   * only reached if the stylesheet failed to load, in which case a readable approximation
   * beats an unstyled black-on-white diagram.
   */
  it('keeps colour literals out of the renderer', () => {
    const offenders: string[] = []
    for (const file of walk('src/renderer', ['.ts', '.tsx'])) {
      const code = stripComments(read(file))
      for (const match of code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        const before = code.slice(Math.max(0, match.index - 60), match.index)
        if (/var\(--[a-z0-9-]+,\s*$/.test(before)) continue
        offenders.push(`${file}: ${match[0]}`)
      }
    }
    expect(offenders, 'A colour literal here is a second palette').toEqual([])
  })

  it('leads with the brand lockup in the header', () => {
    const header = stripComments(read('src/components/site-header.tsx'))
    expect(header).toMatch(/<BrandLockup/)
    // Bengali identity, English interface (§8.5.6) — both halves, and the Bengali tagged so
    // a screen reader switches pronunciation instead of reading it as English.
    const ui = read('src/components/ui.tsx')
    expect(ui).toMatch(/lang="bn"/)
  })

  /**
   * The primitives are what make the system usable; a primitive that needed state would put
   * a JavaScript bundle in front of every page that used it, which is the opposite of the
   * point. Checked here as well as in the client-component census below, because this is the
   * file most likely to grow one.
   */
  /**
   * **Radius comes from the scale, not from Tailwind's default ramp** — Phase 12E.
   *
   * There were 76 hand-picked `rounded-lg` / `rounded-xl` across 20 files, which is what a
   * design system is for: a panel and a control should each have *one* corner in the whole
   * product, and the way to guarantee that is for there to be one place the number lives.
   *
   * Directional and shape variants — `rounded-t-lg` on a tab, `rounded-full` on a chip — are
   * untouched: they are not the panel/control decision this is about.
   */
  it('uses the radius tokens rather than the default ramp', () => {
    const offenders: string[] = []
    for (const file of SOURCE_FILES) {
      const code = stripComments(read(file))
      for (const attr of code.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
        const classes = attr[1] ?? attr[2] ?? attr[3] ?? ''
        for (const util of classes.split(/\s+/)) {
          if (/^(?:\w+:)*rounded-(sm|md|lg|xl|2xl|3xl)$/.test(util)) offenders.push(`${file}: ${util}`)
        }
      }
    }
    expect(offenders, 'Use rounded-panel or rounded-control').toEqual([])
  })

  /**
   * And a filled button comes from `buttonClass`. Six had been hand-written before the
   * primitive gained a `compact` size — each very slightly different, and every one of them a
   * place the next person would copy from.
   */
  it('builds filled buttons from the primitive', () => {
    const offenders: string[] = []
    for (const file of SOURCE_FILES) {
      if (file.endsWith('ui.tsx')) continue
      const code = stripComments(read(file))
      for (const attr of code.matchAll(/className="([^"]*)"/g)) {
        if (/\bbg-brand-700\b/.test(attr[1] ?? '') && /\bpx-\d/.test(attr[1] ?? '')) {
          offenders.push(file)
        }
      }
    }
    expect([...new Set(offenders)], 'Use buttonClass() from @/components/ui').toEqual([])
  })

  it('keeps every primitive a server component', () => {
    const ui = read('src/components/ui.tsx')
    expect(ui).not.toMatch(/'use client'/)
    expect(stripComments(ui)).not.toMatch(/useState|useEffect|useRef|onClick=/)
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

  /**
   * **`noindex` on every private surface, not only a `robots.txt` disallow.**
   *
   * The two do different jobs and are routinely confused. A disallow asks a crawler not to
   * *fetch* a page; it does not stop the URL appearing in an index when something links to
   * it, and an indexed journey URL advertises that a private page sits at a guessable
   * address. `noindex` is the directive that actually keeps it out.
   *
   * Listed explicitly, so a new private surface is a decision rather than an omission.
   */
  it('marks every private surface noindex', () => {
    for (const page of [
      'src/app/[locale]/journeys/page.tsx',
      'src/app/[locale]/routes/[slug]/journey/page.tsx',
      'src/app/[locale]/signin/page.tsx',
      'src/app/[locale]/admin/reports/page.tsx',
      'src/app/[locale]/admin/routes/page.tsx',
    ]) {
      expect(read(page), page).toMatch(/robots: \{ index: false/)
    }
  })

  it('exposes no sitemap that could list a private URL', () => {
    // None exists. If one is ever added it must exclude /journeys and /admin, and this test
    // is where that requirement is recorded rather than in a comment nobody reads.
    const sitemaps = walk('src/app', ['.ts']).filter((file) => file.endsWith('sitemap.ts'))
    expect(sitemaps).toEqual([])
  })

  it('has an error boundary that leaks nothing about what failed', () => {
    expect(read('src/app/[locale]/error.tsx')).toMatch(/reset/)
    const boundary = stripComments(read('src/app/[locale]/error.tsx'))
    expect(boundary).not.toMatch(/error\.message|error\.stack/)
  })

  /**
   * **The loading state is inside the page, not at the segment — deliberately.**
   *
   * A `loading.tsx` under `[locale]` was written first and removed: it replaces everything
   * inside the layout, including the persistent route header and tabs that CLAUDE.md §7.1
   * exists to keep on screen. Every tab click would have blanked the route a reader was
   * looking at, which is worse than the brief wait it hid.
   *
   * A Suspense boundary around the part that is actually slow does the opposite — the filters
   * stay put and usable while the results stream in underneath them.
   *
   * Asserted as an absence as well as a presence, so a future `loading.tsx` at the segment
   * level is a decision somebody has to make against this note rather than an accident.
   */
  /**
   * **Phase 12 tried two loading states on the read path and removed both.** Each looked
   * obviously right until it was tested, and the reasons are worth keeping.
   *
   * A segment-level `loading.tsx` went first: under `[locale]` it replaces everything inside
   * the layout, including the persistent route header and tabs §7.1 exists to keep on screen,
   * so every tab click would have blanked the route being read.
   *
   * A Suspense boundary around just the search results replaced it, and **broke the platform
   * for anybody without JavaScript.** React streams the fallback and swaps in the real markup
   * with an inline script; with no script the swap never happens and the reader is left on a
   * skeleton for ever. The Phase 5 no-JavaScript spec caught it.
   *
   * Search is the first thing a visitor does, on a phone, often on a poor connection
   * (CLAUDE.md §7). Working without JavaScript is worth more than a shimmer.
   */
  it('has no loading state that would break without JavaScript', () => {
    const segmentWide = walk('src/app', ['.tsx']).filter((file) => file.endsWith('loading.tsx'))
    expect(segmentWide, 'a segment-wide loading.tsx would blank the route context').toEqual([])

    for (const page of [
      'src/app/[locale]/routes/page.tsx',
      'src/app/[locale]/routes/[slug]/page.tsx',
      'src/app/[locale]/page.tsx',
    ]) {
      expect(stripComments(read(page)), page).not.toMatch(/<Suspense/)
    }
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

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The shared application canvas — CLAUDE.md §7.2
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('every page sits on the shared canvas', () => {
  /**
   * §7.2: "One canvas width and one gutter, shared by the header, every page and the footer.
   * That shared edge is what gives the interface a stable vertical axis at every viewport
   * size." `PageCanvas` is named as "the single owner of page width and gutters."
   *
   * **Six of eleven pages did not use it.** `PageCanvas` supplies both the max-width and the
   * gutters, so those pages had *no gutter at all*: their content sat flush against x=0 while
   * the header and footer above and below were inset. Sign-in was the worst of them — a form
   * pinned to the top-left corner of a 1440px page — and it is the page a reader sees at the
   * moment they decide whether this looks like a real product.
   *
   * This was not a matter of taste. The rule already existed and was written down; nothing
   * checked it. Now something does.
   */
  it('wraps every page in PageCanvas, directly or through RouteContext', () => {
    const pages = walk('src/app', ['.tsx']).filter((file) => file.endsWith('page.tsx'))
    expect(pages.length).toBeGreaterThan(8)

    const offenders = pages.filter((file) => {
      const code = stripComments(read(file))
      // RouteContext renders PageCanvas itself, and is the persistent shell for route views.
      return !code.includes('<PageCanvas') && !code.includes('<RouteContext')
    })

    expect(
      offenders,
      'These pages render outside the shared canvas, so they have no gutter and no common ' +
        'left axis with the header and footer (CLAUDE.md §7.2).',
    ).toEqual([])
  })

  /**
   * And the canvas is defined once. Two definitions of "the page width" is how a header and
   * the content beneath it end up on different axes, which is the failure §7.2 opens with.
   */
  it('defines the canvas width and gutter in exactly one place', () => {
    const layout = read('src/components/layout.tsx')
    expect(layout).toMatch(/export const PAGE_CANVAS = /)
    expect(layout).toMatch(/export const PAGE_GUTTER = /)

    const offenders = walk('src', ['.tsx'])
      .filter((file) => file !== 'src/components/layout.tsx')
      .filter((file) => /max-w-\[\d+px\]/.test(stripComments(read(file))))
    expect(offenders, 'A page-width literal outside layout.tsx is a second canvas').toEqual([])
  })
})
