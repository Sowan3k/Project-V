import { beforeAll, describe, expect, it } from 'vitest'

import {
  ChallengeReason,
  FieldApplicability,
  FieldCategory,
  SourceClass,
  StepCategory,
  StudyLevel,
  UserRole,
} from '../../src/domain/enums'
import { generateHandle } from '../../src/server/auth/handle'
import { prisma } from '../../src/server/db/client'
import {
  addField,
  addStep,
  archiveStep,
  challengeField,
  confirmField,
  createRoute,
  reviseField,
} from '../../src/server/revisions/service'
import { getRouteBySlug, routeAttention } from '../../src/server/routes/read'
import { quarantineField } from '../../src/server/safety/service'

/**
 * Phase 15, against a real database. FR-50, FR-53, FR-70.
 *
 * The passport has counted "needs review" and "disputed" since Phase 6. This proves the list
 * behind those counts is the same set of fields: same length, same fields, so a route can never
 * say "2 contested" and then show one.
 */

const url = process.env.TEST_DATABASE_URL
const actor = { id: null, system: true }
const DAY = 24 * 60 * 60 * 1000

let challenger: string
let admin: string

beforeAll(async () => {
  if (!url) return
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [c, a] = await Promise.all([
    prisma.user.create({ data: { handle: generateHandle(), email: `nh-c-${suffix}@example.test` } }),
    prisma.user.create({
      data: { handle: generateHandle(), email: `nh-a-${suffix}@example.test`, role: UserRole.admin },
    }),
  ])
  challenger = c.id
  admin = a.id
}, 180_000)

async function newRoute() {
  const slug = `needs-help-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { routeId } = await createRoute({
    actor,
    slug,
    originCountry: 'BD',
    destinationCountry: 'US',
    studyLevel: StudyLevel.masters,
    title: 'A route with things that need help',
  })
  const { stepId } = await addStep({
    actor,
    routeId,
    label: 'Admission',
    category: StepCategory.admission_university,
  })
  return { slug, routeId, stepId }
}

function field(stepId: string, valueText: string, extra: { expiresAt?: Date } = {}) {
  return addField({
    actor,
    stepId,
    category: FieldCategory.procedure,
    valueText,
    sourceClass: SourceClass.official,
    applicability: [FieldApplicability.route_wide],
    ...extra,
  })
}

describe.skipIf(!url)('Phase 15, the fields behind the passport counts', () => {
  it('lists exactly the fields the passport counts, each with its reasons', async () => {
    const { slug, routeId, stepId } = await newRoute()

    await field(stepId, 'Nothing wrong with this one')

    const due = await field(stepId, 'Apply through the portal')
    await confirmField({ actor, fieldId: due.fieldId, reviewDueAt: new Date(Date.now() - DAY) })

    const expired = await field(stepId, 'The fee is waived this year', {
      expiresAt: new Date(Date.now() - DAY),
    })

    const challenged = await field(stepId, 'Interviews are in person')
    await challengeField({
      actor: { id: challenger },
      fieldId: challenged.fieldId,
      reason: ChallengeReason.obsolete,
      note: 'They moved online in August.',
    })

    const forked = await field(stepId, 'Deadline is 15 July')
    for (const valueText of ['Deadline is 1 March', 'Deadline is 31 May']) {
      await reviseField({
        actor,
        fieldId: forked.fieldId,
        basedOnRevisionId: forked.revisionId,
        valueText,
        sourceClass: SourceClass.official,
        applicability: [FieldApplicability.route_wide],
        reason: 'Read a different page.',
      })
    }

    const route = await getRouteBySlug(slug)
    const attention = await routeAttention(routeId)

    // The rule that matters: the counts and the lists are the same thing.
    expect(attention.needsReview).toHaveLength(route?.trust.needsReviewCount ?? -1)
    expect(attention.contested).toHaveLength(route?.trust.disputedCount ?? -1)

    const reasons = (items: typeof attention.needsReview) =>
      Object.fromEntries(items.map((item) => [item.fieldId, item.reasons]))
    expect(reasons(attention.needsReview)).toEqual({
      [due.fieldId]: ['review_due'],
      [expired.fieldId]: ['expired'],
    })
    expect(reasons(attention.contested)).toEqual({
      [challenged.fieldId]: ['challenged'],
      [forked.fieldId]: ['forked'],
    })

    // The challenge carries what, why, when and who, so a reader can act on it (FR-49).
    const item = attention.contested.find((entry) => entry.fieldId === challenged.fieldId)
    expect(item?.challenges).toHaveLength(1)
    expect(item?.challenges[0]?.reason).toBe(ChallengeReason.obsolete)
    expect(item?.challenges[0]?.note).toContain('online')
    expect(item?.challenges[0]?.authorHandle).not.toBeNull()
    expect(item?.stepId).toBe(stepId)
    expect(item?.stepLabel).toBe('Admission')
  })

  it('says nothing needs help when nothing does', async () => {
    const { routeId, stepId } = await newRoute()
    await field(stepId, 'An ordinary official fact')
    expect(await routeAttention(routeId)).toEqual({ needsReview: [], contested: [] })
  })

  it('drops a challenge once a revision answers it', async () => {
    const { routeId, stepId } = await newRoute()
    const target = await field(stepId, 'The visa fee is 160 dollars')
    await challengeField({
      actor: { id: challenger },
      fieldId: target.fieldId,
      reason: ChallengeReason.incorrect,
    })
    expect((await routeAttention(routeId)).contested).toHaveLength(1)

    await reviseField({
      actor,
      fieldId: target.fieldId,
      basedOnRevisionId: target.revisionId,
      valueText: 'The visa fee is 185 dollars',
      sourceClass: SourceClass.official,
      applicability: [FieldApplicability.route_wide],
      reason: 'Fee changed.',
    })
    expect((await routeAttention(routeId)).contested).toHaveLength(0)
  })

  it('never repeats a quarantined value, and marks a field on an archived step', async () => {
    const { routeId, stepId } = await newRoute()
    const withheld = await field(stepId, 'https://phishing.example.test/apply-here')
    await challengeField({
      actor: { id: challenger },
      fieldId: withheld.fieldId,
      reason: ChallengeReason.unsafe_or_scam,
    })
    await quarantineField({ adminId: admin, fieldId: withheld.fieldId, note: 'Reported as phishing.' })

    const listed = (await routeAttention(routeId)).contested.find(
      (item) => item.fieldId === withheld.fieldId,
    )
    expect(listed?.valueText).toBeNull()

    await archiveStep({ actor, stepId })
    const archived = (await routeAttention(routeId)).contested.find(
      (item) => item.fieldId === withheld.fieldId,
    )
    expect(archived?.stepArchived).toBe(true)
  })
})
