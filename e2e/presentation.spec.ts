import { expect, test } from '@playwright/test'

/**
 * Presentation, responsiveness and accessibility in a browser — Phase 12.
 *
 * These are the claims a static guard cannot make. Whether the page overflows sideways at
 * 360px, whether the narrow road is the one actually painted, whether a keyboard can reach
 * the content — all of them need a real viewport and a real layout pass.
 *
 * The spec runs under both Playwright projects, so every assertion below is checked at
 * **360px and 1280px**, and the few that differ between them branch on the viewport rather
 * than being written twice.
 */

const seeded = !process.env.E2E_BASE_URL

/** The pages a reader can reach without an account. */
const PUBLIC_PAGES = ['/en', '/en/routes', '/en/signin', '/en/routes/new']

test.describe('presentation and responsiveness', () => {
  /**
   * **The Phase 12 exit criterion.** CLAUDE.md §7.2: wide content scrolls inside its own
   * container; the page itself never scrolls sideways. A page that overflows horizontally on
   * a phone is the single most common way a "responsive" site turns out to be a scaled
   * desktop one.
   *
   * Checked against `documentElement.scrollWidth` rather than by looking, with a pixel of
   * tolerance for sub-pixel rounding in the layout engine.
   */
  test('no page scrolls sideways', async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path)
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement
        return doc.scrollWidth - doc.clientWidth
      })
      expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1)
    }
  })

  test('every page has landmarks and exactly one first-level heading', async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path)
      // Landmarks a screen-reader user navigates by.
      await expect(page.locator('header'), path).toHaveCount(1)
      await expect(page.locator('main#main'), path).toHaveCount(1)
      await expect(page.locator('footer'), path).toHaveCount(1)
      // Exactly one h1: more than one makes the document outline meaningless.
      expect(await page.locator('h1').count(), `${path} h1 count`).toBe(1)
    }
  })

  /**
   * Every page carries its own title. Before Phase 12 they all shared one, which made a
   * browser tab, a history entry and a bookmark equally useless.
   */
  test('page titles are distinct and name their subject', async ({ page }) => {
    const titles = new Map<string, string>()
    for (const path of PUBLIC_PAGES) {
      await page.goto(path)
      titles.set(path, await page.title())
    }
    expect(new Set(titles.values()).size, 'titles must differ').toBe(PUBLIC_PAGES.length)
    for (const [path, title] of titles) {
      expect(title, path).toContain('Vindeshi Express')
    }
  })

  /**
   * The skip link is the first thing a keyboard reaches, and it must actually be visible when
   * focused — an `sr-only` link that never reveals itself is a link only a screen reader
   * benefits from, which is half the point missed.
   */
  test('a keyboard reaches the skip link first, and it becomes visible', async ({ page }) => {
    await page.goto('/en')
    await page.keyboard.press('Tab')

    const focused = page.locator(':focus')
    await expect(focused).toHaveText(/skip to content/i)
    await expect(focused).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.locator('main#main')).toBeVisible()
  })

  test('every interactive control on the search page is keyboard reachable', async ({ page }) => {
    await page.goto('/en/routes')
    // A control that cannot be tabbed to is a control that does not exist for a keyboard.
    const unreachable = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('a[href], button, select, input, textarea')]
      return controls
        .filter((el) => (el as HTMLElement).tabIndex < 0)
        .map((el) => el.tagName.toLowerCase())
    })
    expect(unreachable).toEqual([])
  })
})

test.describe('the road reflows rather than shrinking', () => {
  test.skip(!seeded, 'needs the seeded route; the deployed target is deliberately not seeded')

  /**
   * **The Phase 12 mobile finding, asserted.** `ROAD_NARROW` existed from Phase 4 and nothing
   * selected it, so every phone was served the 5-column desktop road inside a scroller —
   * exactly the "scaled desktop" CLAUDE.md §7 and VR-12 forbid.
   *
   * Both densities are in the markup and CSS chooses; this asserts the *visible* one is the
   * right one for the viewport, which is the part that actually matters to a reader.
   */
  test('a phone gets the narrow road and a desktop gets the wide one', async ({ page }) => {
    await page.goto('/en/routes/e2e-test-route')

    const roads = page.locator('svg[role="img"]')
    // Both are rendered — one per density — and exactly one is visible.
    expect(await roads.count()).toBeGreaterThanOrEqual(2)

    const visible = await page.evaluate(() =>
      [...document.querySelectorAll('svg[role="img"]')]
        .filter((el) => (el as SVGElement).getBoundingClientRect().width > 0)
        .map((el) => Number(el.getAttribute('width'))),
    )
    expect(visible.length, 'exactly one road should be painted').toBe(1)

    /**
     * Compared against the geometry the layout pass actually produces for *this* route,
     * rather than a fixed threshold.
     *
     * The first version asserted `> 500` for desktop and failed at 384 — because the seeded
     * route has only two ranks, so even the full-width density is 384px wide. A magic number
     * chosen against an imagined route is a test that fails on the real one.
     */
    const { layout, ROAD, ROAD_NARROW } = await import('../src/renderer')
    const { loadRouteGraph } = await import('../src/server/revisions/read')
    const { prisma } = await import('../src/server/db/client')

    const route = await prisma.route.findUniqueOrThrow({
      where: { slug: 'e2e-test-route' },
      select: { id: true },
    })
    const graph = await loadRouteGraph(route.id)
    const expected =
      (page.viewportSize()?.width ?? 0) < 640
        ? layout(graph, ROAD_NARROW).width
        : layout(graph, ROAD).width

    expect(visible[0], 'the painted road should match this viewport’s density').toBe(expected)
  })

  test('the road scrolls inside its own container, never the page', async ({ page }) => {
    await page.goto('/en/routes/e2e-test-route')
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(pageOverflow).toBeLessThanOrEqual(1)
  })
})

test.describe('the voluntary support link', () => {
  /**
   * §10.1 and invariant 13. The link is permitted; everything around it is not.
   */
  test('is an unobtrusive outbound link that promises nothing', async ({ page }) => {
    await page.goto('/en')

    const link = page.getByRole('link', { name: /support vindeshi express/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /^https:\/\/[^/]*gumroad\.com\//)
    await expect(link).toHaveAttribute('rel', /external/)

    // It sits in the footer, not in route content or navigation.
    expect(await page.locator('footer').getByRole('link', { name: /support/i }).count()).toBe(1)
    expect(await page.locator('header').getByRole('link', { name: /support/i }).count()).toBe(0)

    // It says outright that it buys nothing (invariant 13, FR-78, BR-13, BR-14).
    await expect(page.getByText(/supporting it affects no route/i)).toBeVisible()

    // And it does not compete with the primary action.
    await expect(page.getByRole('link', { name: /find my route/i }).first()).toBeVisible()

    // Nothing on the page collects a payment detail.
    expect(await page.locator('input[type="password"], input[name*="card" i]').count()).toBe(0)
  })
})
