import { beforeAll, describe, expect, it } from 'vitest'

import {
  ChallengeReason,
  FieldApplicability,
  FieldCategory,
  RouteLifecycleState,
  SourceClass,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
} from '../../src/domain/enums'
import { generateHandle } from '../../src/server/auth/handle'
import { getContributorHistory } from '../../src/server/contributors/read'
import { prisma } from '../../src/server/db/client'
import {
  addEdge,
  addField,
  addStep,
  challengeField,
  confirmField,
  confirmStepFields,
  createRoute,
  reviseField,
} from '../../src/server/revisions/service'
import { getRouteBySlug, getRouteHistory, getStepFields } from '../../src/server/routes/read'

/**
 * Phase 8 — the contribution loop against a real database.
 *
 * The exit gate, essentially: a new signed-in user creates a route, it publishes as
 * experimental, and a *different* user improves it immediately. No approval, no owner, no
 * waiting.
 */

const url = process.env.TEST_DATABASE_URL

interface Fixture {
  readonly amina: string
  readonly bikash: string
}

let who: Fixture

beforeAll(async () => {
  if (!url) return
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [amina, bikash] = await Promise.all([
    prisma.user.create({ data: { handle: generateHandle(), email: `c1-${suffix}@example.test` } }),
    prisma.user.create({ data: { handle: generateHandle(), email: `c2-${suffix}@example.test` } }),
  ])
  who = { amina: amina.id, bikash: bikash.id }
}, 180_000)

async function newRoute(userId: string): Promise<{ routeId: string; slug: string }> {
  const slug = `contrib-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { routeId } = await createRoute({
    actor: { id: userId },
    slug,
    originCountry: 'BD',
    destinationCountry: 'MY',
    studyLevel: StudyLevel.masters,
    title: 'A route somebody added because it was missing',
    summary: 'Created by a contributor, not by us.',
  })
  return { routeId, slug }
}

describe.skipIf(!url)('FR-13, FR-74 — anyone signed in can add a missing route', () => {
  it('publishes immediately as experimental, with no approval step', async () => {
    const { slug } = await newRoute(who.amina)
    const route = await getRouteBySlug(slug)

    expect(route).not.toBeNull()
    // Visible straight away. There is no draft state to be stuck in.
    expect(route?.lifecycleState).toBe(RouteLifecycleState.experimental)
    // And honestly labelled as immature rather than presented as settled (FR-74).
    expect(route?.trust.lifecycleState).toBe(RouteLifecycleState.experimental)
  })

  /**
   * FR-44, BR-01, D-18: creating a route confers no ownership.
   *
   * The second contributor is a different person who did not create the route and was not
   * invited to it. Every one of these succeeds.
   */
  it('lets a different user build on it immediately', async () => {
    const { routeId, slug } = await newRoute(who.amina)

    const first = await addStep({
      actor: { id: who.bikash },
      routeId,
      label: 'Collect documents',
      category: StepCategory.documents_preparation,
      typicalDurationDays: 30,
    })
    const second = await addStep({
      actor: { id: who.bikash },
      routeId,
      label: 'Apply to the university',
      category: StepCategory.admission_university,
      typicalDurationDays: 45,
    })
    await addEdge({
      actor: { id: who.bikash },
      routeId,
      fromStepId: first.stepId,
      toStepId: second.stepId,
      kind: StepEdgeKind.sequential,
    })
    await addField({
      actor: { id: who.bikash },
      stepId: first.stepId,
      category: FieldCategory.requirement,
      valueText: 'Attested copies of every transcript',
      sourceClass: SourceClass.community_submission,
      applicability: [FieldApplicability.route_wide],
    })

    const route = await getRouteBySlug(slug)
    expect(route?.stepCount).toBe(2)
    // The graph is real, so the generic renderer has something to draw — the same one, with
    // no route-specific code anywhere (invariant 24).
    expect(route?.graph.edges).toHaveLength(1)
    expect(route?.trust.contributorCount).toBeGreaterThanOrEqual(2)
  })
})

describe.skipIf(!url)('UPDATE — FR-16, FR-69, invariant 2', () => {
  it('preserves the earlier value when another user corrects it', async () => {
    const { routeId } = await newRoute(who.amina)
    const step = await addStep({
      actor: { id: who.amina },
      routeId,
      label: 'Language test',
      category: StepCategory.language_testing,
    })
    const field = await addField({
      actor: { id: who.amina },
      stepId: step.stepId,
      category: FieldCategory.requirement,
      valueText: 'IELTS overall 6.0',
      sourceClass: SourceClass.community_submission,
    })

    await reviseField({
      actor: { id: who.bikash },
      fieldId: field.fieldId,
      valueText: 'IELTS overall 6.5, with no band below 6.0',
      sourceClass: SourceClass.official,
      applicability: [FieldApplicability.route_wide],
      reason: 'The university page says 6.5.',
    })

    const [fields, history] = await Promise.all([
      getStepFields(step.stepId),
      getRouteHistory(routeId),
    ])

    expect(fields[0]?.valueText).toContain('6.5')
    expect(fields[0]?.revisionCount).toBe(2)
    // The old value is still readable — that is the whole invariant (FR-20, BR-03).
    expect(history.some((entry) => entry.value.includes('IELTS overall 6.0'))).toBe(true)
    expect(history.some((entry) => entry.reason === 'The university page says 6.5.')).toBe(true)
  })

  /**
   * Two contributors correcting the same value from the same starting point.
   *
   * Neither is lost, and the field renders as contested rather than one silently winning
   * (BR-21, FR-70, invariant 15). This is the property Phase 3 built and Phase 8 finally
   * exercises through the path a real contributor takes.
   */
  it('keeps both corrections when two people revise from the same base', async () => {
    const { routeId } = await newRoute(who.amina)
    const step = await addStep({
      actor: { id: who.amina },
      routeId,
      label: 'Visa',
      category: StepCategory.immigration_visa,
    })
    const field = await addField({
      actor: { id: who.amina },
      stepId: step.stepId,
      category: FieldCategory.cost,
      valueText: 'Visa fee 5,000 BDT',
      sourceClass: SourceClass.community_submission,
    })
    const base = field.revisionId

    const one = await reviseField({
      actor: { id: who.amina },
      fieldId: field.fieldId,
      basedOnRevisionId: base,
      valueText: 'Visa fee 5,500 BDT',
      sourceClass: SourceClass.community_submission,
    })
    const two = await reviseField({
      actor: { id: who.bikash },
      fieldId: field.fieldId,
      basedOnRevisionId: base,
      valueText: 'Visa fee 6,000 BDT',
      sourceClass: SourceClass.community_submission,
    })

    expect(one.forked).toBe(false)
    expect(two.forked).toBe(true)

    const fields = await getStepFields(step.stepId)
    expect(fields[0]?.revisionCount).toBe(3)
    expect(fields[0]?.hasForkedHistory).toBe(true)

    // Both are still in the record; neither was overwritten.
    const revisions = await prisma.fieldRevision.findMany({
      where: { fieldId: field.fieldId },
      select: { valueText: true },
    })
    const values = revisions.map((r) => r.valueText)
    expect(values).toContain('Visa fee 5,500 BDT')
    expect(values).toContain('Visa fee 6,000 BDT')
  })
})

describe.skipIf(!url)('CONFIRM and CHALLENGE are different actions — FR-17, FR-18, FR-55', () => {
  async function fieldOnRoute(): Promise<{ stepId: string; fieldId: string }> {
    const { routeId } = await newRoute(who.amina)
    const step = await addStep({
      actor: { id: who.amina },
      routeId,
      label: 'Funding',
      category: StepCategory.funding_scholarship,
    })
    const field = await addField({
      actor: { id: who.amina },
      stepId: step.stepId,
      category: FieldCategory.procedure,
      valueText: 'Apply for the scholarship before the admission deadline',
      sourceClass: SourceClass.community_submission,
    })
    return { stepId: step.stepId, fieldId: field.fieldId }
  }

  it('confirms without creating a revision, and counts people rather than clicks', async () => {
    const { stepId, fieldId } = await fieldOnRoute()

    await confirmField({ actor: { id: who.bikash }, fieldId })
    await confirmField({ actor: { id: who.bikash }, fieldId })
    await confirmField({ actor: { id: who.amina }, fieldId })

    const fields = await getStepFields(stepId)
    // Three confirmations, two people. A count that could not tell those apart would not be
    // a signal (invariant 14, BR-32).
    expect(fields[0]?.confirmationCount).toBe(2)
    // And nothing was edited: confirming is not editing (§39.4).
    expect(fields[0]?.revisionCount).toBe(1)
    expect(fields[0]?.lastConfirmedAt).not.toBeNull()
  })

  it('challenges without changing the value, and shows the reason', async () => {
    const { stepId, fieldId } = await fieldOnRoute()
    const before = await getStepFields(stepId)

    await challengeField({
      actor: { id: who.bikash },
      fieldId,
      reason: ChallengeReason.obsolete,
      note: 'The scholarship deadline moved this year.',
    })

    const after = await getStepFields(stepId)
    // The value, its source class and its revision count are all untouched. A challenge says
    // "this may be wrong"; it does not decide that it is.
    expect(after[0]?.valueText).toBe(before[0]?.valueText)
    expect(after[0]?.sourceClass).toBe(before[0]?.sourceClass)
    expect(after[0]?.revisionCount).toBe(before[0]?.revisionCount)

    expect(after[0]?.openChallenges).toHaveLength(1)
    expect(after[0]?.openChallenges[0]?.reason).toBe(ChallengeReason.obsolete)
    expect(after[0]?.openChallenges[0]?.note).toContain('deadline moved')
  })

  /**
   * A revision answers a challenge. A confirmation does not.
   *
   * The second half is the one that matters: letting somebody clear a challenge by vouching
   * for the field is how a dispute gets buried under reassurance (FR-70).
   */
  it('resolves an open challenge by revision, and never by confirmation', async () => {
    const { stepId, fieldId } = await fieldOnRoute()
    await challengeField({ actor: { id: who.bikash }, fieldId, reason: ChallengeReason.incorrect })

    await confirmField({ actor: { id: who.amina }, fieldId })
    expect((await getStepFields(stepId))[0]?.openChallenges).toHaveLength(1)

    await reviseField({
      actor: { id: who.amina },
      fieldId,
      valueText: 'Apply for the scholarship at least six weeks before the admission deadline',
      sourceClass: SourceClass.community_submission,
      reason: 'Answering the challenge.',
    })

    const after = await getStepFields(stepId)
    expect(after[0]?.openChallenges).toHaveLength(0)

    // Resolved, not deleted: the reason, the author and the answering revision all survive.
    const stored = await prisma.challenge.findFirst({ where: { fieldId } })
    expect(stored?.resolvedAt).not.toBeNull()
    expect(stored?.resolvedByRevisionId).not.toBeNull()
    expect(stored?.reason).toBe(ChallengeReason.incorrect)
  })

  it('counts an open challenge as disputed on the route, and a resolved one not', async () => {
    const { stepId, fieldId } = await fieldOnRoute()
    const step = await prisma.step.findUniqueOrThrow({
      where: { id: stepId },
      select: { route: { select: { slug: true } } },
    })

    await challengeField({ actor: { id: who.bikash }, fieldId, reason: ChallengeReason.broken_link })
    expect((await getRouteBySlug(step.route.slug))?.trust.disputedCount).toBe(1)

    await reviseField({
      actor: { id: who.bikash },
      fieldId,
      valueText: 'Apply through the current scholarship portal',
      sourceClass: SourceClass.community_submission,
    })
    expect((await getRouteBySlug(step.route.slug))?.trust.disputedCount).toBe(0)
  })
})

describe.skipIf(!url)('FR-42 — the prompt after completing a step', () => {
  it('confirms every live field in the step, and creates no revisions', async () => {
    const { routeId } = await newRoute(who.amina)
    const step = await addStep({
      actor: { id: who.amina },
      routeId,
      label: 'Documents',
      category: StepCategory.documents_preparation,
    })
    for (const value of ['Birth certificate', 'Passport-size photographs', 'Academic transcripts']) {
      await addField({
        actor: { id: who.amina },
        stepId: step.stepId,
        category: FieldCategory.document,
        valueText: value,
        sourceClass: SourceClass.community_submission,
      })
    }

    const { confirmed } = await confirmStepFields({ actor: { id: who.bikash }, stepId: step.stepId })
    expect(confirmed).toBe(3)

    const fields = await getStepFields(step.stepId)
    for (const field of fields) {
      expect(field.confirmationCount).toBe(1)
      // One revision each — the one that created them. The prompt confirms; it never edits.
      expect(field.revisionCount).toBe(1)
    }
  })
})

describe.skipIf(!url)('FR-33, invariant 11 — a contribution never impersonates an official source', () => {
  it('keeps a community submission in the community group after every action', async () => {
    const { routeId } = await newRoute(who.amina)
    const step = await addStep({
      actor: { id: who.amina },
      routeId,
      label: 'Experience',
      category: StepCategory.travel_departure,
    })
    const field = await addField({
      actor: { id: who.amina },
      stepId: step.stepId,
      category: FieldCategory.community_experience,
      valueText: 'The queue at the airport was long on a Friday evening.',
      sourceClass: SourceClass.community_submission,
    })

    // Confirmations do not promote a claim. Ten people agreeing about a queue does not make
    // it an official statement (invariant 14, BR-32).
    await confirmField({ actor: { id: who.bikash }, fieldId: field.fieldId })
    await confirmField({ actor: { id: who.amina }, fieldId: field.fieldId })

    const fields = await getStepFields(step.stepId)
    expect(fields[0]?.sourceClass).toBe(SourceClass.community_submission)
    expect(fields[0]?.confirmationCount).toBe(2)
  })
})

describe.skipIf(!url)('FR-43 — contributor history is evidence, not a score', () => {
  it('reports counts and dates for a real contributor', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: who.bikash } })
    const history = await getContributorHistory(user.handle)

    expect(history).not.toBeNull()
    expect(history?.handle).toBe(user.handle)
    expect(history?.contributionCount).toBeGreaterThan(0)
    expect(history?.firstContributionAt).not.toBeNull()
    expect(history?.confirmationsGiven).toBeGreaterThan(0)
    expect(history?.challengesRaised).toBeGreaterThan(0)

    // Nothing resembling a grade is returned. If a score is ever added, this fails.
    expect(Object.keys(history ?? {}).sort()).toEqual([
      'challengesRaised',
      'confirmationsGiven',
      'confirmedContributionCount',
      'contributionCount',
      'firstContributionAt',
      'handle',
    ])
  })

  it('returns nothing for a handle that does not exist', async () => {
    expect(await getContributorHistory('traveller-nobody')).toBeNull()
  })
})

describe.skipIf(!url)('shared knowledge still cannot be destroyed', () => {
  it('refuses to delete a confirmation or a challenge', async () => {
    const { routeId } = await newRoute(who.amina)
    const step = await addStep({
      actor: { id: who.amina },
      routeId,
      label: 'Anything',
      category: StepCategory.documents_preparation,
    })
    const field = await addField({
      actor: { id: who.amina },
      stepId: step.stepId,
      category: FieldCategory.warning,
      valueText: 'Something to be careful about',
      sourceClass: SourceClass.community_submission,
    })
    await confirmField({ actor: { id: who.bikash }, fieldId: field.fieldId })
    await challengeField({
      actor: { id: who.bikash },
      fieldId: field.fieldId,
      reason: ChallengeReason.other,
    })

    // The runtime write guard refuses both, in or out of a revision context.
    await expect(prisma.confirmation.deleteMany({ where: { fieldId: field.fieldId } })).rejects.toThrow()
    await expect(prisma.challenge.deleteMany({ where: { fieldId: field.fieldId } })).rejects.toThrow()
  })
})
