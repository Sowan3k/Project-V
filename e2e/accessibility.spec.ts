import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { SEEDED_ROUTE_SLUG } from './fixtures'

/**
 * An automated accessibility pass over every public screen — Phase 12G, Gate 4.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Why this exists, and what it is not.**
 *
 * Phase 12G's scope names "a full keyboard pass and an automated accessibility pass over every
 * screen", and until now only the keyboard half existed — scattered through
 * `presentation.spec.ts` as individual assertions about the skip link, tab order and station
 * links. Those are the checks somebody thought to write. This is the complement: the checks
 * nobody thought to write, because axe knows about several dozen failure modes that a person
 * reviewing their own markup reliably does not.
 *
 * **It is not a substitute for the assertions already here, and it does not make this product
 * accessible.** Automated tooling catches somewhere under half of real barriers — it can tell
 * that an input has no label, and it cannot tell that a label is wrong. The specific things
 * this product depends on and axe cannot see are already guarded elsewhere and stay there:
 *
 *   - **colour is never the only carrier of meaning** (§10.4) — the category-icon guard in
 *     `presentation.spec.ts`, and `SeverityChip`'s icon on the one loud level;
 *   - **contrast** — computed from the tokens in `globals.css` by
 *     `tests/architecture/presentation.test.ts`, which is stricter than a rendered sample
 *     because it covers every token pair rather than the ones that happen to be on screen;
 *   - **the whole read path works with JavaScript disabled** — `route-journey.spec.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **WCAG 2.1 AA is the bar, and it is asserted as zero violations rather than a budget.**
 *
 * A threshold ("no more than three") is a licence to add a fourth. Where a rule genuinely
 * should not apply, it is disabled *by name with a reason* in the builder below, so an
 * exemption is a decision somebody wrote down rather than a number quietly drifting.
 *
 * Runs at every configured viewport, because several of these rules are layout-dependent:
 * target size, reflow, and whether a control is still reachable once the phone composition
 * replaces the desktop one.
 */

/** The screens a reader can reach with no account — the whole of the public read path. */
const PUBLIC_PAGES: readonly (readonly [string, string])[] = [
  ['landing', '/en'],
  ['search', '/en/routes'],
  ['sign in', '/en/signin'],
  ['add a route', '/en/routes/new'],
  ['my journeys', '/en/journeys'],
  ['not found', '/en/routes/definitely-not-a-real-route'],
]

/** The route-shaped screens, which need the seeded fixture. */
const ROUTE_PAGES: readonly (readonly [string, string])[] = [
  ['route', `/en/routes/${SEEDED_ROUTE_SLUG}`],
  ['route changes', `/en/routes/${SEEDED_ROUTE_SLUG}/changes`],
  ['route history', `/en/routes/${SEEDED_ROUTE_SLUG}/history`],
  ['route journey', `/en/routes/${SEEDED_ROUTE_SLUG}/journey`],
]

const seeded = !process.env.E2E_BASE_URL

/**
 * One builder, so every page is held to the same standard and an exemption cannot be added to
 * a single page without appearing here.
 *
 * `color-contrast` is **not** disabled: it is checked here on what is actually painted *and*
 * in the architecture suite on the tokens themselves. The two catch different things — a token
 * pair nobody uses, and a use nobody predicted.
 */
function audit(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
}

/** Readable output: axe's own `help` text plus where it landed. */
function describe(results: Awaited<ReturnType<typeof audit>>): string {
  return results.violations
    .map((violation) => {
      const where = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join('\n      ')
      return `  [${violation.id}] ${violation.help}\n      ${where}`
    })
    .join('\n')
}

test.describe('every public screen passes WCAG 2.1 AA', () => {
  for (const [name, path] of PUBLIC_PAGES) {
    test(`${name} has no accessibility violations`, async ({ page }) => {
      await page.goto(path)
      const results = await audit(page)
      expect(
        results.violations.length,
        `${path} at ${page.viewportSize()?.width}px:\n${describe(results)}`,
      ).toBe(0)
    })
  }
})

test.describe('every route screen passes WCAG 2.1 AA', () => {
  test.skip(!seeded, 'needs the seeded route; the deployed target is deliberately not seeded')

  for (const [name, path] of ROUTE_PAGES) {
    test(`${name} has no accessibility violations`, async ({ page }) => {
      await page.goto(path)
      const results = await audit(page)
      expect(
        results.violations.length,
        `${path} at ${page.viewportSize()?.width}px:\n${describe(results)}`,
      ).toBe(0)
    })
  }

  /**
   * The step detail is a state of the route page rather than a page of its own, and it is where
   * most of the product's interactive markup lives — the four contribution disclosures, the
   * report form's radio grid, the field rows and their cautions. Auditing the route page with
   * nothing open would miss all of it.
   */
  test('a step opened in place has no accessibility violations', async ({ page }) => {
    await page.goto(`/en/routes/${SEEDED_ROUTE_SLUG}`)
    await page.getByRole('link', { name: /open this step/i }).first().click()
    await expect(page.getByText(/information in/i)).toBeVisible()

    const results = await audit(page)
    expect(
      results.violations.length,
      `the opened step at ${page.viewportSize()?.width}px:\n${describe(results)}`,
    ).toBe(0)
  })
})
