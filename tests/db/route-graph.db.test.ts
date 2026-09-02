import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { StepCategory, StepEdgeKind, StudyLevel, SourceClass, FieldCategory } from '../../src/domain/enums'
import { buildTimeline, rankSteps } from '../../src/domain/graph/order'
import { validateGraph } from '../../src/domain/graph/validate'
import type { RouteGraph } from '../../src/domain/graph/types'

/**
 * Phase 2 exit criteria that only a real database can answer (Phases.md):
 *
 *   - "A fixture with a real alternative branch and a real overlap persists, round-trips,
 *      validates."
 *   - "Timeline ordering over the overlapping fixture yields parallel lanes, not a
 *      flattened line."
 *
 * Plus the properties that are claims about Postgres rather than about TypeScript: that
 * deletion of anything with history is physically refused, and that two contributors
 * revising one field concurrently both persist.
 *
 * Runs against TEST_DATABASE_URL — a Neon scratch branch locally, a service container in
 * CI. Never against `production` (Test.md §1).
 */

const url = process.env.TEST_DATABASE_URL
const prisma = new PrismaClient({ datasources: { db: { url: url ?? 'postgresql://unset' } } })

/** A route that is genuinely a graph: an alternative branch, and two overlapping steps. */
const FIXTURE = {
  slug: 'test-branching-overlapping',
  steps: [
    { key: 'start', label: 'Decide destination', category: StepCategory.documents_preparation, offset: 0, duration: 7 },
    { key: 'lang', label: 'Language preparation', category: StepCategory.language_testing, offset: 7, duration: 90 },
    { key: 'docs', label: 'Document collection', category: StepCategory.documents_preparation, offset: 7, duration: 60 },
    { key: 'ielts', label: 'IELTS', category: StepCategory.language_testing, offset: 97, duration: 14 },
    { key: 'pte', label: 'PTE', category: StepCategory.language_testing, offset: 97, duration: 14 },
    { key: 'apply', label: 'Apply', category: StepCategory.admission_university, offset: null, duration: 30 },
  ],
  edges: [
    { key: 'e1', from: 'start', to: 'lang', kind: StepEdgeKind.sequential },
    { key: 'e2', from: 'start', to: 'docs', kind: StepEdgeKind.sequential },
    { key: 'e3', from: 'lang', to: 'ielts', kind: StepEdgeKind.alternative },
    { key: 'e4', from: 'lang', to: 'pte', kind: StepEdgeKind.alternative },
    { key: 'e5', from: 'ielts', to: 'apply', kind: StepEdgeKind.rejoin },
    { key: 'e6', from: 'pte', to: 'apply', kind: StepEdgeKind.rejoin },
    { key: 'e7', from: 'docs', to: 'apply', kind: StepEdgeKind.rejoin },
  ],
} as const

let routeId = ''
let authorId = ''
const stepIds = new Map<string, string>()

/**
 * Writes the fixture with raw Prisma calls.
 *
 * Phase 3 will make a revision-writing service the only way this is allowed to happen and
 * will add a test that fails if anything outside it writes these tables. Until that service
 * exists, a test writing directly is the only option — noted so it is not mistaken for the
 * intended pattern.
 */
async function persistFixture(): Promise<void> {
  const author = await prisma.user.create({ data: { handle: `tester-${Date.now()}` } })
  authorId = author.id

  const route = await prisma.route.create({
    data: {
      slug: `${FIXTURE.slug}-${Date.now()}`,
      originCountry: 'BD',
      destinationCountry: 'DE',
      studyLevel: StudyLevel.masters,
      createdById: author.id,
    },
  })
  routeId = route.id

  const revision = await prisma.routeRevision.create({
    data: { routeId: route.id, title: 'Branching and overlapping fixture', authorId: author.id },
  })
  await prisma.route.update({
    where: { id: route.id },
    data: { currentRevisionId: revision.id },
  })

  for (const s of FIXTURE.steps) {
    const step = await prisma.step.create({ data: { routeId: route.id } })
    const rev = await prisma.stepRevision.create({
      data: {
        stepId: step.id,
        label: s.label,
        category: s.category,
        earliestStartOffsetDays: s.offset,
        typicalDurationDays: s.duration,
        authorId: author.id,
      },
    })
    await prisma.step.update({ where: { id: step.id }, data: { currentRevisionId: rev.id } })
    stepIds.set(s.key, step.id)
  }

  for (const e of FIXTURE.edges) {
    const from = stepIds.get(e.from)
    const to = stepIds.get(e.to)
    if (!from || !to) throw new Error(`fixture edge ${e.key} references a missing step`)
    const edge = await prisma.stepEdge.create({
      data: { routeId: route.id, fromStepId: from, toStepId: to },
    })
    const rev = await prisma.stepEdgeRevision.create({
      data: { stepEdgeId: edge.id, kind: e.kind, authorId: author.id },
    })
    await prisma.stepEdge.update({ where: { id: edge.id }, data: { currentRevisionId: rev.id } })
  }

  // One field, so the field half of the ledger is exercised too.
  const langStepId = stepIds.get('lang')
  if (langStepId) {
    const field = await prisma.field.create({
      data: { stepId: langStepId, category: FieldCategory.requirement },
    })
    const rev = await prisma.fieldRevision.create({
      data: {
        fieldId: field.id,
        valueText: 'Overall band 6.5 with no component below 6.0',
        sourceClass: SourceClass.official,
        authorId: author.id,
      },
    })
    await prisma.field.update({ where: { id: field.id }, data: { currentRevisionId: rev.id } })
  }
}

/** Reads the route back out of Postgres into the shape the domain functions consume. */
async function readGraph(id: string): Promise<RouteGraph> {
  const [steps, edges] = await Promise.all([
    prisma.step.findMany({ where: { routeId: id }, include: { currentRevision: true } }),
    prisma.stepEdge.findMany({ where: { routeId: id }, include: { currentRevision: true } }),
  ])

  return {
    steps: steps.map((s) => ({
      id: s.id,
      label: s.currentRevision?.label ?? '',
      category: s.currentRevision?.category ?? StepCategory.documents_preparation,
      archived: s.archivedAt !== null,
      earliestStartOffsetDays: s.currentRevision?.earliestStartOffsetDays ?? null,
      typicalDurationDays: s.currentRevision?.typicalDurationDays ?? null,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      fromStepId: e.fromStepId,
      toStepId: e.toStepId,
      kind: e.currentRevision?.kind ?? StepEdgeKind.sequential,
      archived: e.archivedAt !== null,
    })),
  }
}

describe.skipIf(!url)('route graph round-trips through Postgres', () => {
  beforeAll(async () => {
    await persistFixture()
  }, 60_000)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('persists the branch structure with its typed edge kinds', async () => {
    const graph = await readGraph(routeId)
    expect(graph.steps).toHaveLength(6)
    expect(graph.edges).toHaveLength(7)

    const kinds = graph.edges.map((e) => e.kind).sort()
    expect(kinds.filter((k) => k === StepEdgeKind.alternative)).toHaveLength(2)
    expect(kinds.filter((k) => k === StepEdgeKind.rejoin)).toHaveLength(3)
  })

  it('validates after the round trip', async () => {
    expect(validateGraph(await readGraph(routeId))).toEqual([])
  })

  it('reconstructs the branch: the alternatives share a rank, the rejoin comes after', async () => {
    const graph = await readGraph(routeId)
    const ranks = new Map(rankSteps(graph).map((r) => [r.step.id, r.rank]))
    const id = (key: string) => stepIds.get(key) ?? ''

    expect(ranks.get(id('ielts'))).toBe(ranks.get(id('pte')))
    expect(ranks.get(id('apply'))).toBeGreaterThan(ranks.get(id('ielts')) as number)
  })

  it('yields parallel lanes for the overlapping steps, not a flattened line', async () => {
    const graph = await readGraph(routeId)
    const timeline = buildTimeline(graph)
    const lane = (key: string) => timeline.entries.find((e) => e.stepId === stepIds.get(key))?.lane

    expect(timeline.laneCount).toBeGreaterThan(1)
    // Language preparation and document collection both start on day 7 and overlap.
    expect(lane('lang')).not.toBe(lane('docs'))

    const summed = FIXTURE.steps.reduce((n, s) => n + s.duration, 0)
    expect(timeline.totalDays).toBeLessThan(summed)
  })
})

describe.skipIf(!url)('the database physically refuses to destroy history', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('refuses to delete a step that has revisions (invariants 1, 2)', async () => {
    const stepId = stepIds.get('lang')
    expect(stepId).toBeDefined()
    // onDelete: Restrict — this is a Postgres foreign-key error, not an application check.
    // No amount of application-layer carelessness can get past it.
    await expect(prisma.step.delete({ where: { id: stepId } })).rejects.toThrow()
  })

  it('refuses to delete a route that has steps and revisions', async () => {
    await expect(prisma.route.delete({ where: { id: routeId } })).rejects.toThrow()
  })

  it('keeps both revisions when two contributors revise one field concurrently', async () => {
    const stepId = stepIds.get('docs')
    expect(stepId).toBeDefined()

    const field = await prisma.field.create({
      data: { stepId: stepId as string, category: FieldCategory.cost },
    })
    const base = await prisma.fieldRevision.create({
      data: {
        fieldId: field.id,
        valueText: '7500 BDT',
        sourceClass: SourceClass.community_submission,
        authorId,
      },
    })

    // Two edits made against the same parent: neither author saw the other's work.
    const [a, b] = await Promise.all([
      prisma.fieldRevision.create({
        data: {
          fieldId: field.id, valueText: '8000 BDT', sourceClass: SourceClass.community_submission,
          previousRevisionId: base.id, authorId, reason: 'paid this last week',
        },
      }),
      prisma.fieldRevision.create({
        data: {
          fieldId: field.id, valueText: '7900 BDT', sourceClass: SourceClass.official,
          previousRevisionId: base.id, authorId, reason: 'embassy site',
        },
      }),
    ])

    const all = await prisma.fieldRevision.findMany({ where: { fieldId: field.id } })
    expect(all).toHaveLength(3)
    expect(all.map((r) => r.id)).toEqual(expect.arrayContaining([base.id, a.id, b.id]))

    // Both share a parent, which is exactly how a conflict is detected. A unique constraint
    // on previousRevisionId would have rejected the second contributor's edit outright.
    const siblings = all.filter((r) => r.previousRevisionId === base.id)
    expect(siblings).toHaveLength(2)
  })
})
