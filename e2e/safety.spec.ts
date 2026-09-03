import { randomUUID } from 'node:crypto'

import { expect, test, type Browser, type BrowserContext } from '@playwright/test'

import { UserRole } from '../src/domain/enums'
import { generateHandle } from '../src/server/auth/handle'
import { prisma } from '../src/server/db/client'

/**
 * Safety in a browser — Phase 9. FR-35, FR-36, FR-37, §23.
 *
 * Two claims a browser can prove that a unit test cannot: a reader is offered reporting as a
 * *different* thing from flagging, and a quarantined value is genuinely not on the page —
 * not merely styled away.
 */

const seeded = !process.env.E2E_BASE_URL
const SESSION_COOKIE = 'authjs.session-token'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'

async function signedIn(
  browser: Browser,
  role: (typeof UserRole)[keyof typeof UserRole] = UserRole.member,
): Promise<{ context: BrowserContext; userId: string }> {
  const user = await prisma.user.create({
    data: { handle: generateHandle(), email: `safety-${randomUUID()}@example.test`, role },
  })
  const sessionToken = randomUUID()
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 86_400_000) },
  })
  const context = await browser.newContext()
  await context.addCookies([{ name: SESSION_COOKIE, value: sessionToken, url: BASE_URL }])
  return { context, userId: user.id }
}

test.describe('reporting and quarantine', () => {
  test.skip(!seeded, 'needs database access; the deployed target is deliberately not seeded')

  test('report is offered as a different action from flagging, and says which to use', async ({
    browser,
  }) => {
    const { context } = await signedIn(browser)
    const page = await context.newPage()

    await page.goto('/en/routes/e2e-test-route')
    await page.getByRole('link', { name: /open this step/i }).first().click()

    // Five affordances, and the fifth reads differently from the other four (§23.1).
    await expect(page.getByText(/^still accurate$/i).first()).toBeVisible()
    await expect(page.getByText(/^correct this$/i).first()).toBeVisible()
    await expect(page.getByText(/^flag a problem$/i).first()).toBeVisible()
    await expect(page.getByText(/^report as unsafe$/i).first()).toBeVisible()

    await page.getByText(/^report as unsafe$/i).first().click()

    // It explains when NOT to use it. A report that should have been a challenge wastes an
    // administrator's attention and delays a correction the community could have made.
    await expect(page.getByText(/use “flag a problem” instead/i).first()).toBeVisible()
    // And that reports are not a public accusation board.
    await expect(page.getByText(/reports are not shown publicly/i).first()).toBeVisible()

    // Text only — nowhere to attach anything (§8.6, invariants 6 and 7).
    expect(await page.locator('input[type="file"]').count()).toBe(0)

    const row = page.locator('main li').filter({ has: page.locator('select[name="reportReason"]') }).first()
    await row.locator('select[name="reportReason"]').selectOption('phishing_or_scam')
    await row.locator('textarea[name="reportDetail"]').fill('That link is not the embassy.')
    await row.getByRole('button', { name: /send this report/i }).click()

    // Reporting changes nothing a reader can see. No badge, no counter, no accusation.
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).not.toContain('that link is not the embassy')
    expect(body).not.toMatch(/1 report|reported by/)

    await context.close()
  })

  test('the moderation queue does not exist for anyone but an administrator', async ({
    browser,
  }) => {
    // A plain 404, not a "forbidden" — there is no reason to tell somebody a moderation queue
    // exists and they are not allowed in.
    const anonymous = await (await browser.newContext()).newPage()
    expect((await anonymous.goto('/en/admin/reports'))?.status()).toBe(404)

    const member = await signedIn(browser)
    const memberPage = await member.context.newPage()
    expect((await memberPage.goto('/en/admin/reports'))?.status()).toBe(404)
    await member.context.close()

    const admin = await signedIn(browser, UserRole.admin)
    const adminPage = await admin.context.newPage()
    expect((await adminPage.goto('/en/admin/reports'))?.status()).toBe(200)
    await expect(adminPage.getByRole('heading', { name: /reported content/i })).toBeVisible()

    // Evidence, never a verdict: nothing on this page ranks or recommends (FR-71).
    await expect(adminPage.getByText(/suggests nothing/i)).toBeVisible()
    const adminBody = (await adminPage.locator('body').innerText()).toLowerCase()
    expect(adminBody).not.toMatch(/severity|risk score|recommended action|priority/)

    await admin.context.close()
  })

  /**
   * The Phase 9 exit criterion in a browser: **withheld, explained, and not clickable.**
   */
  test('a quarantined value is absent from the page, not merely hidden', async ({ browser }) => {
    const admin = await signedIn(browser, UserRole.admin)
    const page = await admin.context.newPage()

    await page.goto('/en/routes/e2e-test-route')
    await page.getByRole('link', { name: /open this step/i }).first().click()

    const secret = `phishy-${randomUUID().slice(0, 8)}`
    // Add something to withhold, so this test owns its own subject.
    await page.getByText(/add information to this step/i).click()
    const addForm = page.locator('form').filter({ has: page.getByRole('button', { name: /add this information/i }) })
    await addForm.locator('textarea[name="valueText"]').fill(`Apply here ${secret}`)
    await addForm.locator('input[name="sourceUrl"]').fill('https://bit.ly/definitely-not-real')
    await page.getByRole('button', { name: /add this information/i }).click()
    await expect(page.getByText(new RegExp(secret, 'i')).first()).toBeVisible()

    const added = await prisma.field.findFirstOrThrow({
      where: { revisions: { some: { valueText: { contains: secret } } } },
      select: { id: true },
    })

    await page.goto('/en/admin/reports')
    // Quarantine directly — the queue only lists reported fields, and this test is about the
    // effect of quarantine rather than about the queue.
    // A note unique to this run. The seeded route accumulates quarantined fields across CI
    // runs — the database is append-only by design — so asserting on shared copy hits several
    // elements at once. The note is this test's own handle on its own subject.
    // Deliberately does NOT contain `secret`: the note is rendered on the page, and the
    // assertion below is that `secret` appears nowhere in the HTML. Two tokens, two jobs.
    const noteToken = `note-${randomUUID().slice(0, 8)}`
    const note = `Shortened link impersonating an embassy — ${noteToken}`
    const { quarantineField } = await import('../src/server/safety/service')
    await quarantineField({ adminId: admin.userId, fieldId: added.id, note })

    await page.goto('/en/routes/e2e-test-route')
    await page.getByRole('link', { name: /open this step/i }).first().click()

    // The value is not in the HTML at all — withheld server-side, not styled away.
    const html = await page.content()
    expect(html).not.toContain(secret)
    expect(html).not.toContain('bit.ly/definitely-not-real')

    // And the reader is told, and told why — located by this run's own note.
    await expect(page.getByText(noteToken, { exact: false })).toBeVisible()
    await expect(page.getByText(/withheld pending review/i).first()).toBeVisible()
    // Withholding one thing is not a safety claim about everything else (§42.5).
    await expect(page.getByText(/containment, not a safety check/i).first()).toBeVisible()

    // Still in the record: the history tab has it (invariants 1 and 4).
    await page.goto('/en/routes/e2e-test-route/history')
    await expect(page.getByText(new RegExp(secret, 'i')).first()).toBeVisible()

    await admin.context.close()
  })
})
