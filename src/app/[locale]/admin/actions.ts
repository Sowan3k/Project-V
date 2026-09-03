'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { ReportOutcome } from '@/domain/enums'
import { REPORT_OUTCOMES, ReportOutcome as Outcome } from '@/domain/enums'
import { optionalText, text } from '@/lib/form-fields'
import { currentViewer } from '@/server/auth'
import { handleReportsForField, quarantineField, releaseField } from '@/server/safety/service'

/**
 * Administrator actions — Phase 9, FR-36, §23.2, §23.3.
 *
 * Every one of these calls a service function that checks the role **server-side** before
 * doing anything. The check is not here and not in the page: a hidden button is not a
 * permission (CLAUDE.md §9), and an action that trusted its caller would be reachable by
 * anyone who could construct a POST.
 *
 * §23.3 confines this role to "safety, disputes, abuse, annual maintenance and exceptional
 * cases". There is deliberately no administrator action for approving a contribution, because
 * there is nothing to approve.
 */

async function requireSignedIn(locale: string): Promise<{ id: string }> {
  const viewer = await currentViewer()
  if (!viewer) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/admin/reports`)}`)
  return viewer
}

export async function quarantineFieldAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const viewer = await requireSignedIn(locale)

  await quarantineField({
    adminId: viewer.id,
    fieldId: text(formData, 'fieldId'),
    note: optionalText(formData, 'quarantineNote'),
  })

  revalidatePath(`/${locale}/admin/reports`)
}

export async function releaseFieldAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const viewer = await requireSignedIn(locale)

  await releaseField({ adminId: viewer.id, fieldId: text(formData, 'fieldId') })
  revalidatePath(`/${locale}/admin/reports`)
}

export async function handleReportAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const viewer = await requireSignedIn(locale)

  const raw = text(formData, 'outcome')
  const outcome: ReportOutcome = (REPORT_OUTCOMES as readonly string[]).includes(raw)
    ? (raw as ReportOutcome)
    : Outcome.no_action_needed

  await handleReportsForField({
    adminId: viewer.id,
    fieldId: text(formData, 'fieldId'),
    outcome,
    note: optionalText(formData, 'outcomeNote'),
  })

  revalidatePath(`/${locale}/admin/reports`)
}
