import { reportFieldAction } from '@/app/[locale]/routes/[slug]/safety-actions'
import { Caution } from '@/components/trust'
import {
  buttonClass,
  ChoiceGrid,
  Disclosure,
  FormField,
  GuidanceList,
  inputClass,
  NumberedFlow,
  Panel,
} from '@/components/ui'
import { REPORT_REASONS } from '@/domain/enums'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { FieldView, RouteDetail, StepView } from '@/server/routes/read'

/**
 * Safety surfaces — Phase 9, recomposed against VR-11 in Phase 12E.
 * FR-35, FR-36, FR-37, §23, §42.5.
 *
 * Two things a reader sees: a way to say something is dangerous, and a clear notice when
 * something has been withheld.
 *
 * **Report sits apart from the other four actions, and reads differently.** Confirm, correct
 * and flag are one row of small links; reporting is a separate disclosure with its own words
 * explaining when to use it — and, importantly, when *not* to. A report that should have been
 * a challenge wastes an administrator's attention and delays a correction the community could
 * have made in a minute (§23.1, §23.3).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What VR-11 gives this, and the five things it does not.**
 *
 * Taken, and it is most of the mockup's value: the **category grid**. Eight report reasons had
 * been eight one-line `<option>`s in a `<select>`, which is the shape most likely to produce
 * the wrong report — "phishing or a scam" and "another serious concern" look equally plausible
 * to somebody who has just found an out-of-date deadline. Each category now carries a sentence
 * saying what it is for, which is the thing that stops a challenge being filed as a report.
 * Also taken: **"what happens next"** and the **quarantine explanation**, both of which answer
 * questions a first-time reporter genuinely has and neither of which existed here.
 *
 * *Departure 1 — a disclosure on the field, not a Report & Safety Center.* Same rule as the
 * correction surface: CLAUDE.md §7.1 makes Report a short transient action returning to the
 * same place, and a report is *about a specific field*. A centre would have to ask "where did
 * you find this?" — VR-11 has exactly that dropdown — where reporting in place already knows.
 *
 * *Departure 2 — no screenshot upload.* CLAUDE.md §8.6, decided 2026-09-02: no upload
 * endpoint, no blob storage, no attachment table. The form says so rather than being silently
 * missing a control the mockup shows, because "text only, and there is nowhere on this
 * platform to upload a file" is a fact about the product worth a reader knowing (invariant 6).
 *
 * *Departure 3 — no "Recently Quarantined Items".* Reports are not a public accusation board
 * (§23.1, §23.3, Phase 9). A list of withheld items with the domains that were withheld is a
 * directory of exactly what it is protecting people from.
 *
 * *Departure 4 — no Safety Leaderboard, and no "12,842+ reports resolved / 98% reviewed"
 * band.* §25 on contribution as a competitive game, and every number in it is illustrative
 * (§8.6). A percentage of reports reviewed is also a claim about our own performance, which is
 * the one kind of claim it would be easiest to make and hardest to keep true.
 *
 * *Departure 5 — "Our Commitment: we review all reports and take action" is not written.* It
 * is a promise with a volume in it. What is written instead is what actually happens, in
 * order, including that a person and not a count decides (invariant 14, FR-71).
 */

const INPUT = inputClass('compact')

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
    <Disclosure summary={t.safety.report} tone="caution" className="mt-2 open:w-full">
      <div className="mt-2 rounded-panel border border-caution-500/40 bg-caution-50 p-3 sm:p-4">
        <p className="text-meta leading-5 text-ink-700">{t.safety.reportExplainer}</p>
        {/* Sending a reader to the faster, more effective action when that is what they need. */}
        <p className="mt-1 text-meta leading-5 text-ink-500">{t.safety.reportVsChallenge}</p>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <form action={reportFieldAction} className="lg:col-span-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={route.slug} />
            <input type="hidden" name="stepId" value={step.id} />
            <input type="hidden" name="fieldId" value={field.id} />

            <fieldset>
              <legend className="text-meta font-semibold text-ink-900">
                {t.safety.reportWhatTitle}
              </legend>
              {/*
                A grid of described categories rather than a `<select>` — VR-11.

                Two columns rather than three: this sits inside a field row inside a step
                panel, and three columns of a sentence each would be four words wide.
              */}
              <ChoiceGrid
                className="mt-2"
                name="reportReason"
                columns={2}
                required
                choices={REPORT_REASONS.map((reason) => ({
                  value: reason,
                  title: t.reportReason[reason],
                  description: t.safety.reportReasonDetail[reason],
                }))}
              />
            </fieldset>

            <FormField
              className="mt-4"
              label={t.safety.reportDetail}
              hint={t.safety.reportDetailHint}
              size="compact"
            >
              <textarea name="reportDetail" rows={3} className={INPUT} />
            </FormField>

            {/* CLAUDE.md §8.6 and invariant 6: VR-11 offers a screenshot here. Saying why
                there is no control is better than a gap where the mockup has one. */}
            <p className="mt-2 text-micro leading-5 text-ink-500">{t.safety.reportTextOnly}</p>

            <button
              type="submit"
              className={buttonClass('caution', { size: 'compact', className: 'mt-3' })}
            >
              {t.safety.submitReport}
            </button>

            {/* §23.1, §23.3: reports are not a public accusation board. Saying so protects
                both the reporter and whoever is reported. */}
            <p className="mt-3 text-micro leading-5 text-ink-500">{t.safety.reportPrivate}</p>
          </form>

          <div className="space-y-3">
            <Panel as="section" padded={false} className="p-3">
              <h5 className="text-meta font-semibold text-ink-900">
                {t.safety.whatHappensTitle}
              </h5>
              <NumberedFlow className="mt-3" stages={t.safety.whatHappens} />
            </Panel>

            <Panel as="section" padded={false} className="p-3">
              <h5 className="text-meta font-semibold text-ink-900">
                {t.safety.quarantineHowTitle}
              </h5>
              <GuidanceList className="mt-2" lines={t.safety.quarantineHow} />
            </Panel>
          </div>
        </div>
      </div>
    </Disclosure>
  )
}

/**
 * What a reader sees in place of a withheld value — FR-36, §23.2, VR-11.
 *
 * The value itself never reached this component: `src/server/routes/read.ts` withholds it
 * server-side, so a phishing URL is not sitting in the HTML behind a `display: none`.
 *
 * The notice says three things deliberately. That something was withheld — silence would
 * leave a reader thinking the field was simply empty. Why, in the administrator's words —
 * containment without explanation is indistinguishable from a platform quietly editing what
 * it shows. And that nothing was deleted and it can be restored, because a reader who assumes
 * censorship stops trusting the pages that have no notice on them either.
 *
 * VR-11's "How quarantine works" panel is folded in as a disclosure rather than left on a
 * safety page the reader would have to go and find. It is four sentences, and the moment a
 * reader wants them is the moment they meet one of these.
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
    <div className="mt-1 rounded-control border border-caution-500/40 bg-caution-50 px-2.5 py-2">
      <p className="text-meta font-medium text-caution-900">{t.safety.quarantinedTitle}</p>
      <p className="mt-1 text-meta leading-5 text-ink-700">{t.safety.quarantinedBody}</p>

      <p className="mt-1 text-meta leading-5 text-ink-700">
        <span className="text-ink-500">{t.safety.quarantineNote}: </span>
        {field.quarantineNote ?? t.safety.quarantinedNoReason}
      </p>

      <Disclosure summary={t.safety.quarantineHowTitle} tone="caution" className="mt-2">
        <GuidanceList className="mt-2" lines={t.safety.quarantineHow} />
      </Disclosure>

      {/* §42.5: containment is not a guarantee about anything else on the page. */}
      <Caution>{t.safety.quarantineNotAGuarantee}</Caution>
    </div>
  )
}
