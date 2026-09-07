import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentColumn, GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import {
  buttonClass,
  Chip,
  EmptyState,
  FormField,
  GuidanceList,
  inputClass,
  Panel,
  Rail,
  TabNav,
} from '@/components/ui'
import { RECORDABLE_REPORT_OUTCOMES } from '@/domain/enums'
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
 * Reachable from the header, and **only by an administrator** — Phase 12E, audit F12. Until
 * then nothing linked here at all: the queue worked, was tested, and could be reached only by
 * knowing the address, which is a capability that is complete in code and absent from the
 * product. FR-46's periodic review is not a review anybody can perform.
 *
 * The header link is gated on the session's safety role, and that gate decides only what is
 * *shown*. This page's own refusal is unchanged and is the actual rule: a
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

const INPUT = inputClass('compact')

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
      <h1 className="text-title font-semibold tracking-tight text-ink-900">{t.admin.title}</h1>
      {/* The other queue, named — see `TabNav`. `/admin/routes` was reachable only by typing
          its URL until Phase 12M. */}
      <TabNav
        label={t.admin.tabsLabel}
        tabs={[
          {
            href: `/${locale}/admin/reports`,
            label: t.admin.title,
            current: true,
          },
          {
            href: `/${locale}/admin/routes`,
            label: t.admin.routesTitle,
            current: false,
          },
        ]}
      />
      <ContentColumn width="reading">
        <p className="mt-2 text-sm leading-6 text-ink-700">{t.admin.lede}</p>
        <p className="mt-2 text-sm leading-6 text-ink-500">{t.admin.noRecommendation}</p>
      </ContentColumn>

      <PageGrid className="mt-8">
        <GridRegion span={8} tablet={4}>
          {queue.length === 0 ? (
            <EmptyState title={t.admin.empty} body={t.admin.emptyNote} />
          ) : (
            <ul className="space-y-4">
              {queue.map((summary) => (
                <Panel as="li" key={summary.fieldId}>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <h2 className="text-panel font-semibold text-ink-900">{t.admin.evidence}</h2>
                      <ul className="mt-2 space-y-0.5 text-sm text-ink-700">
                        <li>{t.admin.openReports(summary.openReports)}</li>
                        {/* The number that resists gaming: people, not reports (invariant 14). */}
                        <li>{t.admin.distinctReporters(summary.distinctReporters)}</li>
                        <li>
                          {t.admin.firstReported}:{' '}
                          {summary.firstReportedAt?.toISOString().slice(0, 16).replace('T', ' ') ??
                            '—'}
                        </li>
                        <li>
                          {t.admin.lastReported}:{' '}
                          {summary.lastReportedAt?.toISOString().slice(0, 16).replace('T', ' ') ??
                            '—'}
                        </li>
                      </ul>
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {summary.reasons.map((reason) => (
                          <li key={reason}>
                            <Chip tone="caution">{t.reportReason[reason]}</Chip>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h2 className="text-panel font-semibold text-ink-900">{t.admin.actions}</h2>

                      <form action={quarantineFieldAction} className="mt-3 grid gap-2">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="fieldId" value={summary.fieldId} />
                        <FormField
                          label={t.admin.quarantineReason}
                          hint={t.admin.quarantineReasonHint}
                          size="compact"
                        >
                          <input type="text" name="quarantineNote" className={INPUT} />
                        </FormField>
                        <button
                          type="submit"
                          className={buttonClass('caution', {
                            size: 'compact',
                            className: 'justify-self-start',
                          })}
                        >
                          {t.admin.quarantine}
                        </button>
                      </form>

                      <form action={releaseFieldAction} className="mt-3">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="fieldId" value={summary.fieldId} />
                        <button type="submit" className="text-meta text-brand-700 underline">
                          {t.admin.release}
                        </button>
                      </form>

                      <form
                        action={handleReportAction}
                        className="mt-4 grid gap-2 border-t border-hairline pt-3"
                      >
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="fieldId" value={summary.fieldId} />
                        <FormField label={t.admin.outcome} size="compact">
                          {/*
                          Only outcomes this product can actually perform — audit F11.

                          The list used to be every outcome in the baseline's vocabulary, and
                          recording one did nothing but set a column: "content removed" beside
                          a field that was still public. An outcome is a claim that something
                          happened, so the queue now offers only the claims it can make true.
                          A correction is a revision somebody makes on the route, and permanent
                          removal is a separate audited surface that does not exist yet
                          (src/domain/enums.ts, RECORDABLE_REPORT_OUTCOMES).
                        */}
                          <select name="outcome" className={INPUT}>
                            {RECORDABLE_REPORT_OUTCOMES.map((outcome) => (
                              <option key={outcome} value={outcome}>
                                {t.reportOutcome[outcome]}
                              </option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label={t.admin.outcomeNote} size="compact">
                          <input type="text" name="outcomeNote" className={INPUT} />
                        </FormField>
                        <button
                          type="submit"
                          className={buttonClass('secondary', {
                            size: 'compact',
                            className: 'justify-self-start',
                          })}
                        >
                          {t.admin.recordDecision}
                        </button>
                      </form>

                      <p className="mt-3 text-meta leading-5 text-ink-500">
                        {t.admin.quarantineIsNotDeletion}
                      </p>
                    </div>
                  </div>
                </Panel>
              ))}
            </ul>
          )}
        </GridRegion>

        {/*
          What the two actions actually do, beside the queue that offers them — Phase 12E.

          The same four sentences a reader meets on a withheld field (VR-11's "How quarantine
          works"), shown to the person deciding rather than only to the person affected. An
          administrator who does not know that withholding is visible, explained and reversible
          will reach for it either too rarely or too readily, and both are worse than knowing.
        */}
        <GridRegion span={4} tablet={2}>
          <div className="space-y-3 lg:sticky lg:top-6">
            <Rail title={t.safety.quarantineHowTitle} level={2}>
              <GuidanceList lines={t.safety.quarantineHow} />
            </Rail>
            <Rail title={t.admin.roleScopeTitle} level={2}>
              <p className="text-meta leading-5 text-ink-700">{t.admin.roleScope}</p>
            </Rail>
          </div>
        </GridRegion>
      </PageGrid>
    </PageCanvas>
  )
}
