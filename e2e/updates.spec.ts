import { randomUUID } from 'node:crypto'

import { expect, test, type Browser, type BrowserContext } from '@playwright/test'

import {
  ChangeSeverity,
  RouteChangeKind,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
} from '../src/domain/enums'
import { generateHandle } from '../src/server/auth/handle'
import { announceChange } from '../src/server/changes/service'
import { prisma } from '../src/server/db/client'
import { followRoute } from '../src/server/journeys/service'
import { addEdge, addStep, createRoute } from '../src/server/revisions/service'

/**
 * The Updates page in a browser — Phase 14. FR-28, FR-29, FR-62, FR-76. VR-10.
 *
 * Each test builds its own routes with titles nobody else uses, because the page lists every
 * route's changes and other specs announce changes in parallel (Test.md §17).
 *
 * Sessions are fabricated as database rows, as in `changes.spec.ts`. There is no test-only
 * sign-in path in the application.
 */

const seeded = !process.env.E2E_BASE_URL
const SESSION_COOKIE = 'authjs.session-token'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'
const DAY = 24 * 60 * 60 * 1000

const actor = { id: null, system: true }

async function signedIn(browser: Browser): Promise<{ context: BrowserContext; userId: string }> {
  const user = await prisma.user.create({
    data: { handle: generateHandle(), email: `upd-${randomUUID()}@example.test` },
  })
  const sessionToken = randomUUID()
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + DAY) },
  })
  const context = await browser.newContext()
  await context.addCookies([{ name: SESSION_COOKIE, value: sessionToken, url: BASE_URL }])
  return { context, userId: user.id }
}

async function buildRoute(title: string): Promise<{ routeId: string; visa: string }> {
  const { routeId } = await createRoute({
    actor,
    slug: `e2e-updates-${randomUUID().slice(0, 8)}`,
    originCountry: 'BD',
    destinationCountry: 'MY',
    studyLevel: StudyLevel.masters,
    title,
    summary: 'Illustrative test data. Not researched content and not a real procedure.',
  })
  const docs = await addStep({
    actor,
    routeId,
    label: 'Documents',
    category: StepCategory.documents_preparation,
  })
  const visa = await addStep({
    actor,
    routeId,
    label: 'Visa application',
    category: StepCategory.immigration_visa,
  })
  await addEdge({
    actor,
    routeId,
    fromStepId: docs.stepId,
    toStepId: visa.stepId,
    kind: StepEdgeKind.sequential,
  })
  return { routeId, visa: visa.stepId }
}

/** Somebody to have announced the changes. Every announcement is attributed to a person. */
async function author(): Promise<string> {
  const user = await prisma.user.create({
    data: { handle: generateHandle(), email: `upd-author-${randomUUID()}@example.test` },
  })
  return user.id
}

async function announce(routeId: string, title: string, severity: ChangeSeverity, stepId?: string) {
  return announceChange({
    authorId: await author(),
    routeId,
    kind: RouteChangeKind.field_correction,
    severity,
    title,
    ...(stepId === undefined ? {} : { stepId }),
  })
}

test.describe('the Updates page', () => {
  test.skip(!seeded, 'needs database access; the deployed target is deliberately not seeded')

  test('lists changes across routes for a reader who is not signed in', async ({ page }) => {
    const tag = randomUUID().slice(0, 8)
    const route = await buildRoute(`Updates route ${tag}`)
    await announce(route.routeId, `A change anyone can read ${tag}`, ChangeSeverity.important)

    await page.goto('/en/updates')
    await expect(page.getByRole('heading', { level: 1, name: 'Updates' })).toBeVisible()
    await expect(page.getByText(`A change anyone can read ${tag}`)).toBeVisible()
    // The row names its route and leads to that route's Changes tab.
    await expect(page.getByRole('link', { name: `Updates route ${tag}` }).first()).toHaveAttribute(
      'href',
      /\/en\/routes\/e2e-updates-[^/]+\/changes$/,
    )

    // Every tab is a real URL, and the current one is announced (CLAUDE.md §7.1).
    const tabs = page.getByRole('navigation', { name: 'Which updates' })
    await expect(tabs.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page')
    await expect(tabs.getByRole('link', { name: 'Affecting my journey' })).toHaveAttribute(
      'href',
      '/en/updates/journey',
    )

    // The private tabs are shown, not hidden, and say what signing in would put there.
    await page.goto('/en/updates/journey')
    await expect(page.getByText('Sign in to see what lands ahead of you')).toBeVisible()
  })

  /**
   * The filter is a GET form. With scripts off, ticking a level and pressing Apply must still
   * narrow the list, and the result must be a URL somebody could send.
   */
  test('filters by level with JavaScript disabled', async ({ browser }) => {
    const tag = randomUUID().slice(0, 8)
    const route = await buildRoute(`Filtered route ${tag}`)
    await announce(route.routeId, `Critical one ${tag}`, ChangeSeverity.critical)
    await announce(route.routeId, `Informational one ${tag}`, ChangeSeverity.informational)

    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/en/updates')
    await expect(page.getByText(`Informational one ${tag}`)).toBeVisible()

    // On a phone the filter is folded into a disclosure. A native <details> opens with
    // scripts off too, which is part of what this test proves.
    const fold = page.locator('summary', { hasText: 'Filter' })
    if (await fold.isVisible()) await fold.click()
    await page.getByRole('checkbox', { name: 'Could disrupt your path' }).check()
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(page).toHaveURL(/[?&]severity=critical/)
    await expect(page.getByText(`Critical one ${tag}`)).toBeVisible()
    await expect(page.getByText(`Informational one ${tag}`)).toHaveCount(0)
    await context.close()
  })

  test('collects a follower’s routes, and says which changes land ahead of them', async ({
    browser,
  }) => {
    const tag = randomUUID().slice(0, 8)
    const one = await buildRoute(`Followed one ${tag}`)
    const two = await buildRoute(`Followed two ${tag}`)
    const unfollowed = await buildRoute(`Not followed ${tag}`)

    const { context, userId } = await signedIn(browser)
    await followRoute({ userId, routeId: one.routeId })
    await followRoute({ userId, routeId: two.routeId })
    // A change is news to a follower only if it arrived after they started following.
    await new Promise((resolve) => setTimeout(resolve, 50))
    await announce(one.routeId, `Ahead on route one ${tag}`, ChangeSeverity.important, one.visa)
    await announce(two.routeId, `Ahead on route two ${tag}`, ChangeSeverity.critical, two.visa)
    await announce(unfollowed.routeId, `Elsewhere ${tag}`, ChangeSeverity.relevant)

    const page = await context.newPage()
    await page.goto('/en/updates/journey')
    await expect(page.getByText(`Ahead on route one ${tag}`)).toBeVisible()
    await expect(page.getByText(`Ahead on route two ${tag}`)).toBeVisible()
    await expect(page.getByText(`Elsewhere ${tag}`)).toHaveCount(0)
    // The relevance note, in the same words as on the route's own Changes tab.
    await expect(page.getByText('Ahead of you', { exact: true }).first()).toBeVisible()
    // The rail summary is shown from the tablet breakpoint up; on a phone this tab is it.
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(page.getByText('Across the 2 routes you follow.')).toBeVisible()
    }

    await page.goto('/en/updates/elsewhere')
    await expect(page.getByText(`Elsewhere ${tag}`)).toBeVisible()
    await expect(page.getByText(`Ahead on route one ${tag}`)).toHaveCount(0)
    await context.close()
  })

  test('is reachable from the navigation at every width', async ({ page }) => {
    await page.goto('/en/routes')
    const phone = (page.viewportSize()?.width ?? 0) < 768
    const nav = phone
      ? page.getByRole('navigation', { name: 'Main sections' })
      : page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByRole('link', { name: 'Updates' })).toHaveAttribute('href', '/en/updates')
  })
})
