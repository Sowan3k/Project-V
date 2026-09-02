import { randomUUID } from 'node:crypto'

import { expect, test, type BrowserContext, type Browser } from '@playwright/test'

import { generateHandle } from '../src/server/auth/handle'
import { prisma } from '../src/server/db/client'

/**
 * My Journey in a browser — Phase 7. FR-23, FR-24, FR-25, FR-26, FR-41.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Sessions are fabricated in the database, not through a test-only sign-in.**
 *
 * The obvious way to test a signed-in flow is to add a credentials provider behind a flag.
 * That flag is then one misconfiguration away from being a password-free login on the real
 * site, and the whole reason this platform holds so little personal data is that it does not
 * take that kind of risk.
 *
 * Because Auth.js is configured with database sessions, a session is simply a row. The test
 * harness has database access, so it writes one and sets the cookie the browser would have
 * received. **The application contains no test-only authentication path at all** — nothing to
 * misconfigure, nothing to leave switched on.
 *
 * Two users are created, and the second exists solely to try to see the first one's notes.
 */

const seeded = !process.env.E2E_BASE_URL

/**
 * The cookie Auth.js reads for a database session over plain http.
 *
 * Read out of `@auth/core` rather than guessed: the prefix becomes `__Secure-` only when the
 * configured URL is https, which a local CI run is not.
 */
const SESSION_COOKIE = 'authjs.session-token'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'

async function signedInContext(browser: Browser): Promise<{ context: BrowserContext; userId: string }> {
  const user = await prisma.user.create({
    data: { handle: generateHandle(), email: `e2e-${randomUUID()}@example.test` },
  })
  const sessionToken = randomUUID()
  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  const context = await browser.newContext()
  // By URL rather than by domain/path: fewer ways to get subtly wrong, and it follows
  // whatever base URL the run is using.
  await context.addCookies([
    { name: SESSION_COOKIE, value: sessionToken, url: BASE_URL },
  ])

  return { context, userId: user.id }
}

test.describe('a private journey', () => {
  test.skip(!seeded, 'needs a seeded route and database access; the deployed target has neither')

  test('anonymous visitors are invited to sign in, and see nobody’s progress', async ({ page }) => {
    await page.goto('/en/routes/e2e-test-route/journey')

    // The tab exists for everyone, so the navigation does not rearrange itself around who is
    // signed in — but an anonymous visitor sees an invitation, never data.
    await expect(page.getByRole('heading', { name: /my journey/i })).toBeVisible()
    await expect(page.getByText(/sign in to follow this route/i)).toBeVisible()

    // Assert the absence of the controls and data, not of words. `privateExplainer`
    // legitimately reads "Your progress, dates and notes are visible only to you" — it is
    // the sentence that *promises* privacy, and matching on its wording was a bad proxy for
    // matching on a leak.
    expect(await page.locator('textarea[name="privateNote"]').count()).toBe(0)
    expect(await page.locator('select[name="status"]').count()).toBe(0)
    expect(await page.getByText(/private to you/i).count()).toBe(0)
  })

  test('a follower records progress, privately, with no upload anywhere', async ({ browser }) => {
    const { context } = await signedInContext(browser)
    const page = await context.newPage()

    await page.goto('/en/routes/e2e-test-route/journey')
    await page.getByRole('button', { name: /follow this route/i }).click()

    await expect(page.getByText(/private to you/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /your progress/i })).toBeVisible()

    // FR-25, invariant 6: there is nowhere to attach a document, on the whole page.
    expect(await page.locator('input[type="file"]').count()).toBe(0)
    expect(await page.locator('form[enctype*="multipart"]').count()).toBe(0)

    // Record something private against the first step.
    const firstStep = page.locator('form').filter({ has: page.locator('select[name="status"]') }).first()
    await firstStep.locator('select[name="status"]').selectOption('completed')
    await firstStep.locator('textarea[name="privateNote"]').fill('Collected at the DU office.')
    await firstStep.locator('button[type="submit"]').click()

    await expect(page.getByText('Collected at the DU office.')).toBeVisible()

    await context.close()
  })

  /**
   * Invariant 5 in a browser: the failure this whole phase is built to prevent.
   *
   * A second real person, on the same route, at the same URL. If any of the first person's
   * note, dates or status appears on their screen, the privacy promise is broken — and it is
   * the kind of break a reader would never discover for themselves.
   */
  test('one follower never sees another follower’s notes', async ({ browser }) => {
    const first = await signedInContext(browser)
    const firstPage = await first.context.newPage()
    await firstPage.goto('/en/routes/e2e-test-route/journey')
    await firstPage.getByRole('button', { name: /follow this route/i }).click()

    const secret = `only-mine-${randomUUID().slice(0, 8)}`
    const form = firstPage.locator('form').filter({ has: firstPage.locator('select[name="status"]') }).first()
    await form.locator('textarea[name="privateNote"]').fill(secret)
    await form.locator('button[type="submit"]').click()
    await expect(firstPage.getByText(secret)).toBeVisible()

    const second = await signedInContext(browser)
    const secondPage = await second.context.newPage()
    await secondPage.goto('/en/routes/e2e-test-route/journey')

    // Same route, same URL, a different person: an invitation to follow, and nothing else.
    const body = await secondPage.locator('body').innerText()
    expect(body).not.toContain(secret)

    await secondPage.getByRole('button', { name: /follow this route/i }).click()
    const afterFollowing = await secondPage.locator('body').innerText()
    expect(afterFollowing).not.toContain(secret)

    await first.context.close()
    await second.context.close()
  })

  test('unfollowing keeps the notes, and following again brings them back', async ({ browser }) => {
    const { context } = await signedInContext(browser)
    const page = await context.newPage()

    await page.goto('/en/routes/e2e-test-route/journey')
    await page.getByRole('button', { name: /follow this route/i }).click()

    const kept = `kept-${randomUUID().slice(0, 8)}`
    const form = page.locator('form').filter({ has: page.locator('select[name="status"]') }).first()
    await form.locator('textarea[name="privateNote"]').fill(kept)
    await form.locator('button[type="submit"]').click()
    await expect(page.getByText(kept)).toBeVisible()

    await page.getByRole('button', { name: /stop following/i }).click()
    await page.goto('/en/routes/e2e-test-route/journey')
    await page.getByRole('button', { name: /follow again/i }).click()

    await expect(page.getByText(kept)).toBeVisible()

    await context.close()
  })

  test('a completion is described as self-reported, never as verified', async ({ browser }) => {
    const { context } = await signedInContext(browser)
    const page = await context.newPage()

    await page.goto('/en/routes/e2e-test-route/journey')
    await page.getByRole('button', { name: /follow this route/i }).click()
    await page.getByRole('button', { name: /mark this journey completed/i }).click()

    await expect(page.getByText(/the platform does not verify it/i)).toBeVisible()

    // FR-41, §26, invariant 17: on the public route page the count says who said so.
    await page.goto('/en/routes/e2e-test-route')
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).not.toMatch(/(?<!un)verified/)

    await context.close()
  })
})
