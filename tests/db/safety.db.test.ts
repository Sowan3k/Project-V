import { randomUUID } from 'node:crypto'

import { beforeAll, describe, expect, it } from 'vitest'

import {
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
import { getRouteBySlug, getRouteHistory, getStepFields } from '../../src/server/routes/read'
import {
  fieldsWithOpenReports,
  handleReportsForField,
  NotAnAdministratorError,
  openReportsFor,
  quarantineField,
  releaseField,
  reportField,
} from '../../src/server/safety/service'

/**
 * Phase 9 — reporting and quarantine against a real database.
 *
 * The exit criteria, essentially: a quarantined link is not clickable but stays in history,
 * and no raw count alone triggers any state change.
 */

const url = process.env.TEST_DATABASE_URL
const system = { id: null, system: true }

interface Fixture {
  readonly admin: string
  readonly member: string
  readonly other: string
}

let who: Fixture

beforeAll(async () => {
  if (!url) return
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [admin, member, other] = await Promise.all([
    prisma.user.create({
      data: { handle: generateHandle(), email: `adm-${suffix}@example.test`, role: UserRole.admin },
    }),
    prisma.user.create({ data: { handle: generateHandle(), email: `m1-${suffix}@example.test` } }),
    prisma.user.create({ data: { handle: generateHandle(), email: `m2-${suffix}@example.test` } }),
  ])
  who = { admin: admin.id, member: member.id, other: other.id }
}, 180_000)

const PHISHING = 'Apply for your visa here: https://bit.ly/not-a-real-embassy'

async function fieldWithLink(): Promise<{ slug: string; stepId: string; fieldId: string }> {
  const slug = `safety-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { routeId } = await createRoute({
    actor: system,
    slug,
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    title: 'A route with something reportable on it',
  })
  const step = await addStep({
    actor: system,
    routeId,
    label: 'Visa',
    category: StepCategory.immigration_visa,
  })
  const field = await addField({
    actor: system,
    stepId: step.stepId,
    category: FieldCategory.link,
    valueText: PHISHING,
    sourceClass: SourceClass.community_submission,
    sourceUrl: 'https://bit.ly/not-a-real-embassy',
  })
  return { slug, stepId: step.stepId, fieldId: field.fieldId }
}

describe.skipIf(!url)('FR-35 — reporting changes nothing on its own', () => {
  it('leaves the field exactly as it was', async () => {
    const { stepId, fieldId } = await fieldWithLink()
    const before = await getStepFields(stepId)

    await reportField({
      reporterId: who.member,
      fieldId,
      reason: ReportReason.phishing_or_scam,
      detail: 'This is not the embassy.',
    })

    const after = await getStepFields(stepId)
    expect(after[0]?.valueText).toBe(before[0]?.valueText)
    expect(after[0]?.sourceUrl).toBe(before[0]?.sourceUrl)
    expect(after[0]?.revisionCount).toBe(before[0]?.revisionCount)
    expect(after[0]?.quarantined).toBe(false)
  })

  /**
   * Invariant 14 / FR-71, demonstrated rather than argued.
   *
   * Ten reports from ten different people — the shape that would trip any threshold anybody
   * would have chosen — and the content is untouched. Nothing counts and acts.
   */
  it('does not hide anything however many people report it', async () => {
    const { slug, stepId, fieldId } = await fieldWithLink()
    const reporterIds: string[] = []
    const detail = `burst-detail-${randomUUID().slice(0, 8)}`

    for (let i = 0; i < 10; i += 1) {
      const reporter = await prisma.user.create({
        data: { handle: generateHandle(), email: `burst-${i}-${randomUUID()}@example.test` },
      })
      reporterIds.push(reporter.id)
      await reportField({
        reporterId: reporter.id,
        fieldId,
        reason: ReportReason.phishing_or_scam,
        detail,
      })
    }

    const fields = await getStepFields(stepId)
    expect(fields[0]?.quarantined).toBe(false)
    expect(fields[0]?.valueText).toBe(PHISHING)

    // And the route projection carries nothing about the reports — they are not public
    // (§23.1). Asserted against the actual reporter ids and detail text rather than the word
    // "report": an earlier version matched this fixture's own title and failed for no reason.
    const route = await getRouteBySlug(slug)
    expect(route?.trust.quarantinedCount).toBe(0)

    const serialised = JSON.stringify(route)
    expect(serialised).not.toContain(detail)
    for (const id of reporterIds) expect(serialised).not.toContain(id)
    expect(Object.keys(route?.trust ?? {})).not.toContain('reportCount')
  })
})

describe.skipIf(!url)('the administrator role is required, and checked in the service', () => {
  it('refuses every safety action to an ordinary member', async () => {
    const { fieldId } = await fieldWithLink()
    await reportField({ reporterId: who.member, fieldId, reason: ReportReason.spam })

    for (const attempt of [
      () => quarantineField({ adminId: who.member, fieldId, note: 'not mine to do' }),
      () => releaseField({ adminId: who.member, fieldId }),
      () => openReportsFor(who.member, fieldId),
      () => fieldsWithOpenReports(who.member),
      () =>
        handleReportsForField({
          adminId: who.member,
          fieldId,
          outcome: ReportOutcome.no_action_needed,
        }),
    ]) {
      await expect(attempt()).rejects.toThrow(NotAnAdministratorError)
    }

    // And nothing moved.
    const stored = await prisma.field.findUniqueOrThrow({ where: { id: fieldId } })
    expect(stored.quarantinedAt).toBeNull()
  })
})

describe.skipIf(!url)('FR-36 — quarantine hides the value and keeps the history', () => {
  it('withholds the value and the link, and says why', async () => {
    const { stepId, fieldId } = await fieldWithLink()
    await reportField({ reporterId: who.member, fieldId, reason: ReportReason.phishing_or_scam })

    await quarantineField({
      adminId: who.admin,
      fieldId,
      note: 'Shortened link impersonating the embassy.',
    })

    const fields = await getStepFields(stepId)
    expect(fields[0]?.quarantined).toBe(true)
    // The value never leaves the server. A phishing URL sitting in the HTML behind a
    // `display: none` is not containment.
    expect(fields[0]?.valueText).toBe('')
    expect(fields[0]?.sourceUrl).toBeNull()
    expect(fields[0]?.quarantineNote).toContain('impersonating')
  })

  /**
   * The Phase 9 exit criterion, in one assertion: **not clickable, still in history.**
   *
   * This is the line between containment and destruction. Erasing the value would make the
   * moderation decision unreviewable and would break invariants 1 and 4; leaving it clickable
   * would make quarantine decorative.
   */
  it('keeps the withheld value readable in the route history', async () => {
    const { slug, stepId, fieldId } = await fieldWithLink()
    await quarantineField({ adminId: who.admin, fieldId, note: 'Reported as phishing.' })

    const route = await getRouteBySlug(slug)
    if (!route) throw new Error('route not found')
    const history = await getRouteHistory(route.id)

    // Gone from the current view...
    expect((await getStepFields(stepId))[0]?.valueText).toBe('')
    // ...and still in the record.
    expect(history.some((entry) => entry.value === PHISHING)).toBe(true)

    // The underlying revision was never touched.
    const revisions = await prisma.fieldRevision.findMany({ where: { fieldId } })
    expect(revisions).toHaveLength(1)
    expect(revisions[0]?.valueText).toBe(PHISHING)
  })

  it('creates no revision — quarantine is a safety state, not an edit', async () => {
    const { stepId, fieldId } = await fieldWithLink()
    const before = (await getStepFields(stepId))[0]?.revisionCount

    await quarantineField({ adminId: who.admin, fieldId, note: 'x' })
    await releaseField({ adminId: who.admin, fieldId })

    const after = await prisma.fieldRevision.count({ where: { fieldId } })
    expect(after).toBe(before)
  })

  it('restores cleanly, because nothing was destroyed to undo', async () => {
    const { stepId, fieldId } = await fieldWithLink()
    await quarantineField({ adminId: who.admin, fieldId, note: 'temporary' })
    expect((await getStepFields(stepId))[0]?.quarantined).toBe(true)

    await releaseField({ adminId: who.admin, fieldId })

    const restored = (await getStepFields(stepId))[0]
    expect(restored?.quarantined).toBe(false)
    expect(restored?.valueText).toBe(PHISHING)
    expect(restored?.sourceUrl).toBe('https://bit.ly/not-a-real-embassy')
    expect(restored?.quarantineNote).toBeNull()
  })

  it('surfaces a quarantined item as a route-level caution', async () => {
    const { slug, fieldId } = await fieldWithLink()
    await quarantineField({ adminId: who.admin, fieldId, note: 'withheld' })

    const route = await getRouteBySlug(slug)
    expect(route?.trust.quarantinedCount).toBe(1)
  })
})

describe.skipIf(!url)('what an administrator is shown — evidence, never a verdict', () => {
  it('counts people rather than reports', async () => {
    const { fieldId } = await fieldWithLink()

    // One person reporting three times is not three people.
    await reportField({ reporterId: who.member, fieldId, reason: ReportReason.spam })
    await reportField({ reporterId: who.member, fieldId, reason: ReportReason.spam })
    await reportField({ reporterId: who.other, fieldId, reason: ReportReason.impersonation })

    const summary = await openReportsFor(who.admin, fieldId)
    expect(summary.openReports).toBe(3)
    expect(summary.distinctReporters).toBe(2)
    expect(summary.reasons).toContain(ReportReason.spam)
    expect(summary.reasons).toContain(ReportReason.impersonation)
    expect(summary.firstReportedAt).not.toBeNull()

    // Nothing resembling a score, band or recommendation is returned.
    expect(Object.keys(summary).sort()).toEqual([
      'distinctReporters',
      'fieldId',
      'firstReportedAt',
      'lastReportedAt',
      'openReports',
      'reasons',
    ])
  })

  it('records a decision without deleting the reports it answered', async () => {
    const { fieldId } = await fieldWithLink()
    await reportField({ reporterId: who.member, fieldId, reason: ReportReason.phishing_or_scam })
    await reportField({ reporterId: who.other, fieldId, reason: ReportReason.phishing_or_scam })

    const { handled } = await handleReportsForField({
      adminId: who.admin,
      fieldId,
      outcome: ReportOutcome.quarantine_upheld,
      note: 'Confirmed the domain is not the embassy.',
    })
    expect(handled).toBe(2)

    // Off the queue...
    expect((await openReportsFor(who.admin, fieldId)).openReports).toBe(0)
    // ...and still on the record, with who decided and why.
    const stored = await prisma.report.findMany({ where: { fieldId } })
    expect(stored).toHaveLength(2)
    for (const report of stored) {
      expect(report.handledAt).not.toBeNull()
      expect(report.handledById).toBe(who.admin)
      expect(report.outcome).toBe(ReportOutcome.quarantine_upheld)
      expect(report.outcomeNote).toContain('not the embassy')
    }
  })

  it('refuses to delete a report at all', async () => {
    const { fieldId } = await fieldWithLink()
    await reportField({ reporterId: who.member, fieldId, reason: ReportReason.malware_or_download })

    // A handled report is the record of a safety decision, and the record is what makes the
    // decision reviewable later (invariant 1).
    await expect(prisma.report.deleteMany({ where: { fieldId } })).rejects.toThrow()
  })
})
