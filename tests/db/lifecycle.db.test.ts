import { randomUUID } from 'node:crypto'

import { beforeAll, describe, expect, it } from 'vitest'

import {
  FieldCategory,
  JourneyStepStatus,
  RouteLifecycleState,
  SourceClass,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
  UserRole,
} from '../../src/domain/enums'
import { DORMANCY_DAYS } from '../../src/domain/lifecycle'
import { generateHandle } from '../../src/server/auth/handle'
import { prisma } from '../../src/server/db/client'
import { followRoute, setStepProgress } from '../../src/server/journeys/service'
import { getJourneyForRoute } from '../../src/server/journeys/read'
import {
  canonicalFor,
  lifecycleHistory,
  mergedIntoThis,
  openDuplicateFlags,
} from '../../src/server/lifecycle/read'
import {
  applyProposedLifecycle,
  flagDuplicate,
  LifecycleError,
  mergeRoutes,
  NotAnAdministratorError,
  resolveDuplicateFlag,
  setLifecycleState,
  unmergeRoute,
} from '../../src/server/lifecycle/service'
import { loadRouteGraph } from '../../src/server/revisions/read'
import {
  addEdge,
  addField,
  addStep,
  confirmField,
  createRoute,
  reviseField,
  reviseStep,
} from '../../src/server/revisions/service'
import { getRouteBySlug, getRouteHistory, searchRoutes } from '../../src/server/routes/read'

/**
 * Phase 11 — lifecycle and merge against a real database.
 *
 * The unit suite proves the transition rules; this proves they hold against real revision
 * ledgers, real journeys and real timestamps — and it proves the two claims that cannot be
 * made without a database:
 *
 *   **A merge loses nothing.** Two routes with independent histories, followers on both, and
 *   after the merge every history entry, every follower, every private note and every
 *   contributor attribution is exactly where it was.
 *
 *   **Dormancy and staleness stay apart.** An unused new route parks; an established route
 *   with the same silence does not, however long it has been quiet.
 */

const url = process.env.TEST_DATABASE_URL
const system = { id: null, system: true }

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number): Date => new Date(Date.now() - n * DAY)

let admin: string
let member: string
let follower1: string
let follower2: string

beforeAll(async () => {
  if (!url) return
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [a, m, f1, f2] = await Promise.all([
    prisma.user.create({
      data: { handle: generateHandle(), email: `la-${suffix}@example.test`, role: UserRole.admin },
    }),
    prisma.user.create({ data: { handle: generateHandle(), email: `lm-${suffix}@example.test` } }),
    prisma.user.create({ data: { handle: generateHandle(), email: `l1-${suffix}@example.test` } }),
    prisma.user.create({ data: { handle: generateHandle(), email: `l2-${suffix}@example.test` } }),
  ])
  admin = a.id
  member = m.id
  follower1 = f1.id
  follower2 = f2.id
}, 180_000)

interface Fixture {
  readonly routeId: string
  readonly slug: string
  readonly steps: Record<string, string>
}

/** A route with two steps and a field, built through the ordinary revision service. */
async function makeRoute(prefix: string, authorId: string | null = null): Promise<Fixture> {
  const slug = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const actor = authorId === null ? system : { id: authorId }

  const { routeId } = await createRoute({
    actor,
    slug,
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    title: `Route ${prefix}`,
  })

  const first = await addStep({
    actor,
    routeId,
    label: `${prefix} documents`,
    category: StepCategory.documents_preparation,
  })
  const second = await addStep({
    actor,
    routeId,
    label: `${prefix} visa`,
    category: StepCategory.immigration_visa,
  })
  await addEdge({
    actor,
    routeId,
    fromStepId: first.stepId,
    toStepId: second.stepId,
    kind: StepEdgeKind.sequential,
  })
  await addField({
    actor,
    stepId: first.stepId,
    category: FieldCategory.requirement,
    valueText: `${prefix} needs a passport`,
    sourceClass: SourceClass.official,
  })

  return { routeId, slug, steps: { first: first.stepId, second: second.stepId } }
}

/**
 * A clock `days` in the future, for reaching the dormancy period without waiting 30 days.
 *
 * **Deliberately not backdating the fixtures.** The first attempt rewrote `createdAt` on the
 * route and its revisions, and the revision tables refused — Postgres triggers make every
 * revision row immutable (the Phase 2 migration). That refusal is the ledger working, and
 * fighting it in a test would have meant weakening the thing the whole product rests on.
 *
 * Moving the observer instead is also the better test: it exercises the same code path
 * production uses, with `now` supplied rather than assumed, and it needs no privileged write.
 */
const later = (days: number): Date => new Date(Date.now() + days * DAY)

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Invariant 23 — dormancy against real routes
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('FR-38, D-20, invariant 23 — an unused new route goes dormant', () => {
  it('parks a route nobody used, and takes it out of search without deleting it', async () => {
    const route = await makeRoute('dormant')
    const when = later(DORMANCY_DAYS + 5)

    const before = (await searchRoutes({ originCountry: 'BD', destinationCountry: 'DE' })).routes
    expect(before.map((r) => r.slug)).toContain(route.slug)

    const result = await applyProposedLifecycle(route.routeId, when)
    expect(result.applied?.to).toBe(RouteLifecycleState.dormant)
    expect(result.applied?.reason).toBe('unused_since_creation')

    // Out of the listing...
    const after = (await searchRoutes({ originCountry: 'BD', destinationCountry: 'DE' })).routes
    expect(after.map((r) => r.slug)).not.toContain(route.slug)

    // ...and entirely intact. The page still loads, the road still has its steps, and the
    // history is untouched (FR-45, BR-15, invariants 1 and 4).
    const detail = await getRouteBySlug(route.slug)
    expect(detail).not.toBeNull()
    expect(detail?.lifecycleState).toBe(RouteLifecycleState.dormant)
    expect(detail?.stepCount).toBe(2)
    expect((await getRouteHistory(route.routeId)).length).toBeGreaterThan(0)
  })

  it('records the transition with the evidence it saw, and no report count', async () => {
    const route = await makeRoute('dormant-log')
    await applyProposedLifecycle(route.routeId, later(DORMANCY_DAYS + 1))

    const events = await lifecycleHistory(route.routeId)
    expect(events).toHaveLength(1)
    expect(events[0]?.toState).toBe(RouteLifecycleState.dormant)
    // Automatic: no actor, because no person decided.
    expect(events[0]?.actorHandle).toBeNull()

    const stored = await prisma.routeLifecycleEvent.findFirstOrThrow({
      where: { routeId: route.routeId },
      select: { evidence: true },
    })
    const evidence = JSON.stringify(stored.evidence)
    expect(evidence).toContain('followerCount')
    // Invariant 12's sibling: reports never enter a lifecycle decision.
    expect(evidence).not.toContain('report')
  })

  it('is idempotent — a second pass proposes nothing and logs nothing', async () => {
    const route = await makeRoute('dormant-twice')
    const when = later(DORMANCY_DAYS + 1)

    expect((await applyProposedLifecycle(route.routeId, when)).applied).not.toBeNull()
    expect((await applyProposedLifecycle(route.routeId, when)).applied).toBeNull()
    expect(await prisma.routeLifecycleEvent.count({ where: { routeId: route.routeId } })).toBe(1)
  })

  it('brings a dormant route back the moment somebody follows it', async () => {
    const route = await makeRoute('dormant-revive')
    const when = later(DORMANCY_DAYS + 1)
    await applyProposedLifecycle(route.routeId, when)

    await followRoute({ userId: follower1, routeId: route.routeId })

    const revived = await applyProposedLifecycle(route.routeId, when)
    expect(revived.applied?.to).toBe(RouteLifecycleState.experimental)
    expect(revived.applied?.reason).toBe('activity_resumed')
    // Back in search.
    const results = (await searchRoutes({ originCountry: 'BD', destinationCountry: 'DE' })).routes
    expect(results.map((r) => r.slug)).toContain(route.slug)
  })

  /**
   * **The distinction invariant 23 exists for**, against a real route.
   *
   * Two routes, identical silence: created long ago, nothing since. One is experimental and
   * parks; one is established and does not, however long it has been quiet.
   */
  it('never parks an established route with exactly the same silence', async () => {
    const [newish, settled] = await Promise.all([makeRoute('quiet-new'), makeRoute('quiet-old')])
    // One clock, 400 days on. Identical silence for both routes — the only difference is
    // which lifecycle state they are in, which is exactly what invariant 23 turns on.
    const when = later(400)
    await setLifecycleState({
      adminId: admin,
      routeId: settled.routeId,
      state: RouteLifecycleState.established,
      note: 'Reviewed and established',
    })

    const parked = await applyProposedLifecycle(newish.routeId, when)
    const quiet = await applyProposedLifecycle(settled.routeId, when)

    expect(parked.applied?.to).toBe(RouteLifecycleState.dormant)
    // Quiet, never dormant — and quiet is not a defect.
    expect(quiet.applied?.to).toBe(RouteLifecycleState.quiet)
    expect(quiet.applied?.reason).toBe('no_recent_activity')

    // And the established-but-quiet route stays in search, because it is still a route people
    // can use (FR-39, BR-10).
    const results = (await searchRoutes({ originCountry: 'BD', destinationCountry: 'DE' })).routes
    expect(results.map((r) => r.slug)).toContain(settled.slug)
    expect(results.map((r) => r.slug)).not.toContain(newish.slug)
  })

  it('produces no caution for a quiet route in the route projection', async () => {
    const route = await makeRoute('quiet-caution')
    await setLifecycleState({
      adminId: admin,
      routeId: route.routeId,
      state: RouteLifecycleState.established,
    })
    await applyProposedLifecycle(route.routeId, later(400))

    const detail = await getRouteBySlug(route.slug)
    expect(detail?.lifecycleState).toBe(RouteLifecycleState.quiet)
    // The passport's own caution list carries nothing about the lifecycle state.
    const { snapshotCautions } = await import('../../src/domain/trust')
    expect(snapshotCautions(detail!.trust)).not.toContain('lifecycle_not_established')
  })

  it('marks a route stale from its own stored review date, not from silence', async () => {
    const route = await makeRoute('stale')
    await setLifecycleState({
      adminId: admin,
      routeId: route.routeId,
      state: RouteLifecycleState.established,
    })
    // A contributor's own review date, now past. No period is assumed anywhere.
    await prisma.$executeRaw`
      UPDATE fields SET "reviewDueAt" = ${daysAgo(2)}
      WHERE "stepId" = ${route.steps.first}
    `

    const result = await applyProposedLifecycle(route.routeId)
    expect(result.applied?.to).toBe(RouteLifecycleState.stale)
    expect(result.applied?.reason).toBe('review_overdue')
    // Stale, not dormant — different concepts, different routes (§19.1).
    expect(result.applied?.to).not.toBe(RouteLifecycleState.dormant)
  })

  it('leaves an administrator’s archival alone', async () => {
    const route = await makeRoute('archived')
    await setLifecycleState({
      adminId: admin,
      routeId: route.routeId,
      state: RouteLifecycleState.archived,
      note: 'Superseded by policy change',
    })

    // Nothing automatic may move it back out, in either direction (invariant 14) — not even
    // 900 days later with everything overdue.
    expect((await applyProposedLifecycle(route.routeId, later(900))).applied).toBeNull()

    const detail = await getRouteBySlug(route.slug)
    expect(detail?.lifecycleState).toBe(RouteLifecycleState.archived)
    // Archived leaves search and stays readable with its history (FR-45, BR-15).
    const results = (await searchRoutes({})).routes
    expect(results.map((r) => r.slug)).not.toContain(route.slug)
    expect((await getRouteHistory(route.routeId)).length).toBeGreaterThan(0)
  })

  it('refuses every administrator action to an ordinary member', async () => {
    const route = await makeRoute('perm')
    for (const attempt of [
      () =>
        setLifecycleState({
          adminId: member,
          routeId: route.routeId,
          state: RouteLifecycleState.established,
        }),
      () =>
        mergeRoutes({
          adminId: member,
          duplicateRouteId: route.routeId,
          canonicalRouteId: route.routeId,
        }),
      () => unmergeRoute({ adminId: member, routeId: route.routeId }),
    ]) {
      await expect(attempt()).rejects.toThrow(NotAnAdministratorError)
    }

    const unchanged = await prisma.route.findUniqueOrThrow({ where: { id: route.routeId } })
    expect(unchanged.lifecycleState).toBe(RouteLifecycleState.experimental)
    expect(unchanged.mergedIntoId).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Merge — invariant 20, FR-40, FR-58, BR-25, D-38
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('FR-40, FR-58, BR-25, invariant 20 — a merge loses nothing', () => {
  /**
   * **The Phase 11 exit criterion, in one test.**
   *
   * Two routes with genuinely independent revision histories, a different follower on each
   * with private progress recorded, contributions by two different people. After the merge:
   * both histories reconstructable, both followers intact, both sets of private notes and
   * dates untouched, and every contribution still attributed to whoever made it.
   */
  it('preserves both histories, both follower sets and both journeys', async () => {
    const duplicate = await makeRoute('merge-dup', member)
    const canonical = await makeRoute('merge-canon', admin)

    // Independent histories: each route is revised by a different contributor.
    await reviseStep({
      actor: { id: member },
      stepId: duplicate.steps.first ?? '',
      label: 'Duplicate documents, revised',
      category: StepCategory.documents_preparation,
    })
    await reviseStep({
      actor: { id: admin },
      stepId: canonical.steps.first ?? '',
      label: 'Canonical documents, revised',
      category: StepCategory.documents_preparation,
    })

    // A follower on each, with private progress on each.
    const dupJourney = await followRoute({ userId: follower1, routeId: duplicate.routeId })
    const canonJourney = await followRoute({ userId: follower2, routeId: canonical.routeId })
    const privateNote = `note-${randomUUID().slice(0, 8)}`
    await setStepProgress({
      userId: follower1,
      journeyId: dupJourney.journeyId,
      stepId: duplicate.steps.first ?? '',
      status: JourneyStepStatus.completed,
      actualDate: daysAgo(5),
      privateNote,
    })
    await setStepProgress({
      userId: follower2,
      journeyId: canonJourney.journeyId,
      stepId: canonical.steps.first ?? '',
      status: JourneyStepStatus.in_progress,
    })

    const historyBefore = {
      duplicate: await getRouteHistory(duplicate.routeId),
      canonical: await getRouteHistory(canonical.routeId),
    }
    expect(historyBefore.duplicate.length).toBeGreaterThan(0)
    expect(historyBefore.canonical.length).toBeGreaterThan(0)

    // ── the merge ──────────────────────────────────────────────────────────────────────────
    await mergeRoutes({
      adminId: admin,
      duplicateRouteId: duplicate.routeId,
      canonicalRouteId: canonical.routeId,
      note: 'Same journey, different wording',
    })

    // 1. Both histories are still reconstructable, entry for entry.
    expect(await getRouteHistory(duplicate.routeId)).toEqual(historyBefore.duplicate)
    expect(await getRouteHistory(canonical.routeId)).toEqual(historyBefore.canonical)

    // 2. Contributions stay attributed to whoever made them.
    const duplicateAuthors = new Set(
      (await getRouteHistory(duplicate.routeId)).map((entry) => entry.authorHandle),
    )
    const memberHandle = (
      await prisma.user.findUniqueOrThrow({ where: { id: member }, select: { handle: true } })
    ).handle
    expect(duplicateAuthors).toContain(memberHandle)

    // 3. Both follower sets survive — neither was moved, neither was deleted.
    const keptDup = await getJourneyForRoute(follower1, duplicate.routeId)
    const keptCanon = await getJourneyForRoute(follower2, canonical.routeId)
    expect(keptDup).not.toBeNull()
    expect(keptCanon).not.toBeNull()
    expect(keptDup?.routeId).toBe(duplicate.routeId)
    expect(keptCanon?.routeId).toBe(canonical.routeId)

    // 4. Private progress is exactly as it was.
    const kept = keptDup?.progress.find((row) => row.stepId === duplicate.steps.first)
    expect(kept?.status).toBe(JourneyStepStatus.completed)
    expect(kept?.privateNote).toBe(privateNote)
    expect(kept?.actualDate?.toDateString()).toBe(daysAgo(5).toDateString())

    // 5. The duplicate is still a valid, readable route that renders — and it now says where
    //    the community maintains this journey (§40.4).
    const detail = await getRouteBySlug(duplicate.slug)
    expect(detail).not.toBeNull()
    expect(detail?.stepCount).toBe(2)
    expect(detail?.mergedInto?.slug).toBe(canonical.slug)

    // 6. It leaves search; the survivor stays.
    const results = (await searchRoutes({ originCountry: 'BD', destinationCountry: 'DE' })).routes
    expect(results.map((r) => r.slug)).not.toContain(duplicate.slug)
    expect(results.map((r) => r.slug)).toContain(canonical.slug)

    // 7. The relationship is visible from both sides.
    expect((await canonicalFor(duplicate.routeId))?.canonicalSlug).toBe(canonical.slug)
    expect((await mergedIntoThis(canonical.routeId)).map((r) => r.slug)).toContain(duplicate.slug)

    // 8. Nothing was moved: every step still belongs to the route that authored it.
    const dupGraph = await loadRouteGraph(duplicate.routeId)
    const canonGraph = await loadRouteGraph(canonical.routeId)
    expect(dupGraph.steps).toHaveLength(2)
    expect(canonGraph.steps).toHaveLength(2)
    expect(dupGraph.steps.map((s) => s.id).sort()).toEqual(
      [duplicate.steps.first, duplicate.steps.second].sort(),
    )
  })

  /**
   * Both graphs still render through the one generic renderer, unchanged — invariant 24. The
   * merged route is not a special case with its own drawing path; it is a route graph like
   * any other, which is why nothing in the renderer had to know a merge happened.
   */
  it('renders both routes through the ordinary layout pass after the merge', async () => {
    const duplicate = await makeRoute('merge-render-dup')
    const canonical = await makeRoute('merge-render-canon')
    await mergeRoutes({
      adminId: admin,
      duplicateRouteId: duplicate.routeId,
      canonicalRouteId: canonical.routeId,
    })

    const { layout, ROAD } = await import('../../src/renderer')
    for (const routeId of [duplicate.routeId, canonical.routeId]) {
      const graph = await loadRouteGraph(routeId)
      const frame = layout(graph, ROAD)
      expect(frame.nodes).toHaveLength(2)
      expect(frame.width).toBeGreaterThan(0)
      for (const node of frame.nodes) expect(node.step.label).not.toBe('')
    }
  })

  it('is reversible, and reversing it restores search visibility', async () => {
    const duplicate = await makeRoute('merge-undo-dup')
    const canonical = await makeRoute('merge-undo-canon')
    await followRoute({ userId: follower1, routeId: duplicate.routeId })

    await mergeRoutes({
      adminId: admin,
      duplicateRouteId: duplicate.routeId,
      canonicalRouteId: canonical.routeId,
    })
    expect((await getRouteBySlug(duplicate.slug))?.mergedInto).not.toBeNull()

    await unmergeRoute({ adminId: admin, routeId: duplicate.routeId, note: 'Different intakes' })

    expect((await getRouteBySlug(duplicate.slug))?.mergedInto).toBeNull()
    const results = (await searchRoutes({ originCountry: 'BD', destinationCountry: 'DE' })).routes
    expect(results.map((r) => r.slug)).toContain(duplicate.slug)
    // The follower never noticed.
    expect(await getJourneyForRoute(follower1, duplicate.routeId)).not.toBeNull()

    // Both decisions stay on the record.
    const events = await lifecycleHistory(duplicate.routeId)
    expect(events.filter((e) => e.note?.includes('Merged into'))).toHaveLength(1)
    expect(events.filter((e) => e.note?.includes('Merge reversed'))).toHaveLength(1)
  })

  it('follows a merge chain to the route a reader should actually open', async () => {
    const first = await makeRoute('chain-a')
    const second = await makeRoute('chain-b')
    const third = await makeRoute('chain-c')

    await mergeRoutes({
      adminId: admin,
      duplicateRouteId: first.routeId,
      canonicalRouteId: second.routeId,
    })
    await mergeRoutes({
      adminId: admin,
      duplicateRouteId: second.routeId,
      canonicalRouteId: third.routeId,
    })

    expect((await canonicalFor(first.routeId))?.canonicalSlug).toBe(third.slug)
  })

  it('refuses a self-merge, a double merge and a cycle', async () => {
    const a = await makeRoute('cycle-a')
    const b = await makeRoute('cycle-b')

    await expect(
      mergeRoutes({ adminId: admin, duplicateRouteId: a.routeId, canonicalRouteId: a.routeId }),
    ).rejects.toThrow(LifecycleError)

    await mergeRoutes({ adminId: admin, duplicateRouteId: a.routeId, canonicalRouteId: b.routeId })

    // Already merged.
    await expect(
      mergeRoutes({ adminId: admin, duplicateRouteId: a.routeId, canonicalRouteId: b.routeId }),
    ).rejects.toThrow(LifecycleError)

    // b → a would close the loop, leaving neither reachable as canonical.
    await expect(
      mergeRoutes({ adminId: admin, duplicateRouteId: b.routeId, canonicalRouteId: a.routeId }),
    ).rejects.toThrow(LifecycleError)
  })

  /**
   * §40.1 — routes that overlap heavily but describe different journeys must stay separate,
   * and a merge must never be something a count can cause.
   */
  it('never merges anything by itself, however many people flag it', async () => {
    const a = await makeRoute('flag-a')
    const b = await makeRoute('flag-b')

    for (let i = 0; i < 10; i += 1) {
      const reporter = await prisma.user.create({
        data: { handle: generateHandle(), email: `flag-${i}-${randomUUID()}@example.test` },
      })
      await flagDuplicate({
        flaggedById: reporter.id,
        routeId: a.routeId,
        duplicateOfId: b.routeId,
        note: 'These look the same to me',
      })
    }

    const stored = await prisma.route.findUniqueOrThrow({ where: { id: a.routeId } })
    expect(stored.mergedIntoId).toBeNull()
    expect(stored.lifecycleState).toBe(RouteLifecycleState.experimental)
    // Still in search: a flag changes nothing (invariant 14).
    const results = (await searchRoutes({ originCountry: 'BD', destinationCountry: 'DE' })).routes
    expect(results.map((r) => r.slug)).toContain(a.slug)

    // The queue shows them, and shows them oldest-first with no tally.
    const queue = await openDuplicateFlags()
    const mine = queue.filter((flag) => flag.routeSlug === a.slug)
    expect(mine.length).toBeGreaterThan(0)
    expect(Object.keys(mine[0] ?? {})).not.toContain('count')
  })

  it('counts one person flagging twice as one opinion', async () => {
    const a = await makeRoute('flag-once-a')
    const b = await makeRoute('flag-once-b')

    await flagDuplicate({ flaggedById: member, routeId: a.routeId, duplicateOfId: b.routeId })
    await flagDuplicate({
      flaggedById: member,
      routeId: a.routeId,
      duplicateOfId: b.routeId,
      note: 'Actually, here is a better reason',
    })

    expect(
      await prisma.duplicateFlag.count({
        where: { routeId: a.routeId, duplicateOfId: b.routeId },
      }),
    ).toBe(1)
  })

  it('lets an administrator close a flag as "genuinely different"', async () => {
    const a = await makeRoute('flag-diff-a')
    const b = await makeRoute('flag-diff-b')
    const { flagId } = await flagDuplicate({
      flaggedById: member,
      routeId: a.routeId,
      duplicateOfId: b.routeId,
    })

    await resolveDuplicateFlag({
      adminId: admin,
      flagId,
      note: 'Different funding mechanism — §40.1',
    })

    expect((await openDuplicateFlags()).map((f) => f.id)).not.toContain(flagId)
    // Closed, not deleted: the disagreement stays on the record.
    const stored = await prisma.duplicateFlag.findUniqueOrThrow({ where: { id: flagId } })
    expect(stored.resolvedAt).not.toBeNull()
    expect(stored.resolutionNote).toContain('Different funding')

    // Both routes are untouched by the whole exchange.
    for (const route of [a, b]) {
      const detail = await getRouteBySlug(route.slug)
      expect(detail?.mergedInto).toBeNull()
      expect(detail?.stepCount).toBe(2)
    }
  })

  it('refuses to delete a lifecycle event or a duplicate flag', async () => {
    const route = await makeRoute('undeletable')
    await setLifecycleState({
      adminId: admin,
      routeId: route.routeId,
      state: RouteLifecycleState.developing,
    })

    await expect(
      prisma.routeLifecycleEvent.deleteMany({ where: { routeId: route.routeId } }),
    ).rejects.toThrow()

    const other = await makeRoute('undeletable-2')
    const { flagId } = await flagDuplicate({
      flaggedById: member,
      routeId: route.routeId,
      duplicateOfId: other.routeId,
    })
    await expect(prisma.duplicateFlag.deleteMany({ where: { id: flagId } })).rejects.toThrow()
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Change propagation still works across a merge — Phase 10 held
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('a follower of a merged route keeps everything Phase 10 gave them', () => {
  it('still sees its changes and its shadow comparison', async () => {
    const duplicate = await makeRoute('merged-changes')
    const canonical = await makeRoute('merged-changes-canon')
    const journey = await followRoute({ userId: follower1, routeId: duplicate.routeId })
    await setStepProgress({
      userId: follower1,
      journeyId: journey.journeyId,
      stepId: duplicate.steps.first ?? '',
      status: JourneyStepStatus.completed,
      actualDate: daysAgo(3),
    })

    await mergeRoutes({
      adminId: admin,
      duplicateRouteId: duplicate.routeId,
      canonicalRouteId: canonical.routeId,
    })

    // The route continues to be maintainable — a merge is not a freeze.
    const field = await prisma.field.findFirstOrThrow({
      where: { step: { routeId: duplicate.routeId } },
      select: { id: true },
    })
    await reviseField({
      actor: { id: member },
      fieldId: field.id,
      valueText: 'Passport must be valid for two years',
      sourceClass: SourceClass.official,
    })
    await confirmField({ actor: { id: follower2 }, fieldId: field.id })

    const { followerChangeReport } = await import('../../src/server/journeys/changes')
    const report = await followerChangeReport(follower1, duplicate.routeId)
    expect(report).not.toBeNull()

    const { shadowSince } = await import('../../src/server/changes/read')
    const shadow = await shadowSince(duplicate.routeId, report!.startedAt)
    expect(shadow.fieldsChanged).toBeGreaterThan(0)

    // And the completion is exactly where they left it (FR-30, BR-17, invariant 8).
    const kept = await getJourneyForRoute(follower1, duplicate.routeId)
    expect(
      kept?.progress.find((row) => row.stepId === duplicate.steps.first)?.status,
    ).toBe(JourneyStepStatus.completed)
  })
})
