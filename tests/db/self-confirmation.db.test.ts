import { beforeAll, describe, expect, it } from 'vitest'

import {
  FieldCategory,
  JourneyStepStatus,
  RouteMechanism,
  SourceClass,
  StepCategory,
  StudyLevel,
} from '../../src/domain/enums'
import { generateHandle } from '../../src/server/auth/handle'
import { prisma } from '../../src/server/db/client'
import { followRoute, setStepProgress } from '../../src/server/journeys/service'
import { addField, addStep, confirmField, createRoute } from '../../src/server/revisions/service'
import { followersYetToReach } from '../../src/server/routes/read'

/**
 * Two contribution guarantees that have no visible surface, so they need a database to prove.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Self-confirmation** is the cheapest attack in the system. `confirmedContributionCount` on
 * the contributor page is the one signal that speaks to usefulness rather than volume, and it
 * only means anything because the confirmations come from *other people*. If an author can
 * confirm their own revision, a number designed to say "others agreed" says "I agreed with
 * myself", and it can be farmed to any value by one person in a loop.
 *
 * **The followers-ahead count** is the sentence that makes contributing worth doing. It has to
 * be right, and it has to identify nobody.
 */

const url = process.env.TEST_DATABASE_URL

interface Fixture {
  readonly authorId: string
  readonly strangerId: string
  readonly followerAId: string
  readonly followerBId: string
  readonly routeId: string
  readonly stepId: string
  readonly fieldId: string
}

let fx: Fixture

beforeAll(async () => {
  if (!url) return

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const people = await Promise.all(
    ['author', 'stranger', 'follower-a', 'follower-b'].map((who) =>
      prisma.user.create({
        data: { handle: generateHandle(), email: `${who}-${suffix}@example.test` },
      }),
    ),
  )
  const [author, stranger, followerA, followerB] = people as [
    (typeof people)[0],
    (typeof people)[0],
    (typeof people)[0],
    (typeof people)[0],
  ]

  const { routeId } = await createRoute({
    actor: { id: author.id, system: false },
    slug: `selfconfirm-${suffix}`,
    originCountry: 'BD',
    destinationCountry: 'JP',
    studyLevel: StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    title: 'A route for testing who may vouch for what',
  })

  const step = await addStep({
    actor: { id: author.id, system: false },
    routeId,
    label: 'Apply for the Certificate of Eligibility',
    category: StepCategory.immigration_visa,
    typicalDurationDays: 30,
  })

  // Written by `author`. Nobody else has touched it.
  const field = await addField({
    actor: { id: author.id, system: false },
    stepId: step.stepId,
    category: FieldCategory.requirement,
    valueText: 'The university applies for the CoE on your behalf',
    sourceClass: SourceClass.official,
  })

  fx = {
    authorId: author.id,
    strangerId: stranger.id,
    followerAId: followerA.id,
    followerBId: followerB.id,
    routeId,
    stepId: step.stepId,
    fieldId: field.fieldId,
  }
})

describe.skipIf(!url)('a person cannot vouch for their own work', () => {
  it('writes no confirmation when the author confirms their own revision', async () => {
    await confirmField({
      actor: { id: fx.authorId, system: false },
      fieldId: fx.fieldId,
    })

    const rows = await prisma.confirmation.count({
      where: { fieldId: fx.fieldId, authorId: fx.authorId },
    })
    expect(rows, 'the author must not appear in their own confirmation count').toBe(0)
  })

  it('still accepts a confirmation from somebody else', async () => {
    await confirmField({
      actor: { id: fx.strangerId, system: false },
      fieldId: fx.fieldId,
    })

    const rows = await prisma.confirmation.count({ where: { fieldId: fx.fieldId } })
    expect(rows, 'exactly one confirmation, from the person who did not write it').toBe(1)
  })

  it('does not throw, so one authored field cannot abort a whole step confirmation', async () => {
    // `confirmStepFields` walks every field in a step, and a follower who contributed one of
    // them should still confirm the others. Refusing loudly would lose the rest.
    await expect(
      confirmField({ actor: { id: fx.authorId, system: false }, fieldId: fx.fieldId }),
    ).resolves.toBeUndefined()
  })
})

describe.skipIf(!url)('how many people are still behind you', () => {
  it('counts followers who have not marked the step done, and excludes you', async () => {
    const a = await followRoute({ userId: fx.followerAId, routeId: fx.routeId })
    await followRoute({ userId: fx.followerBId, routeId: fx.routeId })

    // Follower A has finished the step; B has not.
    await setStepProgress({
      userId: fx.followerAId,
      journeyId: a.journeyId,
      stepId: fx.stepId,
      status: JourneyStepStatus.completed,
    })

    // Asked on A's behalf: B is behind them, and A does not count themselves.
    const behindA = await followersYetToReach({
      stepId: fx.stepId,
      routeId: fx.routeId,
      excludeUserId: fx.followerAId,
    })
    expect(behindA).toBe(1)

    // Asked on B's behalf: A has already done it, so nobody is behind B.
    const behindB = await followersYetToReach({
      stepId: fx.stepId,
      routeId: fx.routeId,
      excludeUserId: fx.followerBId,
    })
    expect(behindB).toBe(0)
  })

  it('does not count somebody who has unfollowed', async () => {
    const before = await followersYetToReach({
      stepId: fx.stepId,
      routeId: fx.routeId,
      excludeUserId: fx.followerAId,
    })

    await prisma.journey.updateMany({
      where: { userId: fx.followerBId, routeId: fx.routeId },
      data: { archivedAt: new Date() },
    })

    const after = await followersYetToReach({
      stepId: fx.stepId,
      routeId: fx.routeId,
      excludeUserId: fx.followerAId,
    })
    expect(after, 'an archived journey is not a follower').toBe(before - 1)
  })
})
