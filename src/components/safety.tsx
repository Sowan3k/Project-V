import { reportFieldAction } from '@/app/[locale]/routes/[slug]/safety-actions'
import { Caution } from '@/components/trust'
import { REPORT_REASONS } from '@/domain/enums'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { FieldView, RouteDetail, StepView } from '@/server/routes/read'

/**
 * Safety surfaces — Phase 9. FR-35, FR-36, FR-37, §23, §42.5.
 *
 * Two things a reader sees: a way to say something is dangerous, and a clear notice when
 * something has been withheld.
 *
 * **Report sits apart from the other four actions, and reads differently.** Confirm, correct
 * and flag are one row of small links; reporting is a separate disclosure with its own words
 * explaining when to use it — and, importantly, when *not* to. A report that should have been
 * a challenge wastes an administrator's attention and delays a correction the community could
 * have made in a minute (§23.1, §23.3).
 */

const FORM = 'mt-2 grid gap-2 rounded-lg border border-caution-500/40 bg-caution-50 p-3'
const INPUT =
  'mt-1 block w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900'
const LABEL = 'text-xs text-ink-700'

/** FR-35, FR-37. Any signed-in user; nothing about the field changes. */
export function ReportAction({
  field,
  step,
  route,
  locale,
  dictionary: t,
}: {
  field: FieldView
  step: StepView
  route: RouteDetail
  locale: string
  dictionary: Dictionary
}) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-caution-900">{t.safety.report}</summary>
      <form action={reportFieldAction} className={FORM}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="slug" value={route.slug} />
        <input type="hidden" name="stepId" value={step.id} />
        <input type="hidden" name="fieldId" value={field.id} />

        <p className="text-xs leading-5 text-ink-700">{t.safety.reportExplainer}</p>
        {/* Sending a reader to the faster, more effective action when that is what they need. */}
        <p className="text-xs leading-5 text-ink-500">{t.safety.reportVsChallenge}</p>

        <label className={LABEL}>
          {t.safety.reportReason}
          <select name="reportReason" className={INPUT}>
            {REPORT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {t.reportReason[reason]}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL}>
          {t.safety.reportDetail}
          <textarea name="reportDetail" rows={2} className={INPUT} />
          <span className="mt-0.5 block text-ink-500">{t.safety.reportDetailHint}</span>
        </label>

        <button
          type="submit"
          className="justify-self-start rounded-lg bg-caution-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          {t.safety.submitReport}
        </button>

        {/* §23.1, §23.3: reports are not a public accusation board. Saying so protects both
            the reporter and whoever is reported. */}
        <p className="text-xs leading-5 text-ink-500">{t.safety.reportPrivate}</p>
      </form>
    </details>
  )
}

/**
 * What a reader sees in place of a withheld value — FR-36, §23.2.
 *
 * The value itself never reached this component: `src/server/routes/read.ts` withholds it
 * server-side, so a phishing URL is not sitting in the HTML behind a `display: none`.
 *
 * The notice says three things deliberately. That something was withheld — silence would
 * leave a reader thinking the field was simply empty. Why, in the administrator's words —
 * containment without explanation is indistinguishable from a platform quietly editing what
 * it shows. And that nothing was deleted and it can be restored, because a reader who assumes
 * censorship stops trusting the pages that have no notice on them either.
 */
export function QuarantineNotice({
  field,
  dictionary: t,
}: {
  field: FieldView
  dictionary: Dictionary
}) {
  if (!field.quarantined) return null

  return (
    <div className="mt-1 rounded-md border border-caution-500/40 bg-caution-50 px-2.5 py-2">
      <p className="text-xs font-medium text-caution-900">{t.safety.quarantinedTitle}</p>
      <p className="mt-1 text-xs leading-5 text-ink-700">{t.safety.quarantinedBody}</p>

      <p className="mt-1 text-xs leading-5 text-ink-700">
        <span className="text-ink-500">{t.safety.quarantineNote}: </span>
        {field.quarantineNote ?? t.safety.quarantinedNoReason}
      </p>

      {/* §42.5: containment is not a guarantee about anything else on the page. */}
      <Caution>{t.safety.quarantineNotAGuarantee}</Caution>
    </div>
  )
}
