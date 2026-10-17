import { beforeAll, describe, expect, it } from 'vitest'

import {
  FieldApplicability,
  FieldCategory,
  ReportOutcome,
  ReportReason,
  SourceClass,
  StepCategory,
  StudyLevel,
  UserRole,
} from '../../src/domain/enums'
import { generateHandle } from '../../src/server/auth/handle'
import { prisma } from '../../src/server/db/client'
import { addField, addStep, createRoute } from '../../src/server/revisions/service'
import { handleReport, reportField, reportsFiledBy } from '../../src/server/safety/service'

/**
 * Phase 18, the half D6 does not decide: a reporter can see what happened. FR-33, FR-79.
 *
 * Reports are not public (§23.1, §23.3), so the guarantee that matters most is the second
 * test: one person's list never contains another person's report, even about the same field.
 */

const url = process.env.TEST_DATABASE_URL
const system = { id: null, system: true }

let reporter: string
let other: string
let admin: string

beforeAll(async () => {
  if (!url) return
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [r, o, a] = await Promise.all([
    prisma.user.create({ data: { handle: generateHandle(), email: `rf-r-${suffix}@example.test` } }),
    prisma.user.create({ data: { handle: generateHandle(), email: `rf-o-${suffix}@example.test` } }),
    prisma.user.create({
      data: { handle: generateHandle(), email: `rf-a-${suffix}@example.test`, role: UserRole.admin },
    }),
  ])
  reporter = r.id
  other = o.id
  admin = a.id
}, 180_000)

async function fieldOnRoute(): Promise<{ fieldId: string; stepId: string; slug: string }> {
  const slug = `reports-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { routeId } = await createRoute({
    actor: system,
    slug,
    originCountry: 'BD',
    destinationCountry: 'MY',
    studyLevel: StudyLevel.masters,
    title: 'A route with something reported on it',
  })
  const { stepId } = await addStep({
    actor: system,
    routeId,
    label: 'Visa',
    category: StepCategory.immigration_visa,
  })
  const { fieldId } = await addField({
    actor: system,
    stepId,
    category: FieldCategory.link,
    valueText: 'https://not-the-embassy.example.test',
    sourceClass: SourceClass.community_submission,
    applicability: [FieldApplicability.route_wide],
  })
  return { fieldId, stepId, slug }
}

describe.skipIf(!url)('Phase 18 — the reports a person filed, and what became of them', () => {
  it('lists them newest first, open until a moderator looks, then with the outcome', async () => {
    const first = await fieldOnRoute()
    const second = await fieldOnRoute()
    const older = await reportField({
      reporterId: reporter,
      fieldId: first.fieldId,
      reason: ReportReason.phishing_or_scam,
    })
    const newer = await reportField({
      reporterId: reporter,
      fieldId: second.fieldId,
      reason: ReportReason.spam,
    })

    let mine = (await reportsFiledBy({ userId: reporter })).filter((r) =>
      [older.reportId, newer.reportId].includes(r.id),
    )
    expect(mine.map((r) => r.id)).toEqual([newer.reportId, older.reportId])
    expect(mine.every((r) => r.handledAt === null && r.outcome === null)).toBe(true)
    expect(mine[1]?.routeSlug).toBe(first.slug)
    expect(mine[1]?.stepId).toBe(first.stepId)
    expect(mine[1]?.stepLabel).toBe('Visa')

    await handleReport({
      adminId: admin,
      reportId: older.reportId,
      outcome: ReportOutcome.no_action_needed,
      note: 'Internal reasoning the reporter does not need.',
    })

    mine = (await reportsFiledBy({ userId: reporter })).filter((r) => r.id === older.reportId)
    expect(mine[0]?.outcome).toBe(ReportOutcome.no_action_needed)
    expect(mine[0]?.handledAt).not.toBeNull()
    // The moderator's note is not part of what comes back.
    expect(JSON.stringify(mine[0])).not.toContain('Internal reasoning')
  })

  it('never shows one person another person’s report, even about the same field', async () => {
    const shared = await fieldOnRoute()
    const theirs = await reportField({
      reporterId: other,
      fieldId: shared.fieldId,
      reason: ReportReason.impersonation,
    })
    const ids = (await reportsFiledBy({ userId: reporter })).map((r) => r.id)
    expect(ids).not.toContain(theirs.reportId)
    expect((await reportsFiledBy({ userId: other })).map((r) => r.id)).toContain(theirs.reportId)
  })
})
