import Link from 'next/link'

import { LinkButton } from '@/components/ui'
import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * Where to begin on this route.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Owner, 2026-09-07:** *"most of the websites, the design guides the people where to go,
 * what to do, but in my website all the other pages has info scattered like saying what our
 * building documents are saying."*
 *
 * They were right, and it was measurable: of 271 substantial user-facing strings, 108 were
 * defensive or system-explaining and only 27 told a reader to do anything. A route page opened
 * with its standing, its cautions and its provenance, and the only instruction anywhere near
 * the road was *"Select a step to see the information inside it."* That is a description of a
 * control, not guidance.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What this shows, and why each part earns its line.**
 *
 * The first stage, by name, with its own duration and a way in. Not "explore the route" but
 * *Find Master's programmes, about 4 weeks* — the concrete vocabulary of the journey rather
 * than the abstract vocabulary of the data model. Then the two stages after it, so a reader
 * gets the shape of the beginning without reading eighteen rows.
 *
 * **It is shown to everyone**, signed in or not (owner's decision, 2026-09-07). Knowing where
 * a process starts is part of reading it, not a reward for following it — and the read path is
 * anonymous by design (FR-01, D-03).
 *
 * **It is derived, never authored.** The order comes from the same canonical ordering the
 * renderer uses, so a contributor who reorders the road at 2am changes this with no developer
 * involved (invariant 24). Nothing here is per-route content.
 *
 * **It makes no promise.** Durations are the route's own stored estimates and are already
 * worded as estimates elsewhere; this repeats the number, not a claim about it (invariant 16).
 */
export interface StartStep {
  readonly id: string
  readonly label: string
  readonly href: string
  readonly durationLabel: string | null
}

export function StartHere({
  first,
  next,
  dictionary: t,
}: {
  first: StartStep
  /** The two stages after the first. Fewer is fine on a very short route. */
  next: readonly StartStep[]
  dictionary: Dictionary
}) {
  return (
    <section
      aria-labelledby="start-here"
      className="rounded-panel border border-hairline bg-surface p-4 sm:p-5"
    >
      <h2 id="start-here" className="text-meta font-semibold uppercase tracking-wide text-ink-500">
        {t.route.startHereTitle}
      </h2>

      <p className="mt-2 text-base leading-6 text-ink-900">
        <span className="font-semibold">{first.label}</span>
        {first.durationLabel === null ? null : (
          <span className="text-ink-500">{` · ${first.durationLabel}`}</span>
        )}
      </p>

      <div className="mt-3">
        <LinkButton href={first.href}>{t.route.startHereAction}</LinkButton>
      </div>

      {next.length === 0 ? null : (
        <p className="mt-4 text-meta leading-5 text-ink-500">
          {t.route.startHereThen}{' '}
          {next.map((step, index) => (
            <span key={step.id}>
              {index === 0 ? '' : ', '}
              {/* Linked, because naming a stage a reader cannot reach is a dead end. */}
              <Link href={step.href} className="text-ink-700 hover:text-brand-900 hover:underline">
                {step.label}
              </Link>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}
