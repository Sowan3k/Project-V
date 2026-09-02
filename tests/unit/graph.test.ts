import { describe, expect, it } from 'vitest'

import { buildTimeline, rankSteps, stepOrder } from '../../src/domain/graph/order'
import { GraphValidationError, assertValidGraph, validateGraph } from '../../src/domain/graph/validate'
import type { GraphEdge, GraphStep, RouteGraph } from '../../src/domain/graph/types'

/**
 * Phase 2 — the graph rules, tested without a database.
 *
 * These are pure functions on purpose: they are the gate Phase 3's write service will call,
 * and the renderer will consume the same ordering. Keeping them database-free is what lets
 * both use them.
 */

function step(id: string, over: Partial<GraphStep> = {}): GraphStep {
  return {
    id,
    label: id,
    category: 'documents_preparation',
    archived: false,
    earliestStartOffsetDays: null,
    typicalDurationDays: null,
    ...over,
  }
}

function edge(id: string, from: string, to: string, over: Partial<GraphEdge> = {}): GraphEdge {
  return { id, fromStepId: from, toStepId: to, kind: 'sequential', archived: false, ...over }
}

/** docs → (ielts | pte) → admission → visa. A real alternative branch that reconverges. */
const branching: RouteGraph = {
  steps: [step('docs'), step('ielts'), step('pte'), step('adm'), step('visa')],
  edges: [
    edge('e1', 'docs', 'ielts', { kind: 'alternative' }),
    edge('e2', 'docs', 'pte', { kind: 'alternative' }),
    edge('e3', 'ielts', 'adm', { kind: 'rejoin' }),
    edge('e4', 'pte', 'adm', { kind: 'rejoin' }),
    edge('e5', 'adm', 'visa'),
  ],
}

describe('graph validation', () => {
  it('accepts a route with a real alternative branch that reconverges', () => {
    expect(validateGraph(branching)).toEqual([])
    expect(() => assertValidGraph(branching)).not.toThrow()
  })

  it('rejects a cycle', () => {
    const codes = validateGraph({
      steps: [step('a'), step('b')],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')],
    }).map((v) => v.code)
    expect(codes).toContain('cycle')
  })

  it('rejects a self-loop', () => {
    expect(validateGraph({ steps: [step('a')], edges: [edge('e', 'a', 'a')] }).map((v) => v.code)).toContain(
      'self_loop',
    )
  })

  it('rejects an orphan step', () => {
    const codes = validateGraph({
      steps: [step('a'), step('b'), step('lonely')],
      edges: [edge('e1', 'a', 'b')],
    }).map((v) => v.code)
    expect(codes).toContain('orphan_step')
  })

  it('rejects an edge pointing at a step that does not exist', () => {
    expect(
      validateGraph({ steps: [step('a')], edges: [edge('e', 'a', 'ghost')] }).map((v) => v.code),
    ).toContain('unknown_step')
  })

  it('rejects a rejoin where nothing diverged', () => {
    const codes = validateGraph({
      steps: [step('a'), step('b')],
      edges: [edge('e1', 'a', 'b', { kind: 'rejoin' })],
    }).map((v) => v.code)
    expect(codes).toContain('dangling_rejoin')
  })

  it('accepts a rejoin where two paths genuinely converge', () => {
    expect(validateGraph(branching).map((v) => v.code)).not.toContain('dangling_rejoin')
  })

  it('rejects duplicate active edges, since the schema deliberately has no unique constraint', () => {
    const codes = validateGraph({
      steps: [step('a'), step('b')],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')],
    }).map((v) => v.code)
    expect(codes).toContain('duplicate_edge')
  })

  it('allows re-adding a connection whose earlier edge was archived (invariant 4)', () => {
    expect(
      validateGraph({
        steps: [step('a'), step('b')],
        edges: [edge('e1', 'a', 'b', { archived: true }), edge('e2', 'a', 'b')],
      }),
    ).toEqual([])
  })

  it('ignores archived steps and the edges that touch them', () => {
    // History may contain shapes the current view no longer shows. Archived is not deleted,
    // so validation must look at the active graph only (invariant 4).
    expect(
      validateGraph({
        steps: [step('a'), step('b'), step('old', { archived: true })],
        edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'old')],
      }),
    ).toEqual([])
  })

  it('reports every violation at once rather than only the first', () => {
    const violations = validateGraph({
      steps: [step('a'), step('b'), step('lonely')],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'a'), edge('e3', 'a', 'ghost')],
    })
    expect(violations.length).toBeGreaterThan(1)
    expect(new Set(violations.map((v) => v.code)).size).toBeGreaterThan(1)
  })

  it('throws a GraphValidationError carrying the violations', () => {
    try {
      assertValidGraph({ steps: [step('a')], edges: [edge('e', 'a', 'a')] })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(GraphValidationError)
      expect((error as GraphValidationError).violations[0]?.code).toBe('self_loop')
    }
  })
})

describe('ordering is derived from edges, never stored', () => {
  it('places a rejoin target after both of its branches', () => {
    const ranks = new Map(rankSteps(branching).map((r) => [r.step.id, r.rank]))
    expect(ranks.get('ielts')).toBe(ranks.get('pte'))
    expect(ranks.get('adm')).toBeGreaterThan(ranks.get('ielts') as number)
    expect(ranks.get('visa')).toBeGreaterThan(ranks.get('adm') as number)
  })

  it('gives structurally concurrent steps the same rank', () => {
    const ranks = new Map(rankSteps(branching).map((r) => [r.step.id, r.rank]))
    expect(ranks.get('ielts')).toBe(ranks.get('pte'))
  })

  it('is deterministic and independent of declaration order', () => {
    const reversed: RouteGraph = {
      steps: [...branching.steps].reverse(),
      edges: [...branching.edges].reverse(),
    }
    expect(stepOrder(reversed)).toEqual(stepOrder(branching))
  })

  it('drops archived steps from the current order but leaves the rest intact', () => {
    const withArchived: RouteGraph = {
      steps: [...branching.steps, step('gone', { archived: true })],
      edges: [...branching.edges, edge('e6', 'visa', 'gone')],
    }
    expect(stepOrder(withArchived)).toEqual(stepOrder(branching))
  })
})

describe('timeline yields parallel lanes, not a flattened line', () => {
  /** Language prep and document collection genuinely run at the same time (§20.2). */
  const overlapping: RouteGraph = {
    steps: [
      step('start', { typicalDurationDays: 7 }),
      step('lang', { earliestStartOffsetDays: 7, typicalDurationDays: 90 }),
      step('docs', { earliestStartOffsetDays: 7, typicalDurationDays: 60 }),
      step('apply', { typicalDurationDays: 30 }),
    ],
    edges: [
      edge('e1', 'start', 'lang'),
      edge('e2', 'start', 'docs'),
      edge('e3', 'lang', 'apply', { kind: 'rejoin' }),
      edge('e4', 'docs', 'apply', { kind: 'rejoin' }),
    ],
  }

  it('puts overlapping steps in different lanes', () => {
    const timeline = buildTimeline(overlapping)
    const lane = (id: string) => timeline.entries.find((e) => e.stepId === id)?.lane

    expect(timeline.laneCount).toBeGreaterThan(1)
    expect(lane('lang')).not.toBe(lane('docs'))
  })

  it('does not sum overlapping durations into a straight line', () => {
    const timeline = buildTimeline(overlapping)
    const summed = overlapping.steps.reduce((n, s) => n + (s.typicalDurationDays ?? 0), 0)

    // 7 + 90 + 60 + 30 = 187 if flattened; the real span is shorter because two steps run
    // concurrently. Flattening would misrepresent the journey and inflate the fly window.
    expect(summed).toBe(187)
    expect(timeline.totalDays).toBeLessThan(summed)
  })

  it('starts a step after its dependencies when no offset is declared', () => {
    const timeline = buildTimeline({
      steps: [step('a', { typicalDurationDays: 10 }), step('b', { typicalDurationDays: 5 })],
      edges: [edge('e1', 'a', 'b')],
    })
    const b = timeline.entries.find((e) => e.stepId === 'b')
    expect(b?.startDay).toBe(10)
    expect(b?.endDay).toBe(15)
  })

  it('collapses a purely sequential route to a single lane', () => {
    const timeline = buildTimeline({
      steps: [
        step('a', { typicalDurationDays: 10 }),
        step('b', { typicalDurationDays: 5 }),
        step('c', { typicalDurationDays: 5 }),
      ],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    })
    expect(timeline.laneCount).toBe(1)
  })

  it('handles a route with no timing at all without throwing', () => {
    const timeline = buildTimeline(branching)
    expect(timeline.entries).toHaveLength(5)
    expect(timeline.totalDays).toBe(0)
  })
})
