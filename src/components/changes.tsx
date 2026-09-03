import { Caution } from '@/components/trust'
import type { ChangeRelevance, DisruptionRelevance } from '@/domain/changes'
import { daysRemaining } from '@/domain/changes'
import type { ChangeSeverity } from '@/domain/enums'
import { ChangeSeverity as Severity, FOLLOWER_CHANGE_STANCES } from '@/domain/enums'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { ChangeView, DisruptionView } from '@/server/changes/read'
import type { RelevantChange, RelevantDisruption } from '@/server/journeys/changes'

/**
 * Changes and disruptions as a reader sees them — Phase 10.
 *
 * FR-28, FR-29, FR-32, FR-59, FR-60, FR-61, FR-63, FR-76. §13.2, §13.3, §41. Invariants 8,
 * 19, 21.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Severity is shown as words, not as an alarm scale.**
 *
 * VR-10 renders severity as coloured chips and *also* a second "Impact: High / Medium / Low"
 * column. Two scales for one judgement is one too many, and the second is not in the baseline
 * — §41.2 defines exactly four levels and defines each by what it means to the follower. So
 * there is one chip, its words are §41.2's meanings rather than the bare enum name
 * ("May need action", not "Important"), and only `critical` gets the attention colour.
 *
 * That last part is Phase 6's rule applied to change: a colour on every severity is a colour
 * on none. `--color-caution-*` means "there is something here to read" and nothing else — it
 * is the same colour a disputed field and a shortened link get, and it never carries meaning
 * alone (CLAUDE.md §7.3, §10.4).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What a follower is told about their own position is never a verdict on their progress.**
 *
 * The strongest wording available here is "this took effect after the date you recorded, so
 * what you did still stands". There is no copy that says a completed step is now wrong,
 * because no such conclusion is ever ours to draw (FR-30, BR-17, §41.3, invariant 8).
 */

const INPUT =
  'mt-1 block w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900'

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Severity and dates
   ══════════════════════════════════════════════════════════════════════════════════════════ */

function SeverityChip({
  severity,
  dictionary: t,
}: {
  severity: ChangeSeverity
  dictionary: Dictionary
}) {
  // One attention colour, reserved for the one level that means "this could break your path".
  const loud = severity === Severity.critical
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${
        loud
          ? 'border-caution-500/40 bg-caution-50 font-medium text-caution-900'
          : 'border-hairline bg-canvas text-ink-700'
      }`}
    >
      {t.changes.severity[severity]}
    </span>
  )
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Both dates, labelled — FR-59, §41.1, BR-26.
 *
 * They are shown together and never collapsed, because the difference between them is the
 * whole point: a rule announced in March and effective in June does not touch an application
 * filed in April. A single "changed on" date would destroy exactly the information a follower
 * needs to work that out (invariant 21).
 */
function ChangeDates({ change, dictionary: t }: { change: ChangeView; dictionary: Dictionary }) {
  return (
    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-500">
      <div className="flex gap-1.5">
        <dt>{t.changes.announcedOn}</dt>
        <dd className="text-ink-700">{isoDate(change.announcedAt)}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt>{t.changes.effectiveFrom}</dt>
        <dd className="text-ink-700">
          {change.effectiveAt === null ? t.changes.effectiveUnknown : isoDate(change.effectiveAt)}
        </dd>
      </div>
    </dl>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   One announced change
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * A change as an anonymous reader sees it — no relevance, because there is no journey to
 * measure against, and inventing one would be a lie.
 */
export function AnnouncedChangeCard({
  change,
  dictionary: t,
  children,
}: {
  change: ChangeView
  dictionary: Dictionary
  children?: React.ReactNode
}) {
  return (
    <li className="rounded-xl border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 className="text-sm font-semibold text-ink-900">{change.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          <SeverityChip severity={change.severity} dictionary={t} />
          <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5 text-xs whitespace-nowrap text-ink-700">
            {t.changes.kind[change.kind]}
          </span>
        </div>
      </div>

      {change.detail === null ? null : (
        <p className="mt-2 text-sm leading-6 text-ink-700">{change.detail}</p>
      )}

      <p className="mt-2 text-xs text-ink-500">
        {t.changes.concerns}:{' '}
        <span className="text-ink-700">{change.stepLabel ?? t.changes.wholeRoute}</span>
      </p>

      <ChangeDates change={change} dictionary={t} />

      {change.authorHandle === null ? null : (
        <p className="mt-1 text-xs text-ink-500">
          {t.changes.announcedBy} {change.authorHandle}
        </p>
      )}

      {children}
    </li>
  )
}

/**
 * The follower's own reading of a change — FR-29, FR-61, §41.3.
 *
 * Bearing first, in one line, then only the notes that are true. A change on a finished step
 * carries `completion_preserved` and stops; a change ahead of them earns a caution. Nothing
 * here is a number.
 */
function RelevanceNote({
  relevance,
  dictionary: t,
}: {
  relevance: ChangeRelevance
  dictionary: Dictionary
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-ink-900">{t.changes.bearing[relevance.bearing]}</p>
      <ul className="mt-1 space-y-0.5">
        {relevance.notes.map((note) => (
          <li key={note} className="text-xs leading-5 text-ink-700">
            {t.changes.note[note]}
          </li>
        ))}
      </ul>
    </>
  )

  if (relevance.weight === 'caution') {
    return (
      <div className="mt-3 rounded-lg border border-caution-500/40 bg-caution-50 px-3 py-2">
        {body}
      </div>
    )
  }
  if (relevance.weight === 'context') {
    return <div className="mt-3 border-t border-hairline pt-2">{body}</div>
  }
  // Weightless. Still stated, quietly — a follower who marked a change "not applicable to me"
  // should still be able to see it and change their mind (§13.3).
  return <div className="mt-3 border-t border-hairline pt-2 opacity-70">{body}</div>
}

/**
 * §13.3's control: the platform asks rather than guessing.
 *
 * Shown only where the scope of the change is genuinely narrower than the route, so it does
 * not become a question attached to everything. A form, not JavaScript — every control in
 * this product works without a bundle (Phase 5).
 */
function StanceControl({
  entry,
  locale,
  slug,
  routeId,
  action,
  clearAction,
  dictionary: t,
}: {
  entry: RelevantChange
  locale: string
  slug: string
  routeId: string
  action: (formData: FormData) => void | Promise<void>
  clearAction: (formData: FormData) => void | Promise<void>
  dictionary: Dictionary
}) {
  if (entry.stance !== null) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-hairline pt-2">
        <p className="text-xs text-ink-700">{t.changes.stance[entry.stance]}</p>
        <form action={clearAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="routeId" value={routeId} />
          <input type="hidden" name="changeId" value={entry.change.id} />
          <button type="submit" className="text-xs text-brand-700 underline">
            {t.changes.stanceClear}
          </button>
        </form>
      </div>
    )
  }

  if (!entry.relevance.askFollower) return null

  return (
    <form action={action} className="mt-3 border-t border-hairline pt-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="routeId" value={routeId} />
      <input type="hidden" name="changeId" value={entry.change.id} />

      <p className="text-xs font-medium text-ink-900">{t.changes.stanceQuestion}</p>
      <p className="mt-0.5 text-xs leading-5 text-ink-500">{t.changes.stanceHint}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {FOLLOWER_CHANGE_STANCES.map((stance) => (
          <button
            key={stance}
            type="submit"
            name="stance"
            value={stance}
            className="rounded-lg border border-hairline px-2.5 py-1 text-xs text-ink-900 hover:border-brand-700 hover:text-brand-900"
          >
            {t.changes.stance[stance]}
          </button>
        ))}
      </div>
    </form>
  )
}

export function FollowerChangeList({
  entries,
  locale,
  slug,
  routeId,
  stanceAction,
  clearStanceAction,
  dictionary: t,
}: {
  entries: readonly RelevantChange[]
  locale: string
  slug: string
  routeId: string
  stanceAction: (formData: FormData) => void | Promise<void>
  clearStanceAction: (formData: FormData) => void | Promise<void>
  dictionary: Dictionary
}) {
  if (entries.length === 0) {
    return <p className="mt-3 text-sm text-ink-700">{t.changes.noAnnouncements}</p>
  }

  return (
    <ul className="mt-3 space-y-3">
      {entries.map((entry) => (
        <AnnouncedChangeCard key={entry.change.id} change={entry.change} dictionary={t}>
          <RelevanceNote relevance={entry.relevance} dictionary={t} />
          <StanceControl
            entry={entry}
            locale={locale}
            slug={slug}
            routeId={routeId}
            action={stanceAction}
            clearAction={clearStanceAction}
            dictionary={t}
          />
        </AnnouncedChangeCard>
      ))}
    </ul>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Disruptions
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * A temporary disruption — FR-32, FR-63, §41.5, invariant 19, VR-10.
 *
 * The three scopes are all on the face of it, because a closure the reader cannot place is
 * useless: **when** (the window, plus how long is left), **where** (the location), and
 * **which part of the process** (the step). VR-10's "IDP IELTS Dhaka centre closed 18–30 Sep
 * due to flooding · Dhaka, Bangladesh · Affects: IELTS Test step" is exactly this shape.
 *
 * And it says outright that it is not a route change. That sentence is doing real work: a
 * student who reads a closure as "Germany changed the rules" has learned something false, and
 * the distinction between a disruption and a revision is the one BR-27 exists to protect.
 */
export function DisruptionCard({
  disruption,
  relevance,
  dictionary: t,
  now,
  children,
}: {
  disruption: DisruptionView
  relevance?: DisruptionRelevance
  dictionary: Dictionary
  now: Date
  children?: React.ReactNode
}) {
  const remaining = disruption.active ? daysRemaining(disruption, now) : null
  const state = disruption.active
    ? t.changes.activeNow
    : disruption.resolvedAt !== null
      ? t.changes.disruptionResolved
      : disruption.startsAt.getTime() > now.getTime()
        ? t.changes.disruptionUpcoming
        : t.changes.disruptionEnded

  return (
    <li
      className={`rounded-xl border p-4 ${
        disruption.active
          ? 'border-caution-500/40 bg-caution-50'
          : 'border-hairline bg-surface opacity-80'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 className="text-sm font-semibold text-ink-900">{disruption.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          <SeverityChip severity={disruption.severity} dictionary={t} />
          <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-xs whitespace-nowrap text-ink-700">
            {state}
          </span>
        </div>
      </div>

      {disruption.detail === null ? null : (
        <p className="mt-2 text-sm leading-6 text-ink-700">{disruption.detail}</p>
      )}

      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-500">
        <div className="flex gap-1.5">
          <dt className="sr-only">{t.changes.disruptionWindow('', '')}</dt>
          <dd className="text-ink-700">
            {disruption.endsAt === null
              ? t.changes.disruptionOpenEnded(isoDate(disruption.startsAt))
              : t.changes.disruptionWindow(
                  isoDate(disruption.startsAt),
                  isoDate(disruption.endsAt),
                )}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>{t.changes.disruptionWhere}</dt>
          <dd className="text-ink-700">
            {disruption.locationScope ?? t.changes.disruptionEverywhere}
          </dd>
        </div>
        {disruption.stepLabel === null ? null : (
          <div className="flex gap-1.5">
            <dt>{t.changes.disruptionAffects}</dt>
            <dd className="text-ink-700">{disruption.stepLabel}</dd>
          </div>
        )}
        {remaining === null ? null : (
          <div className="flex gap-1.5">
            <dd className="text-ink-700">{t.changes.daysLeft(remaining)}</dd>
          </div>
        )}
      </dl>

      {disruption.resolvedNote === null ? null : (
        <p className="mt-1 text-xs text-ink-500">{disruption.resolvedNote}</p>
      )}

      {relevance === undefined || relevance.weight === null ? null : relevance.weight ===
        'caution' ? (
        <div className="mt-3 rounded-lg border border-caution-500/40 bg-surface px-3 py-2">
          <Caution>{t.changes.disruptionBearing[relevance.bearing]}</Caution>
        </div>
      ) : (
        <p className="mt-3 border-t border-hairline pt-2 text-xs text-ink-700">
          {t.changes.disruptionBearing[relevance.bearing]}
        </p>
      )}

      {/* BR-27 in one sentence, on every card. The confusion it prevents is expensive. */}
      <p className="mt-3 text-xs leading-5 text-ink-500">
        {t.changes.disruptionNotARouteChange}
      </p>

      {children}
    </li>
  )
}

/**
 * "It has ended" — BR-08.
 *
 * A disruption that could only ever expire on its announced schedule would leave a closure
 * showing for a week after it was lifted, which is exactly the stale-information problem this
 * platform exists to fix. Resolving sets `resolvedAt` and leaves `endsAt` alone, so the
 * announced window and what actually happened stay separately readable.
 *
 * Offered to any signed-in contributor, like every other contribution here — no approval gate
 * and no ownership (invariant 3).
 */
export function ResolveDisruptionControl({
  disruptionId,
  locale,
  slug,
  action,
  dictionary: t,
}: {
  disruptionId: string
  locale: string
  slug: string
  action: (formData: FormData) => void | Promise<void>
  dictionary: Dictionary
}) {
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2 border-t border-hairline pt-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="disruptionId" value={disruptionId} />
      <label className="flex-1 text-xs text-ink-700">
        {t.changes.fieldDetail}
        <input type="text" name="resolvedNote" className={INPUT} />
      </label>
      <button
        type="submit"
        className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-ink-900 hover:border-brand-700 hover:text-brand-900"
      >
        {t.changes.resolveDisruption}
      </button>
    </form>
  )
}

export function DisruptionList({
  entries,
  dictionary: t,
  now,
  resolve,
}: {
  entries: readonly RelevantDisruption[]
  dictionary: Dictionary
  now: Date
  /** Present only for a signed-in reader; absent means the control is not offered. */
  resolve?: {
    locale: string
    slug: string
    action: (formData: FormData) => void | Promise<void>
  }
}) {
  if (entries.length === 0) {
    return <p className="mt-3 text-sm text-ink-700">{t.changes.noDisruptions}</p>
  }
  return (
    <ul className="mt-3 space-y-3">
      {entries.map((entry) => (
        <DisruptionCard
          key={entry.disruption.id}
          disruption={entry.disruption}
          relevance={entry.relevance}
          dictionary={t}
          now={now}
        >
          {/* Only worth offering while it is still running. */}
          {resolve === undefined || !entry.disruption.active ? null : (
            <ResolveDisruptionControl
              disruptionId={entry.disruption.id}
              locale={resolve.locale}
              slug={resolve.slug}
              action={resolve.action}
              dictionary={t}
            />
          )}
        </DisruptionCard>
      ))}
    </ul>
  )
}
