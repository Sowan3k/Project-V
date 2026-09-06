import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { STEP_EDGE_KINDS } from '../../src/domain/enums'
import {
  CORRUPTING_VIOLATIONS,
  INCOMPLETENESS_VIOLATIONS,
  corruptingViolations,
  incompletenessViolations,
  isCorrupting,
  validateGraph,
} from '../../src/domain/graph/validate'
import type { RouteGraph } from '../../src/domain/graph/types'
import { en } from '../../src/i18n/dictionaries/en'

/**
 * Contextual graph authoring — Phase 12E, audit F6. FR-14, FR-16, FR-21, FR-57, D-37.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * The finding: the revision engine could revise a route's title, relabel and retime a step,
 * change a connection's kind and archive or restore any of it — and none of it was reachable
 * from any page. Tests proved the engine could represent a non-linear process; the product
 * could not maintain one.
 *
 * These assert the three things that could quietly go wrong while fixing that:
 *
 *   1. The graph gate is real. It was never called before Phase 12E, and it becomes
 *      load-bearing the moment two existing steps can be connected.
 *   2. The forbidden shortcuts stay forbidden — no orderIndex, no second graph engine, no
 *      separate builder page, no destructive editing.
 *   3. The words a contributor sees are contributor words, not schema words.
 */

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const step = (id: string) => ({
  id,
  label: id,
  category: 'documents_preparation' as const,
  archived: false,
  earliestStartOffsetDays: null,
  typicalDurationDays: null,
})

const edge = (
  id: string,
  from: string,
  to: string,
  kind: (typeof STEP_EDGE_KINDS)[number] = 'sequential',
) => ({
  id,
  fromStepId: from,
  toStepId: to,
  kind,
  archived: false,
})

describe('corruption and incompleteness are different things', () => {
  it('classifies every violation code as exactly one of the two', () => {
    const all = [...CORRUPTING_VIOLATIONS, ...INCOMPLETENESS_VIOLATIONS]
    expect(new Set(all).size).toBe(all.length)
    // The union must be complete: a code in neither list would be silently unenforced and
    // silently unreported, which is the worst of both.
    const known = [
      'unknown_step',
      'self_loop',
      'duplicate_edge',
      'cycle',
      'orphan_step',
      'unreachable_step',
      'no_start',
      'dangling_rejoin',
    ]
    expect([...all].sort()).toEqual([...known].sort())
  })

  it('treats as corruption only what no later addition can repair', () => {
    // A cycle needs the offending edge removed; nothing added fixes it. The rest are repaired
    // by connecting something, which is the ordinary state of a half-built road.
    expect(isCorrupting('cycle')).toBe(true)
    expect(isCorrupting('self_loop')).toBe(true)
    expect(isCorrupting('duplicate_edge')).toBe(true)
    expect(isCorrupting('unknown_step')).toBe(true)

    expect(isCorrupting('orphan_step')).toBe(false)
    expect(isCorrupting('unreachable_step')).toBe(false)
    expect(isCorrupting('no_start')).toBe(false)
    expect(isCorrupting('dangling_rejoin')).toBe(false)
  })

  it('reports a half-built road as incomplete, never as corrupt', () => {
    // Somebody adding three stages before wiring them together. This must be writable.
    const halfBuilt: RouteGraph = { steps: [step('a'), step('b'), step('c')], edges: [] }
    expect(corruptingViolations(halfBuilt)).toEqual([])
    expect(incompletenessViolations(halfBuilt).map((v) => v.code)).toContain('orphan_step')
  })

  it('reports a cycle as corruption', () => {
    const looped: RouteGraph = {
      steps: [step('a'), step('b')],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')],
    }
    expect(corruptingViolations(looped).map((v) => v.code)).toContain('cycle')
  })

  it('reports a duplicated connection as corruption', () => {
    const doubled: RouteGraph = {
      steps: [step('a'), step('b')],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')],
    }
    expect(corruptingViolations(doubled).map((v) => v.code)).toContain('duplicate_edge')
  })

  it('reports a rejoin with one arriving path as incomplete, because the other path may come', () => {
    const early: RouteGraph = {
      steps: [step('a'), step('b')],
      edges: [edge('e1', 'a', 'b', 'rejoin')],
    }
    expect(corruptingViolations(early)).toEqual([])
    expect(incompletenessViolations(early).map((v) => v.code)).toContain('dangling_rejoin')
  })

  it('partitions whatever validateGraph returns, losing nothing', () => {
    const messy: RouteGraph = {
      steps: [step('a'), step('b'), step('c')],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'a'), edge('e3', 'a', 'a')],
    }
    const all = validateGraph(messy)
    const split = [...corruptingViolations(messy), ...incompletenessViolations(messy)]
    expect(split).toHaveLength(all.length)
  })
})

describe('the gate is wired into every structural write', () => {
  const service = stripComments(read('src/server/revisions/service.ts'))

  it('calls the gate rather than merely importing the validator', () => {
    // Before Phase 12E the validator was imported by nothing outside the tests, while its own
    // comment claimed Phase 3 had made it "the only door".
    expect(service).toContain('assertNoGraphCorruption')
    expect(service).toContain('async function assertGraphStillSound')
  })

  const STRUCTURAL = [
    'addEdge',
    'addStepWithConnection',
    'reviseEdge',
    'archiveStep',
    'archiveEdge',
    'restoreStep',
    'restoreEdge',
  ]

  it.each(STRUCTURAL)('%s validates the resulting graph before committing', (fn) => {
    const start = service.indexOf(`export async function ${fn}`)
    expect(start, `${fn} is missing`).toBeGreaterThan(-1)
    const next = service.indexOf('\nexport ', start + 1)
    const body = service.slice(start, next === -1 ? undefined : next)
    expect(body).toContain('assertGraphStillSound')
  })

  it('validates the outcome, inside the transaction, not the arguments', () => {
    // Checking intent means enumerating every way a write could go wrong and missing one.
    // And it must run inside `write()`'s transaction so a refusal rolls the write back.
    expect(service).toMatch(/assertGraphStillSound\(tx,/)
  })

  it('refuses a connection whose ends are in different routes', () => {
    // `StepEdge`'s foreign keys reference `steps` without caring which route they belong to,
    // so nothing below the application refuses this.
    const addEdgeStart = service.indexOf('export async function addEdge')
    const body = service.slice(addEdgeStart, service.indexOf('\nexport ', addEdgeStart + 1))
    expect(body).toContain('GraphInputError')
    expect(body).toMatch(/routeId !== input\.routeId/)
  })

  it('adds restore counterparts, so archival is reversible for structure as well as fields', () => {
    expect(service).toContain('export async function restoreStep')
    expect(service).toContain('export async function restoreEdge')
  })
})

describe('the forbidden shortcuts are still forbidden', () => {
  const files = [
    'src/components/structure.tsx',
    'src/app/[locale]/routes/[slug]/actions.ts',
    'src/server/routes/read.ts',
  ]

  it.each(files)('%s introduces no orderIndex or position column', (path) => {
    const code = stripComments(read(path))
    // Invariant 22: ordering lives in typed edges and nowhere else.
    expect(code).not.toMatch(/orderIndex|positionIndex|\bsortOrder\b/)
  })

  it.each(files)('%s never deletes shared knowledge', (path) => {
    const code = stripComments(read(path))
    // Invariants 1 and 4. Archiving is the only removal, and it is reversible.
    expect(code).not.toMatch(/\.delete\(|\.deleteMany\(/)
  })

  it('reaches the domain graph through the existing engine, not a second one', () => {
    const structure = stripComments(read('src/components/structure.tsx'))
    // Every control posts to a server action, which calls the Phase 3 revision service.
    // A component that imported a database client would fail the ESLint write boundary, but
    // this states the positive rule.
    expect(structure).toContain("from '@/app/[locale]/routes/[slug]/actions'")
    expect(structure).not.toContain('@/server/db/client')
  })

  it('is contextual to the route rather than a builder page of its own', () => {
    // CLAUDE.md §7.1: a short transient action is a disclosure, never a page transition. The
    // controls render inside the route page, and no new route segment was added for them.
    expect(read('src/app/[locale]/routes/[slug]/page.tsx')).toContain('MaintainRoad')
    expect(stripComments(read('src/components/structure.tsx'))).toContain('<details')
  })

  it('works without JavaScript — plain forms posting to server actions', () => {
    const structure = stripComments(read('src/components/structure.tsx'))
    expect(structure).not.toContain("'use client'")
    expect(structure).not.toMatch(/useState|useEffect|onClick=/)
  })
})

describe('the contributor is asked in their own words', () => {
  it('gives every connection kind a plain label and an explainer', () => {
    for (const kind of STEP_EDGE_KINDS) {
      const entry = en.stepEdgeKind[kind]
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.explainer.length).toBeGreaterThan(0)
      // The schema's own word must not be the word a contributor reads.
      expect(entry.label.toLowerCase()).not.toContain(kind.replace('_', ' '))
    }
  })

  it('never shows the reader the words edge, node or graph', () => {
    const vocabulary = JSON.stringify([en.stepEdgeKind, en.structure]).toLowerCase()
    for (const jargon of ['edge', 'node', 'graph', 'orderindex', 'vertex']) {
      expect(vocabulary).not.toContain(jargon)
    }
  })

  it('explains that overlapping timing is how two stages become parallel', () => {
    // There is no "parallel" control and there must not be one — overlap is what two
    // intersecting time windows mean (§20.2, §20.3, invariant 22). A contributor who does not
    // know that will describe a parallel journey as a straight line.
    const explainer = en.structure.timingExplainer.toLowerCase()
    expect(explainer).toContain('overlap')
    expect(explainer).toContain('same time')
  })

  it('says archiving is not deletion, wherever it offers it', () => {
    for (const note of [en.structure.archiveStepNote, en.structure.archiveFieldNote]) {
      expect(note.toLowerCase()).toMatch(/history|put it back/)
    }
    // And it must not promise something the database would refuse.
    expect(en.structure.archiveStepNote.toLowerCase()).toContain('keeps their progress')
  })

  it('uses no approval language anywhere', () => {
    // FR-16, FR-69, §43.1 and CLAUDE.md §8.6: an update is live when it is saved. There is no
    // pending state, no reviewer and no queue.
    // Phrasings that would assert a gate, rather than the bare words — the lede says
    // "nothing waits for approval", which uses one of them to deny exactly what §8.6 forbids
    // building. A guard that failed that sentence would be pushing the copy the wrong way.
    const vocabulary = JSON.stringify(en.structure).toLowerCase()
    for (const forbidden of [
      'awaiting approval',
      'pending approval',
      'needs approval',
      'once approved',
      'submit for review',
      'will be reviewed',
      'moderator',
    ]) {
      expect(vocabulary).not.toContain(forbidden)
    }
    // And the positive claim VR-08's mockup exception requires us to make instead.
    expect(en.structure.maintainLede.toLowerCase()).toContain('nothing waits for approval')
  })

  it('describes what is unfinished without calling it wrong', () => {
    const unfinished = JSON.stringify(en.structure.unfinished).toLowerCase()
    for (const alarming of ['invalid', 'error', 'broken', 'illegal', 'corrupt']) {
      expect(unfinished).not.toContain(alarming)
    }
  })
})
