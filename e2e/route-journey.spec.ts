import { expect, test } from '@playwright/test'

/**
 * Phase 5 exit criterion: "Playwright covers landing → search → ribbon → road → step → field."
 *
 * This is the anonymous reading journey end to end, in one test, because that sequence is
 * the product (§8, REQUIREMENTS.md). Fragments that each pass separately would not prove a
 * visitor can actually get from the front page to a field.
 *
 * Skipped against a deployed target: it needs a seeded route, and seeding a deployment would
 * put unreviewed content into production. Locally the server runs against the test database
 * (see playwright.config.ts).
 */
const seeded = !process.env.E2E_BASE_URL

/** The route `e2e/seed-route.setup.ts` creates. Named so specs do not race each other. */
const SEEDED_ROUTE = 'Test route for the reading journey'

test.describe('anonymous reading journey', () => {
  test.skip(!seeded, 'needs a seeded route; the deployed target is deliberately not seeded')

  test('landing → search → ribbon → road → step → field, with no account', async ({ page }) => {
    // 1. Landing (VR-01)
    await page.goto('/en')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // 2. Search — reached by acting, not by browsing (§8.1)
    await page.getByRole('link', { name: /find my route/i }).click()
    await expect(page).toHaveURL(/\/en\/routes$/)
    await expect(page.getByRole('heading', { name: /find a route/i })).toBeVisible()

    // 3. Ribbons — each result is the route compressed, drawn by the renderer
    /**
     * The SEEDED route by name, not "the first result".
     *
     * Phase 8's contribution specs create real routes, and search is newest-first, so the
     * first result is whatever another spec happened to make a second earlier. Naming the
     * route this spec seeded is both deterministic and a more honest test — it walks to a
     * known destination rather than to whatever turned up.
     */
    const firstRoute = page.locator('main ul li a').filter({ hasText: SEEDED_ROUTE }).first()
    await expect(firstRoute).toBeVisible()
    await expect(firstRoute.getByRole('img').first()).toBeVisible()

    const routeTitle = (await firstRoute.locator('h3').innerText()).trim()

    // 4. Road — the ribbon unfolds into the same object, not a disconnected page
    await firstRoute.click()
    await expect(page).toHaveURL(/\/en\/routes\/[^/]+$/)
    await expect(page.getByRole('heading', { level: 1, name: routeTitle })).toBeVisible()
    // The visible road only: Phase 12 renders a narrow and a wide density and hides one.
    await expect(page.getByRole('img').first()).toBeVisible()

    // 5. Step — expands in place, without leaving the road
    const firstStep = page.getByRole('link', { name: /open this step/i }).first()
    await expect(firstStep).toBeVisible()
    await firstStep.click()
    await expect(page).toHaveURL(/[?&]step=/)

    // 6. Field — the smallest community-maintained unit, under a heading that says who is
    // making the claim. Provenance is a group heading rather than a per-row badge (Phase 6).
    await expect(page.getByText(/information in/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /from the community/i })).toBeVisible()

    // Collapsing returns to the visual journey (§8.3).
    // The whole step row is the link, so its accessible name is the row text, not just 'Close'.
    await page.getByRole('link', { name: /close/i }).first().click()
    await expect(page).toHaveURL(/\/en\/routes\/[^/?]+$/)
  })

  test('the whole journey works with JavaScript disabled', async ({ browser }) => {
    // Search is the first thing a visitor does and must not wait on a bundle. Many arrive on
    // a phone browser on a slow connection (CLAUDE.md §7).
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    await page.goto('/en/routes')
    const firstRoute = page.locator('main ul li a').filter({ hasText: SEEDED_ROUTE }).first()
    await expect(firstRoute).toBeVisible()
    await firstRoute.click()

    // The visible road only: Phase 12 renders a narrow and a wide density and hides one.
    await expect(page.getByRole('img').first()).toBeVisible()
    await page.getByRole('link', { name: /open this step/i }).first().click()
    await expect(page.getByText(/information in/i)).toBeVisible()

    // The trust surface must survive too. A student on a slow phone should still be able to
    // see that a route has not been checked by anyone — every disclosure is a <details>.
    await expect(page.getByText(/does not verify routes/i)).toBeVisible()

    await context.close()
  })

  /**
   * History is a TAB, not a link away.
   *
   * This test used to click a "See what has changed" link. The navigation work replaced that
   * link with a tab inside the persistent route context (CLAUDE.md §7.1) and the test was not
   * updated — nobody noticed, because E2E ran only on a workstation and never in CI. Adding
   * the CI job caught it on its first run. Recorded rather than quietly fixed: the bug was in
   * the test, and the reason it survived was a gap in *where* tests run.
   */
  test('history is readable without an account, and keeps the route on screen', async ({
    page,
  }) => {
    await page.goto('/en/routes')
    await page.locator('main ul li a').filter({ hasText: SEEDED_ROUTE }).first().click()
    // Wait for the navigation to settle before reading the heading. Without this, `innerText`
    // resolves against whichever h1 is on screen at that instant — which was the search
    // page's "Find a route", not the route's own title.
    await expect(page).toHaveURL(/\/en\/routes\/[^/]+$/)
    const routeTitle = (await page.getByRole('heading', { level: 1 }).innerText()).trim()

    await page.getByRole('navigation', { name: /route views/i }).getByRole('link', { name: /^history$/i }).click()

    await expect(page).toHaveURL(/\/history$/)
    await expect(page.getByRole('heading', { name: /route history/i })).toBeVisible()
    // Earlier values are still readable — that is the whole point (§17.2).
    await expect(page.locator('main ol li').first()).toBeVisible()

    // A tab changes the view, not the place: the route's own title stays on screen.
    await expect(page.getByRole('heading', { level: 1, name: routeTitle })).toBeVisible()
  })

  test('no read path redirects to a sign-in', async ({ page }) => {
    // FR-01 and D-03: search, ribbons, roads, steps, fields and history are all open.
    await page.goto('/en/routes')
    await page.locator('main ul li a').filter({ hasText: SEEDED_ROUTE }).first().click()
    // Wait for the navigation to settle before reading the URL — capturing it too early
    // gave '/en/routes', and the loop below then requested '/en/routes/history'.
    await expect(page).toHaveURL(/\/en\/routes\/[^/]+$/)
    const routeUrl = page.url()

    for (const path of [routeUrl, `${routeUrl}/history`, '/en', '/en/routes']) {
      const response = await page.goto(path)
      expect(response?.status(), `${path} should be readable`).toBeLessThan(400)
      expect(page.url(), `${path} redirected somewhere`).not.toMatch(/sign|login|auth/i)
    }
  })

  test('a route that does not exist is a 404, not a crash', async ({ page }) => {
    const response = await page.goto('/en/routes/definitely-not-a-real-route')
    expect(response?.status()).toBe(404)
  })
})

/**
 * Phase 6 exit criteria, proved in a browser.
 *
 *   "a `community_submission` field is visually distinct from an `official` one"
 *   "no badge derives from absence of reports"
 *
 * The unit and integration suites prove the rules and the projection. Only a browser can
 * prove a reader actually *sees* the difference, which is the whole point of the phase.
 */
test.describe('the trust surface is legible to a reader', () => {
  test.skip(!seeded, 'needs a seeded route; the deployed target is deliberately not seeded')

  test('separates official claims from community ones, and says what applies narrowly', async ({
    page,
  }) => {
    await page.goto('/en/routes/e2e-test-route')

    // The first step carries both an official claim and a community submission.
    await page.getByRole('link', { name: /open this step/i }).first().click()

    // Separation is positional: two regions, two headings, in that order.
    const official = page.getByRole('heading', { name: /from official and institutional/i })
    const community = page.getByRole('heading', { name: /from the community/i })
    await expect(official).toBeVisible()
    await expect(community).toBeVisible()

    // Official comes first. A reader scanning downward meets the authoritative claim before
    // the anecdote, never the other way round (FR-33, FR-54, invariant 11).
    const headings = await page.getByRole('heading', { level: 4 }).allInnerTexts()
    const officialAt = headings.findIndex((h) => /official and institutional/i.test(h))
    const communityAt = headings.findIndex((h) => /from the community/i.test(h))
    expect(officialAt).toBeGreaterThanOrEqual(0)
    expect(officialAt).toBeLessThan(communityAt)

    // FR-81: the programme-scoped claim says so; the route-wide one beside it does not
    // shout. Both are official, so only scope distinguishes them.
    await expect(page.getByText(/applies only to/i).first()).toBeVisible()

    // FR-64: an external link shows the host it will actually visit.
    await expect(page.getByText(/goes to/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /example\.org/i }).first()).toBeVisible()

    // Invariant 9: the community submission says nobody has corroborated it.
    await expect(page.getByText(/not corroborated/i).first()).toBeVisible()
  })

  test('never implies safety, and says outright that silence is not reassurance', async ({
    page,
  }) => {
    await page.goto('/en/routes/e2e-test-route')

    // Invariant 12 / BR-04 / D-19. This route has no reports against it — and the page must
    // not let that read as approval.
    await expect(page.getByText(/does not verify routes/i)).toBeVisible()
    await expect(page.getByText(/absence of a warning is not evidence/i)).toBeVisible()

    // A new route shows its maturity honestly rather than hiding it (FR-74).
    await expect(page.getByText(/experimental/i).first()).toBeVisible()
    await expect(page.getByText(/read this route with care/i)).toBeVisible()

    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).not.toMatch(/(?<!un)verified/)
    expect(body).not.toContain('trusted route')
    expect(body).not.toContain('100% ')
  })

  test('a ribbon in search results agrees with the route it leads to', async ({ page }) => {
    await page.goto('/en/routes')

    // The ribbon shows maturity and a count of things to know — not the list, and never a
    // calmer picture than the route page itself (FR-74).
    const ribbon = page.locator('main ul li a').first()
    await expect(ribbon.getByText(/experimental/i)).toBeVisible()
    await expect(ribbon.getByText(/read with care/i)).toBeVisible()
  })
})
