'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { ReportReason } from '@/domain/enums'
import { REPORT_REASONS, ReportReason as Reason } from '@/domain/enums'
import { optionalText, text } from '@/lib/form-fields'
import { currentViewer } from '@/server/auth'
import { reportField } from '@/server/safety/service'

/**
 * REPORT — Phase 9, FR-35, FR-37, §23.1.
 *
 * Kept in its own file rather than beside the contribution actions, because it is not one.
 * A challenge says "this may be wrong" and any contributor answers it with a revision; a
 * report says "this may be dangerous" and an administrator answers it. An architecture test
 * asserts the contribution module contains no reference to reporting at all, precisely so the
 * two cannot quietly merge (§23.1, CLAUDE.md §5).
 *
 * Reporting changes nothing about the field. The content stays exactly as it was until a
 * person with the administrator role decides otherwise — there is no automatic hiding, and no
 * threshold anywhere for one to be based on (FR-71, invariant 14).
 *
 * Fields are read through the shared helper that refuses a `File`, so a report cannot carry an
 * attachment even if a request is hand-crafted (§8.6, invariants 6 and 7).
 */
export async function reportFieldAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const slug = text(formData, 'slug')
  const stepId = text(formData, 'stepId')

  const viewer = await currentViewer()
  if (!viewer) {
    redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/routes/${slug}?step=${stepId}`)}`)
  }

  const raw = text(formData, 'reportReason')
  const reason: ReportReason = (REPORT_REASONS as readonly string[]).includes(raw)
    ? (raw as ReportReason)
    : Reason.other_serious_concern

  await reportField({
    reporterId: viewer.id,
    fieldId: text(formData, 'fieldId'),
    reason,
    detail: optionalText(formData, 'reportDetail'),
  })

  revalidatePath(`/${locale}/routes/${slug}`)
}
