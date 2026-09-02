import {
  addFieldAction,
  addStepAction,
  challengeFieldAction,
  confirmFieldAction,
  updateFieldAction,
} from '@/app/[locale]/routes/[slug]/actions'
import { Caution } from '@/components/trust'
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
 * Contribution controls — Phase 8. FR-14, FR-15, FR-16, FR-17, FR-18, FR-50.
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
 *   UPDATE     the current value, editable. Appends a revision; the old value survives.
 *   CHALLENGE  a reason and an optional note. Changes nothing about the value.
 *   ADD        a new field, or a new step.
 *
 * There is no Report button here. "This may be dangerous" is a different action with different
 * consequences, and it is Phase 9 (CLAUDE.md §5).
 *
 * **No approval language anywhere.** Nothing says "submit for review", "pending" or "awaiting
 * approval", because nothing is: an update is live when it is saved (FR-16, FR-69, §43.1).
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
    <p className="mt-3 text-xs text-ink-500">
      <a
        href={`/${locale}/signin?next=${encodeURIComponent(next)}`}
        className="text-brand-700 underline"
      >
        {t.contribute.signInToContribute}
      </a>
    </p>
  )
}

const FORM = 'mt-2 grid gap-2 rounded-lg border border-hairline bg-surface p-3'
const INPUT =
  'mt-1 block w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900'
const LABEL = 'text-xs text-ink-700'
const SUBMIT = 'justify-self-start rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white'
const SUMMARY = 'cursor-pointer text-xs text-brand-700'

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
    <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-hairline pt-2">
      {/* CONFIRM — one button. Nothing changed, so there is nothing to fill in (FR-17). */}
      <form action={confirmFieldAction}>
        {common}
        <button type="submit" className="text-xs text-brand-700 underline">
          {t.contribute.confirm}
        </button>
      </form>

      <details>
        <summary className={SUMMARY}>{t.contribute.update}</summary>
        <form action={updateFieldAction} className={FORM}>
          {common}
          {/* Carried through so a concurrent correction forks rather than overwrites. */}
          <input type="hidden" name="basedOnRevisionId" value={field.currentRevisionId ?? ''} />
          <p className="text-xs text-ink-500">{t.contribute.updateExplainer}</p>

          <label className={LABEL}>
            {t.contribute.value}
            <textarea name="valueText" rows={3} defaultValue={field.valueText} className={INPUT} />
          </label>

          <SourceAndScope field={field} dictionary={t} />

          <label className={LABEL}>
            {t.contribute.reason}
            <input type="text" name="reason" className={INPUT} placeholder={t.contribute.reasonHint} />
          </label>

          <button type="submit" className={SUBMIT}>
            {t.contribute.saveUpdate}
          </button>
        </form>
      </details>

      <details>
        <summary className={SUMMARY}>{t.contribute.challenge}</summary>
        <form action={challengeFieldAction} className={FORM}>
          {common}
          <p className="text-xs text-ink-500">{t.contribute.challengeExplainer}</p>

          <label className={LABEL}>
            {t.contribute.challengeReason}
            <select name="reason" className={INPUT} defaultValue="">
              {CHALLENGE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {t.challengeReason[reason]}
                </option>
              ))}
            </select>
          </label>

          <label className={LABEL}>
            {t.contribute.note}
            <textarea name="note" rows={2} className={INPUT} placeholder={t.contribute.noteHint} />
          </label>

          <button type="submit" className={SUBMIT}>
            {t.contribute.raiseChallenge}
          </button>
        </form>
      </details>
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
      <label className={LABEL}>
        {t.contribute.sourceClass}
        <select name="sourceClass" defaultValue={field.sourceClass} className={INPUT}>
          {SOURCE_CLASSES.map((sourceClass) => (
            <option key={sourceClass} value={sourceClass}>
              {t.sourceClass[sourceClass]}
            </option>
          ))}
        </select>
        <span className="mt-0.5 block text-ink-500">{t.contribute.sourceClassHint}</span>
      </label>

      <fieldset className={LABEL}>
        <legend>{t.contribute.applicability}</legend>
        <span className="mt-0.5 block text-ink-500">{t.contribute.applicabilityHint}</span>
        <div className="mt-1 grid gap-1 sm:grid-cols-2">
          {FIELD_APPLICABILITIES.map((scope) => (
            <label key={scope} className="flex items-center gap-1.5">
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
      </fieldset>

      <label className={LABEL}>
        {t.contribute.sourceUrl}
        <input
          type="url"
          name="sourceUrl"
          defaultValue={field.sourceUrl ?? ''}
          className={INPUT}
          placeholder="https://"
        />
      </label>
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
    <details className="mt-4">
      <summary className={SUMMARY}>{t.contribute.addField}</summary>
      <form action={addFieldAction} className={FORM}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="slug" value={route.slug} />
        <input type="hidden" name="stepId" value={step.id} />

        <label className={LABEL}>
          {t.contribute.fieldCategory}
          <select name="category" className={INPUT}>
            {FIELD_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t.fieldCategory[category]}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL}>
          {t.contribute.value}
          <textarea name="valueText" rows={3} className={INPUT} />
        </label>

        <label className={LABEL}>
          {t.contribute.sourceClass}
          <select name="sourceClass" className={INPUT}>
            {SOURCE_CLASSES.map((sourceClass) => (
              <option key={sourceClass} value={sourceClass}>
                {t.sourceClass[sourceClass]}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-ink-500">{t.contribute.sourceClassHint}</span>
        </label>

        <fieldset className={LABEL}>
          <legend>{t.contribute.applicability}</legend>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {FIELD_APPLICABILITIES.map((scope) => (
              <label key={scope} className="flex items-center gap-1.5">
                <input type="checkbox" name="applicability" value={scope} />
                <span>{t.applicability[scope]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={LABEL}>
          {t.contribute.sourceUrl}
          <input type="url" name="sourceUrl" className={INPUT} placeholder="https://" />
        </label>

        <button type="submit" className={SUBMIT}>
          {t.contribute.addField}
        </button>
      </form>
    </details>
  )
}

/** ADD a step to a route — FR-14, VR-09's "Build Road" stage, done in place. */
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
    <details className="mt-4">
      <summary className={SUMMARY}>{t.contribute.addStep}</summary>
      <form action={addStepAction} className={FORM}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="slug" value={route.slug} />
        <input type="hidden" name="routeId" value={route.id} />

        <label className={LABEL}>
          {t.contribute.stepLabel}
          <input type="text" name="label" required className={INPUT} />
        </label>

        <label className={LABEL}>
          {t.contribute.stepCategory}
          <select name="category" className={INPUT}>
            {STEP_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t.stepCategory[category]}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL}>
          {t.contribute.afterStep}
          <select name="afterStepId" className={INPUT} defaultValue="">
            <option value="">{t.contribute.afterStepNone}</option>
            {route.steps.map((step) => (
              <option key={step.id} value={step.id}>
                {step.label}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-ink-500">{t.contribute.afterStepHint}</span>
        </label>

        <button type="submit" className={SUBMIT}>
          {t.contribute.addStep}
        </button>
      </form>
    </details>
  )
}

/** Open challenges on a field, shown with the field rather than tucked away (FR-49). */
export function OpenChallenges({
  field,
  dictionary: t,
}: {
  field: FieldView
  dictionary: Dictionary
}) {
  if (field.openChallenges.length === 0) return null

  return (
    <ul className="mt-2 space-y-1 rounded-md border border-caution-500/40 bg-caution-50 px-2.5 py-2">
      {field.openChallenges.map((challenge) => (
        <li key={challenge.id}>
          <Caution>
            <span className="font-medium">{t.challengeReason[challenge.reason]}</span>
            {challenge.note === null ? null : <> — “{challenge.note}”</>}
            <span className="text-ink-500">
              {' '}
              · {challenge.createdAt.toISOString().slice(0, 10)}
              {challenge.authorHandle === null ? '' : ` · ${challenge.authorHandle}`}
            </span>
          </Caution>
        </li>
      ))}
    </ul>
  )
}
