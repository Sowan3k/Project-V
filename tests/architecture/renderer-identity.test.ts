import { describe, expect, it } from 'vitest'

import { read, walk } from '../support/source-files'

/**
 * Test 24d — the renderer never branches on which route it is drawing.
 *
 * CLAUDE.md invariant 24: "a route created by a community contributor at 2am must draw
 * correctly with no developer involved." That holds only if the renderer cannot special-case
 * anything.
 *
 * Scope matters here, and it is the reason this check replaced an earlier idea. The original
 * plan was a repository-wide grep for country names, which was dropped as unreliable
 * (Status.md, session 3): it would have false-positived on route data, seed content, i18n
 * strings, alt text and fixtures, while missing the actual failure mode — logic can branch on
 * an id or slug without ever writing "Germany".
 *
 * So this is narrow and behavioural: it reads only `src/renderer/**`, and looks for the
 * renderer comparing against, or destructuring, route identity.
 */

const RENDERER_DIR = 'src/renderer'
const rendererFiles = walk(RENDERER_DIR, ['.ts', '.tsx'])

/** Block comments and whole-line comments removed, so prose cannot trip the check. */
function code(file: string): string {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

describe('the renderer exists and is where it claims to be', () => {
  it('has source files', () => {
    expect(rendererFiles.length).toBeGreaterThan(2)
  })

  it('is the module the ESLint import boundary protects', () => {
    for (const file of rendererFiles) expect(file.startsWith(`${RENDERER_DIR}/`)).toBe(true)
  })
})

describe('24d — no branching on route identity', () => {
  /**
   * Identity comparisons: `x.id === '…'`, `slug ===`, `destination !==`, `title ===`, and
   * membership tests over the same. Structural comparisons — rank, lane, category, kind —
   * are legitimate and must not be caught.
   */
  // Longest alternatives first. Ordered the other way, `destination` matches before
  // `destinationCountry` and then fails its own word boundary, so the pattern silently
  // matches nothing — which is why the not-vacuous test below exists.
  const IDENTITY_COMPARISON =
    /\b\w*(?:destinationCountry|originCountry|destination|routeId|slug|title)\b\s*(?:===|!==|==|!=)/i

  // `[\w.]*` rather than `\w*`: these two anchor immediately after a bracket, so the
  // pattern has to be able to step over a property access like `route.slug`.
  const IDENTITY_MEMBERSHIP =
    /\[[^\]]*\]\s*\.\s*includes\s*\(\s*[\w.]*(?:routeId|slug|destination|title)\b/i

  const IDENTITY_SWITCH = /switch\s*\(\s*[\w.]*(?:routeId|slug|destination|title)\b/i

  it.each(rendererFiles)('%s does not compare against route identity', (file) => {
    const source = code(file)
    expect(
      IDENTITY_COMPARISON.test(source),
      `${file} compares against a route's identity. The renderer must decide from graph ` +
        `structure alone — if a route needs different drawing, the renderer is wrong ` +
        `(CLAUDE.md invariant 24).`,
    ).toBe(false)
    expect(IDENTITY_MEMBERSHIP.test(source), `${file} tests membership on route identity`).toBe(false)
    expect(IDENTITY_SWITCH.test(source), `${file} switches on route identity`).toBe(false)
  })

  it.each(rendererFiles)('%s never reads a destination or slug at all', (file) => {
    const source = code(file)
    // Stronger than not-comparing: the renderer should not even have these values in hand.
    // `RouteGraph` deliberately carries no route identity, so any reference is a smell.
    expect(/\bslug\b/.test(source), `${file} references a slug`).toBe(false)
    expect(/\bdestinationCountry\b/.test(source), `${file} references a destination country`).toBe(false)
    expect(/\boriginCountry\b/.test(source), `${file} references an origin country`).toBe(false)
  })

  it('proves the check is not vacuous', () => {
    // If the patterns matched nothing at all they would pass regardless of the code.
    expect(IDENTITY_COMPARISON.test("if (route.slug === 'bd-de-masters') {}")).toBe(true)
    expect(IDENTITY_COMPARISON.test('if (graph.destinationCountry !== x) {}')).toBe(true)
    expect(IDENTITY_MEMBERSHIP.test("if (['a','b'].includes(route.slug)) {}")).toBe(true)
    expect(IDENTITY_SWITCH.test('switch (destination) {}')).toBe(true)

    // ...and that structural logic, which the renderer genuinely needs, is not caught.
    expect(IDENTITY_COMPARISON.test('if (node.rank === other.rank) {}')).toBe(false)
    expect(IDENTITY_COMPARISON.test('if (edge.kind === StepEdgeKind.rejoin) {}')).toBe(false)
    expect(IDENTITY_COMPARISON.test('if (step.category === category) {}')).toBe(false)
  })
})

describe('24c — the renderer depends on nothing route-specific', () => {
  const FORBIDDEN_IMPORT = /from\s+['"][^'"]*\/(seed|content|destinations)(\/|['"])/

  it.each(rendererFiles)('%s imports no seed, content or destination module', (file) => {
    expect(FORBIDDEN_IMPORT.test(read(file))).toBe(false)
  })

  it.each(rendererFiles)('%s imports no database client', (file) => {
    // The renderer takes data as an argument. Reaching for a client would let it fetch
    // something route-specific and quietly become non-generic.
    expect(/@prisma\/client|@\/server\//.test(read(file))).toBe(false)
  })

  it.each(rendererFiles)('%s holds no user-facing English of its own', (file) => {
    // Strings are passed in (RouteVisualStrings) so the renderer stays i18n-agnostic. The
    // exception is placeholder glyphs and colour tokens, which are not language.
    const source = code(file)
    for (const phrase of ['Route', 'Step ', 'Departure', 'Archived', 'New route']) {
      const quoted = new RegExp(`['"\`]${phrase}`)
      expect(quoted.test(source), `${file} appears to hardcode the string "${phrase}"`).toBe(false)
    }
  })
})
