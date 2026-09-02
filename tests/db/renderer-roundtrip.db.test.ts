import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { StepCategory, StepEdgeKind, StudyLevel } from '../../src/domain/enums'
import { en } from '../../src/i18n/dictionaries/en'
import { RIBBON, ROAD, ROAD_NARROW, layout } from '../../src/renderer/layout'
import { Ribbon, Road, type RouteVisualStrings } from '../../src/renderer/route-visual'
import { loadRouteGraph } from '../../src/server/revisions/read'
import { addEdge, addStep, createRoute } from '../../src/server/revisions/service'

/**
 * Test 24e — "a route created through the UI renders with zero developer involvement."
 *
 * Phase 8 builds that UI, so this proves the equivalent and stronger thing available today:
 * a route built entirely through the **Phase 3 revision service** — the same functions the
 * Phase 8 UI will call — loads and renders with no change to the renderer and no fixture,
 * mapping or special case anywhere.
 *
 * If the renderer needed anything route-specific, this is where it would show: the route
 * below is created at runtime, its ids are generated, and the renderer has never seen it.
 *
 * Uses `createElement` rather than JSX so this file needs no JSX transform in the database
 * test config — one dependency fewer for an assertion that does not need the syntax.
 */

const url = process.env.TEST_DATABASE_URL

const strings: RouteVisualStrings = {
  categories: en.stepCategory,
  start: en.route.start,
  destination: en.route.destination,
  added: en.route.stepAdded,
  archived: en.route.stepArchived,
  disrupted: en.route.stepDisrupted,
  summary: (n) => `Route with ${n} steps`,
}

/** Builds a branching route through the service, exactly as a contributor would. */
async function buildContributedRoute(): Promise<string> {
  const actor = { id: null, system: true }
  const { routeId } = await createRoute({
    actor,
    slug: `renderer-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    originCountry: 'BD',
    destinationCountry: 'MY',
    studyLevel: StudyLevel.bachelors,
    title: 'Contributed at runtime',
  })

  const step = async (label: string, category: (typeof StepCategory)[keyof typeof StepCategory]) =>
    (await addStep({ actor, routeId, label, category })).stepId

  const docs = await step('Documents', StepCategory.documents_preparation)
  const ielts = await step('IELTS', StepCategory.language_testing)
  const pte = await step('PTE', StepCategory.language_testing)
  const adm = await step('Admission', StepCategory.admission_university)
  const visa = await step('Visa', StepCategory.immigration_visa)
  const fly = await step('Departure', StepCategory.travel_departure)

  const link = async (from: string, to: string, kind: (typeof StepEdgeKind)[keyof typeof StepEdgeKind]) => {
    await addEdge({ actor, routeId, fromStepId: from, toStepId: to, kind })
  }

  await link(docs, ielts, StepEdgeKind.alternative)
  await link(docs, pte, StepEdgeKind.alternative)
  await link(ielts, adm, StepEdgeKind.rejoin)
  await link(pte, adm, StepEdgeKind.rejoin)
  await link(adm, visa, StepEdgeKind.sequential)
  await link(visa, fly, StepEdgeKind.sequential)

  return routeId
}

describe.skipIf(!url)('24e — a route created through the service renders unaided', () => {
  it('renders as a road with no renderer change, fixture or special case', async () => {
    const routeId = await buildContributedRoute()
    const graph = await loadRouteGraph(routeId)

    const markup = renderToStaticMarkup(createElement(Road, { graph, strings }))

    expect(markup).toContain('<svg')
    // Every step the contributor created is drawn and named.
    for (const label of ['Documents', 'IELTS', 'PTE', 'Admission', 'Visa', 'Departure']) {
      expect(markup, `${label} is missing from the road`).toContain(label)
    }
  }, 60_000)

  it('renders as a ribbon from the same data, with the same steps in the same order', async () => {
    const routeId = await buildContributedRoute()
    const graph = await loadRouteGraph(routeId)

    const road = layout(graph, ROAD)
    const ribbon = layout(graph, RIBBON)

    // Invariant 25, proved end to end against a real database rather than a fixture.
    expect(ribbon.order).toEqual(road.order)
    expect(renderToStaticMarkup(createElement(Ribbon, { graph, strings }))).toContain('<svg')
  }, 60_000)

  it('reconstructs the branch it was given', async () => {
    const routeId = await buildContributedRoute()
    const frame = layout(await loadRouteGraph(routeId), ROAD)

    const byLabel = new Map(frame.nodes.map((n) => [n.step.label, n]))
    const ielts = byLabel.get('IELTS')
    const pte = byLabel.get('PTE')
    const adm = byLabel.get('Admission')

    // The two alternatives are concurrent; the rejoin lands after both.
    expect(ielts?.rank).toBe(pte?.rank)
    expect(adm?.rank).toBeGreaterThan(ielts?.rank ?? 0)
    // ...and they are visually separated, or "alternative" would be a lie.
    expect(ielts?.y).not.toBe(pte?.y)
  }, 60_000)

  it('fits the same route on a phone by changing a density constant only', async () => {
    const routeId = await buildContributedRoute()
    const graph = await loadRouteGraph(routeId)

    const narrow = layout(graph, ROAD_NARROW)
    expect(narrow.width).toBeLessThanOrEqual(360)
    expect(narrow.order).toEqual(layout(graph, ROAD).order)
  }, 60_000)

  it('carries an accessible name and per-step titles, so meaning is never colour-only', async () => {
    const routeId = await buildContributedRoute()
    const graph = await loadRouteGraph(routeId)
    const markup = renderToStaticMarkup(createElement(Ribbon, { graph, strings }))

    expect(markup).toContain('role="img"')
    expect(markup).toContain('aria-label="Route with 6 steps"')
    // At ribbon density there is no visible text, so the title is what makes it readable.
    expect(markup).toContain('<title>')
    expect(markup).toContain('Language and testing')
  }, 60_000)
})
