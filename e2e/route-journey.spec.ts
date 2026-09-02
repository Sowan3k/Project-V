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
    const firstRoute = page.locator('main ul li a').first()
    await expect(firstRoute).toBeVisible()
    await expect(firstRoute.locator('svg[role="img"]')).toBeVisible()

    const routeTitle = (await firstRoute.locator('h3').innerText()).trim()

    // 4. Road — the ribbon unfolds into the same object, not a disconnected page
    await firstRoute.click()
    await expect(page).toHaveURL(/\/en\/routes\/[^/]+$/)
    await expect(page.getByRole('heading', { level: 1, name: routeTitle })).toBeVisible()
    await expect(page.locator('svg[role="img"]')).toBeVisible()

    // 5. Step — expands in place, without leaving the road
    const firstStep = page.getByRole('link', { name: /open this step/i }).first()
    await expect(firstStep).toBeVisible()
    await firstStep.click()
    await expect(page).toHaveURL(/[?&]step=/)

    // 6. Field — the smallest community-maintained unit, with its source visible
    await expect(page.getByText(/information in/i)).toBeVisible()
    await expect(page.getByText(/^Source:/i).first()).toBeVisible()

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
    const firstRoute = page.locator('main ul li a').first()
    await expect(firstRoute).toBeVisible()
    await firstRoute.click()

    await expect(page.locator('svg[role="img"]')).toBeVisible()
    await page.getByRole('link', { name: /open this step/i }).first().click()
    await expect(page.getByText(/information in/i)).toBeVisible()

    await context.close()
  })

  test('history is readable without an account', async ({ page }) => {
    await page.goto('/en/routes')
    await page.locator('main ul li a').first().click()
    await page.getByRole('link', { name: /see what has changed/i }).click()

    await expect(page).toHaveURL(/\/history$/)
    await expect(page.getByRole('heading', { name: /route history/i })).toBeVisible()
    // Earlier values are still readable — that is the whole point (§17.2).
    await expect(page.locator('main ol li').first()).toBeVisible()
  })

  test('no read path redirects to a sign-in', async ({ page }) => {
    // FR-01 and D-03: search, ribbons, roads, steps, fields and history are all open.
    await page.goto('/en/routes')
    await page.locator('main ul li a').first().click()
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
