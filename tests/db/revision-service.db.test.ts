import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FieldCategory, SourceClass, StepCategory, StepEdgeKind, StudyLevel } from '../../src/domain/enums'
import { diffRouteGraphs } from '../../src/domain/graph/diff'
import { validateGraph } from '../../src/domain/graph/validate'
import { fieldHistory, loadRouteGraph } from '../../src/server/revisions/read'
import {
  addEdge,
  addField,
  addStep,
  archiveField,
  archiveStep,
  confirmField,
  createRoute,
  reviseEdge,
  reviseField,
  reviseStep,
} from '../../src/server/revisions/service'
import { WriteBoundaryError } from '../../src/server/write-guard'

/**
 * Phase 3, proved against a real database.
 *
 * Each block below corresponds to one thing the revision engine claims. Where a claim is
 * about Postgres rather than about TypeScript — immutability, restrict-on-delete,
 * transactional atomicity, concurrency — it is tested by making the database refuse, not by
 * checking that a function returns the right shape.
 *
 * Runs against TEST_DATABASE_URL. Never `production` (Test.md §1).
 */

const url = process.env.TEST_DATABASE_URL

/**
 * A raw, UNGUARDED client.
 *
 * Deliberately not the application client: these tests must prove that the database refuses
 * things even when the application guard is absent. Using the guarded client would prove
 * only that the guard works, which is a much weaker claim.
 */
const raw = new PrismaClient({ datasources: { db: { url: url ?? 'postgresql://unset' } } })

let actorId = ''
let otherActorId = ''

async function makeActor(prefix: string): Promise<string> {
  const user = await raw.user.create({ data: { handle: `${prefix}-${Date.now()}-${Math.random()}` } })
  return user.id
}

async function makeRoute(): Promise<string> {
  const { routeId } = await createRoute({
    actor: { id: actorId },
    slug: `svc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    title: 'Service fixture',
  })
  return routeId
}

async function makeField(routeId: string, value = 'Overall band 6.5'): Promise<string> {
  const { stepId } = await addStep({
    actor: { id: actorId },
    routeId,
    label: 'Language test',
    category: StepCategory.language_testing,
  })
  const { fieldId } = await addField({
    actor: { id: actorId },
    stepId,
    category: FieldCategory.requirement,
    valueText: value,
    sourceClass: SourceClass.official,
  })
  return fieldId
}

beforeAll(async () => {
  if (!url) return
  actorId = await makeActor('nadia')
  otherActorId = await makeActor('rafi')
}, 60_000)

afterAll(async () => {
  await raw.$disconnect()
})

describe.skipIf(!url)('1 — a correction appends; the previous value is never overwritten', () => {
  it('keeps the prior value, its author, its timestamp and its reason', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId, 'Overall band 6.5')

    await reviseField({
      actor: { id: otherActorId },
      reason: 'University raised the minimum',
      fieldId,
      valueText: 'Overall band 7.0',
      sourceClass: SourceClass.official,
    })

    const history = await fieldHistory(fieldId)
    expect(history.revisions).toHaveLength(2)

    const [first, second] = history.revisions
    expect(first?.value).toBe('Overall band 6.5')
    expect(first?.authorId).toBe(actorId)
    expect(second?.value).toBe('Overall band 7.0')
    expect(second?.authorId).toBe(otherActorId)
    expect(second?.reason).toBe('University raised the minimum')
    expect(second?.previousRevisionId).toBe(first?.id)

    // The pointer moved; the old row did not.
    expect(history.currentRevisionId).toBe(second?.id)
  })

  it('preserves every value across a chain of corrections', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId, 'v1')

    for (const value of ['v2', 'v3', 'v4']) {
      await reviseField({ actor: { id: actorId }, fieldId, valueText: value, sourceClass: SourceClass.official })
    }

    const history = await fieldHistory(fieldId)
    expect(history.revisions.map((r) => r.value)).toEqual(['v1', 'v2', 'v3', 'v4'])
  })
})

describe.skipIf(!url)('2 — revision rows are immutable once created', () => {
  it('the DATABASE refuses to update a revision, guard or no guard', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId)
    const history = await fieldHistory(fieldId)
    const revisionId = history.revisions[0]?.id ?? ''

    // The unguarded client — this is Postgres refusing, not the application.
    await expect(
      raw.fieldRevision.update({ where: { id: revisionId }, data: { valueText: 'rewritten' } }),
    ).rejects.toThrow(/immutable/i)

    expect((await fieldHistory(fieldId)).revisions[0]?.value).toBe('Overall band 6.5')
  })

  it('the DATABASE refuses to delete a revision', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId)
    const revisionId = (await fieldHistory(fieldId)).revisions[0]?.id ?? ''

    await expect(raw.fieldRevision.delete({ where: { id: revisionId } })).rejects.toThrow(/immutable/i)
    expect((await fieldHistory(fieldId)).revisions).toHaveLength(1)
  })

  it('protects route revisions too, not only field revisions', async () => {
    const row = await raw.routeRevision.findFirst()
    if (!row) return
    await expect(
      raw.routeRevision.update({ where: { id: row.id }, data: { reason: 'tampered' } }),
    ).rejects.toThrow(/immutable/i)
  })

  it('protects step revisions', async () => {
    const row = await raw.stepRevision.findFirst()
    if (!row) return
    await expect(
      raw.stepRevision.update({ where: { id: row.id }, data: { reason: 'tampered' } }),
    ).rejects.toThrow(/immutable/i)
  })

  it('protects step edge revisions, so a branch change cannot be rewritten', async () => {
    const row = await raw.stepEdgeRevision.findFirst()
    if (!row) return
    await expect(
      raw.stepEdgeRevision.update({ where: { id: row.id }, data: { reason: 'tampered' } }),
    ).rejects.toThrow(/immutable/i)
  })

  it('the application guard refuses the same thing, with an explanation', async () => {
    // Two independent refusals: the guard explains before the query is sent, the database
    // enforces if anything ever gets past it.
    const { prisma } = await import('../../src/server/db/client')
    await expect(
      prisma.fieldRevision.update({ where: { id: 'anything' }, data: { valueText: 'x' } }),
    ).rejects.toBeInstanceOf(WriteBoundaryError)
  })
})

describe.skipIf(!url)('3 — normal application code cannot bypass the service', () => {
  it('refuses a direct write through the application client outside the service', async () => {
    const routeId = await makeRoute()
    const { prisma } = await import('../../src/server/db/client')

    // Exactly what a seed script or a hastily-written route handler would do.
    await expect(
      prisma.step.create({ data: { routeId } }),
    ).rejects.toBeInstanceOf(WriteBoundaryError)
  })

  it('refuses a hard delete of shared knowledge through the application client', async () => {
    const routeId = await makeRoute()
    const { prisma } = await import('../../src/server/db/client')
    await expect(prisma.route.delete({ where: { id: routeId } })).rejects.toBeInstanceOf(
      WriteBoundaryError,
    )
  })

  it('the DATABASE refuses a hard delete even from an unguarded client', async () => {
    const routeId = await makeRoute()
    // Belt and braces: onDelete: Restrict plus a trigger. Either alone would do; both mean
    // a future schema change cannot quietly remove the protection.
    await expect(raw.route.delete({ where: { id: routeId } })).rejects.toThrow()
  })

  it('allows reads through the application client from anywhere', async () => {
    const { prisma } = await import('../../src/server/db/client')
    await expect(prisma.route.count()).resolves.toBeGreaterThanOrEqual(0)
  })
})

describe.skipIf(!url)('4 — private journey state does not go through the revision engine', () => {
  it('exposes no journey surface on the revision service', async () => {
    const service = await import('../../src/server/revisions/service')
    const names = Object.keys(service).map((n) => n.toLowerCase())
    expect(names.filter((n) => n.includes('journey') || n.includes('progress'))).toEqual([])
  })

  it('leaves non-revisioned models writable outside the service context', async () => {
    // A journey note must be editable in place by its owner. If the guard covered every
    // model, private progress would be forced through a public revision path — the exact
    // failure invariant 5 exists to prevent. Proved here with User, the model that stands
    // in for "not shared knowledge" until Phase 7 adds Journey.
    const { prisma } = await import('../../src/server/db/client')
    const user = await prisma.user.create({ data: { handle: `private-${Date.now()}` } })
    await expect(
      prisma.user.update({ where: { id: user.id }, data: { handle: `renamed-${Date.now()}` } }),
    ).resolves.toBeDefined()
  })
})

describe.skipIf(!url)('5 — revision and current-state transition are transactionally safe', () => {
  it('leaves nothing behind when the work throws part-way', async () => {
    const routeId = await makeRoute()
    const before = await raw.stepRevision.count()

    // A step whose route does not exist: the step insert succeeds in the transaction, the
    // revision insert fails the foreign key, and the whole thing must roll back.
    await expect(
      addStep({
        actor: { id: actorId },
        routeId: 'route-that-does-not-exist',
        label: 'Doomed',
        category: StepCategory.documents_preparation,
      }),
    ).rejects.toThrow()

    expect(await raw.stepRevision.count()).toBe(before)
    expect(await raw.step.count({ where: { routeId: 'route-that-does-not-exist' } })).toBe(0)
    expect(validateGraph(await loadRouteGraph(routeId))).toEqual([])
  })

  it('never leaves a current pointer aimed at a missing revision', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId)
    await reviseField({ actor: { id: actorId }, fieldId, valueText: 'v2', sourceClass: SourceClass.official })

    const field = await raw.field.findUniqueOrThrow({
      where: { id: fieldId },
      select: { currentRevisionId: true },
    })
    const pointed = await raw.fieldRevision.findUnique({
      where: { id: field.currentRevisionId ?? '' },
    })
    expect(pointed).not.toBeNull()
    expect(pointed?.fieldId).toBe(fieldId)
  })
})

describe.skipIf(!url)('6 & 7 — concurrent contributions both survive', () => {
  it('keeps both edits when two contributors revise from the same parent', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId, 'Fee 7500 BDT')
    const parent = (await fieldHistory(fieldId)).currentRevisionId

    // Both authors were looking at the same revision. Neither saw the other's work.
    const [a, b] = await Promise.all([
      reviseField({
        actor: { id: actorId }, reason: 'paid this last week', fieldId,
        basedOnRevisionId: parent, valueText: 'Fee 8000 BDT',
        sourceClass: SourceClass.community_submission,
      }),
      reviseField({
        actor: { id: otherActorId }, reason: 'embassy site says 7900', fieldId,
        basedOnRevisionId: parent, valueText: 'Fee 7900 BDT',
        sourceClass: SourceClass.official,
      }),
    ])

    const history = await fieldHistory(fieldId)

    // Nothing was lost. This is the whole point: last-write-wins would leave two revisions.
    expect(history.revisions).toHaveLength(3)
    expect(history.revisions.map((r) => r.value)).toEqual(
      expect.arrayContaining(['Fee 7500 BDT', 'Fee 8000 BDT', 'Fee 7900 BDT']),
    )

    // Both forks hang off the same parent, which is how the conflict is detectable.
    const siblings = history.revisions.filter((r) => r.previousRevisionId === parent)
    expect(siblings).toHaveLength(2)
    expect(siblings.map((r) => r.id).sort()).toEqual([a.revisionId, b.revisionId].sort())

    // And it is reported as contested rather than silently resolved (FR-70, invariant 15).
    expect(history.contested).toBe(true)
    expect(history.forks).toHaveLength(1)
    expect(history.forks[0]).toHaveLength(2)

    // Exactly one of the two lost the race to become current — but losing the race is not
    // losing the contribution.
    expect([a.revisionId, b.revisionId]).toContain(history.currentRevisionId)
    expect(a.revisionId).not.toBe(b.revisionId)
  })

  it('reports the fork to the second writer rather than failing silently', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId, 'v1')
    const parent = (await fieldHistory(fieldId)).currentRevisionId

    const first = await reviseField({
      actor: { id: actorId }, fieldId, basedOnRevisionId: parent,
      valueText: 'v2-a', sourceClass: SourceClass.official,
    })
    const second = await reviseField({
      actor: { id: otherActorId }, fieldId, basedOnRevisionId: parent,
      valueText: 'v2-b', sourceClass: SourceClass.official,
    })

    expect(first.forked).toBe(false)
    // The second author edited a revision that was no longer current — they are told.
    expect(second.forked).toBe(true)
    expect((await fieldHistory(fieldId)).contested).toBe(true)
  })

  it('does not report a fork for an ordinary sequential edit chain', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId, 'v1')

    const a = await reviseField({ actor: { id: actorId }, fieldId, valueText: 'v2', sourceClass: SourceClass.official })
    const b = await reviseField({
      actor: { id: otherActorId }, fieldId, basedOnRevisionId: a.revisionId,
      valueText: 'v3', sourceClass: SourceClass.official,
    })

    expect(b.forked).toBe(false)
    expect((await fieldHistory(fieldId)).contested).toBe(false)
  })

  it('survives many simultaneous contributors without losing one', async () => {
    // The earlier version of this engine deadlocked here: the foreign-key check on inserting
    // a revision took a share lock on the field row, and moving the current pointer then
    // needed an exclusive lock on the same row. Postgres killed one transaction and that
    // contribution was gone. Five at once is a fair test of the row-locking fix.
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId, 'start')
    const parent = (await fieldHistory(fieldId)).currentRevisionId

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        reviseField({
          actor: { id: i % 2 === 0 ? actorId : otherActorId },
          reason: `contributor ${i}`,
          fieldId,
          basedOnRevisionId: parent,
          valueText: `value-${i}`,
          sourceClass: SourceClass.community_submission,
        }),
      ),
    )

    const history = await fieldHistory(fieldId)
    expect(history.revisions).toHaveLength(6)
    expect(new Set(results.map((r) => r.revisionId)).size).toBe(5)

    // Every contribution is readable, not just the one that won the pointer.
    for (let i = 0; i < 5; i += 1) {
      expect(history.revisions.map((r) => r.value)).toContain(`value-${i}`)
    }
    expect(history.revisions.filter((r) => r.previousRevisionId === parent)).toHaveLength(5)
    expect(history.contested).toBe(true)
  })

  it('orders concurrent revisions deterministically', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId, 'v1')
    const parent = (await fieldHistory(fieldId)).currentRevisionId

    await Promise.all([
      reviseField({ actor: { id: actorId }, fieldId, basedOnRevisionId: parent, valueText: 'x', sourceClass: SourceClass.official }),
      reviseField({ actor: { id: otherActorId }, fieldId, basedOnRevisionId: parent, valueText: 'y', sourceClass: SourceClass.official }),
    ])

    // Two reads must agree, even when timestamps collide — id breaks the tie.
    const first = (await fieldHistory(fieldId)).revisions.map((r) => r.id)
    const second = (await fieldHistory(fieldId)).revisions.map((r) => r.id)
    expect(first).toEqual(second)
  })
})

describe.skipIf(!url)('archival leaves current views and stays in history', () => {
  it('removes a field from current views while keeping every revision', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId, 'obsolete value')
    await reviseField({ actor: { id: actorId }, fieldId, valueText: 'still obsolete', sourceClass: SourceClass.official })

    await archiveField({ actor: { id: actorId }, reason: 'fee now collected at the centre', fieldId })

    const history = await fieldHistory(fieldId)
    expect(history.archived).toBe(true)
    expect(history.revisions).toHaveLength(2)
    expect(history.revisions[0]?.value).toBe('obsolete value')
  })

  it('removes an archived step from the current graph but keeps it in the history view', async () => {
    const routeId = await makeRoute()
    const a = await addStep({ actor: { id: actorId }, routeId, label: 'A', category: StepCategory.documents_preparation })
    const b = await addStep({ actor: { id: actorId }, routeId, label: 'B', category: StepCategory.travel_departure })
    await addEdge({ actor: { id: actorId }, routeId, fromStepId: a.stepId, toStepId: b.stepId, kind: StepEdgeKind.sequential })

    await archiveStep({ actor: { id: actorId }, reason: 'replaced', stepId: b.stepId })

    const current = await loadRouteGraph(routeId)
    const withHistory = await loadRouteGraph(routeId, { includeArchived: true })

    expect(current.steps.map((s) => s.id)).not.toContain(b.stepId)
    expect(withHistory.steps.map((s) => s.id)).toContain(b.stepId)
  })
})

describe.skipIf(!url)('the engine produces a diff that names structural change', () => {
  it('describes an added alternative branch, not just a step count', async () => {
    const routeId = await makeRoute()
    const docs = await addStep({ actor: { id: actorId }, routeId, label: 'Documents', category: StepCategory.documents_preparation })
    const ielts = await addStep({ actor: { id: actorId }, routeId, label: 'IELTS', category: StepCategory.language_testing })
    const adm = await addStep({ actor: { id: actorId }, routeId, label: 'Admission', category: StepCategory.admission_university })
    await addEdge({ actor: { id: actorId }, routeId, fromStepId: docs.stepId, toStepId: ielts.stepId, kind: StepEdgeKind.sequential })
    await addEdge({ actor: { id: actorId }, routeId, fromStepId: ielts.stepId, toStepId: adm.stepId, kind: StepEdgeKind.sequential })

    const before = await loadRouteGraph(routeId)

    const pte = await addStep({ actor: { id: actorId }, routeId, label: 'PTE', category: StepCategory.language_testing })
    await addEdge({ actor: { id: actorId }, routeId, fromStepId: docs.stepId, toStepId: pte.stepId, kind: StepEdgeKind.alternative })
    await addEdge({ actor: { id: actorId }, routeId, fromStepId: pte.stepId, toStepId: adm.stepId, kind: StepEdgeKind.rejoin })

    const diff = diffRouteGraphs(before, await loadRouteGraph(routeId))

    expect(diff.stepsAdded).toEqual([pte.stepId])
    expect(diff.structureChanged).toBe(true)
    expect(diff.branchConnectionsChanged).toBe(2)
    expect(diff.summary).toContain('branch connection')
  })

  it('notices an edge whose kind was revised', async () => {
    const routeId = await makeRoute()
    const a = await addStep({ actor: { id: actorId }, routeId, label: 'A', category: StepCategory.documents_preparation })
    const b = await addStep({ actor: { id: actorId }, routeId, label: 'B', category: StepCategory.travel_departure })
    const edge = await addEdge({ actor: { id: actorId }, routeId, fromStepId: a.stepId, toStepId: b.stepId, kind: StepEdgeKind.sequential })

    const before = await loadRouteGraph(routeId)
    await reviseEdge({ actor: { id: actorId }, reason: 'this stage is optional', edgeId: edge.edgeId, kind: StepEdgeKind.optional_branch })

    const diff = diffRouteGraphs(before, await loadRouteGraph(routeId))
    expect(diff.edgesRetyped).toHaveLength(1)
    expect(diff.structureChanged).toBe(true)
  })
})

describe.skipIf(!url)('anyone may revise; creating a route confers no ownership', () => {
  it('lets a different user revise a route they did not create (FR-44, invariant 3)', async () => {
    const routeId = await makeRoute() // created by actorId
    const fieldId = await makeField(routeId, 'original')

    await expect(
      reviseField({
        actor: { id: otherActorId }, reason: 'correcting a stranger’s route',
        fieldId, valueText: 'corrected', sourceClass: SourceClass.official,
      }),
    ).resolves.toBeDefined()

    const history = await fieldHistory(fieldId)
    expect(history.revisions.at(-1)?.authorId).toBe(otherActorId)
  })

  it('refreshes freshness on confirmation without creating a revision', async () => {
    const routeId = await makeRoute()
    const fieldId = await makeField(routeId, 'still true')
    const before = (await fieldHistory(fieldId)).revisions.length

    await confirmField({ actor: { id: otherActorId }, fieldId })

    // Confirming is not editing. A confirmation that created a revision would pollute the
    // history with entries where nothing changed (§39.4).
    expect((await fieldHistory(fieldId)).revisions).toHaveLength(before)
    const field = await raw.field.findUniqueOrThrow({ where: { id: fieldId }, select: { lastConfirmedAt: true } })
    expect(field.lastConfirmedAt).not.toBeNull()
  })

  it('revises a step through the service and keeps the old label readable', async () => {
    const routeId = await makeRoute()
    const step = await addStep({ actor: { id: actorId }, routeId, label: 'Old label', category: StepCategory.documents_preparation })
    await reviseStep({
      actor: { id: otherActorId }, reason: 'clearer name', stepId: step.stepId,
      label: 'New label', category: StepCategory.documents_preparation,
    })

    const revisions = await raw.stepRevision.findMany({
      where: { stepId: step.stepId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    expect(revisions.map((r) => r.label)).toEqual(['Old label', 'New label'])
  })
})
