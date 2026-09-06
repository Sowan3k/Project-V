import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { rendererStrings } from '../../src/components/route-shared'
import { JOURNEY_STEP_STATUSES, JourneyStepStatus, StepCategory, StepEdgeKind } from '../../src/domain/enums'
import type { GraphEdge, GraphStep, RouteGraph } from '../../src/domain/graph/types'
import { en } from '../../src/i18n/dictionaries/en'
import { layout, ROAD, ROAD_NARROW } from '../../src/renderer/layout'
import { CATEGORY_STYLE } from '../../src/renderer/primitives'
import { Ribbon, Road, type RouteVisualProps } from '../../src/renderer/route-visual'

/**
 * Render the actual components, not their source text. These supplement the generative
 * geometry tests: correct coordinates alone cannot prove readable labels, working stage
 * links or separation of private progress from category/trust (FR-04–06, FR-26, FR-57).
 * Browser keyboard/viewport checks live in e2e/presentation.spec.ts; no snapshots claim
 * to establish visual quality here.
 */
const strings = rendererStrings(en)
const categories = [
  StepCategory.documents_preparation,
  StepCategory.language_testing,
  StepCategory.admission_university,
  StepCategory.funding_scholarship,
  StepCategory.immigration_visa,
  StepCategory.travel_departure,
] as const
const labels = [
  'Prepare documents', 'Language requirements', 'University application',
  'Financial proof', 'Visa application', 'Prepare to travel',
]

function step(id: string, over: Partial<GraphStep> = {}): GraphStep {
  return {
    id, label: id, category: StepCategory.documents_preparation, archived: false,
    earliestStartOffsetDays: null, typicalDurationDays: null, ...over,
  }
}

function edge(id: string, fromStepId: string, toStepId: string, kind: GraphEdge['kind'] = StepEdgeKind.sequential): GraphEdge {
  return { id, fromStepId, toStepId, kind, archived: false }
}

function linear(count: number): RouteGraph {
  const steps = Array.from({ length: count }, (_, i) => step(`stage-${i}`, {
    label: labels[i] ?? `Stage ${i + 1}`,
    category: categories[i % categories.length],
  }))
  return {
    steps,
    edges: steps.slice(1).map((s, i) => edge(`edge-${i}`, `stage-${i}`, s.id)),
  }
}

function road(props: Partial<RouteVisualProps> = {}, density = ROAD): string {
  return renderToStaticMarkup(createElement(Road, { graph: linear(6), strings, ...props, density }))
}

/** Exclude accessible-only SVG titles before asserting that words are actually painted. */
function paintedText(markup: string): string {
  return markup.replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function stageIds(markup: string): string[] {
  return [...markup.matchAll(/<g\b[^>]*data-step-id="([^"]+)"/g)].map((m) => m[1]!)
}

function hrefs(graph: RouteGraph): Record<string, string> {
  return Object.fromEntries(graph.steps.map((s) => [s.id, `/en/routes/example?step=${s.id}#route-step-info`]))
}

describe('a Ribbon retains readable stages at both densities', () => {
  it.each([6, 20])('paints every label in a %i-stage Ribbon, including the phone version', (count) => {
    const graph = linear(count)
    const markup = renderToStaticMarkup(createElement(Ribbon, { graph, strings }))
    const drawings = [...markup.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((m) => m[0])
    expect(drawings).toHaveLength(2)
    for (const drawing of drawings) {
      expect(stageIds(drawing)).toEqual(layout(graph, ROAD).order)
      for (const s of graph.steps) expect(paintedText(drawing)).toContain(s.label)
      expect(drawing).toContain('data-route-visual="ribbon"')
      const accessibleName = drawing.match(/aria-label="([^"]+)"/)?.[1] ?? ''
      for (const s of graph.steps) expect(accessibleName).toContain(s.label)
      expect(drawing).not.toContain('<a ')
    }
  })

  it('omits archived stages in both representations rather than offering dead links', () => {
    const graph: RouteGraph = { steps: [step('current'), step('retired', { archived: true })], edges: [] }
    const markup = road({ graph, stepHrefs: hrefs(graph) })
    expect(stageIds(markup)).toEqual(['current'])
    expect(markup).not.toContain('?step=retired')
    const ribbon = renderToStaticMarkup(createElement(Ribbon, { graph, strings }))
    expect(stageIds(ribbon)).toEqual(['current', 'current'])
  })
})

describe('the Road is navigable and selection stays attached to a stage', () => {
  it.each([ROAD, ROAD_NARROW])('exposes stage links as a group, with exactly one current stage', (density) => {
    const graph = linear(6)
    const markup = road({ graph, stepHrefs: hrefs(graph), selectedStepId: 'stage-2' }, density)
    expect(markup).toMatch(/^<svg[^>]*role="group"/)
    expect([...markup.matchAll(/<a\s/g)]).toHaveLength(6)
    expect([...markup.matchAll(/aria-current="step"/g)]).toHaveLength(1)
    expect(markup).toMatch(/data-step-id="stage-2" data-selected="true"/)
    for (const s of graph.steps) {
      expect(markup).toContain(`href="${hrefs(graph)[s.id]}"`)
      expect(markup).toContain(`${s.label} — ${strings.categories[s.category]}`)
    }
  })

  it('keeps a static Road an image with no pretend controls', () => {
    const markup = road()
    expect(markup).toMatch(/^<svg[^>]*role="img"/)
    expect(markup).not.toContain('<a ')
    expect(markup).not.toContain('aria-current=')
  })

  it('does not mark an unknown requested stage as selected', () => {
    const graph = linear(2)
    const markup = road({ graph, stepHrefs: hrefs(graph), selectedStepId: 'not-in-this-route' })
    expect(markup).not.toContain('aria-current=')
    expect(markup).not.toContain('data-selected=')
  })

  it('keeps the complete accessible name when a long visible label must wrap or truncate', () => {
    const label = 'An unusually long institutional application procedure that exceeds any station width'
    const graph: RouteGraph = { steps: [step('long', { label })], edges: [] }
    const markup = road({ graph, stepHrefs: hrefs(graph) }, ROAD_NARROW)
    expect(markup).toContain(`1. ${label} — ${strings.categories[StepCategory.documents_preparation]}`)
    expect(paintedText(markup)).toContain('An unusually')
  })

  it('shows unknown timing honestly and formats only durations that exist', () => {
    const graph: RouteGraph = { steps: [step('unknown'), step('known', { typicalDurationDays: 21 })], edges: [] }
    const text = paintedText(road({ graph }))
    expect(text).toContain(strings.timingUnknown)
    expect(text).toContain(strings.duration(21))
    expect(text).not.toContain('0 days')
  })

  it('shows a stored start offset without inventing an offset for other stages', () => {
    const graph: RouteGraph = {
      steps: [step('scheduled', { earliestStartOffsetDays: 45, typicalDurationDays: 7 })],
      edges: [],
    }
    const text = paintedText(road({ graph }))
    expect(text).toContain(strings.startsAfter(45))
    expect(text).toContain(strings.duration(7))
    expect(paintedText(road({ graph: { steps: [step('unknown')], edges: [] } })))
      .not.toContain(strings.startsAfter(0))
  })
})

describe('private progress is an explicit overlay, never category or trust', () => {
  it.each(JOURNEY_STEP_STATUSES)('retains category colour and names the %s state', (status) => {
    const graph: RouteGraph = { steps: [step('personal')], edges: [] }
    const markup = road({ graph, annotations: { progressByStep: { personal: status } } })
    const category = CATEGORY_STYLE[StepCategory.documents_preparation]
    expect(markup).toContain(`fill="${category.fill}"`)
    expect(markup).toContain(`fill="${category.ink}"`)
    expect(paintedText(markup)).toContain(strings.progress[status])
    expect(paintedText(markup)).not.toMatch(/verified|approved|safe route/i)
  })

  it('does not retain private progress or selection in a subsequent public render', () => {
    const graph: RouteGraph = { steps: [step('personal')], edges: [] }
    road({ graph, selectedStepId: 'personal', annotations: { progressByStep: { personal: JourneyStepStatus.completed } } })
    const publicMarkup = road({ graph })
    for (const status of JOURNEY_STEP_STATUSES) expect(paintedText(publicMarkup)).not.toContain(strings.progress[status])
    expect(publicMarkup).not.toContain('data-selected=')
  })
})

describe('junction labels describe stored relationships', () => {
  function fan(kind: GraphEdge['kind']): RouteGraph {
    return {
      steps: [step('start'), step('left'), step('right'), step('finish')],
      edges: [
        edge('left-entry', 'start', 'left', kind), edge('right-entry', 'start', 'right', kind),
        edge('left-exit', 'left', 'finish', StepEdgeKind.rejoin),
        edge('right-exit', 'right', 'finish', StepEdgeKind.rejoin),
      ],
    }
  }

  it('names alternatives without claiming they are simultaneous work', () => {
    const text = paintedText(road({ graph: fan(StepEdgeKind.alternative) }))
    expect(text).toContain(strings.relationships.alternative)
    expect(text).not.toContain(strings.relationships.parallel)
  })

  it('names optional branches without claiming every student needs both', () => {
    const text = paintedText(road({ graph: fan(StepEdgeKind.optional_branch) }))
    expect(text).toContain(strings.relationships.optional)
    expect(text).not.toContain(strings.relationships.parallel)
  })

  it('names structurally independent sequential branches as parallel', () => {
    const text = paintedText(road({ graph: fan(StepEdgeKind.sequential) }))
    expect(text).toContain(strings.relationships.parallel)
    expect(text).not.toContain(strings.relationships.alternative)
  })

  it('does not infer parallel work from a mixed alternative/ordinary rank', () => {
    const original = fan(StepEdgeKind.alternative)
    const graph = { ...original, edges: original.edges.map((e) => e.id === 'left-entry' ? { ...e, kind: StepEdgeKind.sequential } : e) }
    const text = paintedText(road({ graph }))
    expect(text).toContain(strings.relationships.alternative)
    expect(text).not.toContain(strings.relationships.parallel)
  })

  it('does not turn sequential descendants of alternative arms into parallel work', () => {
    const graph: RouteGraph = {
      steps: ['start', 'left', 'right', 'left-next', 'right-next', 'finish'].map((id) => step(id)),
      edges: [
        edge('left-entry', 'start', 'left', StepEdgeKind.alternative),
        edge('right-entry', 'start', 'right', StepEdgeKind.alternative),
        edge('left-next-entry', 'left', 'left-next'),
        edge('right-next-entry', 'right', 'right-next'),
        edge('left-exit', 'left-next', 'finish', StepEdgeKind.rejoin),
        edge('right-exit', 'right-next', 'finish', StepEdgeKind.rejoin),
      ],
    }
    const text = paintedText(road({ graph }))
    expect(text).toContain(strings.relationships.alternative)
    expect(text).not.toContain(strings.relationships.parallel)
  })
})

describe('change overlays preserve the route beneath them', () => {
  it.each([ROAD, ROAD_NARROW])('contains a larger previous graph in the shared canvas', (density) => {
    const graph = linear(2)
    const shadow = linear(15)
    const markup = road({ graph, annotations: { shadow } }, density)
    const viewBox = markup.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
    expect(viewBox).not.toBeNull()
    expect(Number(viewBox![1])).toBeGreaterThanOrEqual(layout(shadow, density).width)
    expect(Number(viewBox![2])).toBeGreaterThanOrEqual(layout(shadow, density).height)
    expect(markup).toContain('data-route-layer="previous"')
    expect(stageIds(markup)).toEqual(layout(graph, density).order)
  })

  it.each(['addedStepIds', 'changedStepIds', 'archivedStepIds'] as const)('labels %s without removing the annotated stage', (annotation) => {
    const graph = linear(2)
    const markup = road({ graph, annotations: { [annotation]: ['stage-0'] } })
    const label = { addedStepIds: strings.added, changedStepIds: strings.changed, archivedStepIds: strings.archived }[annotation]
    expect(paintedText(markup)).toContain(label)
    expect(stageIds(markup)).toEqual(layout(graph, ROAD).order)
  })

  it('keeps disruptions distinct from permanent change annotations', () => {
    const graph = linear(2)
    const markup = road({ graph, annotations: { disruptedStepIds: ['stage-0'] } })
    expect(markup).toContain(`<title>${strings.disrupted}</title>`)
    expect(paintedText(markup)).not.toContain(strings.changed)
    expect(stageIds(markup)).toEqual(layout(graph, ROAD).order)
  })
})
