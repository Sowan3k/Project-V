import Link from 'next/link'

import { buttonClass } from '@/components/ui'
import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * The moment somebody knows more about a step than anybody else alive.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **This is the single highest-signal moment in the product**, and until now it was four lines
 * of small text at the bottom of a row.
 *
 * A private journey knows which step this person just finished and the date they say they did
 * it. Nothing else in the product, and nothing in any comparable platform, can target a
 * question that precisely: Wikipedia cannot know who stood in the visa queue last Tuesday. So
 * the prompt names the step, names the date, and asks one closed question that can be answered
 * with a single tap (FR-42, §16.5).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Four deliberate choices.**
 *
 * **It says the date back to them.** "You were there on 12 March" is taken from the progress
 * row they already filled in. Asking for it again would be asking a question the product can
 * answer itself, which is the friction that stops people contributing at all.
 *
 * **It names who benefits, as a number.** *"14 people are following this route and have not
 * reached this step yet."* The abstract beneficiary of a public good moves almost nobody; a
 * specific count of people about to hit the exact thing you just learned is different in kind.
 * It is an aggregate that identifies no one and excludes the reader themselves (invariant 5).
 *
 * **Confirming is one tap, and correcting is one tap away.** Roughly nine in ten contributions
 * should be a confirmation, so that path has no form at all. "Something was different" opens
 * the step, where the field-level actions already live.
 *
 * **It invents no contribution type.** This is a moment, not a new kind of action: the buttons
 * lead to CONFIRM and to the existing UPDATE and CHALLENGE controls.
 *
 * The count is optional. On a route nobody else follows there is nothing true to say, and a
 * cheerful zero would be worse than silence.
 */
export function StepCompletedPrompt({
  stepLabel,
  stepHref,
  actualDate,
  followersAhead,
  confirmForm,
  dictionary: t,
}: {
  stepLabel: string
  stepHref: string
  /** The date the follower recorded, if they recorded one. */
  actualDate: Date | null
  /** People following this route who have not marked this step done. Null when unknown. */
  followersAhead: number | null
  /** The CONFIRM form, passed in so the action stays with the page that owns it. */
  confirmForm: React.ReactNode
  dictionary: Dictionary
}) {
  return (
    <section
      aria-label={t.contribute.stillAccurate}
      className="mt-3 rounded-panel border border-brand-500/40 bg-brand-500/5 p-4"
    >
      <p className="text-meta leading-5 text-ink-700">
        {t.contribute.youCompleted(stepLabel)}
        {actualDate === null
          ? ''
          : ` ${t.contribute.youWereThere(actualDate.toISOString().slice(0, 10))}`}
      </p>

      <p className="mt-2 text-sm font-semibold text-ink-900">{t.contribute.stillAccurate}</p>
      <p className="mt-0.5 text-meta leading-5 text-ink-700">{t.contribute.stillAccurateLede}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {confirmForm}

        <Link href={stepHref} className={buttonClass('secondary', { size: 'compact' })}>
          {t.contribute.somethingChanged}
        </Link>
      </div>

      {/*
        The reason to bother, stated as a fact rather than an appeal. Only when there is
        somebody there: "0 people are following this route" is a true sentence that discourages
        the exact thing this panel exists to encourage.
      */}
      {followersAhead === null || followersAhead === 0 ? null : (
        <p className="mt-3 border-t border-brand-500/20 pt-2.5 text-meta leading-5 text-ink-700">
          {t.contribute.peopleBehindYou(followersAhead)}
        </p>
      )}
    </section>
  )
}
