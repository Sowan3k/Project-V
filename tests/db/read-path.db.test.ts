import { describe, expect, it } from 'vitest'

import {
  FieldCategory,
  RouteMechanism,
  SourceClass,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
} from '../../src/domain/enums'
import { expectedFlyWindow } from '../../src/domain/fly-window'
import {
  availableFilters,
  getRouteBySlug,
  getRouteHistory,
  getStepFields,
  ROUTES_PER_PAGE,
  searchRoutes,
} from '../../src/server/routes/read'
import { addEdge, addField, addStep, archiveField, archiveStep, createRoute, reviseField } from '../../src/server/revisions/service'

/**
 * Phase 5 — the anonymous read path, against a real database.
 *
 * Everything here is called with no session, no actor and no role, because that is exactly
 * how an anonymous visitor reaches it (FR-01, D-03). If any of these functions needed a
 * caller identity, these tests would not compile.
 */

const url = process.env.TEST_DATABASE_URL
const actor = { id: null, system: true }

interface Built {
  readonly slug: string
  readonly routeId: string
  readonly langStepId: string
  readonly fieldId: string
}

async function buildRoute(over: Partial<{ destination: string; level: typeof StudyLevel[keyof typeof StudyLevel] }> = {}): Promise<Built> {
  const slug = `read-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { routeId } = await createRoute({
    actor,
    slug,
    originCountry: 'BD',
    destinationCountry: over.destination ?? 'DE',
    studyLevel: over.level ?? StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    intake: '2027 autumn',
    title: 'Readable route',
    summary: 'A route that exists only to be read.',
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

  const field = await addField({
    actor, stepId: lang.stepId, category: FieldCategory.requirement,
    valueText: 'Overall band 6.5',
    sourceClass: SourceClass.official,
    sourceUrl: 'https://example.org/language-requirement',
  })

  return { slug, routeId, langStepId: lang.stepId, fieldId: field.fieldId }
}

describe.skipIf(!url)('search is open, filtered and honest', () => {
  it('finds a route with no filters and no session', async () => {
    const built = await buildRoute()
    const results = (await searchRoutes()).routes
    expect(results.map((r) => r.slug)).toContain(built.slug)
  }, 60_000)

  it('filters by destination and study level', async () => {
    const built = await buildRoute({ destination: 'AU', level: StudyLevel.bachelors })

    const matching = (await searchRoutes({ destinationCountry: 'AU', studyLevel: StudyLevel.bachelors })).routes
    expect(matching.map((r) => r.slug)).toContain(built.slug)

    const wrongLevel = (await searchRoutes({ destinationCountry: 'AU', studyLevel: StudyLevel.phd })).routes
    expect(wrongLevel.map((r) => r.slug)).not.toContain(built.slug)
  }, 60_000)

  it('returns the graph so the ribbon draws from the same data as the road', async () => {
    const built = await buildRoute()
    const summary = (await searchRoutes()).routes.find((r) => r.slug === built.slug)

    expect(summary?.graph.steps).toHaveLength(3)
    expect(summary?.stepCount).toBe(3)
    // Invariant 25 at the data layer: search and detail must not diverge.
    const detail = await getRouteBySlug(built.slug)
    expect(detail?.graph.steps.map((s) => s.id).sort()).toEqual(
      summary?.graph.steps.map((s) => s.id).sort(),
    )
  }, 60_000)

  it('offers only filter values that actually exist', async () => {
    await buildRoute()
    const options = await availableFilters()
    expect(options.origins).toContain('BD')
    expect(options.destinations.length).toBeGreaterThan(0)
  }, 60_000)

  /**
   * **Paging must not lose a route or show one twice** — Phase 12D.
   *
   * Before this, search returned every match: 359 ribbons on one page on the test branch.
   * Adding `skip`/`take` to a query whose ordering is not a *total* order is the classic way
   * to introduce a silent data bug — rows the database is free to order either way can land
   * on two pages, or on none. Routes built in one transaction share `createdAt` to the
   * millisecond, which this suite does constantly, so the tie-break on `id` is load-bearing
   * rather than tidiness.
   *
   * Walking every page and comparing the union to the total is the assertion that catches
   * both failure modes at once.
   */
  it('pages without losing or repeating a route', async () => {
    const destination = `PG${Date.now() % 100000}`.slice(0, 6)
    const wanted = ROUTES_PER_PAGE + 3
    for (let i = 0; i < wanted; i += 1) await buildRoute({ destination })

    const first = await searchRoutes({ destinationCountry: destination })
    expect(first.total).toBe(wanted)
    expect(first.pageCount).toBe(2)
    expect(first.routes).toHaveLength(ROUTES_PER_PAGE)
    expect(first.page).toBe(1)

    const seen: string[] = []
    for (let page = 1; page <= first.pageCount; page += 1) {
      const result = await searchRoutes({ destinationCountry: destination }, new Date(), page)
      expect(result.page).toBe(page)
      seen.push(...result.routes.map((r) => r.slug))
    }

    expect(seen).toHaveLength(wanted)
    expect(new Set(seen).size, 'a route appeared on two pages').toBe(wanted)
  }, 180_000)

  /**
   * `?page=` is user input and reaches this function unvalidated. Every one of these should
   * land on a real page rather than on an empty result, a negative `skip`, or an error.
   */
  it('clamps a page number that is out of range, negative or nonsense', async () => {
    const destination = `CL${Date.now() % 100000}`.slice(0, 6)
    await buildRoute({ destination })

    for (const requested of [0, -5, 1000, Number.NaN]) {
      const result = await searchRoutes({ destinationCountry: destination }, new Date(), requested)
      expect(result.page, `page=${requested}`).toBe(1)
      expect(result.routes).toHaveLength(1)
    }
  }, 120_000)

  it('returns an empty list rather than throwing when nothing matches', async () => {
    const empty = await searchRoutes({ destinationCountry: 'ZZ' })
    expect(empty.routes).toEqual([])
    expect(empty.total).toBe(0)
    // Phase 12D: a page count of 1 rather than 0 for no results, so the page can always say
    // "Page 1 of 1" instead of "Page 1 of 0", which reads like a fault.
    expect(empty.pageCount).toBe(1)
  }, 60_000)
})

describe.skipIf(!url)('a route reads as a road, its steps and their fields', () => {
  it('loads by slug with steps and field counts', async () => {
    const built = await buildRoute()
    const route = await getRouteBySlug(built.slug)

    expect(route?.title).toBe('Readable route')
    expect(route?.steps).toHaveLength(3)
    expect(route?.steps.find((s) => s.id === built.langStepId)?.fieldCount).toBe(1)
  }, 60_000)

  it('returns null for a slug that does not exist, rather than throwing', async () => {
    expect(await getRouteBySlug('no-such-route-anywhere')).toBeNull()
  }, 60_000)

  it('shows every field with where its value came from (invariant 11)', async () => {
    const built = await buildRoute()
    const fields = await getStepFields(built.langStepId)

    expect(fields).toHaveLength(1)
    expect(fields[0]?.valueText).toBe('Overall band 6.5')
    // An official requirement and a community experience must never look alike.
    expect(fields[0]?.sourceClass).toBe(SourceClass.official)
    expect(fields[0]?.sourceUrl).toBe('https://example.org/language-requirement')
  }, 60_000)

  it('hides archived content from the current view (invariant 4)', async () => {
    const built = await buildRoute()
    await archiveField({ actor, fieldId: built.fieldId, reason: 'obsolete' })
    expect(await getStepFields(built.langStepId)).toHaveLength(0)

    await archiveStep({ actor, stepId: built.langStepId, reason: 'replaced' })
    const route = await getRouteBySlug(built.slug)
    expect(route?.steps.map((s) => s.id)).not.toContain(built.langStepId)
    expect(route?.graph.steps.map((s) => s.id)).not.toContain(built.langStepId)
  }, 60_000)

  it('counts every version of a field, so instability is visible later', async () => {
    const built = await buildRoute()
    await reviseField({
      actor, fieldId: built.fieldId, valueText: 'Overall band 7.0',
      sourceClass: SourceClass.official, reason: 'raised',
    })

    const fields = await getStepFields(built.langStepId)
    expect(fields[0]?.valueText).toBe('Overall band 7.0')
    expect(fields[0]?.revisionCount).toBe(2)
  }, 60_000)
})

describe.skipIf(!url)('history is readable without an account (FR-08, FR-31)', () => {
  it('returns route, step and field revisions newest first', async () => {
    const built = await buildRoute()
    await reviseField({
      actor, fieldId: built.fieldId, valueText: 'Overall band 7.0',
      sourceClass: SourceClass.official, reason: 'University raised the minimum',
    })

    const history = await getRouteHistory(built.routeId)
    expect(history.length).toBeGreaterThan(4)
    expect(new Set(history.map((h) => h.kind))).toEqual(new Set(['route', 'step', 'field']))

    const times = history.map((h) => h.createdAt.getTime())
    expect([...times].sort((a, b) => b - a)).toEqual(times)

    // The reason a contributor gave is part of the record, not metadata thrown away.
    expect(history.some((h) => h.reason === 'University raised the minimum')).toBe(true)
  }, 60_000)

  it('keeps archived content in history — that is the difference from deletion', async () => {
    const built = await buildRoute()
    await archiveField({ actor, fieldId: built.fieldId, reason: 'obsolete' })

    const history = await getRouteHistory(built.routeId)
    expect(history.some((h) => h.value === 'Overall band 6.5')).toBe(true)
  }, 60_000)
})

describe.skipIf(!url)('expected fly window is a range, never a date (invariant 16)', () => {
  it('derives a window from the route timing', async () => {
    const built = await buildRoute()
    const route = await getRouteBySlug(built.slug)
    expect(route?.flyWindow).not.toBeNull()

    const w = route?.flyWindow
    if (!w) throw new Error('expected a window')

    // A window, not a point: the end must be strictly later than the start.
    const fromIndex = w.from.year * 12 + w.from.month
    const toIndex = w.to.year * 12 + w.to.month
    expect(toIndex).toBeGreaterThan(fromIndex)
  }, 60_000)

  it('does not sum overlapping steps', async () => {
    const built = await buildRoute()
    const route = await getRouteBySlug(built.slug)
    if (!route) throw new Error('expected a route')

    // Documents (30d) and language (60d) both start on day 0, then departure (7d).
    // Flattened that would be 97 days; the real span is 67.
    expect(route.flyWindow?.estimatedDays).toBe(67)
  }, 60_000)

  it('returns null rather than inventing a window when there is no timing', () => {
    const graph = {
      steps: [
        { id: 'a', label: 'A', category: StepCategory.documents_preparation, archived: false, earliestStartOffsetDays: null, typicalDurationDays: null },
        { id: 'b', label: 'B', category: StepCategory.travel_departure, archived: false, earliestStartOffsetDays: null, typicalDurationDays: null },
      ],
      edges: [{ id: 'e', fromStepId: 'a', toStepId: 'b', kind: StepEdgeKind.sequential, archived: false }],
    }
    expect(expectedFlyWindow(graph)).toBeNull()
  })
})
