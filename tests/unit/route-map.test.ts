import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RouteMap } from '../../src/components/route-map'
import { RouteRibbon } from '../../src/components/route-ribbon'
import { JourneyStepStatus, RouteLifecycleState, RouteMechanism, StepCategory, StudyLevel } from '../../src/domain/enums'
import { en } from '../../src/i18n/dictionaries/en'
import type { RouteSummary } from '../../src/server/routes/read'

/** Presentation fixtures only. No country requirements or live route records are invented. */
const route: RouteSummary = {
  id: 'presentation-route',
  slug: 'presentation-route',
  title: 'A route with a meaningful process',
  summary: null,
  originCountry: 'BD',
  destinationCountry: 'DE',
  studyLevel: StudyLevel.masters,
  intake: null,
  mechanism: null,
  lifecycleState: RouteLifecycleState.experimental,
  createdAt: new Date('2026-09-05T00:00:00Z'),
  graph: {
    steps: [{
      id: 'documents',
      label: 'Prepare your documents',
      category: StepCategory.documents_preparation,
      archived: false,
      earliestStartOffsetDays: null,
      typicalDurationDays: null,
    }],
    edges: [],
  },
  stepCount: 1,
  flyWindow: null,
  trust: {
    lifecycleState: RouteLifecycleState.experimental,
    informationCount: 0,
    confirmedCount: 0,
    needsReviewCount: 0,
    disputedCount: 0,
    quarantinedCount: 0,
  },
}

describe('the route wayfinding surface', () => {
  it('uses the provided route endpoints and keeps the existing generic renderer', () => {
    const html = renderToStaticMarkup(createElement(RouteMap, { route, dictionary: en }))
    expect(html).toContain('BD')
    expect(html).toContain('DE')
    expect(html).toContain('Prepare your documents')
    expect(html).toContain(en.route.mapGuide)
    expect(html).toContain('<svg')
    expect(html).not.toContain(en.flyWindow.label)
  })

  it('keeps selected stations as real deep links without introducing a form or script', () => {
    const href = '/en/routes/presentation-route?step=documents#route-step-info'
    const html = renderToStaticMarkup(createElement(RouteMap, {
      route,
      dictionary: en,
      selectedStepId: 'documents',
      stepHrefs: { documents: href },
    }))
    expect(html).toContain(`href="${href}"`)
    expect(html).toContain(en.route.selectedStep)
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<script')
  })

  it('adds private progress only when explicitly supplied by the journey surface', () => {
    const publicHtml = renderToStaticMarkup(createElement(RouteMap, { route, dictionary: en }))
    const privateHtml = renderToStaticMarkup(createElement(RouteMap, {
      route,
      dictionary: en,
      privateJourney: true,
      stepHrefs: { documents: '#journey-step-documents' },
      annotations: { progressByStep: { documents: JourneyStepStatus.completed } },
    }))
    expect(publicHtml).not.toContain(en.journey.mapGuide)
    expect(publicHtml).not.toContain(en.journeyStepStatus.completed)
    expect(privateHtml).toContain(en.journey.mapGuide)
    expect(privateHtml).toContain(en.journeyStepStatus.completed)
    expect(privateHtml).toContain('href="#journey-step-documents"')
  })

  it('shows stored process differences without manufacturing them for unknown routes', () => {
    const mechanism = RouteMechanism.direct_admission
    const html = renderToStaticMarkup(createElement(RouteRibbon, {
      route: { ...route, mechanism, intake: 'Example intake' },
      dictionary: en,
      locale: 'en',
    }))
    expect(html).toContain(en.routeMechanism[mechanism])
    expect(html).toContain('Example intake')
    expect(html).toContain(en.flyWindow.unknown)
    expect(html).toContain('href="/en/routes/presentation-route"')

    const unknown = renderToStaticMarkup(createElement(RouteRibbon, { route, dictionary: en, locale: 'en' }))
    expect(unknown).not.toContain(en.routeMechanism[mechanism])
    expect(unknown).not.toContain('Example intake')
  })
})
