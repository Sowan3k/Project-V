import { describe, expect, it } from 'vitest'

import { ALL_FIXTURES, wrapping15, wrapping15Twin } from './fixtures'
import { GraphError, layout, RIBBON, ROAD } from './layout'
import { renderRibbon, renderRoad } from './svg'
import type { EdgeKind, RouteGraph } from './types'

/**
 * Spike A — the structural half of the go/no-go.
 *
 * Legibility is answered by screenshots; these assertions answer the parts a human eye
 * cannot check reliably: that ribbon and road really do share one layout pass, that the
 * layout is blind to route identity, and that it does not fall over on shapes nobody
 * special-cased.
 *
 * These are the Phase 4 tests 24, 24b and 25 from Test.md, run early against throwaway
 * code — which is the entire point of a kill spike.
 */
describe('spike A — ribbon and road are one representation at two densities', () => {
  it.each(ALL_FIXTURES.map((f) => [f.title, f] as const))(
    '%s — ribbon and road agree on step count and order',
    (_title, graph) => {
      const road = layout(graph, ROAD)
      const ribbon = layout(graph, RIBBON)

      expect(ribbon.order).toEqual(road.order)
      expect(ribbon.nodes).toHaveLength(graph.steps.length)
      expect(road.nodes).toHaveLength(graph.steps.length)
    },
  )

  it('a step added to a route appears in both densities with no separate work', () => {
    const base: RouteGraph = {
      id: 'r',
      title: 'r',
      destination: 'X',
      steps: [
        { id: 'a', label: 'A', category: 'documents' },
        { id: 'b', label: 'B', category: 'travel' },
      ],
      edges: [{ from: 'a', to: 'b', kind: 'sequential' }],
    }
    const grown: RouteGraph = {
      ...base,
      steps: [...base.steps, { id: 'c', label: 'C', category: 'immigration' }],
      edges: [...base.edges, { from: 'b', to: 'c', kind: 'sequential' }],
    }

    expect(layout(base, ROAD).order).toHaveLength(2)
    expect(layout(base, RIBBON).order).toHaveLength(2)
    expect(layout(grown, ROAD).order).toHaveLength(3)
    expect(layout(grown, RIBBON).order).toHaveLength(3)
  })
})

describe('spike A — the layout is blind to route identity (invariant 24)', () => {
  it('structural equivalence: same shape, different destination and ids, identical geometry', () => {
    const a = layout(wrapping15, ROAD)
    const b = layout(wrapping15Twin, ROAD)

    expect(b.width).toBe(a.width)
    expect(b.height).toBe(a.height)
    expect(b.rowCount).toBe(a.rowCount)

    // Geometry compared with labels and ids stripped — only positions may be inspected.
    const geometry = (l: typeof a) =>
      l.nodes.map((n) => ({ rank: n.rank, lane: n.lane, x: n.x, y: n.y }))
    expect(geometry(b)).toEqual(geometry(a))
    expect(b.edges.map((e) => e.path)).toEqual(a.edges.map((e) => e.path))
  })

  it('is deterministic — the same graph lays out identically every time', () => {
    const runs = Array.from({ length: 3 }, () => layout(wrapping15, ROAD).nodes.map((n) => n.x + n.y))
    expect(runs[1]).toEqual(runs[0])
    expect(runs[2]).toEqual(runs[0])
  })
})

describe('spike A — generative coverage over shapes nobody special-cased', () => {
  /** Deterministic PRNG so a failure is reproducible from its seed. */
  function makeRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
  }

  function randomGraph(seed: number): RouteGraph {
    const rand = makeRandom(seed)
    const count = 3 + Math.floor(rand() * 18) // 3..20 primary steps
    const categories = ['documents', 'language', 'admission', 'funding', 'immigration', 'travel'] as const
    const states = ['current', 'current', 'current', 'archived', 'added'] as const

    const steps = Array.from({ length: count }, (_, i) => ({
      id: `g${i}`,
      label: `Stage ${i}`,
      category: categories[Math.floor(rand() * categories.length)] ?? 'documents',
      state: states[Math.floor(rand() * states.length)] ?? 'current',
    }))

    const edges: { from: string; to: string; kind: EdgeKind }[] = []
    for (let i = 1; i < count; i += 1) {
      // Always attach to an earlier node, which keeps the graph acyclic by construction.
      const parent = Math.floor(rand() * i)
      const kinds = ['sequential', 'optional_branch', 'alternative', 'rejoin'] as const
      edges.push({
        from: `g${parent}`,
        to: `g${i}`,
        kind: kinds[Math.floor(rand() * kinds.length)] ?? 'sequential',
      })
    }

    return { id: `gen-${seed}`, title: `Generated ${seed}`, destination: 'Generated', steps, edges }
  }

  it.each(Array.from({ length: 60 }, (_, i) => i + 1))('seed %i renders to valid geometry', (seed) => {
    const graph = randomGraph(seed)

    for (const density of [ROAD, RIBBON]) {
      const frame = layout(graph, density)

      expect(frame.nodes).toHaveLength(graph.steps.length)
      expect(frame.order).toHaveLength(graph.steps.length)
      expect(new Set(frame.order).size).toBe(graph.steps.length)

      for (const node of frame.nodes) {
        expect(Number.isFinite(node.x)).toBe(true)
        expect(Number.isFinite(node.y)).toBe(true)
        // Every node must sit fully inside the canvas. Seed 56 originally failed here with
        // y = -21: a dense rank fanned its lanes past the top edge and would have been
        // clipped. Asserting the full box, not just the centre point, is what caught it.
        expect(node.x - node.width / 2).toBeGreaterThanOrEqual(0)
        expect(node.y - node.height / 2).toBeGreaterThanOrEqual(0)
        expect(node.x + node.width / 2).toBeLessThanOrEqual(frame.width)
        expect(node.y + node.height / 2).toBeLessThanOrEqual(frame.height)
      }
      // No two step markers may overlap. Found by eye first: at ribbon density the lane
      // gap was smaller than the marker height, so parallel activities stacked on top of
      // each other and the ribbon lied about how many steps there were.
      for (let i = 0; i < frame.nodes.length; i += 1) {
        for (let j = i + 1; j < frame.nodes.length; j += 1) {
          const a = frame.nodes[i]
          const b = frame.nodes[j]
          if (!a || !b) continue
          const overlaps =
            Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
            Math.abs(a.y - b.y) < (a.height + b.height) / 2
          expect(overlaps, `${a.step.id} overlaps ${b.step.id}`).toBe(false)
        }
      }

      // Connectors must stay on the canvas too. The wrap hooks originally overshot by a
      // fixed 40px and were clipped by the viewBox at both edges — visible in a screenshot,
      // invisible to every assertion until this one.
      for (const edge of frame.edges) {
        expect(edge.path).not.toContain('NaN')
        expect(edge.path).not.toContain('Infinity')

        const numbers = (edge.path.match(/-?d+(?:.d+)?/g) ?? []).map(Number)
        numbers.forEach((value, i) => {
          const limit = i % 2 === 0 ? frame.width : frame.height
          expect(value, `${edge.edge.from}->${edge.edge.to} leaves the canvas`).toBeGreaterThanOrEqual(0)
          expect(value, `${edge.edge.from}->${edge.edge.to} leaves the canvas`).toBeLessThanOrEqual(limit)
        })
      }
      expect(frame.width).toBeGreaterThan(0)
      expect(frame.height).toBeGreaterThan(0)
    }

    // And it must actually serialise.
    expect(renderRoad(graph)).toContain('<svg')
    expect(renderRibbon(graph)).toContain('<svg')
  })
})

describe('spike A — invalid graphs are rejected, not silently drawn', () => {
  const base = { id: 'x', title: 'x', destination: 'X' } as const

  it('rejects a cycle', () => {
    expect(() =>
      layout(
        {
          ...base,
          steps: [
            { id: 'a', label: 'A', category: 'documents' },
            { id: 'b', label: 'B', category: 'travel' },
          ],
          edges: [
            { from: 'a', to: 'b', kind: 'sequential' },
            { from: 'b', to: 'a', kind: 'sequential' },
          ],
        },
        ROAD,
      ),
    ).toThrow(GraphError)
  })

  it('rejects a dangling edge target', () => {
    expect(() =>
      layout(
        {
          ...base,
          steps: [{ id: 'a', label: 'A', category: 'documents' }],
          edges: [{ from: 'a', to: 'nowhere', kind: 'rejoin' }],
        },
        ROAD,
      ),
    ).toThrow(GraphError)
  })

  it('rejects an orphan step', () => {
    expect(() =>
      layout(
        {
          ...base,
          steps: [
            { id: 'a', label: 'A', category: 'documents' },
            { id: 'b', label: 'B', category: 'travel' },
            { id: 'lonely', label: 'Lonely', category: 'funding' },
          ],
          edges: [{ from: 'a', to: 'b', kind: 'sequential' }],
        },
        ROAD,
      ),
    ).toThrow(GraphError)
  })
})

describe('spike A — the hard shapes produce the structure they claim', () => {
  it('parallel activities share a rank rather than flattening into a line', () => {
    const graph = ALL_FIXTURES.find((f) => f.id === 'fx-parallel')
    expect(graph).toBeDefined()
    const frame = layout(graph as RouteGraph, ROAD)

    const lanes = frame.nodes.filter((n) => ['p1', 'p2', 'p3'].includes(n.step.id))
    expect(lanes).toHaveLength(3)
    expect(new Set(lanes.map((n) => n.rank)).size).toBe(1)
    // Concurrent steps must be visually separated, or "parallel" is a lie.
    expect(new Set(lanes.map((n) => n.y)).size).toBe(3)
  })

  it('a rejoin places the shared step after both alternatives', () => {
    const graph = ALL_FIXTURES.find((f) => f.id === 'fx-alternative')
    expect(graph).toBeDefined()
    const frame = layout(graph as RouteGraph, ROAD)
    const rank = (id: string) => frame.nodes.find((n) => n.step.id === id)?.rank

    expect(rank('ielts')).toBe(rank('pte'))
    expect(rank('b')).toBeGreaterThan(rank('ielts') as number)
  })

  it('a 15-step route wraps across rows', () => {
    expect(layout(wrapping15, ROAD).rowCount).toBeGreaterThan(1)
  })

  it('the ribbon never wraps, however long the route is', () => {
    expect(layout(wrapping15, RIBBON).rowCount).toBe(1)
  })
})
