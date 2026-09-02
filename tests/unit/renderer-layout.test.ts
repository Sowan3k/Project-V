import { describe, expect, it } from 'vitest'

import { StepCategory, StepEdgeKind } from '../../src/domain/enums'
import type { GraphEdge, GraphStep, RouteGraph } from '../../src/domain/graph/types'
import { RIBBON, ROAD, ROAD_NARROW, layout, type Density } from '../../src/renderer/layout'

/**
 * Phase 4 exit criteria, and Test.md tests 24, 24b, 25 and 25b.
 *
 * These are the assertions that make invariants 24 and 25 true by construction rather than
 * by review. They also carry across the four defects Spike A found — every one of which was
 * invisible until something asserted it (Test.md §7).
 */

const CATEGORIES = [
  StepCategory.documents_preparation,
  StepCategory.language_testing,
  StepCategory.admission_university,
  StepCategory.funding_scholarship,
  StepCategory.immigration_visa,
  StepCategory.travel_departure,
] as const

function step(id: string, over: Partial<GraphStep> = {}): GraphStep {
  return {
    id,
    label: `Step ${id}`,
    category: StepCategory.documents_preparation,
    archived: false,
    earliestStartOffsetDays: null,
    typicalDurationDays: null,
    ...over,
  }
}

function edge(id: string, from: string, to: string, over: Partial<GraphEdge> = {}): GraphEdge {
  return { id, fromStepId: from, toStepId: to, kind: StepEdgeKind.sequential, archived: false, ...over }
}

/** The Phase 1 stress fixtures, reimplemented against the production renderer (Test.md §7). */
const FIXTURES: Record<string, RouteGraph> = {
  'F1 tiny3': {
    steps: [step('a'), step('b'), step('c')],
    edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
  },
  'F2 linear4': {
    steps: [step('a'), step('b'), step('c'), step('d')],
    edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'c', 'd')],
  },
  'F3 optionalBranch': {
    steps: [step('a'), step('opt'), step('b'), step('c')],
    edges: [
      edge('e1', 'a', 'b'),
      edge('e2', 'a', 'opt', { kind: StepEdgeKind.optional_branch }),
      edge('e3', 'opt', 'b', { kind: StepEdgeKind.rejoin }),
      edge('e4', 'b', 'c'),
    ],
  },
  'F4 alternativeBranch': {
    steps: [step('a'), step('ielts'), step('pte'), step('b'), step('c')],
    edges: [
      edge('e1', 'a', 'ielts', { kind: StepEdgeKind.alternative }),
      edge('e2', 'a', 'pte', { kind: StepEdgeKind.alternative }),
      edge('e3', 'ielts', 'b', { kind: StepEdgeKind.rejoin }),
      edge('e4', 'pte', 'b', { kind: StepEdgeKind.rejoin }),
      edge('e5', 'b', 'c'),
    ],
  },
  'F5 parallelActivities': {
    steps: [step('a'), step('p1'), step('p2'), step('p3'), step('b'), step('c')],
    edges: [
      edge('e1', 'a', 'p1'),
      edge('e2', 'a', 'p2'),
      edge('e3', 'a', 'p3'),
      edge('e4', 'p1', 'b', { kind: StepEdgeKind.rejoin }),
      edge('e5', 'p2', 'b', { kind: StepEdgeKind.rejoin }),
      edge('e6', 'p3', 'b', { kind: StepEdgeKind.rejoin }),
      edge('e7', 'b', 'c'),
    ],
  },
  'F6 rejoiningBranch': {
    steps: [step('a'), step('b'), step('x'), step('y'), step('c'), step('d')],
    edges: [
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'x', { kind: StepEdgeKind.alternative }),
      edge('e3', 'b', 'y', { kind: StepEdgeKind.alternative }),
      edge('e4', 'x', 'c', { kind: StepEdgeKind.rejoin }),
      edge('e5', 'y', 'c', { kind: StepEdgeKind.rejoin }),
      edge('e6', 'c', 'd'),
    ],
  },
  'F7 evolvedRoute': {
    steps: [
      step('a'),
      step('lang'),
      step('old', { archived: true }),
      step('new'),
      step('b'),
      step('c'),
    ],
    edges: [
      edge('e1', 'a', 'lang'),
      edge('e2', 'lang', 'b'),
      edge('e3', 'b', 'old', { kind: StepEdgeKind.optional_branch, archived: true }),
      edge('e4', 'b', 'new'),
      edge('e5', 'new', 'c'),
    ],
  },
  'F8 wrapping15': {
    steps: Array.from({ length: 15 }, (_, i) =>
      step(`s${String(i + 1).padStart(2, '0')}`, { category: CATEGORIES[i % 6] }),
    ),
    edges: Array.from({ length: 14 }, (_, i) =>
      edge(`e${i}`, `s${String(i + 1).padStart(2, '0')}`, `s${String(i + 2).padStart(2, '0')}`),
    ),
  },
  'F9 large20': {
    steps: Array.from({ length: 20 }, (_, i) =>
      step(`n${String(i + 1).padStart(2, '0')}`, { category: CATEGORIES[i % 6] }),
    ),
    edges: Array.from({ length: 19 }, (_, i) =>
      edge(`e${i}`, `n${String(i + 1).padStart(2, '0')}`, `n${String(i + 2).padStart(2, '0')}`),
    ),
  },
}

const ALL = Object.entries(FIXTURES)
const DENSITIES: [string, Density][] = [
  ['ROAD', ROAD],
  ['ROAD_NARROW', ROAD_NARROW],
  ['RIBBON', RIBBON],
]

describe('25 — ribbon and road derive from one layout pass', () => {
  it.each(ALL)('%s — every density agrees on step count and order', (_name, graph) => {
    const active = graph.steps.filter((s) => !s.archived).length
    const orders = DENSITIES.map(([, density]) => layout(graph, density).order)

    for (const order of orders) expect(order).toHaveLength(active)
    // The decisive assertion: not merely the same count, the same sequence.
    expect(orders[1]).toEqual(orders[0])
    expect(orders[2]).toEqual(orders[0])
  })

  it('25b — adding a step changes every density, with no separate work', () => {
    const before: RouteGraph = {
      steps: [step('a'), step('b')],
      edges: [edge('e1', 'a', 'b')],
    }
    const after: RouteGraph = {
      steps: [...before.steps, step('c')],
      edges: [...before.edges, edge('e2', 'b', 'c')],
    }

    for (const [, density] of DENSITIES) {
      expect(layout(before, density).order).toHaveLength(2)
      expect(layout(after, density).order).toHaveLength(3)
    }
  })

  it('the ribbon never wraps, however long the route', () => {
    const graph = FIXTURES['F9 large20']
    expect(graph).toBeDefined()
    expect(layout(graph as RouteGraph, RIBBON).rowCount).toBe(1)
  })

  it('the road wraps once a route outgrows a row (VR-04)', () => {
    const graph = FIXTURES['F8 wrapping15']
    expect(graph).toBeDefined()
    expect(layout(graph as RouteGraph, ROAD).rowCount).toBeGreaterThan(1)
  })
})

describe('24 — structural equivalence across destinations', () => {
  /** Same shape, different ids, labels and categories. Geometry must be identical. */
  function twin(graph: RouteGraph): RouteGraph {
    return {
      steps: graph.steps.map((s) => ({
        ...s,
        id: `twin-${s.id}`,
        label: `Ganz anderer ${s.label}`,
        category: StepCategory.immigration_visa,
      })),
      edges: graph.edges.map((e) => ({
        ...e,
        id: `twin-${e.id}`,
        fromStepId: `twin-${e.fromStepId}`,
        toStepId: `twin-${e.toStepId}`,
      })),
    }
  }

  it.each(ALL)('%s — a structural twin lays out identically', (_name, graph) => {
    const a = layout(graph, ROAD)
    const b = layout(twin(graph), ROAD)

    expect(b.width).toBe(a.width)
    expect(b.height).toBe(a.height)
    expect(b.rowCount).toBe(a.rowCount)

    // Positions only. If any destination-, id- or label-specific logic existed, this fails.
    const geometry = (l: typeof a) =>
      l.nodes.map((n) => ({ rank: n.rank, lane: n.lane, x: n.x, y: n.y, ordinal: n.ordinal }))
    expect(geometry(b)).toEqual(geometry(a))
    expect(b.edges.map((e) => e.path)).toEqual(a.edges.map((e) => e.path))
  })

  it('is independent of the order steps and edges arrive in', () => {
    const graph = FIXTURES['F5 parallelActivities'] as RouteGraph
    const shuffled: RouteGraph = {
      steps: [...graph.steps].reverse(),
      edges: [...graph.edges].reverse(),
    }
    expect(layout(shuffled, ROAD).order).toEqual(layout(graph, ROAD).order)
  })

  it('is deterministic across repeated calls', () => {
    const graph = FIXTURES['F8 wrapping15'] as RouteGraph
    const runs = Array.from({ length: 3 }, () => layout(graph, ROAD).nodes.map((n) => `${n.x},${n.y}`))
    expect(runs[1]).toEqual(runs[0])
    expect(runs[2]).toEqual(runs[0])
  })
})

describe('24b — generative coverage over shapes nobody special-cased', () => {
  function makeRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
  }

  function randomGraph(seed: number): RouteGraph {
    const rand = makeRandom(seed)
    const count = 3 + Math.floor(rand() * 18)
    const kinds = [
      StepEdgeKind.sequential,
      StepEdgeKind.optional_branch,
      StepEdgeKind.alternative,
      StepEdgeKind.rejoin,
    ] as const

    const steps = Array.from({ length: count }, (_, i) =>
      step(`g${String(i).padStart(2, '0')}`, {
        category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)] ?? CATEGORIES[0],
        archived: rand() < 0.12,
      }),
    )
    // Every node attaches to an earlier one, which keeps the graph acyclic by construction.
    const edges = Array.from({ length: count - 1 }, (_, i) =>
      edge(
        `ge${i}`,
        `g${String(Math.floor(rand() * (i + 1))).padStart(2, '0')}`,
        `g${String(i + 1).padStart(2, '0')}`,
        { kind: kinds[Math.floor(rand() * kinds.length)] ?? StepEdgeKind.sequential },
      ),
    )
    return { steps, edges }
  }

  const seeds = Array.from({ length: 60 }, (_, i) => i + 1)

  it.each(seeds)('seed %i lays out validly at every density', (seed) => {
    const graph = randomGraph(seed)

    for (const [name, density] of DENSITIES) {
      const frame = layout(graph, density)
      const active = graph.steps.filter((s) => !s.archived)

      expect(frame.nodes, `${name}`).toHaveLength(active.length)
      expect(new Set(frame.order).size).toBe(active.length)

      for (const node of frame.nodes) {
        // The full box, not the centre point. A dense lane fan once pushed markers to
        // negative y where they were silently clipped (Spike A, seed 56).
        expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true)
        expect(node.x - node.width / 2).toBeGreaterThanOrEqual(0)
        expect(node.y - node.height / 2).toBeGreaterThanOrEqual(0)
        expect(node.x + node.width / 2).toBeLessThanOrEqual(frame.width)
        expect(node.y + node.height / 2).toBeLessThanOrEqual(frame.height)
      }

      // No two markers may overlap. At ribbon density the lane gap was once smaller than the
      // marker height, so concurrent steps stacked and the ribbon showed fewer steps than
      // the road — a correctness bug exactly where invariant 25 lives.
      for (let i = 0; i < frame.nodes.length; i += 1) {
        for (let j = i + 1; j < frame.nodes.length; j += 1) {
          const a = frame.nodes[i]
          const b = frame.nodes[j]
          if (!a || !b) continue
          const overlaps =
            Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
            Math.abs(a.y - b.y) < (a.height + b.height) / 2
          expect(overlaps, `${name}: ${a.step.id} overlaps ${b.step.id}`).toBe(false)
        }
      }

      // Connectors must stay on the canvas too. Wrap hooks once overshot and were clipped.
      for (const placed of frame.edges) {
        expect(placed.path).not.toContain('NaN')
        const numbers = (placed.path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
        numbers.forEach((value, index) => {
          const limit = index % 2 === 0 ? frame.width : frame.height
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(limit)
        })
      }
    }
  })
})

describe('the hard shapes produce the structure they claim', () => {
  it('places concurrent activities on separate lanes at the same rank', () => {
    const frame = layout(FIXTURES['F5 parallelActivities'] as RouteGraph, ROAD)
    const lanes = frame.nodes.filter((n) => ['p1', 'p2', 'p3'].includes(n.step.id))
    expect(lanes).toHaveLength(3)
    expect(new Set(lanes.map((n) => n.rank)).size).toBe(1)
    expect(new Set(lanes.map((n) => n.y)).size).toBe(3)
  })

  it('places a rejoin target after every branch that reaches it', () => {
    const frame = layout(FIXTURES['F4 alternativeBranch'] as RouteGraph, ROAD)
    const rank = (id: string) => frame.nodes.find((n) => n.step.id === id)?.rank
    expect(rank('ielts')).toBe(rank('pte'))
    expect(rank('b')).toBeGreaterThan(rank('ielts') as number)
  })

  it('drops archived steps from the current visual but keeps the rest intact', () => {
    const frame = layout(FIXTURES['F7 evolvedRoute'] as RouteGraph, ROAD)
    expect(frame.order).not.toContain('old')
    expect(frame.order).toContain('new')
  })

  it('has no upper limit on step count', () => {
    // "3-20 steps" in Phases.md is the range the plan expected, not a cap the renderer
    // imposes. Nothing in the layout bounds it: the road adds rows and the ribbon grows
    // wider. Verified here rather than assumed, because a route that silently broke at
    // step 21 would be discovered by a contributor, not by us.
    for (const count of [21, 30, 60, 100]) {
      const steps = Array.from({ length: count }, (_, i) =>
        step(`x${String(i).padStart(3, '0')}`, { category: CATEGORIES[i % 6] }),
      )
      const edges = Array.from({ length: count - 1 }, (_, i) =>
        edge(`xe${i}`, `x${String(i).padStart(3, '0')}`, `x${String(i + 1).padStart(3, '0')}`),
      )
      const graph: RouteGraph = { steps, edges }

      for (const [name, density] of DENSITIES) {
        const frame = layout(graph, density)
        expect(frame.order, `${name} at ${count} steps`).toHaveLength(count)

        for (const node of frame.nodes) {
          expect(node.x - node.width / 2).toBeGreaterThanOrEqual(0)
          expect(node.y - node.height / 2).toBeGreaterThanOrEqual(0)
          expect(node.x + node.width / 2).toBeLessThanOrEqual(frame.width)
          expect(node.y + node.height / 2).toBeLessThanOrEqual(frame.height)
        }
      }

      // The ribbon stays one line however long the route, which is what makes it a ribbon.
      expect(layout(graph, RIBBON).rowCount).toBe(1)
    }
  })

  it('fits a 15-step route inside 360px at the narrow density', () => {
    // The whole mobile strategy: a density constant, not a second renderer.
    const frame = layout(FIXTURES['F8 wrapping15'] as RouteGraph, ROAD_NARROW)
    expect(frame.width).toBeLessThanOrEqual(360)
    expect(frame.rowCount).toBeGreaterThan(3)
  })

  it('handles an empty route without throwing', () => {
    const frame = layout({ steps: [], edges: [] }, ROAD)
    expect(frame.nodes).toEqual([])
    expect(frame.width).toBeGreaterThan(0)
  })
})
