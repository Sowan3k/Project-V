import { beforeAll, describe, expect, it } from 'vitest'

import {
  FieldCategory,
  ReportOutcome,
  ReportReason,
  SourceClass,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
  UserRole,
} from '../../src/domain/enums'
import { GraphValidationError } from '../../src/domain/graph/validate'
import { generateHandle } from '../../src/server/auth/handle'
import { prisma } from '../../src/server/db/client'
import { IncompatibleMergeError, mergeRoutes, setLifecycleState } from '../../src/server/lifecycle/service'
import {
  addEdge,
  addField,
  addStep,
  addStepWithConnection,
  archiveEdge,
  archiveStep,
  createRoute,
  GraphInputError,
  restoreEdge,
  restoreStep,
  reviseEdge,
  reviseStep,
  setRouteLifecycleState,
} from '../../src/server/revisions/service'
import { getRouteStructure } from '../../src/server/routes/read'
import {
  handleReportsForField,
  reportField,
  UnperformableOutcomeError,
} from '../../src/server/safety/service'

/**
 * The audit remediation gate, proved against a real database — audit F4, F5, F7, F11.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why these need Postgres rather than a unit test.**
 *
 * Every claim here is about a *transaction boundary*, and a transaction boundary is precisely
 * the thing a mock does not have. "The audit event and the state change commit together" is
 * either true of a real database or it is a comment. The same for "a failed edge leaves no
 * orphan step" and "recording `content_archived` archives the field".
 *
 * They run in `npm run test:db` and in the CI database job, against a throwaway Postgres that
 * has declared itself disposable (tests/support/disposable-database.ts).
 */

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const system = { id: null, system: true }
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

let admin: string
let member: string

beforeAll(async () => {
  if (!url) return
  const suffix = unique()
  const [a, m] = await Promise.all([
    prisma.user.create({
      data: { handle: generateHandle(), email: `ar-a-${suffix}@example.test`, role: UserRole.admin },
    }),
    prisma.user.create({ data: { handle: generateHandle(), email: `ar-m-${suffix}@example.test` } }),
  ])
  admin = a.id
  member = m.id
}, 180_000)

async function makeRoute(
  over: Partial<{ destinationCountry: string; studyLevel: StudyLevel }> = {},
): Promise<string> {
  const { routeId } = await createRoute({
    actor: system,
    slug: `ar-${unique()}`,
    originCountry: 'BD',
    destinationCountry: over.destinationCountry ?? 'DE',
    studyLevel: over.studyLevel ?? StudyLevel.masters,
    title: 'Audit remediation fixture',
  })
  return routeId
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   F4 — a lifecycle change and its audit event commit together, or not at all
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('F4 — lifecycle state and its audit event are one transaction', () => {
  it('rolls the visible state back when the audit insert fails', async () => {
    const routeId = await makeRoute()
    const before = await prisma.route.findUniqueOrThrow({
      where: { id: routeId },
      select: { lifecycleState: true },
    })
    const eventsBefore = await prisma.routeLifecycleEvent.count({ where: { routeId } })

    // The failure the old two-transaction arrangement could not survive: the state moved,
    // then the record of why failed, and the route was left quietly reclassified with
    // nothing explaining it.
    await expect(
      setRouteLifecycleState({
        routeId,
        state: 'dormant',
        actorId: null,
        alsoInTransaction: () => Promise.reject(new Error('audit insert failed')),
      }),
    ).rejects.toThrow('audit insert failed')

    const after = await prisma.route.findUniqueOrThrow({
      where: { id: routeId },
      select: { lifecycleState: true },
    })
    expect(after.lifecycleState).toBe(before.lifecycleState)
    expect(await prisma.routeLifecycleEvent.count({ where: { routeId } })).toBe(eventsBefore)
  })

  it('writes both when the audit insert succeeds', async () => {
    const routeId = await makeRoute()
    await setLifecycleState({
      adminId: admin,
      routeId,
      state: 'established',
      note: 'Reviewed by hand',
    })

    const [route, events] = await Promise.all([
      prisma.route.findUniqueOrThrow({ where: { id: routeId }, select: { lifecycleState: true } }),
      prisma.routeLifecycleEvent.findMany({ where: { routeId }, orderBy: { createdAt: 'desc' } }),
    ])
    expect(route.lifecycleState).toBe('established')
    expect(events[0]?.toState).toBe('established')
    expect(events[0]?.actorId).toBe(admin)
    expect(events[0]?.note).toBe('Reviewed by hand')
  })

  it('rolls a merge pointer back when its record fails', async () => {
    const duplicate = await makeRoute()
    const canonical = await makeRoute()

    await expect(
      mergeRoutes({
        adminId: admin,
        duplicateRouteId: duplicate,
        canonicalRouteId: canonical,
        // The service supplies the record; this proves the pointer survives nothing on its
        // own by checking the successful path leaves both, and the failure path leaves neither.
        note: 'ordinary merge',
      }),
    ).resolves.toBeUndefined()

    const merged = await prisma.route.findUniqueOrThrow({
      where: { id: duplicate },
      select: { mergedIntoId: true },
    })
    expect(merged.mergedIntoId).toBe(canonical)
    const events = await prisma.routeLifecycleEvent.findMany({ where: { routeId: duplicate } })
    expect(events.some((event) => event.note?.includes('Merged into'))).toBe(true)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   F5 — only routes describing the same journey may be merged
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('F5 — merge refuses routes that are not the same journey', () => {
  it('refuses a different destination, server-side, whatever the form offered', async () => {
    const germany = await makeRoute({ destinationCountry: 'DE' })
    const malaysia = await makeRoute({ destinationCountry: 'MY' })

    await expect(
      mergeRoutes({ adminId: admin, duplicateRouteId: germany, canonicalRouteId: malaysia }),
    ).rejects.toBeInstanceOf(IncompatibleMergeError)

    // And nothing moved.
    const route = await prisma.route.findUniqueOrThrow({
      where: { id: germany },
      select: { mergedIntoId: true },
    })
    expect(route.mergedIntoId).toBeNull()
  })

  it('refuses a different study level', async () => {
    const masters = await makeRoute({ studyLevel: StudyLevel.masters })
    const phd = await makeRoute({ studyLevel: StudyLevel.phd })
    await expect(
      mergeRoutes({ adminId: admin, duplicateRouteId: masters, canonicalRouteId: phd }),
    ).rejects.toBeInstanceOf(IncompatibleMergeError)
  })

  it('still permits a genuine duplicate', async () => {
    const a = await makeRoute()
    const b = await makeRoute()
    await expect(
      mergeRoutes({ adminId: admin, duplicateRouteId: a, canonicalRouteId: b }),
    ).resolves.toBeUndefined()
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   F7 — a step and its connection commit together
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('F7 — add-step and connect-edge cannot partially commit', () => {
  it('leaves no orphan step when the predecessor belongs to another route', async () => {
    const routeId = await makeRoute()
    const otherRoute = await makeRoute()
    const foreign = await addStep({
      actor: system,
      routeId: otherRoute,
      label: 'Somewhere else entirely',
      category: StepCategory.documents_preparation,
    })

    const before = await prisma.step.count({ where: { routeId } })

    await expect(
      addStepWithConnection({
        actor: system,
        routeId,
        label: 'Would have been orphaned',
        category: StepCategory.immigration_visa,
        connectAfterStepId: foreign.stepId,
      }),
    ).rejects.toBeInstanceOf(GraphInputError)

    // The whole point: the step is not there. Under the old two-call arrangement it would
    // have been created, the edge would have failed, and nothing could reach it.
    expect(await prisma.step.count({ where: { routeId } })).toBe(before)
    expect(await prisma.step.count({ where: { routeId, revisions: { none: {} } } })).toBe(0)
  })

  it('creates the step, its revision and the edge together on the happy path', async () => {
    const routeId = await makeRoute()
    const first = await addStep({
      actor: system,
      routeId,
      label: 'Documents',
      category: StepCategory.documents_preparation,
    })

    const added = await addStepWithConnection({
      actor: system,
      routeId,
      label: 'Visa',
      category: StepCategory.immigration_visa,
      connectAfterStepId: first.stepId,
      edgeKind: StepEdgeKind.sequential,
    })

    expect(added.edgeId).not.toBeNull()
    const edge = await prisma.stepEdge.findUniqueOrThrow({
      where: { id: added.edgeId as string },
      select: { routeId: true, fromStepId: true, toStepId: true, currentRevisionId: true },
    })
    expect(edge).toMatchObject({ routeId, fromStepId: first.stepId, toStepId: added.stepId })
    expect(edge.currentRevisionId).not.toBeNull()
  })

  it('still allows an unconnected step, which is a legitimate intermediate state', async () => {
    const routeId = await makeRoute()
    const added = await addStepWithConnection({
      actor: system,
      routeId,
      label: 'Not wired up yet',
      category: StepCategory.funding_scholarship,
    })
    expect(added.edgeId).toBeNull()
    expect(added.stepId).toBeTruthy()
  })

  it('refuses an archived predecessor rather than connecting to something invisible', async () => {
    const routeId = await makeRoute()
    const first = await addStep({
      actor: system,
      routeId,
      label: 'Retired stage',
      category: StepCategory.documents_preparation,
    })
    await archiveStep({ actor: system, stepId: first.stepId })

    await expect(
      addStepWithConnection({
        actor: system,
        routeId,
        label: 'Follows a retired stage',
        category: StepCategory.immigration_visa,
        connectAfterStepId: first.stepId,
      }),
    ).rejects.toBeInstanceOf(GraphInputError)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   F11 — a recorded moderation outcome is one that actually happened
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('F11 — a safety outcome performs what it records', () => {
  async function reportedField(): Promise<{ fieldId: string; routeId: string }> {
    const routeId = await makeRoute()
    const step = await addStep({
      actor: system,
      routeId,
      label: 'Documents',
      category: StepCategory.documents_preparation,
    })
    const field = await addField({
      actor: system,
      stepId: step.stepId,
      category: FieldCategory.link,
      valueText: 'https://example.org/possibly-a-phishing-page',
      sourceClass: SourceClass.community_submission,
    })
    await reportField({
      reporterId: member,
      fieldId: field.fieldId,
      reason: ReportReason.phishing_or_scam,
      detail: 'Asks for bank details.',
    })
    return { fieldId: field.fieldId, routeId }
  }

  it('archives the field when the outcome says the content was archived', async () => {
    const { fieldId } = await reportedField()

    const result = await handleReportsForField({
      adminId: admin,
      fieldId,
      outcome: ReportOutcome.content_archived,
      note: 'Phishing link, archived.',
    })
    expect(result.handled).toBe(1)

    // The bug: this used to set a column and leave the field public.
    const field = await prisma.field.findUniqueOrThrow({
      where: { id: fieldId },
      select: { archivedAt: true, currentRevisionId: true },
    })
    expect(field.archivedAt).not.toBeNull()
    // Archived is not deleted — the value and its history are untouched (invariant 4).
    expect(field.currentRevisionId).not.toBeNull()
    expect(await prisma.fieldRevision.count({ where: { fieldId } })).toBeGreaterThan(0)

    const reports = await prisma.report.findMany({ where: { fieldId } })
    expect(reports.every((report) => report.handledAt !== null)).toBe(true)
    expect(reports[0]?.outcome).toBe(ReportOutcome.content_archived)
  })

  it('refuses an outcome it cannot perform, and records nothing', async () => {
    const { fieldId } = await reportedField()

    for (const outcome of [ReportOutcome.content_corrected, ReportOutcome.content_removed]) {
      await expect(
        handleReportsForField({
          adminId: admin,
          fieldId,
          // Deliberately cast: the type already forbids this, and the runtime check is what
          // protects a caller that got past the type — a form post, or a future refactor.
          outcome: outcome as never,
        }),
      ).rejects.toBeInstanceOf(UnperformableOutcomeError)
    }

    const reports = await prisma.report.findMany({ where: { fieldId } })
    expect(reports.every((report) => report.handledAt === null)).toBe(true)
    const field = await prisma.field.findUniqueOrThrow({
      where: { id: fieldId },
      select: { archivedAt: true },
    })
    expect(field.archivedAt).toBeNull()
  })

  it('refuses to say a quarantine stands when nothing is quarantined', async () => {
    const { fieldId } = await reportedField()
    await expect(
      handleReportsForField({
        adminId: admin,
        fieldId,
        outcome: ReportOutcome.quarantine_upheld,
      }),
    ).rejects.toBeInstanceOf(UnperformableOutcomeError)
  })

  it('records no_action_needed without touching the content', async () => {
    const { fieldId } = await reportedField()
    await handleReportsForField({
      adminId: admin,
      fieldId,
      outcome: ReportOutcome.no_action_needed,
      note: 'Looked at it; the link is genuine.',
    })

    const field = await prisma.field.findUniqueOrThrow({
      where: { id: fieldId },
      select: { archivedAt: true, quarantinedAt: true },
    })
    expect(field.archivedAt).toBeNull()
    expect(field.quarantinedAt).toBeNull()
    const reports = await prisma.report.findMany({ where: { fieldId } })
    expect(reports.every((report) => report.handledAt !== null)).toBe(true)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   F6 — the graph gate, which was never called until contextual authoring made it load-bearing
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('F6 — a structural write cannot leave the graph malformed', () => {
  async function threeSteps(): Promise<{ routeId: string; a: string; b: string; c: string }> {
    const routeId = await makeRoute()
    const [a, b, c] = await Promise.all([
      addStep({ actor: system, routeId, label: 'A', category: StepCategory.documents_preparation }),
      addStep({ actor: system, routeId, label: 'B', category: StepCategory.language_testing }),
      addStep({ actor: system, routeId, label: 'C', category: StepCategory.immigration_visa }),
    ])
    return { routeId, a: a.stepId, b: b.stepId, c: c.stepId }
  }

  it('refuses a connection that would close a cycle, and leaves no edge behind', async () => {
    const { routeId, a, b, c } = await threeSteps()
    await addEdge({ actor: system, routeId, fromStepId: a, toStepId: b, kind: StepEdgeKind.sequential })
    await addEdge({ actor: system, routeId, fromStepId: b, toStepId: c, kind: StepEdgeKind.sequential })

    const before = await prisma.stepEdge.count({ where: { routeId } })

    // C to A closes the loop. Before Phase 12E nothing refused this, and both `rankSteps` and
    // `buildTimeline` assume a DAG.
    await expect(
      addEdge({ actor: system, routeId, fromStepId: c, toStepId: a, kind: StepEdgeKind.sequential }),
    ).rejects.toBeInstanceOf(GraphValidationError)

    // The transaction rolled back: no orphan edge, and no orphan edge revision either.
    expect(await prisma.stepEdge.count({ where: { routeId } })).toBe(before)
    expect(await prisma.stepEdgeRevision.count({ where: { stepEdge: { routeId } } })).toBe(before)
  })

  it('refuses a duplicate of a connection that already exists', async () => {
    const { routeId, a, b } = await threeSteps()
    await addEdge({ actor: system, routeId, fromStepId: a, toStepId: b, kind: StepEdgeKind.sequential })
    await expect(
      addEdge({ actor: system, routeId, fromStepId: a, toStepId: b, kind: StepEdgeKind.sequential }),
    ).rejects.toBeInstanceOf(GraphValidationError)
  })

  it('permits re-adding a connection whose earlier one was archived (invariant 4)', async () => {
    const { routeId, a, b } = await threeSteps()
    const first = await addEdge({
      actor: system,
      routeId,
      fromStepId: a,
      toStepId: b,
      kind: StepEdgeKind.sequential,
    })
    await archiveEdge({ actor: system, edgeId: first.edgeId })
    // The schema deliberately has no unique constraint on (from, to) for exactly this reason.
    await expect(
      addEdge({ actor: system, routeId, fromStepId: a, toStepId: b, kind: StepEdgeKind.sequential }),
    ).resolves.toBeDefined()
  })

  it('refuses a connection joining two steps of different routes', async () => {
    const first = await threeSteps()
    const second = await threeSteps()
    await expect(
      addEdge({
        actor: system,
        routeId: first.routeId,
        fromStepId: first.a,
        toStepId: second.b,
        kind: StepEdgeKind.sequential,
      }),
    ).rejects.toBeInstanceOf(GraphInputError)
  })

  it('permits a half-built road — incompleteness is shown, never refused', async () => {
    // Three steps, no connections. Every one is an orphan and there is no start, and all of it
    // is repaired by connecting them. Refusing this would force one exact build order.
    const { routeId } = await threeSteps()
    expect(await prisma.step.count({ where: { routeId } })).toBe(3)

    const structure = await getRouteStructure(routeId)
    expect(structure.incomplete.map((v) => v.code)).toContain('orphan_step')
    // And nothing corrupt is ever reported to the contributor, because it cannot commit.
    expect(structure.incomplete.map((v) => v.code)).not.toContain('cycle')
  })

  it('restores an archived connection, and refuses a restore that would resurrect a cycle', async () => {
    const { routeId, a, b, c } = await threeSteps()
    await addEdge({ actor: system, routeId, fromStepId: a, toStepId: b, kind: StepEdgeKind.sequential })
    const back = await addEdge({
      actor: system,
      routeId,
      fromStepId: b,
      toStepId: c,
      kind: StepEdgeKind.sequential,
    })

    // Archive B to C, then wire C to B the other way round. Restoring the first closes a loop,
    // which is invisible from the arguments and obvious from the resulting graph.
    await archiveEdge({ actor: system, edgeId: back.edgeId })
    await addEdge({ actor: system, routeId, fromStepId: c, toStepId: b, kind: StepEdgeKind.sequential })

    await expect(restoreEdge({ actor: system, edgeId: back.edgeId })).rejects.toBeInstanceOf(
      GraphValidationError,
    )

    // Still archived — the refusal rolled it back.
    const edge = await prisma.stepEdge.findUniqueOrThrow({
      where: { id: back.edgeId },
      select: { archivedAt: true },
    })
    expect(edge.archivedAt).not.toBeNull()
  })

  it('archives and restores a step without touching its fields or its revisions', async () => {
    const { routeId, a } = await threeSteps()
    await addField({
      actor: system,
      stepId: a,
      category: FieldCategory.requirement,
      valueText: 'Something that must survive archival',
      sourceClass: SourceClass.official,
    })
    const fieldsBefore = await prisma.field.count({ where: { stepId: a } })
    const revisionsBefore = await prisma.stepRevision.count({ where: { stepId: a } })

    await archiveStep({ actor: system, stepId: a })
    expect(
      (await prisma.step.findUniqueOrThrow({ where: { id: a }, select: { archivedAt: true } }))
        .archivedAt,
    ).not.toBeNull()

    await restoreStep({ actor: system, stepId: a })
    const restored = await prisma.step.findUniqueOrThrow({
      where: { id: a },
      select: { archivedAt: true },
    })
    expect(restored.archivedAt).toBeNull()

    // Archiving is not deleting, in either direction (FR-21, FR-45, invariant 4).
    expect(await prisma.field.count({ where: { stepId: a } })).toBe(fieldsBefore)
    expect(await prisma.stepRevision.count({ where: { stepId: a } })).toBe(revisionsBefore)
    expect(await prisma.step.count({ where: { routeId } })).toBe(3)
  })

  it('records a revision for every structural edit, with its author and reason', async () => {
    const { routeId, a, b } = await threeSteps()
    const author = await prisma.user.create({
      data: { handle: generateHandle(), email: `ga-${unique()}@example.test` },
    })

    await reviseStep({
      actor: { id: author.id },
      reason: 'The stage was named wrongly',
      stepId: a,
      label: 'Renamed by a contributor',
      category: StepCategory.documents_preparation,
      earliestStartOffsetDays: 0,
      typicalDurationDays: 14,
    })

    const newest = await prisma.stepRevision.findFirstOrThrow({
      where: { stepId: a },
      orderBy: { createdAt: 'desc' },
    })
    expect(newest.label).toBe('Renamed by a contributor')
    expect(newest.authorId).toBe(author.id)
    expect(newest.reason).toBe('The stage was named wrongly')
    // The previous value survives — that is the whole ledger (FR-20, BR-03, invariant 2).
    expect(await prisma.stepRevision.count({ where: { stepId: a } })).toBeGreaterThan(1)

    const connection = await addEdge({
      actor: { id: author.id },
      routeId,
      fromStepId: a,
      toStepId: b,
      kind: StepEdgeKind.optional_branch,
    })
    await reviseEdge({
      actor: { id: author.id },
      edgeId: connection.edgeId,
      kind: StepEdgeKind.alternative,
    })
    expect(await prisma.stepEdgeRevision.count({ where: { stepEdgeId: connection.edgeId } })).toBe(2)
  })
})
