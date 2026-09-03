import { randomUUID } from 'node:crypto'

import { expect, test, type Browser, type BrowserContext } from '@playwright/test'

import {
  FieldCategory,
  JourneyStepStatus,
  RouteLifecycleState,
  SourceClass,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
  UserRole,
} from '../src/domain/enums'
import { generateHandle } from '../src/server/auth/handle'
import { prisma } from '../src/server/db/client'
import { followRoute, setStepProgress } from '../src/server/journeys/service'
import { mergeRoutes, setLifecycleState } from '../src/server/lifecycle/service'
import { addEdge, addField, addStep, createRoute } from '../src/server/revisions/service'

/**
 * Lifecycle and merge in a browser — Phase 11. FR-11, FR-38, FR-39, FR-40, FR-45, FR-46,
 * FR-58. BR-09, BR-10, BR-25. §19, §40.4. Invariants 4, 20, 23.
 *
 * Each spec builds its own routes, for the reason recorded in Test.md §17: these mutate route
 * *standing*, and Playwright runs `fullyParallel`, so sharing the seed route would break other
 * specs' search assertions intermittently.
 *
 * Sessions are database rows, exactly as in the other specs — the application has no test-only
 * authentication path and must not acquire one.
 */

const seeded = !process.env.E2E_BASE_URL
const SESSION_COOKIE = 'authjs.session-token'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'
const DAY = 24 * 60 * 60 * 1000
const actor = { id: null, system: true }

async function signedIn(
  browser: Browser,
  role: (typeof UserRole)[keyof typeof UserRole] = UserRole.member,
): Promise<{ context: BrowserContext; userId: string }> {
  const user = await prisma.user.create({
    data: { handle: generateHandle(), email: `lc-${randomUUID()}@example.test`, role },
  })
  const sessionToken = randomUUID()
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + DAY) },
  })
  const context = await browser.newContext()
  await context.addCookies([{ name: SESSION_COOKIE, value: sessionToken, url: BASE_URL }])
  return { context, userId: user.id }
}

async function buildRoute(
  prefix: string,
): Promise<{ routeId: string; slug: string; first: string; title: string }> {
  const slug = `e2e-lc-${prefix}-${randomUUID().slice(0, 8)}`
  const title = `Lifecycle test route ${prefix}`
  const { routeId } = await createRoute({
    actor,
    slug,
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    title,
    summary: 'Illustrative test data. Not researched content and not a real procedure.',
  })
  const first = await addStep({
    actor,
    routeId,
    label: `${prefix} documents`,
    category: StepCategory.documents_preparation,
    typicalDurationDays: 20,
  })
  const second = await addStep({
    actor,
    routeId,
    label: `${prefix} visa`,
    category: StepCategory.immigration_visa,
    typicalDurationDays: 40,
  })
  await addEdge({
    actor,
    routeId,
    fromStepId: first.stepId,
    toStepId: second.stepId,
    kind: StepEdgeKind.sequential,
  })
  await addField({
    actor,
    stepId: first.stepId,
    category: FieldCategory.requirement,
    valueText: `${prefix} needs a passport`,
    sourceClass: SourceClass.official,
  })
  return { routeId, slug, first: first.stepId, title }
}

test.describe('lifecycle and merge', () => {
  test.skip(!seeded, 'needs database access; the deployed target is deliberately not seeded')

  /**
   * FR-39, BR-10, invariant 23 — a quiet route explains itself and carries no warning, while
   * a dormant one is plainly set aside. The two must read differently, because they mean
   * different things about different routes.
   */
  test('a quiet route reads as settled, and a dormant one as set aside', async ({ browser }) => {
    const quiet = await buildRoute('quiet')
    const dormant = await buildRoute('dormant')
    const admin = await signedIn(browser, UserRole.admin)

    await setLifecycleState({
      adminId: admin.userId,
      routeId: quiet.routeId,
      state: RouteLifecycleState.quiet,
      note: 'Settled process',
    })
    await setLifecycleState({
      adminId: admin.userId,
      routeId: dormant.routeId,
      state: RouteLifecycleState.dormant,
    })

    const page = await (await browser.newContext()).newPage()

    await page.goto(`/en/routes/${quiet.slug}`)
    // Evidential, not reassuring: quiet describes what was recorded, and says outright that
    // it is not a statement about accuracy.
    await expect(page.getByText(/no recent changes have been recorded/i)).toBeVisible()
    await expect(page.getByText(/describes its activity, not its accuracy/i)).toBeVisible()
    // FR-39: no caution, no warning language, nothing implying the route is wrong.
    const quietBody = (await page.locator('body').innerText()).toLowerCase()
    expect(quietBody).not.toMatch(/out of date|no longer valid|unreliable|abandoned/)

    await page.goto(`/en/routes/${dormant.slug}`)
    await expect(page.getByText(/no followers, confirmations or edits have been recorded/i)).toBeVisible()
    // Set aside, not deleted — the road and its steps are still here.
    await expect(page.getByText(/nothing has been deleted/i)).toBeVisible()
    const titles = await page.getByRole('img').locator('title').allTextContents()
    expect(titles.some((title) => title.includes('dormant documents'))).toBe(true)

    await admin.context.close()
  })

  /**
   * §40.4, FR-58, invariant 20 — the merged route signposts, keeps everything, and its
   * follower's private progress is untouched.
   */
  test('a merged route signposts the survivor and keeps its follower whole', async ({
    browser,
  }) => {
    const duplicate = await buildRoute('dup')
    const canonical = await buildRoute('canon')
    const admin = await signedIn(browser, UserRole.admin)
    const follower = await signedIn(browser)

    const { journeyId } = await followRoute({
      userId: follower.userId,
      routeId: duplicate.routeId,
    })
    const note = `private-${randomUUID().slice(0, 8)}`
    await setStepProgress({
      userId: follower.userId,
      journeyId,
      stepId: duplicate.first,
      status: JourneyStepStatus.completed,
      actualDate: new Date(Date.now() - 5 * DAY),
      privateNote: note,
    })

    await mergeRoutes({
      adminId: admin.userId,
      duplicateRouteId: duplicate.routeId,
      canonicalRouteId: canonical.routeId,
      note: 'Same journey',
    })

    const page = await follower.context.newPage()
    await page.goto(`/en/routes/${duplicate.slug}`)

    // The signpost, and the reassurance that goes with it.
    await expect(page.getByRole('heading', { name: /this route has been merged/i })).toBeVisible()
    await expect(page.getByText(new RegExp(canonical.title, 'i')).first()).toBeVisible()
    await expect(page.getByText(/nothing was moved or deleted/i)).toBeVisible()

    // The route itself still works — steps, road and all.
    const titles = await page.getByRole('img').locator('title').allTextContents()
    expect(titles.some((title) => title.includes('dup documents'))).toBe(true)

    // The link goes to the survivor, which is an ordinary route page.
    await page.getByRole('link', { name: /open the current route/i }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(canonical.title)

    // The follower's own journey is exactly as they left it.
    await page.goto(`/en/routes/${duplicate.slug}/journey`)
    await expect(page.getByText(note)).toBeVisible()

    // And the survivor's history records where it came from (§40.4, both sides).
    await page.goto(`/en/routes/${canonical.slug}/history`)
    await expect(page.getByText(/routes merged into this one/i)).toBeVisible()
    await expect(page.getByText(duplicate.title).first()).toBeVisible()

    await admin.context.close()
    await follower.context.close()
  })

  /**
   * FR-46, §19.2 — the maintenance surface exists for administrators and for nobody else.
   */
  test('route maintenance is administrator-only, and offers no way to delete', async ({
    browser,
  }) => {
    const anonymous = await (await browser.newContext()).newPage()
    expect((await anonymous.goto('/en/admin/routes'))?.status()).toBe(404)

    const member = await signedIn(browser)
    const memberPage = await member.context.newPage()
    expect((await memberPage.goto('/en/admin/routes'))?.status()).toBe(404)
    await member.context.close()

    const admin = await signedIn(browser, UserRole.admin)
    const page = await admin.context.newPage()
    expect((await page.goto('/en/admin/routes'))?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /route maintenance/i })).toBeVisible()

    // §19.2: archived rather than destroyed. There is no delete control anywhere on it.
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).not.toMatch(/\bdelete\b|\bremove permanently\b|\berase\b/)
    // The direction rule is stated where the person exercising it can read it.
    await expect(page.getByText(/raising a route.s standing is a judgement/i)).toBeVisible()
    // The queue says outright that nothing here is ranked by volume (invariant 14).
    await expect(page.getByText(/no number of flags settles that/i)).toBeVisible()

    await admin.context.close()
  })

  /**
   * §40.4 — a contributor can flag a likely duplicate, and it changes nothing by itself.
   */
  test('a contributor flags a duplicate and the route is unaffected', async ({ browser }) => {
    const first = await buildRoute('flag-a')
    const second = await buildRoute('flag-b')
    const contributor = await signedIn(browser)
    const page = await contributor.context.newPage()

    await page.goto(`/en/routes/${first.slug}`)
    await page.getByText(/flag as a duplicate/i).click()

    // The hint that protects §40.1 — similar is not the same.
    await expect(page.getByText(/two routes can legitimately look similar/i)).toBeVisible()

    await page.locator('select[name="duplicateOfId"]').selectOption({ label: second.title })
    await page.locator('textarea[name="duplicateNote"]').fill('These look like one journey')
    await page.getByRole('button', { name: /send for comparison/i }).click()

    // Nothing about the route moved: still in search, still its own standing (invariant 14).
    await page.goto('/en/routes?origin=BD&destination=DE')
    await expect(page.getByText(first.title).first()).toBeVisible()

    const stored = await prisma.route.findUniqueOrThrow({ where: { id: first.routeId } })
    expect(stored.mergedIntoId).toBeNull()
    expect(stored.lifecycleState).toBe(RouteLifecycleState.experimental)

    // No upload path anywhere on this page (invariants 6 and 7).
    expect(await page.locator('input[type="file"]').count()).toBe(0)

    await contributor.context.close()
  })
})
