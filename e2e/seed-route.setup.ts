import { test as setup } from '@playwright/test'

import {
  FieldApplicability,
  FieldCategory,
  SourceClass,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
} from '../src/domain/enums'
import { addEdge, addField, addStep, createRoute } from '../src/server/revisions/service'
import { getRouteBySlug, getStepFields } from '../src/server/routes/read'

/**
 * Seeds one route for the journey spec to walk through.
 *
 * **This is test data, not content.** It goes only to the database named in
 * `.env.test.local`, it says so in its own summary, and it never reaches production — real
 * seed content is researched from official sources and reviewed by a person first
 * (content/README.md).
 *
 * Written through the Phase 3 revision service like everything else, so it doubles as a check
 * that a route built the normal way is readable the normal way.
 *
 * **Ensure-shaped, not create-once.** An earlier version returned early if any route existed,
 * so a route seeded by a previous run never gained fields added later and the journey spec
 * failed against stale data. Nothing here can be deleted (the database refuses), so the seed
 * has to converge on the shape it wants rather than assume a clean slate.
 */
const SLUG = 'e2e-test-route'
const actor = { id: null, system: true }

/** Referenced by `e2e/route-journey.spec.ts`. Both say plainly that they are not real. */
export const OFFICIAL_FIELD = 'Test official requirement. Not a real requirement.'
export const PROGRAMME_FIELD = 'Test programme-specific requirement. Not a real requirement.'

setup('seed a route for the reading journey', async () => {
  if (process.env.E2E_BASE_URL) return // Deployed target: never seeded.

  let route = await getRouteBySlug(SLUG)

  if (!route) {
    const { routeId } = await createRoute({
      actor,
      slug: SLUG,
      originCountry: 'BD',
      destinationCountry: 'DE',
      studyLevel: StudyLevel.masters,
      title: 'Test route for the reading journey',
      summary: 'Illustrative test data. Not researched content and not a real procedure.',
    })

    const docs = await addStep({
      actor, routeId, label: 'Documents', category: StepCategory.documents_preparation,
      earliestStartOffsetDays: 0, typicalDurationDays: 30,
    })
    const lang = await addStep({
      actor, routeId, label: 'Language test', category: StepCategory.language_testing,
      earliestStartOffsetDays: 0, typicalDurationDays: 60,
    })
    const fly = await addStep({
      actor, routeId, label: 'Departure', category: StepCategory.travel_departure,
      typicalDurationDays: 7,
    })

    await addEdge({ actor, routeId, fromStepId: docs.stepId, toStepId: fly.stepId, kind: StepEdgeKind.sequential })
    await addEdge({ actor, routeId, fromStepId: lang.stepId, toStepId: fly.stepId, kind: StepEdgeKind.sequential })

    route = await getRouteBySlug(SLUG)
  }

  if (!route) throw new Error('seed route could not be created')

  // Every step needs at least one field, so opening any step from the journey spec shows
  // something. Converging rather than assuming keeps the seed correct across reruns.
  for (const step of route.steps) {
    if (step.fieldCount > 0) continue
    await addField({
      actor,
      stepId: step.id,
      category: FieldCategory.document,
      valueText: `Test information for "${step.label}". Not a real requirement.`,
      sourceClass: SourceClass.community_submission,
      sourceUrl: 'https://example.org/not-a-real-source',
    })
  }

  /**
   * The first step also gets an OFFICIAL field and a PROGRAMME-SCOPED one — Phase 6.
   *
   * The journey spec has to prove in a real browser that an official claim and a community
   * submission are visibly different (FR-33, FR-54, invariant 11), and that a claim narrower
   * than the route says so (FR-81). Neither is provable against a seed containing only
   * community submissions, which is what this used to be.
   *
   * Matched by value text rather than by count, so a rerun against a branch that already has
   * the community field still adds these.
   */
  const firstStep = route.steps[0]
  if (firstStep) {
    const existing = await getStepFields(firstStep.id)
    const has = (text: string) => existing.some((field) => field.valueText.startsWith(text))

    if (!has(OFFICIAL_FIELD)) {
      await addField({
        actor,
        stepId: firstStep.id,
        category: FieldCategory.requirement,
        valueText: OFFICIAL_FIELD,
        sourceClass: SourceClass.official,
        applicability: [FieldApplicability.route_wide],
        sourceUrl: 'https://example.org/official-test-source',
      })
    }

    if (!has(PROGRAMME_FIELD)) {
      await addField({
        actor,
        stepId: firstStep.id,
        category: FieldCategory.requirement,
        valueText: PROGRAMME_FIELD,
        sourceClass: SourceClass.official,
        applicability: [FieldApplicability.institution, FieldApplicability.programme],
      })
    }
  }
})
