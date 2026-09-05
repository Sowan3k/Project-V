import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentColumn, GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import { REPORT_OUTCOMES } from '@/domain/enums'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { currentViewer } from '@/server/auth'
import { fieldsWithOpenReports, NotAnAdministratorError } from '@/server/safety/service'

import { handleReportAction, quarantineFieldAction, releaseFieldAction } from '../actions'

/**
 * The administrator's queue — Phase 9, FR-36, FR-71, §23.2, §23.3.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **This page shows evidence and offers actions. It never recommends one.**
 *
 * The tempting design is a queue sorted by severity, with a "likely abuse" band and a
 * suggested action. Every part of that would be a raw count deciding something, which FR-71
 * and invariant 14 forbid — and the thresholds it would need are explicitly left open (§23.2,
 * CLAUDE.md §11).
 *
 * So what an administrator gets is: how many reports are open, **how many distinct people**
 * filed them, when the first and last arrived, and which reasons were given. Twelve reports
 * from one person is a different situation from twelve from twelve people, and twelve in four
 * minutes reads differently from twelve over a month. Those are the facts that let a person
 * judge; the judgement stays theirs.
 *
 * Not linked from anywhere in the ordinary interface. An administrator knows the address; a
 * reader has no reason to find a moderation queue while trying to understand a visa process.
 *
 * The role is checked in the service, server-side, and this page shows a plain not-found to
 * anyone else — it does not reveal that the page exists (§23.3, CLAUDE.md §9).
 */
/**
 * Never indexed, and never crawled.
 *
 * The page already answers 404 to anyone who is not an administrator, so this is not what
 * keeps it private — but an indexed moderation URL advertises that the surface exists and
 * invites people to try it. `robots.ts` disallows the path; this keeps it out of the index
 * even if it is linked from somewhere.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const INPUT =
  'mt-1 block w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900'

export default async function AdminReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const viewer = await currentViewer()
  if (!viewer) notFound()

  let queue
  try {
    queue = await fieldsWithOpenReports(viewer.id)
  } catch (error) {
    // A non-administrator gets a 404, not a 403. There is no reason to tell somebody that a
    // moderation queue exists and they are not allowed into it.
    if (error instanceof NotAnAdministratorError) notFound()
    throw error
  }

  return (
    <PageCanvas className="py-8">
      <ContentColumn width="wide">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{t.admin.title}</h1>
        <ContentColumn width="reading">
          <p className="mt-2 text-sm leading-6 text-ink-700">{t.admin.lede}</p>
          <p className="mt-2 text-sm leading-6 text-ink-500">{t.admin.noRecommendation}</p>
        </ContentColumn>

        {queue.length === 0 ? (
          <p className="mt-6 text-sm text-ink-700">{t.admin.empty}</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {queue.map((summary) => (
              <li key={summary.fieldId} className="rounded-panel border border-hairline bg-surface p-4">
                <PageGrid>
                  <GridRegion span={5}>
                    <h2 className="text-sm font-semibold text-ink-900">{t.admin.evidence}</h2>
                    <ul className="mt-2 space-y-0.5 text-sm text-ink-700">
                      <li>{t.admin.openReports(summary.openReports)}</li>
                      {/* The number that resists gaming: people, not reports (invariant 14). */}
                      <li>{t.admin.distinctReporters(summary.distinctReporters)}</li>
                      <li>
                        {t.admin.firstReported}:{' '}
                        {summary.firstReportedAt?.toISOString().slice(0, 16).replace('T', ' ') ?? '—'}
                      </li>
                      <li>
                        {t.admin.lastReported}:{' '}
                        {summary.lastReportedAt?.toISOString().slice(0, 16).replace('T', ' ') ?? '—'}
                      </li>
                    </ul>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {summary.reasons.map((reason) => (
                        <li
                          key={reason}
                          className="rounded-full border border-caution-500/40 bg-caution-50 px-2 py-0.5 text-xs text-caution-900"
                        >
                          {t.reportReason[reason]}
                        </li>
                      ))}
                    </ul>
                  </GridRegion>

                  <GridRegion span={7}>
                    <h2 className="text-sm font-semibold text-ink-900">{t.admin.actions}</h2>

                    <form action={quarantineFieldAction} className="mt-2 grid gap-2">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="fieldId" value={summary.fieldId} />
                      <label className="text-xs text-ink-700">
                        {t.admin.quarantineReason}
                        <input type="text" name="quarantineNote" className={INPUT} />
                        <span className="mt-0.5 block text-ink-500">{t.admin.quarantineReasonHint}</span>
                      </label>
                      <button
                        type="submit"
                        className="justify-self-start rounded-control bg-caution-900 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        {t.admin.quarantine}
                      </button>
                    </form>

                    <form action={releaseFieldAction} className="mt-3">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="fieldId" value={summary.fieldId} />
                      <button type="submit" className="text-xs text-brand-700 underline">
                        {t.admin.release}
                      </button>
                    </form>

                    <form action={handleReportAction} className="mt-4 grid gap-2 border-t border-hairline pt-3">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="fieldId" value={summary.fieldId} />
                      <label className="text-xs text-ink-700">
                        {t.admin.outcome}
                        <select name="outcome" className={INPUT}>
                          {REPORT_OUTCOMES.map((outcome) => (
                            <option key={outcome} value={outcome}>
                              {t.reportOutcome[outcome]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-ink-700">
                        {t.admin.outcomeNote}
                        <input type="text" name="outcomeNote" className={INPUT} />
                      </label>
                      <button
                        type="submit"
                        className="justify-self-start rounded-control border border-brand-700 px-3 py-1.5 text-xs font-medium text-brand-700"
                      >
                        {t.admin.recordDecision}
                      </button>
                    </form>

                    <p className="mt-3 text-xs leading-5 text-ink-500">{t.admin.quarantineIsNotDeletion}</p>
                  </GridRegion>
                </PageGrid>
              </li>
            ))}
          </ul>
        )}

        <ContentColumn width="reading" className="mt-8 border-t border-hairline pt-4">
          <p className="text-xs leading-5 text-ink-500">{t.admin.roleScope}</p>
        </ContentColumn>
      </ContentColumn>
    </PageCanvas>
  )
}
