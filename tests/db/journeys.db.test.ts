import { beforeAll, describe, expect, it } from 'vitest'

import {
  FieldCategory,
  JourneyStepStatus,
  RouteMechanism,
  SourceClass,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
} from '../../src/domain/enums'
import { generateHandle } from '../../src/server/auth/handle'
import { prisma } from '../../src/server/db/client'
import { getJourneyForRoute, listJourneys } from '../../src/server/journeys/read'
import {
  addTask,
  deleteJourney,
  followRoute,
  setSelfReportedCompletion,
  setStepProgress,
  unfollowRoute,
} from '../../src/server/journeys/service'
import {
  addEdge,
  addField,
  addStep,
  archiveStep,
  createRoute,
  reviseStep,
} from '../../src/server/revisions/service'
import { getRouteBySlug } from '../../src/server/routes/read'

/**
 * Phase 7 — private journeys against a real database.
 *
 * Invariant tests 5, 5b, 8 and 18. The architecture suite proves the *shape* — that no
 * function exists which could read a journey without a user id. This proves the behaviour:
 * two real users, two real journeys, and every attempt by one to touch the other's.
 */

const url = process.env.TEST_DATABASE_URL
const actor = { id: null, system: true }

interface Fixture {
  readonly routeId: string
  readonly slug: string
  readonly firstStepId: string
  readonly secondStepId: string
  readonly rahim: string
  readonly nadia: string
}

let fx: Fixture

beforeAll(async () => {
  if (!url) return

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const slug = `journey-${suffix}`

  const { routeId } = await createRoute({
    actor,
    slug,
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    title: 'A route two people follow',
  })

  const first = await addStep({
    actor,
    routeId,
    label: 'Documents',
    category: StepCategory.documents_preparation,
    earliestStartOffsetDays: 0,
    typicalDurationDays: 30,
  })
  const second = await addStep({
    actor,
    routeId,
    label: 'Language test',
    category: StepCategory.language_testing,
    typicalDurationDays: 60,
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
    valueText: 'Certified copies of every transcript',
    sourceClass: SourceClass.official,
  })

  // Two real people. The whole point of this file is what one cannot do to the other.
  const [rahim, nadia] = await Promise.all([
    prisma.user.create({ data: { handle: generateHandle(), email: `a-${suffix}@example.test` } }),
    prisma.user.create({ data: { handle: generateHandle(), email: `b-${suffix}@example.test` } }),
  ])

  fx = {
    routeId,
    slug,
    firstStepId: first.stepId,
    secondStepId: second.stepId,
    rahim: rahim.id,
    nadia: nadia.id,
  }
}, 180_000)

describe.skipIf(!url)('following a route — FR-23, FR-27, invariant 18', () => {
  it('creates one journey per person per route, and following twice does not fork it', async () => {
    const first = await followRoute({ userId: fx.rahim, routeId: fx.routeId })
    const again = await followRoute({ userId: fx.rahim, routeId: fx.routeId })

    expect(again.journeyId).toBe(first.journeyId)
    expect(again.resumed).toBe(false)
  })

  /**
   * Invariant 18: following links, it does not copy.
   *
   * A step added to the public route after somebody started following must appear in their
   * journey. If following forked a snapshot, this is where that would show — and the whole
   * premise of the product ("benefit continuously as the community corrects the route")
   * would be false.
   */
  it('keeps the journey attached to the live route as the route grows', async () => {
    await followRoute({ userId: fx.nadia, routeId: fx.routeId })

    const before = await getRouteBySlug(fx.slug)
    const added = await addStep({
      actor,
      routeId: fx.routeId,
      label: 'Visa appointment',
      category: StepCategory.immigration_visa,
      typicalDurationDays: 21,
    })
    await addEdge({
      actor,
      routeId: fx.routeId,
      fromStepId: fx.secondStepId,
      toStepId: added.stepId,
      kind: StepEdgeKind.sequential,
    })

    const after = await getRouteBySlug(fx.slug)
    expect(after?.stepCount).toBe((before?.stepCount ?? 0) + 1)
    // The follower's journey points at the same route id, so the new step is simply there.
    const journey = await getJourneyForRoute(fx.nadia, fx.routeId)
    expect(journey?.routeId).toBe(after?.id)
  })
})

describe.skipIf(!url)('invariant 5 / test 5 — one user can never reach another user’s journey', () => {
  it('returns nothing when the wrong user asks for a journey', async () => {
    const { journeyId } = await followRoute({ userId: fx.rahim, routeId: fx.routeId })
    await setStepProgress({
      userId: fx.rahim,
      journeyId,
      stepId: fx.firstStepId,
      status: JourneyStepStatus.completed,
      privateNote: 'Collected them from the university office on Tuesday.',
    })

    // Nadia follows the same route. She gets her own journey and none of Rahim's detail.
    await followRoute({ userId: fx.nadia, routeId: fx.routeId })
    const hers = await getJourneyForRoute(fx.nadia, fx.routeId)

    expect(hers).not.toBeNull()
    expect(hers?.id).not.toBe(journeyId)
    expect(hers?.progress).toEqual([])
    expect(JSON.stringify(hers)).not.toContain('university office')
  })

  it('never lists another user’s journeys', async () => {
    await followRoute({ userId: fx.rahim, routeId: fx.routeId })
    const nadias = await listJourneys(fx.nadia)
    const rahims = await listJourneys(fx.rahim)

    const overlap = nadias.filter((n) => rahims.some((r) => r.id === n.id))
    expect(overlap).toEqual([])
  })

  it('refuses a write aimed at somebody else’s journey', async () => {
    const rahims = await followRoute({ userId: fx.rahim, routeId: fx.routeId })

    // Nadia holds Rahim's journey id — the situation a leaked id or a guessed one creates.
    // Every one of these is scoped in its own `where`, so none of them can move a row.
    await expect(
      setStepProgress({
        userId: fx.nadia,
        journeyId: rahims.journeyId,
        stepId: fx.firstStepId,
        privateNote: 'not mine to write',
      }),
    ).rejects.toThrow()

    await expect(
      addTask({ userId: fx.nadia, journeyId: rahims.journeyId, label: 'not mine' }),
    ).rejects.toThrow()

    // Prisma's `update` with a non-matching scope raises rather than silently doing nothing.
    await expect(
      setSelfReportedCompletion({
        userId: fx.nadia,
        journeyId: rahims.journeyId,
        completed: true,
      }),
    ).rejects.toThrow()

    await expect(
      deleteJourney({ userId: fx.nadia, journeyId: rahims.journeyId }),
    ).rejects.toThrow()

    // And Rahim's journey is exactly as he left it.
    const his = await getJourneyForRoute(fx.rahim, fx.routeId)
    expect(his?.selfReportedCompletedAt).toBeNull()
    expect(his?.tasks).toEqual([])
  })
})

describe.skipIf(!url)('invariant 5b / test 5b — aggregates cannot be reduced to a person', () => {
  /**
   * FR-41 and §12.3. Public statistics "may use aggregated signals only where they do not
   * expose private individual progress."
   *
   * The guarantee is structural: the route detail carries two integers and nothing else. No
   * user ids, no handles, no dates, no per-step breakdown — nothing a reader could narrow.
   */
  it('exposes counts and nothing else', async () => {
    await followRoute({ userId: fx.rahim, routeId: fx.routeId })
    await followRoute({ userId: fx.nadia, routeId: fx.routeId })
    const nadias = await getJourneyForRoute(fx.nadia, fx.routeId)
    await setSelfReportedCompletion({
      userId: fx.nadia,
      journeyId: nadias?.id ?? '',
      completed: true,
    })

    const route = await getRouteBySlug(fx.slug)
    expect(route?.trust.followerCount).toBeGreaterThanOrEqual(2)
    expect(route?.trust.selfReportedCompletionCount).toBeGreaterThanOrEqual(1)

    // Nothing in the public projection names a person or a private value.
    const serialised = JSON.stringify(route)
    expect(serialised).not.toContain(fx.rahim)
    expect(serialised).not.toContain(fx.nadia)
    expect(serialised).not.toMatch(/privateNote|targetDate|actualDate|traveller-/)
  })

  it('stops counting somebody who unfollowed', async () => {
    const { journeyId } = await followRoute({ userId: fx.rahim, routeId: fx.routeId })
    const before = await getRouteBySlug(fx.slug)
    await unfollowRoute({ userId: fx.rahim, journeyId })
    const after = await getRouteBySlug(fx.slug)

    expect(after?.trust.followerCount).toBe((before?.trust.followerCount ?? 0) - 1)
  })
})

describe.skipIf(!url)('unfollowing keeps the data — owner decision, 2026-09-03', () => {
  it('archives rather than destroys, and following again restores everything', async () => {
    const { journeyId } = await followRoute({ userId: fx.rahim, routeId: fx.routeId })
    await setStepProgress({
      userId: fx.rahim,
      journeyId,
      stepId: fx.secondStepId,
      status: JourneyStepStatus.in_progress,
      privateNote: 'Booked for November.',
    })

    await unfollowRoute({ userId: fx.rahim, journeyId })
    expect(await getJourneyForRoute(fx.rahim, fx.routeId)).toBeNull()

    const resumed = await followRoute({ userId: fx.rahim, routeId: fx.routeId })
    expect(resumed.resumed).toBe(true)
    expect(resumed.journeyId).toBe(journeyId)

    const back = await getJourneyForRoute(fx.rahim, fx.routeId)
    const note = back?.progress.find((row) => row.stepId === fx.secondStepId)
    expect(note?.privateNote).toBe('Booked for November.')
  })

  it('deletes permanently when the user explicitly asks, and touches no shared knowledge', async () => {
    const { journeyId } = await followRoute({ userId: fx.nadia, routeId: fx.routeId })
    await setStepProgress({
      userId: fx.nadia,
      journeyId,
      stepId: fx.firstStepId,
      privateNote: 'gone shortly',
    })

    const stepsBefore = await getRouteBySlug(fx.slug)
    await deleteJourney({ userId: fx.nadia, journeyId })

    expect(await getJourneyForRoute(fx.nadia, fx.routeId, { includeArchived: true })).toBeNull()
    expect(await prisma.journeyStepProgress.count({ where: { journeyId } })).toBe(0)

    // Invariant 1 is untouched: deleting private data removes no community knowledge.
    const stepsAfter = await getRouteBySlug(fx.slug)
    expect(stepsAfter?.stepCount).toBe(stepsBefore?.stepCount)
  })
})

describe.skipIf(!url)('invariant 8 / test 8 — a public change never erases private progress', () => {
  it('survives a revision of the step it points at', async () => {
    const { journeyId } = await followRoute({ userId: fx.rahim, routeId: fx.routeId })
    await setStepProgress({
      userId: fx.rahim,
      journeyId,
      stepId: fx.firstStepId,
      status: JourneyStepStatus.completed,
      actualDate: new Date('2026-05-01T00:00:00.000Z'),
      privateNote: 'Attested at the ministry.',
    })

    await reviseStep({
      actor,
      stepId: fx.firstStepId,
      label: 'Documents and attestation',
      category: StepCategory.documents_preparation,
      typicalDurationDays: 45,
      reason: 'Attestation is part of this step, not a separate one.',
    })

    const after = await getJourneyForRoute(fx.rahim, fx.routeId)
    const row = after?.progress.find((p) => p.stepId === fx.firstStepId)
    expect(row?.status).toBe(JourneyStepStatus.completed)
    expect(row?.privateNote).toBe('Attested at the ministry.')
    expect(row?.actualDate?.toISOString()).toBe('2026-05-01T00:00:00.000Z')
  })

  /**
   * The harder half: a step that leaves the public route entirely.
   *
   * Archiving removes it from current views but not from existence, so the follower's row
   * survives — and the database would physically refuse a hard delete anyway, because the
   * foreign key is `RESTRICT`. Both matter: one is the product rule, the other is the floor
   * under it.
   */
  it('survives the step being archived, and the database refuses to delete it at all', async () => {
    const { journeyId } = await followRoute({ userId: fx.rahim, routeId: fx.routeId })
    const doomed = await addStep({
      actor,
      routeId: fx.routeId,
      label: 'A step that will be archived',
      category: StepCategory.funding_scholarship,
    })
    await setStepProgress({
      userId: fx.rahim,
      journeyId,
      stepId: doomed.stepId,
      status: JourneyStepStatus.skipped,
      privateNote: 'Did not apply for this.',
    })

    await archiveStep({ actor, stepId: doomed.stepId })

    const after = await getJourneyForRoute(fx.rahim, fx.routeId)
    const row = after?.progress.find((p) => p.stepId === doomed.stepId)
    expect(row?.privateNote).toBe('Did not apply for this.')

    // Even with the write guard bypassed, the foreign key holds the line.
    await expect(prisma.step.delete({ where: { id: doomed.stepId } })).rejects.toThrow()
  })
})
