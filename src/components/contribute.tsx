import {
  addFieldAction,
  addStepAction,
  challengeFieldAction,
  confirmFieldAction,
  updateFieldAction,
} from '@/app/[locale]/routes/[slug]/actions'
import { Caution } from '@/components/trust'
import {
  buttonClass,
  ContributorLink,
  Disclosure,
  FactList,
  FormField,
  FormFieldset,
  GuidanceList,
  inputClass,
  Panel,
} from '@/components/ui'
import {
  CHALLENGE_REASONS,
  FIELD_APPLICABILITIES,
  FIELD_CATEGORIES,
  SOURCE_CLASSES,
  STEP_CATEGORIES,
} from '@/domain/enums'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { FieldView, RouteDetail, StepView } from '@/server/routes/read'

/**
 * Contribution controls — Phase 8, recomposed against VR-08 in Phase 12E.
 * FR-14, FR-15, FR-16, FR-17, FR-18, FR-50.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Everything here is a `<details>` disclosure containing a plain form.**
 *
 * That single decision satisfies three requirements at once. It keeps the route on screen, so
 * correcting a field never navigates away from the road it belongs to (CLAUDE.md §7.1). It
 * keeps the closed state to one line of small text, so a reader who came to read is not
 * confronted with four forms per field (FR-50: "minimal unnecessary form filling"). And it
 * works with JavaScript disabled, like everything else on the read path — a student on a slow
 * phone in Dhaka can still correct a deadline.
 *
 * **The four actions stay visibly distinct**, because they mean different things:
 *
 *   CONFIRM    one button, no form. Nothing to fill in when nothing changed.
 *   UPDATE     current value beside the correction. Appends a revision; the old value survives.
 *   CHALLENGE  a reason and an optional note. Changes nothing about the value.
 *   ADD        a new field, or a new step.
 *
 * There is no Report button here. "This may be dangerous" is a different action with different
 * consequences, and it is Phase 9 (CLAUDE.md §5).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What VR-08 is binding on here, and the two places it is not.**
 *
 * Binding, and now built: the *comparison*. VR-08's whole composition is the current value on
 * the left and the proposed value on the right, with the route/step/field context above them
 * and applicability, reason and source asked explicitly. Before this, the form showed a
 * textarea pre-filled with the current value and nothing else — so a contributor could not see
 * what they were changing while changing it, and the applicability and source questions read
 * as unexplained extra work rather than as the point.
 *
 * **Departure 1 — a disclosure, not a page.** VR-08 draws a dedicated `/update-information`
 * screen. CLAUDE.md §7.1 classifies Update as a short transient action, which is a disclosure
 * or a drawer "returning to the same place", and it outranks the mockup (§8.1). It is also
 * better here: the field being corrected stays visible above the form, which is exactly the
 * context the mockup has to re-state in a panel *because* it navigated away.
 *
 * **Departure 2 — no wizard, and no stages 4 and 5.** VR-08's progress bar runs Current
 * Information → Your Update → Source & Details → Review & Submit, and its rail ends "4.
 * Community reviews … 5. Update goes live when confirmed by the community." Stages 4 and 5 are
 * a mockup exception (CLAUDE.md §8.6): an update is live when it is saved, and a Phase 8 guard
 * fails the build on approval vocabulary. A four-stage wizard whose last two stages are
 * refused is not a wizard, and a multi-page one would need server-side draft state for a form
 * that fits on one screen. The stages remain as *content* — the guidance list below the
 * comparison — which is the half that was doing the work.
 */

/** Signed-out readers get an invitation, not a disabled button. */
export function ContributionInvitation({
  dictionary: t,
  locale,
  next,
}: {
  dictionary: Dictionary
  locale: string
  next: string
}) {
  return (
    <p className="mt-3 text-meta text-ink-500">
      <a
        href={`/${locale}/signin?next=${encodeURIComponent(next)}`}
        className="text-brand-700 underline"
      >
        {t.contribute.signInToContribute}
      </a>
    </p>
  )
}

const FORM = 'mt-2 grid gap-3 rounded-control border border-hairline bg-surface p-3'
const INPUT = inputClass('compact')
const SUBMIT = buttonClass('primary', { size: 'compact', className: 'justify-self-start' })

/**
 * `open:w-full` is the whole reason the four actions can be a row *and* the correction form
 * can be a two-column comparison.
 *
 * Closed, each disclosure is a chip in a wrapping flex row, which is what FR-50 asks for. Open,
 * it takes the full width of the row and drops onto its own line — so the panel inside is not
 * squeezed into a third of a field row, which is what it would inherit as an ordinary flex
 * item. Pure CSS, no measurement, no script.
 */
const ACTION = 'open:w-full'

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The four field actions, side by side, each closed until asked for. */
export function FieldActions({
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
  const common = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={route.slug} />
      <input type="hidden" name="stepId" value={step.id} />
      <input type="hidden" name="fieldId" value={field.id} />
    </>
  )

  return (
    <div className="mt-3 flex flex-wrap items-start gap-x-5 gap-y-2 border-t border-hairline pt-2.5">
      {/* CONFIRM — one button. Nothing changed, so there is nothing to fill in (FR-17). */}
      <form action={confirmFieldAction}>
        {common}
        <button type="submit" className="text-meta font-medium text-brand-700 underline decoration-hairline underline-offset-2">
          {t.contribute.confirm}
        </button>
      </form>

      <Disclosure summary={t.contribute.update} className={ACTION}>
        <UpdatePanel field={field} step={step} route={route} dictionary={t} common={common} />
      </Disclosure>

      <Disclosure summary={t.contribute.challenge} className={ACTION}>
        <form action={challengeFieldAction} className={FORM}>
          {common}
          <p className="text-meta leading-5 text-ink-500">{t.contribute.challengeExplainer}</p>

          <FormField label={t.contribute.challengeReason} size="compact">
            <select name="reason" className={INPUT} defaultValue="">
              {CHALLENGE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {t.challengeReason[reason]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t.contribute.note} hint={t.contribute.noteHint} size="compact">
            <textarea name="note" rows={2} className={INPUT} />
          </FormField>

          <button type="submit" className={SUBMIT}>
            {t.contribute.raiseChallenge}
          </button>
        </form>
      </Disclosure>
    </div>
  )
}

/**
 * VR-08's comparison: what it says now, beside what you are proposing.
 *
 * The left panel is not decoration and not a duplicate of the row above it. It states the four
 * things a contributor needs in order to make a *useful* correction rather than merely a
 * different one — whom the current claim applies to, who is said to assert it, when it was
 * last confirmed, and how many versions it has already been through. A contributor who cannot
 * see that the current value is an official, route-wide claim confirmed last week will
 * overwrite it with their own experience of one university, which is the exact collision
 * invariant 11 exists to prevent.
 *
 * Stacked at phone width, side by side from `md`. Nothing here is a second copy of the field —
 * it is the same `FieldView` the row above was rendered from.
 */
function UpdatePanel({
  field,
  step,
  route,
  dictionary: t,
  common,
}: {
  field: FieldView
  step: StepView
  route: RouteDetail
  dictionary: Dictionary
  common: React.ReactNode
}) {
  return (
    <div className="mt-3 rounded-panel border border-hairline bg-surface-muted p-3 sm:p-4">
      {/* VR-08's Route | Step | Field strip. On the mockup it exists because the update
          happens on a page of its own; here it is one quiet line confirming what is about to
          be changed, which is worth stating before somebody rewrites it. */}
      <p className="text-micro tracking-wide text-ink-500 uppercase">
        {t.contribute.updateContext}
      </p>
      <p className="mt-1 text-meta text-ink-700">
        {route.title}
        <span aria-hidden="true" className="px-1.5 text-ink-500">
          /
        </span>
        {step.label}
        <span aria-hidden="true" className="px-1.5 text-ink-500">
          /
        </span>
        <span className="font-medium text-ink-900">{t.fieldCategory[field.category]}</span>
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel as="section" padded={false} className="p-3">
          <h4 className="text-meta font-semibold text-ink-900">{t.contribute.currentTitle}</h4>
          <p className="mt-0.5 text-micro text-ink-500">
            {field.lastRevisedAt === null
              ? t.contribute.currentNeverRevised
              : t.contribute.currentAsOf(isoDate(field.lastRevisedAt))}
          </p>

          <p className="mt-2 rounded-control border border-hairline bg-surface-muted px-2.5 py-2 text-sm leading-6 text-ink-900">
            {field.valueText}
          </p>

          <FactList
            className="mt-3"
            facts={[
              {
                label: t.contribute.appliesToNow,
                value:
                  field.applicability.length === 0
                    ? t.trust.fieldSignal.scope_not_stated
                    : field.applicability.map((scope) => t.applicability[scope]).join(' · '),
              },
              { label: t.contribute.whoSaysSo, value: t.sourceClass[field.sourceClass] },
              {
                label: t.contribute.lastConfirmedLabel,
                value:
                  field.lastConfirmedAt === null
                    ? t.contribute.neverConfirmedShort
                    : isoDate(field.lastConfirmedAt),
              },
              {
                label: t.contribute.versionsLabel,
                value: t.contribute.versionCount(field.revisionCount),
              },
            ]}
          />
        </Panel>

        <form action={updateFieldAction} className="grid content-start gap-3 rounded-panel border border-brand-500 bg-surface p-3">
          {common}
          {/* Carried through so a concurrent correction forks rather than overwrites. */}
          <input type="hidden" name="basedOnRevisionId" value={field.currentRevisionId ?? ''} />

          <div>
            <h4 className="text-meta font-semibold text-ink-900">{t.contribute.proposedTitle}</h4>
            <p className="mt-0.5 text-micro leading-5 text-ink-500">
              {t.contribute.updateExplainer}
            </p>
          </div>

          <FormField label={t.contribute.proposedValue} size="compact">
            <textarea name="valueText" rows={4} defaultValue={field.valueText} className={INPUT} />
          </FormField>

          <SourceAndScope field={field} dictionary={t} />

          <FormField
            label={t.contribute.reason}
            hint={t.contribute.reasonHint}
            size="compact"
          >
            <textarea name="reason" rows={2} className={INPUT} />
          </FormField>

          <button type="submit" className={SUBMIT}>
            {t.contribute.saveUpdate}
          </button>
        </form>
      </div>

      {/* VR-08's "Tips for a good update", kept as content and moved beneath the form it is
          about. The mockup puts it in a rail on the right; there is no rail inside a field. */}
      <section className="mt-4 border-t border-hairline pt-3">
        <h4 className="text-meta font-semibold text-ink-900">{t.contribute.updateTipsTitle}</h4>
        <GuidanceList className="mt-2" lines={t.contribute.updateTips} />
      </section>

      <p className="mt-3 text-micro leading-5 text-ink-500">{t.contribute.updateAttribution}</p>
    </div>
  )
}

/**
 * Source class and applicability, asked separately — FR-33, FR-81, D-47, invariant 11.
 *
 * They answer different questions: **who asserts this** and **whom does it apply to**. A form
 * that merged them would teach every contributor that they are the same thing, and the whole
 * Germany finding behind Amendment 001 was that they are not.
 */
function SourceAndScope({ field, dictionary: t }: { field: FieldView; dictionary: Dictionary }) {
  return (
    <>
      <FormField
        label={t.contribute.sourceClass}
        hint={t.contribute.sourceClassHint}
        size="compact"
      >
        <select name="sourceClass" defaultValue={field.sourceClass} className={INPUT}>
          {SOURCE_CLASSES.map((sourceClass) => (
            <option key={sourceClass} value={sourceClass}>
              {t.sourceClass[sourceClass]}
            </option>
          ))}
        </select>
      </FormField>

      <FormFieldset
        legend={t.contribute.applicability}
        hint={t.contribute.applicabilityHint}
        size="compact"
      >
        <div className="grid gap-1.5">
          {FIELD_APPLICABILITIES.map((scope) => (
            <label key={scope} className="flex items-center gap-2 text-meta text-ink-700">
              <input
                type="checkbox"
                name="applicability"
                value={scope}
                defaultChecked={field.applicability.includes(scope)}
              />
              <span>{t.applicability[scope]}</span>
            </label>
          ))}
        </div>
      </FormFieldset>

      <FormField label={t.contribute.sourceUrl} size="compact">
        <input
          type="url"
          name="sourceUrl"
          defaultValue={field.sourceUrl ?? ''}
          className={INPUT}
          placeholder="https://"
        />
      </FormField>
    </>
  )
}

/** ADD a field to a step — FR-15, VR-05's "Add New Field to this Step". */
export function AddFieldForm({
  step,
  route,
  locale,
  dictionary: t,
}: {
  step: StepView
  route: RouteDetail
  locale: string
  dictionary: Dictionary
}) {
  return (
    <Disclosure summary={t.contribute.addField} className="mt-4">
      <form action={addFieldAction} className={FORM}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="slug" value={route.slug} />
        <input type="hidden" name="stepId" value={step.id} />

        <FormField label={t.contribute.fieldCategory} size="compact">
          <select name="category" className={INPUT}>
            {FIELD_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t.fieldCategory[category]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label={t.contribute.value} size="compact">
          <textarea name="valueText" rows={3} className={INPUT} />
        </FormField>

        <FormField
          label={t.contribute.sourceClass}
          hint={t.contribute.sourceClassHint}
          size="compact"
        >
          <select name="sourceClass" className={INPUT}>
            {SOURCE_CLASSES.map((sourceClass) => (
              <option key={sourceClass} value={sourceClass}>
                {t.sourceClass[sourceClass]}
              </option>
            ))}
          </select>
        </FormField>

        <FormFieldset
          legend={t.contribute.applicability}
          hint={t.contribute.applicabilityHint}
          size="compact"
        >
          <div className="grid gap-1.5 sm:grid-cols-2">
            {FIELD_APPLICABILITIES.map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-meta text-ink-700">
                <input type="checkbox" name="applicability" value={scope} />
                <span>{t.applicability[scope]}</span>
              </label>
            ))}
          </div>
        </FormFieldset>

        <FormField label={t.contribute.sourceUrl} size="compact">
          <input type="url" name="sourceUrl" className={INPUT} placeholder="https://" />
        </FormField>

        <button type="submit" className={SUBMIT}>
          {t.contribute.addFieldSubmit}
        </button>
      </form>
    </Disclosure>
  )
}

/**
 * ADD a step to a route — FR-14, VR-09's "Build Road" stage, done in place.
 *
 * VR-09 draws this as stage 2 of a five-stage wizard on a page of its own, with a step strip
 * beneath it. The strip is real and is on the route already — this form sits directly under
 * it, so a contributor watches the road they are building change as they add to it, which is
 * what the wizard's preview pane is trying to approximate.
 */
export function AddStepForm({
  route,
  locale,
  dictionary: t,
}: {
  route: RouteDetail
  locale: string
  dictionary: Dictionary
}) {
  return (
    <Disclosure summary={t.contribute.addStep} className="mt-4">
      <form action={addStepAction} className={FORM}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="slug" value={route.slug} />
        <input type="hidden" name="routeId" value={route.id} />

        <FormField label={t.contribute.stepLabel} size="compact">
          <input type="text" name="label" required className={INPUT} />
        </FormField>

        <FormField label={t.contribute.stepCategory} size="compact">
          <select name="category" className={INPUT}>
            {STEP_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t.stepCategory[category]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label={t.contribute.afterStep}
          hint={t.contribute.afterStepHint}
          size="compact"
        >
          <select name="afterStepId" className={INPUT} defaultValue="">
            <option value="">{t.contribute.afterStepNone}</option>
            {route.steps.map((step) => (
              <option key={step.id} value={step.id}>
                {step.label}
              </option>
            ))}
          </select>
        </FormField>

        <button type="submit" className={SUBMIT}>
          {t.contribute.addStepSubmit}
        </button>
      </form>
    </Disclosure>
  )
}

/** Open challenges on a field, shown with the field rather than tucked away (FR-49). */
export function OpenChallenges({
  field,
  locale,
  dictionary: t,
}: {
  field: FieldView
  locale: string
  dictionary: Dictionary
}) {
  if (field.openChallenges.length === 0) return null

  return (
    <ul className="mt-2 space-y-1 rounded-control border border-caution-500/40 bg-caution-50 px-2.5 py-2">
      {field.openChallenges.map((challenge) => (
        <li key={challenge.id}>
          <Caution>
            <span className="font-medium">{t.challengeReason[challenge.reason]}</span>
            {challenge.note === null ? null : <> — “{challenge.note}”</>}
            <span className="text-ink-500">
              {' '}
              · {isoDate(challenge.createdAt)}
              {challenge.authorHandle === null ? null : (
                <>
                  {' · '}
                  <ContributorLink handle={challenge.authorHandle} locale={locale} />
                </>
              )}
            </span>
          </Caution>
        </li>
      ))}
    </ul>
  )
}
