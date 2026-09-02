import { expect, test } from '@playwright/test'

/**
 * Phase 0 smoke coverage.
 *
 * Runs against a local production build by default, or against a deployed Vercel preview
 * when E2E_BASE_URL is set (see playwright.config.ts).
 *
 * It checks the things Phase 0 actually claims: the shell renders, the locale segment
 * works, every page has a lang attribute, the database probe answers, and nothing overflows
 * horizontally at 360px.
 */
test('the shell renders and redirects to the default locale', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.ok()).toBe(true)
  await expect(page).toHaveURL(/\/en\/?$/)

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('the Bengali brand and English name are both present', async ({ page }) => {
  await page.goto('/en')
  await expect(page.getByText('ভিনদেশী এক্সপ্রেস')).toBeVisible()
  await expect(page.getByText('Vindeshi Express').first()).toBeVisible()
})

test('the page never claims verification and never looks like an agency', async ({ page }) => {
  await page.goto('/en')
  const body = (await page.locator('body').innerText()).toLowerCase()

  // BR-20, CLAUDE.md §8.6 — we are not an admission or immigration authority.
  expect(body).not.toMatch(/(?<!un)verified/)
  expect(body).toContain('not an education agency')
})

test('no horizontal overflow at the configured viewport', async ({ page }) => {
  await page.goto('/en')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow, 'the page must not scroll horizontally (CLAUDE.md §7)').toBe(false)
})

test('the health probe answers and never leaks a connection string', async ({ request }) => {
  const response = await request.get('/api/health')
  expect([200, 503]).toContain(response.status())

  const body: unknown = await response.json()
  const serialised = JSON.stringify(body)
  expect(serialised).not.toContain('postgres')
  expect(serialised).not.toContain('password')
  expect(body).toHaveProperty('status')
})
