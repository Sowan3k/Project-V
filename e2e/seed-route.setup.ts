import { test as setup } from '@playwright/test'

import { FieldCategory, SourceClass, StepCategory, StepEdgeKind, StudyLevel } from '../src/domain/enums'
import { addEdge, addField, addStep, createRoute } from '../src/server/revisions/service'
import { getRouteBySlug } from '../src/server/routes/read'

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
})
