import { randomUUID } from 'node:crypto'

import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { generateHandle } from '../src/server/auth/handle'
import { prisma } from '../src/server/db/client'

/**
 * The contribution loop in a browser — Phase 8. FR-13, FR-14, FR-15, FR-16, FR-17, FR-18.
 *
 * This is the Phase 8 exit gate, walked the way a contributor walks it: **a newly signed-in
 * user creates a route, it renders through the ordinary renderer, it publishes as
 * experimental, and a second, unrelated user improves it immediately.**
 *
 * Sessions are fabricated in the database, as in `journey.spec.ts`, so the application
 * contains no test-only authentication path.
 */

const seeded = !process.env.E2E_BASE_URL
const SESSION_COOKIE = 'authjs.session-token'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'

async function signedIn(browser: Browser): Promise<{ context: BrowserContext; handle: string }> {
  const handle = generateHandle()
  const user = await prisma.user.create({
    data: { handle, email: `contrib-${randomUUID()}@example.test` },
  })
  const sessionToken = randomUUID()
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 86_400_000) },
  })

  const context = await browser.newContext()
  await context.addCookies([{ name: SESSION_COOKIE, value: sessionToken, url: BASE_URL }])
  return { context, handle }
}

/**
 * Form controls are located by their `name`, not by `getByLabel`.
 *
 * Playwright derives a control's accessible name from the whole wrapping `<label>`, which
 * includes the control's own content: a prefilled `<textarea>` contributes its value, and a
 * `<select>` contributes every option's text. So `getByLabel(/^information$/)` stops matching
 * the moment the field has a value in it — which is exactly when an UPDATE form is being
 * tested. `[name="valueText"]` says what is meant and keeps saying it.
 */

/** Opens the first step of a route so its fields and their actions are on screen. */
async function openFirstStep(page: Page): Promise<void> {
  await page.getByRole('link', { name: /open this step/i }).first().click()
  await expect(page).toHaveURL(/[?&]step=/)
}

test.describe('the contribution loop', () => {
  test.skip(!seeded, 'needs database access; the deployed target is deliberately not seeded')

  /**
   * The exit criterion, end to end and in one test, because the sequence is the claim.
   */
  test('a new user creates a route, it renders as experimental, and another user improves it', async ({
    browser,
  }) => {
    const author = await signedIn(browser)
    const page = await author.context.newPage()

    // 1. Create. Reached from the search page, where a student notices the gap.
    await page.goto('/en/routes')
    await page.getByRole('link', { name: /add a missing route/i }).click()
    await expect(page).toHaveURL(/\/en\/routes\/new$/)

    const title = `Bangladesh to Malaysia by direct application ${randomUUID().slice(0, 6)}`
    await page.locator('input[name="title"]').fill(title)
    await page.locator('input[name="destinationCountry"]').fill('MY')
    await page.getByRole('button', { name: /create this route/i }).click()

    // 2. It exists immediately. No draft, no queue, no "submitted for review".
    await expect(page).toHaveURL(/\/en\/routes\/bd-my-/)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    const routeUrl = page.url()

    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).not.toMatch(/pending|awaiting approval|submitted for review|under moderation/)

    // 3. It publishes as experimental and says so (FR-74).
    await expect(page.getByText(/experimental/i).first()).toBeVisible()

    // 4. Build the road. VR-09's "Build Road" stage, in place on the route itself.
    await page.getByText(/^add a step$/i).click()
    await page.locator('input[name="label"]').fill('Collect and attest documents')
    await page.getByRole('button', { name: /add this step/i }).click()

    // In the step list, by role. A plain text match also finds the SVG's own <title>, which
    // is hidden — and which is itself the proof for the assertion below: the renderer drew
    // the new step, with no route-specific code anywhere (invariant 24).
    await expect(page.getByRole('link', { name: /collect and attest documents/i })).toBeVisible()

    // 5. It draws through the ordinary renderer.
    await expect(page.locator('svg[role="img"]')).toBeVisible()
    await expect(page.locator('svg title', { hasText: /collect and attest documents/i })).toHaveCount(1)

    // 6. Add information to the step (FR-15).
    await openFirstStep(page)
    await page.getByText(/add information to this step/i).click()
    const addForm = page.locator('form').filter({ has: page.getByRole('button', { name: /add this information/i }) })
    await addForm.locator('textarea[name="valueText"]').fill('Transcripts must be attested by the ministry')
    await page.getByRole('button', { name: /add this information/i }).click()

    // By role, not by text: the update form's textarea is prefilled with the same words, and
    // an unscoped text match finds both. That it does is the point — the form is prefilled
    // with the current value so a correction starts from it.
    await expect(
      page.getByRole('paragraph').filter({ hasText: /attested by the ministry/i }).first(),
    ).toBeVisible()

    await author.context.close()

    // ── A different person, who did not create this route and was not invited ────────────
    const other = await signedIn(browser)
    const otherPage = await other.context.newPage()
    await otherPage.goto(routeUrl)
    await openFirstStep(otherPage)

    // 7. UPDATE. No ownership gate stops them (FR-44, BR-01, D-18).
    await otherPage.getByText(/^correct this$/i).first().click()
    const updateForm = otherPage
      .locator('form')
      .filter({ has: otherPage.getByRole('button', { name: /save correction/i }) })
      .first()
    await updateForm
      .locator('textarea[name="valueText"]')
      .fill('Transcripts must be attested by the Ministry of Education, then the foreign ministry')
    await updateForm.getByRole('button', { name: /save correction/i }).click()

    await expect(
      otherPage.getByRole('paragraph').filter({ hasText: /then the foreign ministry/i }).first(),
    ).toBeVisible()
    // The correction is live at once — nothing waited for anybody.
    const afterUpdate = (await otherPage.locator('body').innerText()).toLowerCase()
    expect(afterUpdate).not.toMatch(/pending|awaiting approval|will be reviewed/)

    // 8. The previous value survives, in the history tab (FR-20, BR-03, invariant 2).
    await otherPage.goto(`${routeUrl.split('?')[0]}/history`)
    await expect(otherPage.getByText(/attested by the ministry/i).first()).toBeVisible()

    await other.context.close()
  })

  test('CONFIRM and CHALLENGE are offered as different things, and behave differently', async ({
    browser,
  }) => {
    const { context } = await signedIn(browser)
    const page = await context.newPage()

    await page.goto('/en/routes/e2e-test-route')
    await openFirstStep(page)
    // Kept so each half of this test can start from a known page rather than from whatever
    // state the previous server action left behind.
    const stepUrl = page.url()

    // Three distinct affordances, and no fourth: reporting is Phase 9 (CLAUDE.md §5).
    await expect(page.getByText(/^still accurate$/i).first()).toBeVisible()
    await expect(page.getByText(/^correct this$/i).first()).toBeVisible()
    await expect(page.getByText(/^flag a problem$/i).first()).toBeVisible()
    expect(await page.getByRole('button', { name: /^report/i }).count()).toBe(0)

    /**
     * The first field row, whichever group it is in.
     *
     * Earlier versions scoped by group heading and then nested a page-rooted locator inside
     * `filter({ has })`, which is not what `has` means and never matched. The step detail is
     * the only place on this page with field rows, so `main li` is both simpler and correct.
     */
    const firstField = page.locator('main li').filter({ has: page.locator('select[name="reason"]') }).first()

    // CONFIRM — one click, no form, because nothing changed.
    const valueBefore = await firstField.locator('p.text-sm').first().innerText()
    await firstField.getByText(/^still accurate$/i).click()

    // Scoped to the field row: the route passport also has a "Last confirmed" line, inside a
    // collapsed <details>, and an unscoped match finds that hidden one first.
    await expect(
      page
        .locator('main li')
        .filter({ has: page.locator('select[name="reason"]') })
        .first()
        .getByText(/last confirmed/i),
    ).toBeVisible()

    // CHALLENGE — leaves the value alone and says so publicly, with its reason.
    await page.goto(stepUrl)
    const row = page.locator('main li').filter({ has: page.locator('select[name="reason"]') }).first()
    await row.getByText(/^flag a problem$/i).click()
    await row.locator('select[name="reason"]').selectOption('broken_link')
    await row.locator('textarea[name="note"]').fill('That link goes nowhere now.')
    await row.getByRole('button', { name: /^flag it$/i }).click()

    await expect(page.getByText(/that link goes nowhere now/i)).toBeVisible()
    await expect(page.getByText(/broken link/i).first()).toBeVisible()

    // The value itself is untouched: a challenge says "this may be wrong", not "this is".
    await expect(
      page
        .locator('main li')
        .filter({ has: page.locator('select[name="reason"]') })
        .first()
        .locator('p.text-sm')
        .first(),
    ).toHaveText(valueBefore)

    await context.close()
  })

  test('an anonymous reader is invited to sign in, never shown a broken control', async ({
    page,
  }) => {
    await page.goto('/en/routes/e2e-test-route')
    await openFirstStep(page)

    await expect(page.getByText(/sign in to correct or confirm this/i).first()).toBeVisible()
    // No disabled buttons pretending to be usable, and no forms that would fail on submit.
    expect(await page.getByText(/^still accurate$/i).count()).toBe(0)
    expect(await page.getByText(/^flag a problem$/i).count()).toBe(0)

    // Reading is entirely unaffected: the road, the steps and the fields are all there.
    await expect(page.locator('svg[role="img"]')).toBeVisible()
    await expect(page.getByText(/information in/i)).toBeVisible()
  })

  test('there is nowhere to attach a document in a contribution', async ({ browser }) => {
    const { context } = await signedIn(browser)
    const page = await context.newPage()

    await page.goto('/en/routes/e2e-test-route')
    await openFirstStep(page)
    await page.getByText(/^correct this$/i).first().click()
    await page.getByText(/add information to this step/i).click()


    // FR-25, §24.1, invariants 6 and 7. The boundary refuses a file too; that half is
    // asserted in tests/architecture/journey-privacy.test.ts, because Next encodes every
    // server-action form as multipart and markup cannot prove it.
    expect(await page.locator('input[type="file"]').count()).toBe(0)

    await context.close()
  })
})
