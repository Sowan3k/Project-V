import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { ChangeSeverity, RouteChangeKind, StepCategory, StepEdgeKind, StudyLevel } from '../src/domain/enums'
import { generateHandle } from '../src/server/auth/handle'
import { announceChange } from '../src/server/changes/service'
import { prisma } from '../src/server/db/client'
import { followRoute } from '../src/server/journeys/service'
import { addEdge, addStep, createRoute } from '../src/server/revisions/service'

/**
 * Phase 16 in a browser. FR-10, FR-31, FR-62. VR-03, VR-07.
 *
 *   G5: a ribbon states its followers and recent changes, and gains no height for it from the
 *   tablet breakpoint up.
 *   G6: the Changes tab shows the route as it stood on a day the reader picks, by URL.
 */

const seeded = !process.env.E2E_BASE_URL
const actor = { id: null, system: true }

async function twinRoute(title: string, destination: string): Promise<{ routeId: string; slug: string }> {
  const slug = `e2e-p16-${randomUUID().slice(0, 8)}`
  const { routeId } = await createRoute({
    actor,
    slug,
    originCountry: 'BD',
    destinationCountry: destination,
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
  return { routeId, slug }
}

async function person(): Promise<string> {
  const user = await prisma.user.create({
    data: { handle: generateHandle(), email: `p16-${randomUUID()}@example.test` },
  })
  return user.id
}

test.describe('Phase 16', () => {
  test.skip(!seeded, 'needs database access; the deployed target is deliberately not seeded')

  test('a ribbon states followers and recent changes, without growing', async ({ page }) => {
    const tag = randomUUID().slice(0, 6)
    // Same-length titles, same summary, same road: the only difference is the two facts.
    await twinRoute(`Ribbon twin quiet ${tag}`, 'IE')
    const busy = await twinRoute(`Ribbon twin busy- ${tag}`, 'IE')

    const [a, b] = [await person(), await person()]
    await followRoute({ userId: a, routeId: busy.routeId })
    await followRoute({ userId: b, routeId: busy.routeId })
    await announceChange({
      authorId: a,
      routeId: busy.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.informational,
      title: 'A small correction',
    })

    await page.goto('/en/routes?to=IE')
    const busyRow = page.locator('main li').filter({ hasText: `Ribbon twin busy- ${tag}` })
    const quietRow = page.locator('main li').filter({ hasText: `Ribbon twin quiet ${tag}` })
    await expect(busyRow.getByText('2 following')).toBeVisible()
    await expect(busyRow.getByText('1 change in 90 days')).toBeVisible()
    // Silent at zero.
    await expect(quietRow.getByText(/following|changes? in 90 days/)).toHaveCount(0)

    const width = page.viewportSize()?.width ?? 0
    if (width >= 768) {
      // The link inside each row, not the row: the first row in the list carries a top border
      // the second does not, and that pixel is about position, not content.
      const [busyBox, quietBox] = [
        await busyRow.locator('a').first().boundingBox(),
        await quietRow.locator('a').first().boundingBox(),
      ]
      // Within a pixel: layout rounding differs by fractions under load, and the claim being
      // tested is "no extra line", which would be about eighteen pixels.
      expect(busyBox?.height ?? 0).toBeCloseTo(quietBox?.height ?? -100, 0)
    }
  })

  test('the Changes tab shows the route on a chosen day, by URL', async ({ page }) => {
    const route = await twinRoute(`Versioned route ${randomUUID().slice(0, 6)}`, 'IE')
    const today = new Date().toISOString().slice(0, 10)

    await page.goto(`/en/routes/${route.slug}/changes?at=${today}`)
    await expect(page.getByText('The route on the day you chose').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to the usual comparison' })).toBeVisible()

    // A day the route did not exist on is refused out loud, not silently replaced.
    await page.goto(`/en/routes/${route.slug}/changes?at=2020-01-01`)
    await expect(page.getByText(/That day cannot be shown/)).toBeVisible()
  })

  test('the version picker works with JavaScript disabled', async ({ browser }) => {
    const route = await twinRoute(`Versioned route ${randomUUID().slice(0, 6)}`, 'IE')
    const today = new Date().toISOString().slice(0, 10)
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    await page.goto(`/en/routes/${route.slug}/changes`)
    await page.getByLabel('See the route as it stood on').fill(today)
    await page.getByRole('button', { name: 'Show' }).press('Enter')
    await expect(page).toHaveURL(new RegExp(`[?&]at=${today}`))
    await expect(page.getByText('The route on the day you chose').first()).toBeVisible()
    await context.close()
  })
})
