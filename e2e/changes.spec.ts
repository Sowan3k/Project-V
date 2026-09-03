import { randomUUID } from 'node:crypto'

import { expect, test, type Browser, type BrowserContext } from '@playwright/test'

import {
  ChangeSeverity,
  JourneyStepStatus,
  RouteChangeKind,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
} from '../src/domain/enums'
import { generateHandle } from '../src/server/auth/handle'
import { announceChange, recordDisruption } from '../src/server/changes/service'
import { prisma } from '../src/server/db/client'
import { followRoute, setStepProgress } from '../src/server/journeys/service'
import { addEdge, addStep, createRoute } from '../src/server/revisions/service'

/**
 * Change propagation in a browser — Phase 10. FR-22, FR-28, FR-29, FR-30, FR-32, FR-59,
 * FR-61, FR-63, FR-77. §13.2, §14, §41.3. Invariants 8, 19, 21.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Each spec builds its own route.**
 *
 * The shared seed route is read by several other specs, and Playwright runs `fullyParallel`.
 * A spec here mutates route *structure* — adding steps, archiving them — so sharing the seed
 * would make the search-ordering and road-shape assertions in other files fail intermittently
 * for reasons that look like product bugs. That lesson is already recorded in Test.md §17;
 * this file starts from it rather than relearning it.
 *
 * Sessions are fabricated as database rows exactly as in `journey.spec.ts` — the application
 * has no test-only authentication path, and adding one would be a password-free login one
 * misconfiguration away from the real site.
 */

const seeded = !process.env.E2E_BASE_URL
const SESSION_COOKIE = 'authjs.session-token'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'

const DAY = 24 * 60 * 60 * 1000
const ago = (days: number): Date => new Date(Date.now() - days * DAY)
const ahead = (days: number): Date => new Date(Date.now() + days * DAY)

const actor = { id: null, system: true }

async function signedIn(browser: Browser): Promise<{ context: BrowserContext; userId: string }> {
  const user = await prisma.user.create({
    data: { handle: generateHandle(), email: `chg-${randomUUID()}@example.test` },
  })
  const sessionToken = randomUUID()
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + DAY) },
  })
  const context = await browser.newContext()
  await context.addCookies([{ name: SESSION_COOKIE, value: sessionToken, url: BASE_URL }])
  return { context, userId: user.id }
}

interface Fixture {
  readonly routeId: string
  readonly slug: string
  readonly docs: string
  readonly test: string
  readonly visa: string
}

async function buildRoute(): Promise<Fixture> {
  const slug = `e2e-changes-${randomUUID().slice(0, 8)}`
  const { routeId } = await createRoute({
    actor,
    slug,
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    title: 'Test route for change propagation',
    summary: 'Illustrative test data. Not researched content and not a real procedure.',
  })

  const docs = await addStep({
    actor,
    routeId,
    label: 'Documents',
    category: StepCategory.documents_preparation,
    typicalDurationDays: 30,
  })
  const language = await addStep({
    actor,
    routeId,
    label: 'Language test',
    category: StepCategory.language_testing,
    typicalDurationDays: 60,
  })
  const visa = await addStep({
    actor,
    routeId,
    label: 'Visa application',
    category: StepCategory.immigration_visa,
    typicalDurationDays: 45,
  })

  await addEdge({
    actor,
    routeId,
    fromStepId: docs.stepId,
    toStepId: language.stepId,
    kind: StepEdgeKind.sequential,
  })
  await addEdge({
    actor,
    routeId,
    fromStepId: language.stepId,
    toStepId: visa.stepId,
    kind: StepEdgeKind.sequential,
  })

  return { routeId, slug, docs: docs.stepId, test: language.stepId, visa: visa.stepId }
}

test.describe('change propagation', () => {
  test.skip(!seeded, 'needs database access; the deployed target is deliberately not seeded')

  /**
   * **The required scenario, end to end in a browser.**
   *
   * Follow → record progress → the route changes structurally → the follower sees it, sees
   * *where*, keeps their completion, and is told the change came after their date.
   */
  test('a follower sees a structural change, and their completed step survives it', async ({
    browser,
  }) => {
    const route = await buildRoute()
    const { context, userId } = await signedIn(browser)
    const page = await context.newPage()

    const { journeyId } = await followRoute({ userId, routeId: route.routeId })
    await setStepProgress({
      userId,
      journeyId,
      stepId: route.docs,
      status: JourneyStepStatus.completed,
      actualDate: ago(10),
      privateNote: 'Posted the certified copies.',
    })

    // The public route changes underneath them: a genuinely structural change (a new step),
    // plus an announcement dated to take effect after what they already did.
    const aps = await addStep({
      actor,
      routeId: route.routeId,
      label: 'APS certificate',
      category: StepCategory.documents_preparation,
    })
    await addEdge({
      actor,
      routeId: route.routeId,
      fromStepId: route.docs,
      toStepId: aps.stepId,
      kind: StepEdgeKind.sequential,
    })
    await announceChange({
      authorId: userId,
      routeId: route.routeId,
      kind: RouteChangeKind.structural,
      severity: ChangeSeverity.critical,
      title: 'APS certificate now required',
      detail: 'A new step was added before the language test.',
      effectiveAt: ago(2),
      stepId: aps.stepId,
    })
    await announceChange({
      authorId: userId,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.important,
      title: 'Certified copies wording clarified',
      effectiveAt: ago(1),
      stepId: route.docs,
    })

    await page.goto(`/en/routes/${route.slug}/changes`)

    // FR-28 — the route's changes are a tab on the route, and the route is still here.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Test route for change propagation',
    )
    await expect(page.getByRole('link', { name: /^changes$/i })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // FR-30, BR-17, invariant 8 — said plainly, above the fold.
    await expect(page.getByText(/your completed steps, dates, tasks and notes are exactly/i)).toBeVisible()

    // FR-77 — scale AND location.
    await expect(page.getByText(/1 step added/i).first()).toBeVisible()

    // The location, asserted as one row rather than three loose strings: the added step, the
    // gap opposite it, and the mark, all on the same line of the comparison.
    //
    // Scoped to the row deliberately. A bare `getByText('APS certificate')` matches the road's
    // own `<title>` first — which is the renderer having correctly drawn the new step, but is
    // an accessibility label rather than visible text, so it fails a visibility assertion
    // (Test.md §17, and again here).
    const addedRow = page.locator('li').filter({ hasText: 'APS certificate' }).first()
    await expect(addedRow).toBeVisible()
    await expect(addedRow.getByText(/was not part of the route then/i)).toBeVisible()
    await expect(addedRow.getByText(/^added$/i)).toBeVisible()

    // §14.2 — the comparison is against the day they started following.
    await expect(page.getByText(/the route when you started/i).first()).toBeVisible()

    // Invariant 24 — two roads, both from the generic renderer. Same component, twice.
    expect(await page.locator('svg[role="img"]').count()).toBeGreaterThanOrEqual(2)

    // BR-26, §41.3 — the change on the finished step reads as context, not invalidation.
    await expect(
      page.getByText(/this took effect after the date you recorded, so what you did still stands/i).first(),
    ).toBeVisible()
    await expect(page.getByText(/your record of finishing this step is unchanged/i).first()).toBeVisible()

    // FR-59, §41.1 — both dates are shown, never collapsed into one.
    await expect(page.getByText(/^recorded$/i).first()).toBeVisible()
    await expect(page.getByText(/^takes effect$/i).first()).toBeVisible()

    // And nothing anywhere claims their progress is now wrong.
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).not.toMatch(/no longer valid|must redo|start again|progress reset/)

    // The private record itself is untouched.
    const stored = await prisma.journeyStepProgress.findFirstOrThrow({
      where: { journeyId, stepId: route.docs },
    })
    expect(stored.status).toBe(JourneyStepStatus.completed)
    expect(stored.privateNote).toBe('Posted the certified copies.')

    await context.close()
  })

  /**
   * FR-29, §13.1 — relevance, not volume. The journey tab surfaces what is ahead of them and
   * stays quiet about what is behind.
   */
  test('the journey tab raises only what is ahead of the follower', async ({ browser }) => {
    const route = await buildRoute()
    const { context, userId } = await signedIn(browser)
    const page = await context.newPage()

    const { journeyId } = await followRoute({ userId, routeId: route.routeId })
    await setStepProgress({
      userId,
      journeyId,
      stepId: route.docs,
      status: JourneyStepStatus.completed,
      actualDate: ago(20),
    })
    await setStepProgress({
      userId,
      journeyId,
      stepId: route.visa,
      status: JourneyStepStatus.not_started,
    })

    await announceChange({
      authorId: userId,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.informational,
      title: 'Behind them: address corrected',
      effectiveAt: ago(1),
      stepId: route.docs,
    })
    await announceChange({
      authorId: userId,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.critical,
      title: 'Ahead of them: blocked account amount raised',
      effectiveAt: ago(1),
      stepId: route.visa,
    })

    await page.goto(`/en/routes/${route.slug}/journey`)

    // One of the two asks anything of them.
    await expect(page.getByText(/1 change needs a look/i)).toBeVisible()
    await expect(page.getByText(/ahead of them: blocked account amount raised/i)).toBeVisible()
    // The one behind them is not raised here at all — it is on the Changes tab, in context.
    await expect(page.getByText(/behind them: address corrected/i)).toHaveCount(0)

    await context.close()
  })

  /**
   * FR-32, FR-63, BR-08, BR-27, §31.4, invariant 19 — a disruption appears with its three
   * scopes, warns the follower whose own date it overlaps, and expires without touching the
   * route.
   */
  test('a temporary disruption shows its scope and expires without changing the route', async ({
    browser,
  }) => {
    const route = await buildRoute()
    const { context, userId } = await signedIn(browser)
    const page = await context.newPage()

    const { journeyId } = await followRoute({ userId, routeId: route.routeId })
    await setStepProgress({
      userId,
      journeyId,
      stepId: route.test,
      status: JourneyStepStatus.not_started,
      targetDate: ahead(3),
    })

    const marker = `flood-${randomUUID().slice(0, 8)}`
    const { disruptionId } = await recordDisruption({
      authorId: userId,
      routeId: route.routeId,
      severity: ChangeSeverity.critical,
      title: `IELTS Dhaka centre closed ${marker}`,
      detail: 'Closed due to flooding.',
      startsAt: ago(1),
      endsAt: ahead(7),
      locationScope: 'Dhaka, Bangladesh',
      stepId: route.test,
    })

    await page.goto(`/en/routes/${route.slug}/changes`)

    // All three scopes on one card — when, where, and which part of the process. Asserted
    // within the card so it proves they belong together, and so `Language test` matches the
    // card's own text rather than the road's `<title>`.
    const card = page.locator('li').filter({ hasText: marker }).first()
    await expect(card).toBeVisible()
    await expect(card.getByText('Dhaka, Bangladesh')).toBeVisible()
    await expect(card.getByText('Language test')).toBeVisible()
    await expect(card.getByText(/happening now/i)).toBeVisible()

    // §31.4 — it overlaps their own planned date, so it is a caution rather than a notice.
    await expect(card.getByText(/overlaps the date you planned for this step/i)).toBeVisible()

    // BR-27, said on the card: this is not a route change.
    await expect(
      card.getByText(/this is a temporary condition, not a change to the route/i),
    ).toBeVisible()

    // Invariant 19 — the road itself is untouched. Same three steps, same labels, read from
    // the rendered road's accessible titles rather than by visible-text matching.
    await page.goto(`/en/routes/${route.slug}`)
    const roadTitles = await page.locator('svg[role="img"] title').allTextContents()
    for (const label of ['Documents', 'Language test', 'Visa application']) {
      expect(roadTitles.some((title) => title.includes(label)), label).toBe(true)
    }
    const revisionsAfter = await prisma.stepRevision.count({
      where: { step: { routeId: route.routeId } },
    })
    expect(revisionsAfter).toBe(3)

    // Now expire it by moving its window into the past — the only write is to the disruption
    // itself, and the route is not involved.
    await prisma.temporaryDisruption.update({
      where: { id: disruptionId },
      data: { startsAt: ago(20), endsAt: ago(10) },
    })

    await page.goto(`/en/routes/${route.slug}/changes`)
    // Still on the record, no longer a warning.
    await expect(page.getByText(new RegExp(marker, 'i'))).toBeVisible()
    await expect(page.getByText(/happening now/i)).toHaveCount(0)
    await expect(page.getByText(/overlaps the date you planned/i)).toHaveCount(0)

    // And the route is still exactly what it was.
    expect(
      await prisma.stepRevision.count({ where: { step: { routeId: route.routeId } } }),
    ).toBe(3)

    await context.close()
  })

  /**
   * FR-01, D-03 — the comparison is readable with no account, and honestly labelled as a
   * different question from the follower's.
   */
  test('an anonymous reader gets the comparison without being told it is theirs', async ({
    browser,
  }) => {
    const route = await buildRoute()
    // Somebody has to have written the change — contributions are attributable. What is being
    // tested is the *reader* having no account, not the change having no author.
    const contributor = await prisma.user.create({
      data: { handle: generateHandle(), email: `anon-${randomUUID()}@example.test` },
    })
    await announceChange({
      authorId: contributor.id,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.relevant,
      title: 'Something changed on this route',
    })

    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`/en/routes/${route.slug}/changes`)

    await expect(page.getByRole('heading', { name: /what has changed/i })).toBeVisible()
    await expect(page.getByText('Something changed on this route')).toBeVisible()

    // It never claims a journey they do not have.
    await expect(page.getByText(/the route when you started/i)).toHaveCount(0)
    await expect(page.getByText(/you started following this route/i)).toHaveCount(0)
    // Contribution is offered, gated on signing in — never hidden as if it did not exist.
    await expect(page.getByText(/sign in to record a change or a disruption/i)).toBeVisible()

    // §35 — no alert subscription anywhere, and the page says so rather than pretending.
    await expect(page.getByText(/we do not send emails or push notifications/i)).toBeVisible()
    expect(await page.getByText(/subscribe to alerts/i).count()).toBe(0)

    await context.close()
  })

  /**
   * Invariant 3, §43.1 — a contributor records a change and it is live immediately. No
   * approval queue, which VR-08 shows and CLAUDE.md §8.6 lists as not to be built.
   */
  test('a signed-in contributor records a disruption and it appears at once', async ({
    browser,
  }) => {
    const route = await buildRoute()
    const { context } = await signedIn(browser)
    const page = await context.newPage()

    await page.goto(`/en/routes/${route.slug}/changes`)

    const marker = `strike-${randomUUID().slice(0, 8)}`
    // Located by field name rather than by accessible name: a control's accessible name
    // includes its own content, so a filled input stops matching its label (Test.md §17).
    await page.locator('input[name="disruptionTitle"]').fill(`Embassy strike ${marker}`)
    await page.locator('input[name="startsAt"]').fill(new Date().toISOString().slice(0, 10))
    await page.locator('input[name="endsAt"]').fill(ahead(5).toISOString().slice(0, 10))
    await page.locator('input[name="locationScope"]').fill('Dhaka, Bangladesh')
    await page.getByRole('button', { name: /record this disruption/i }).click()

    // Live, with no review step in between.
    await expect(page.getByText(new RegExp(marker, 'i'))).toBeVisible()
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).not.toMatch(/pending review|awaiting approval|will go live when/)

    // No upload path anywhere on this page (invariants 6 and 7).
    expect(await page.locator('input[type="file"]').count()).toBe(0)

    await context.close()
  })
})
