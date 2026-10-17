import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import {
  ChallengeReason,
  FieldApplicability,
  FieldCategory,
  SourceClass,
  StepCategory,
  StudyLevel,
} from '../src/domain/enums'
import { generateHandle } from '../src/server/auth/handle'
import { prisma } from '../src/server/db/client'
import { addField, addStep, challengeField, createRoute } from '../src/server/revisions/service'

/**
 * Phase 15 in a browser: from a count to the field it counts. FR-50, FR-53, FR-70.
 *
 * Each test builds its own route, because it adds a challenge, and a challenge on the shared
 * seed route would change what other specs read (Test.md §17).
 */

const seeded = !process.env.E2E_BASE_URL
const actor = { id: null, system: true }

async function routeWithAChallenge(): Promise<{ slug: string; fieldId: string; tag: string }> {
  const tag = randomUUID().slice(0, 8)
  const slug = `e2e-needs-help-${tag}`
  const { routeId } = await createRoute({
    actor,
    slug,
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    title: `Needs help route ${tag}`,
    summary: 'Illustrative test data. Not researched content and not a real procedure.',
  })
  const { stepId } = await addStep({
    actor,
    routeId,
    label: 'Admission',
    category: StepCategory.admission_university,
  })
  const { fieldId } = await addField({
    actor,
    stepId,
    category: FieldCategory.procedure,
    valueText: `Interviews are held in person ${tag}`,
    sourceClass: SourceClass.official,
    applicability: [FieldApplicability.route_wide],
  })
  const challenger = await prisma.user.create({
    data: { handle: generateHandle(), email: `nh-${randomUUID()}@example.test` },
  })
  await challengeField({
    actor: { id: challenger.id },
    fieldId,
    reason: ChallengeReason.obsolete,
    note: `They moved online ${tag}`,
  })
  return { slug, fieldId, tag }
}

test.describe('what needs help on a route', () => {
  test.skip(!seeded, 'needs database access; the deployed target is deliberately not seeded')

  test('the passport leads to the list, and the list leads to the field', async ({ page }) => {
    const { slug, fieldId, tag } = await routeWithAChallenge()
    await page.goto(`/en/routes/${slug}`)

    // The passport's caution now leads somewhere.
    await page.getByRole('link', { name: 'See which fields' }).click()
    await expect(page).toHaveURL(new RegExp(`/en/routes/${slug}#needs-help$`))

    const section = page.locator('#needs-help')
    await expect(section.getByRole('heading', { name: 'What needs help' })).toBeVisible()
    await expect(section.getByText('Contested (1)')).toBeVisible()
    // What was challenged, why, and the words saying contested is not wrong.
    await expect(section.getByText(`They moved online ${tag}`)).toBeVisible()
    await expect(section.getByText(/Contested does not mean wrong/)).toBeVisible()

    await section.getByRole('link', { name: 'Go to this field' }).click()
    await expect(page).toHaveURL(new RegExp(`\\?step=[^#]+#field-${fieldId}$`))
    // The field is on screen, and the road is still on the page with it (CLAUDE.md §7.1).
    await expect(page.locator(`#field-${fieldId}`)).toBeInViewport()
    await expect(page.locator('#route-map')).toHaveCount(1)
  })

  test('works with JavaScript disabled', async ({ browser }) => {
    const { slug, fieldId } = await routeWithAChallenge()
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(`/en/routes/${slug}#needs-help`)
    await page.locator('#needs-help').getByRole('link', { name: 'Go to this field' }).click()
    await expect(page.locator(`#field-${fieldId}`)).toBeVisible()
    await context.close()
  })
})
