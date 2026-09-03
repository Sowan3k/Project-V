import type { ReportOutcome, ReportReason } from '@/domain/enums'
import { UserRole } from '@/domain/enums'
import { prisma } from '@/server/db/client'
import { setFieldQuarantine } from '@/server/revisions/service'

/**
 * Safety — Phase 9. FR-35, FR-36, FR-37, FR-71, §23, §42.5.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **REPORT is not CHALLENGE, and the difference is not cosmetic.**
 *
 * §23.1: "A routine challenge means 'this information is no longer correct.' A report means
 * 'this may be abusive or unsafe.'" They are answered by different people through different
 * mechanisms — a challenge by any contributor's revision (Phase 8), a report by an
 * administrator. Merging them would either put a moderator in front of ordinary corrections,
 * which §23.3 explicitly rejects, or leave phishing to be resolved by consensus.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **No threshold exists here, and none may be added.**
 *
 * The obvious design — quarantine automatically once N credible reports arrive — is
 * prohibited, not merely unspecified. FR-71 and invariant 14: raw counts "shall not be the
 * sole automatic determinant of trust, ranking, deletion or archival". §23.2 additionally
 * leaves thresholds "an operational decision ... not fixed in this concept baseline", and
 * CLAUDE.md §11 lists them as open.
 *
 * So quarantine is an explicit administrator action. Reports are surfaced to an administrator
 * with the evidence that helps them judge — how many *distinct people* reported, over what
 * period — and a person decides. The number never has to be guessed, and the guarantee holds
 * whatever the number would have been.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Quarantine hides; it never deletes.** The field, every revision of it and its whole
 * history are untouched. Lifting quarantine is one column going back to null. That is the
 * difference between containment and destruction, and invariants 1 and 4 depend on it.
 */

export class NotAnAdministratorError extends Error {
  constructor() {
    // Deliberately says nothing about what the action was or whether the target exists.
    super('this action requires an administrator')
    this.name = 'NotAnAdministratorError'
  }
}

/**
 * The one authorisation check in the application, and it is server-side by construction.
 *
 * §23.3 confines the administrator to "safety, disputes, abuse, annual maintenance and
 * exceptional cases". Nothing in the contribution loop calls this, and nothing should: an
 * update goes live without anybody's permission (FR-16, FR-69, §43.1).
 */
async function requireAdministrator(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role !== UserRole.admin) throw new NotAnAdministratorError()
}

/**
 * REPORT — "this may be dangerous" (FR-35, FR-37, §23.1).
 *
 * Any signed-in user, no administrator involved, and nothing about the field changes. The
 * report is a message to a person, not a state transition: the content stays exactly as it
 * was until somebody with the role decides otherwise.
 *
 * There is no attachment parameter and there must never be one. Reports are structured and
 * textual (§8.6, decided 2026-09-02) — a category, free text, and the field it is about.
 */
export async function reportField(input: {
  reporterId: string
  fieldId: string
  reason: ReportReason
  detail?: string | null
}): Promise<{ reportId: string }> {
  const report = await prisma.report.create({
    data: {
      fieldId: input.fieldId,
      reason: input.reason,
      detail: input.detail ?? null,
      reporterId: input.reporterId,
    },
  })
  return { reportId: report.id }
}

/**
 * QUARANTINE — hide a field's value pending review (FR-36, §23.2).
 *
 * A person decides this. Nothing counts reports and acts.
 *
 * The note is required in practice rather than by the type, and the interface asks for it,
 * because containment without explanation reads as censorship. A reader is told that
 * something was withheld and why — which is also the only way they can tell the difference
 * between "this was dangerous" and "this platform is hiding things".
 */
export async function quarantineField(input: {
  adminId: string
  fieldId: string
  note?: string | null
}): Promise<void> {
  await requireAdministrator(input.adminId)
  // The field mutation itself goes through the revision service, because `Field` is a
  // revisioned model and only that module may write one (Phase 3). Authorisation here,
  // execution there.
  await setFieldQuarantine({
    fieldId: input.fieldId,
    quarantinedById: input.adminId,
    note: input.note ?? null,
    quarantined: true,
  })
}

/** Lift a quarantine. One column back to null — nothing was ever destroyed to undo. */
export async function releaseField(input: { adminId: string; fieldId: string }): Promise<void> {
  await requireAdministrator(input.adminId)
  await setFieldQuarantine({
    fieldId: input.fieldId,
    quarantinedById: input.adminId,
    quarantined: false,
  })
}

/**
 * Record an administrator's decision on a report (§23.2, §23.3).
 *
 * "The administrator can then restore, correct, archive or remove the item."
 *
 * The report row is **updated, never deleted** — the write guard refuses a delete on it, and
 * that is right: a handled report is the record of a safety decision, and the record is what
 * makes the decision reviewable later. The reasoning is stored with it for the same reason.
 */
export async function handleReport(input: {
  adminId: string
  reportId: string
  outcome: ReportOutcome
  note?: string | null
}): Promise<void> {
  await requireAdministrator(input.adminId)

  await prisma.report.update({
    where: { id: input.reportId },
    data: {
      handledAt: new Date(),
      handledById: input.adminId,
      outcome: input.outcome,
      outcomeNote: input.note ?? null,
    },
  })
}

/**
 * Record a decision on every open report about one field (§23.2).
 *
 * Grouped by field rather than by individual report because that is what §23.2 describes —
 * "the administrator can then restore, correct, archive or remove **the item**" — and because
 * eight reports about one phishing link are one decision, not eight.
 *
 * Reports are updated, never deleted. A handled report is the record of a safety decision, and
 * the record is what makes the decision reviewable later; the write guard refuses a delete on
 * it for exactly that reason.
 */
export async function handleReportsForField(input: {
  adminId: string
  fieldId: string
  outcome: ReportOutcome
  note?: string | null
}): Promise<{ handled: number }> {
  await requireAdministrator(input.adminId)

  const result = await prisma.report.updateMany({
    where: { fieldId: input.fieldId, handledAt: null },
    data: {
      handledAt: new Date(),
      handledById: input.adminId,
      outcome: input.outcome,
      outcomeNote: input.note ?? null,
    },
  })

  return { handled: result.count }
}

/**
 * Every open report on a field, with the evidence an administrator needs to judge — and
 * deliberately without any judgement of its own (§23.2, FR-71).
 *
 * `distinctReporters` is the number that matters, and it is the reason this returns it rather
 * than a raw count: twelve reports from one person is a different situation from twelve
 * reports from twelve people, and a system that could not tell them apart would be trivially
 * gamed. `firstReportedAt` and `lastReportedAt` give the burst shape — twelve reports in four
 * minutes reads differently from twelve over a month.
 *
 * **Nothing here decides anything.** No band, no score, no "recommended action". The
 * administrator looks at the reports and the shape of them and forms a view, which is exactly
 * what invariant 14 requires and what §23.2 leaves to an operational decision.
 */
export interface ReportSummary {
  readonly fieldId: string
  readonly openReports: number
  readonly distinctReporters: number
  readonly firstReportedAt: Date | null
  readonly lastReportedAt: Date | null
  readonly reasons: readonly ReportReason[]
}

export async function openReportsFor(adminId: string, fieldId: string): Promise<ReportSummary> {
  await requireAdministrator(adminId)

  const reports = await prisma.report.findMany({
    where: { fieldId, handledAt: null },
    select: { reporterId: true, reason: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const reporters = new Set(
    reports.map((report) => report.reporterId).filter((id): id is string => id !== null),
  )

  return {
    fieldId,
    openReports: reports.length,
    distinctReporters: reporters.size,
    firstReportedAt: reports[0]?.createdAt ?? null,
    lastReportedAt: reports[reports.length - 1]?.createdAt ?? null,
    reasons: [...new Set(reports.map((report) => report.reason))],
  }
}

/** The administrator's queue: fields with unhandled reports, newest activity first. */
export async function fieldsWithOpenReports(
  adminId: string,
  limit = 50,
): Promise<readonly ReportSummary[]> {
  await requireAdministrator(adminId)

  const grouped = await prisma.report.groupBy({
    by: ['fieldId'],
    where: { handledAt: null },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: limit,
  })

  return Promise.all(grouped.map((row) => openReportsFor(adminId, row.fieldId)))
}
