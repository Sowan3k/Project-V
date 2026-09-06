import { ComparisonRows } from '@/components/shadow-compare'
import { ContributorLink, Disclosure, inputClass } from '@/components/ui'
import { Caution } from '@/components/trust'
import type { ChangeRelevance, DisruptionRelevance } from '@/domain/changes'
import { daysRemaining } from '@/domain/changes'
import type { ChangeSeverity } from '@/domain/enums'
import { CHANGE_SEVERITIES, ChangeSeverity as Severity, FOLLOWER_CHANGE_STANCES } from '@/domain/enums'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { ChangeShadow, ChangeView, DisruptionView } from '@/server/changes/read'
import type { RelevantChange, RelevantDisruption } from '@/server/journeys/changes'

/**
 * Changes and disruptions as a reader sees them — Phase 10, recomposed against VR-10 in 12E.
 *
 * FR-28, FR-29, FR-32, FR-59, FR-60, FR-61, FR-63, FR-76. §13.2, §13.3, §41. Invariants 8,
 * 19, 21.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Severity is shown as words and weight, not as an alarm palette.**
 *
 * VR-10 renders severity as four coloured chips and *also* a second "Impact: High / Medium /
 * Low" column. Two scales for one judgement is one too many, and the second is not in the
 * baseline — §41.2 defines exactly four levels and defines each by what it means to the
 * follower. So there is one chip, its words are §41.2's meanings rather than the bare enum
 * name ("May need action", not "Important"), and the four are told apart by ink weight.
 *
 * The reasoning is written out on `SeverityChip` below, because it is the same reasoning
 * CLAUDE.md §11 used to decide that route maturity gets no palette either.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What a follower is told about their own position is never a verdict on their progress.**
 *
 * The strongest wording available here is "this took effect after the date you recorded, so
 * what you did still stands". There is no copy that says a completed step is now wrong,
 * because no such conclusion is ever ours to draw (FR-30, BR-17, §41.3, invariant 8).
 */

const INPUT = inputClass('compact')

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Severity and dates
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * The four levels, told apart by **weight and word** — §41.2, VR-10, CLAUDE.md §7.3.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * VR-10 draws four coloured chips — red, orange, amber, blue — and a rail of four coloured
 * dots to match. Four levels *must* look materially different from one another and until now
 * they did not: `critical` was loud and the other three were the same grey chip, which is a
 * two-level scale wearing four labels.
 *
 * They are four now, and none of it is a palette. This is the §11 route-maturity decision
 * applied to the other ordered scale in the product, for the same three reasons: a hue per
 * level puts a coloured badge on the ordinary case, which is precisely the "badge on
 * everything is a badge on nothing" failure §7.3 exists to prevent; a red chip on a
 * contributor's judgement dresses that judgement as a measurement, which the change
 * vocabulary guard forbids in words and should not permit in pixels; and `--color-caution-*`
 * means "there is something here to read" and nothing else, so spending it four times over
 * would make it mean nothing anywhere.
 *
 * So the ramp is ink weight, and the words carry the meaning — they already say what §41.2
 * says each level *means* rather than naming the enum ("May need action", not "Important").
 * `critical` alone gets the attention colour and an icon, because it is the only level whose
 * definition is that it can invalidate the path somebody is on.
 */
function SeverityChip({
  severity,
  dictionary: t,
}: {
  severity: ChangeSeverity
  dictionary: Dictionary
}) {
  const weight: Record<ChangeSeverity, string> = {
    critical: 'border-caution-500 bg-caution-50 font-semibold text-caution-900',
    important: 'border-ink-500 bg-surface font-medium text-ink-900',
    relevant: 'border-hairline bg-surface text-ink-700',
    informational: 'border-hairline bg-surface-muted text-ink-500',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-micro whitespace-nowrap ${weight[severity]}`}
    >
      {severity === Severity.critical ? (
        // Meaning never rests on colour (§10.4). The one loud level carries a mark too.
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className="shrink-0">
          <path
            d="M6 1.5 L11 10.5 L1 10.5 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M6 4.8 V7.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="6" cy="8.8" r="0.6" fill="currentColor" />
        </svg>
      ) : null}
      {t.changes.severity[severity]}
    </span>
  )
}

/**
 * What kind of thing this is — VR-10's "Type" column, made explicit rather than positional.
 *
 * The mockup mixes permanent changes and temporary disruptions in one list and tells them
 * apart with a type label. This page keeps them in two labelled sections, which is stronger
 * — but a reader who arrives at a card by deep link or by scrolling past the heading has only
 * the card in front of them, and BR-27's distinction is exactly the one that is expensive to
 * get wrong. "Germany adds a visa document" and "the Dhaka centre is shut for a fortnight"
 * are different claims about the world, and one of them expires by itself.
 */
export function ChangeTypeMark({
  kind,
  dictionary: t,
}: {
  kind: 'permanent' | 'temporary'
  dictionary: Dictionary
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-micro whitespace-nowrap text-ink-500">
      <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" className="shrink-0">
        {kind === 'permanent' ? (
          // A road that forks: the route itself is different from here on.
          <path
            d="M6 11 V6.5 M6 6.5 L2.5 3 M6 6.5 L9.5 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        ) : (
          // A clock: it has a window, and the window closes.
          <>
            <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M6 3.4 V6.2 L8 7.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </>
        )}
      </svg>
      {kind === 'permanent' ? t.changes.typePermanent : t.changes.typeTemporary}
    </span>
  )
}

/**
 * How much this route has moved, in counted facts — VR-10's "Impact on My Journey" position.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * The mockup puts a four-number band at the top of its right rail. Its numbers are an impact
 * tally across every route the reader follows, which belongs to a cross-route feed that is
 * out of scope (§35) and would be a change request. The same position on *this* route can
 * carry the same orientation honestly: how many changes have been announced here, at which
 * levels, and how many disruptions are running now.
 *
 * **These counts decide nothing and are not allowed to** (FR-71, invariant 14). Nothing reads
 * them; they are not summed into a score, they do not order the list beneath them, and a route
 * with many announced changes is not thereby worse than one with none — a route nobody has
 * ever corrected is the more common reason for a low number. A level with no changes is
 * omitted rather than shown as a zero, because four zeroes look like a verdict and an absent
 * row looks like what it is.
 */
export function UpdateActivity({
  changes,
  disruptions,
  dictionary: t,
}: {
  changes: readonly ChangeView[]
  disruptions: readonly DisruptionView[]
  dictionary: Dictionary
}) {
  const active = disruptions.filter((disruption) => disruption.active).length
  const bySeverity = [...CHANGE_SEVERITIES]
    .reverse()
    .map((severity) => ({
      severity,
      count: changes.filter((change) => change.severity === severity).length,
    }))
    .filter((entry) => entry.count > 0)

  if (changes.length === 0 && active === 0) {
    return <p className="text-meta leading-5 text-ink-700">{t.changes.activityNone}</p>
  }

  return (
    <>
      <p className="text-meta text-ink-700">{t.changes.activityAnnounced(changes.length)}</p>
      {bySeverity.length === 0 ? null : (
        <ul className="mt-2 space-y-1.5">
          {bySeverity.map((entry) => (
            <li key={entry.severity} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-meta font-semibold text-ink-900">
                {entry.count}
              </span>
              <SeverityChip severity={entry.severity} dictionary={t} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-hairline pt-2 text-meta text-ink-700">
        {t.changes.activityDisruptions(active)}
      </p>
      {/* The sentence that keeps a count from reading as a verdict either way. */}
      <p className="mt-2 text-micro leading-5 text-ink-500">{t.changes.activityNotAJudgement}</p>
    </>
  )
}

/**
 * The four levels explained once, where a reader can find them — VR-10's rail.
 *
 * The mockup's version is a filter with four checkboxes. Filtering one route's handful of
 * announcements is machinery for a problem this page does not have, and the cross-route feed
 * it belongs to is out of scope (§35, and it would be a change request). What is worth
 * keeping is the part underneath: four levels stated in order, with the sentence saying who
 * decided them.
 */
export function SeverityLegend({ dictionary: t }: { dictionary: Dictionary }) {
  return (
    <>
      <ul className="space-y-2">
        {[...CHANGE_SEVERITIES].reverse().map((severity) => (
          <li key={severity}>
            <SeverityChip severity={severity} dictionary={t} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-meta leading-5 text-ink-500">{t.changes.severityExplainer}</p>
    </>
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
  locale,
  dictionary: t,
  children,
}: {
  change: ChangeView
  locale: string
  dictionary: Dictionary
  children?: React.ReactNode
}) {
  return (
    <li className="rounded-panel border border-hairline bg-surface p-4 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {/* BR-27's distinction on the face of the card, not only in the heading above the
              list — a card reached by deep link arrives without its heading. */}
          <ChangeTypeMark kind="permanent" dictionary={t} />
          <h3 className="mt-1 text-sm font-semibold text-ink-900">{change.title}</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <SeverityChip severity={change.severity} dictionary={t} />
          <span className="rounded-full border border-hairline bg-surface-muted px-2 py-0.5 text-micro whitespace-nowrap text-ink-700">
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
          {/* Linked to the contributor's own evidence page — audit F12. A reader weighing an
              announcement is told who made it; §25's answer to "are they any good?" is
              evidence rather than a score, and evidence nothing links to is not evidence. */}
          {t.changes.announcedBy}{' '}
          <ContributorLink handle={change.authorHandle} locale={locale} />
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
      <div className="mt-3 rounded-control border border-caution-500/40 bg-caution-50 px-3 py-2">
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
            className="rounded-control border border-hairline px-2.5 py-1 text-xs text-ink-900 hover:border-brand-700 hover:text-brand-900"
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
  exactChange,
}: {
  entries: readonly RelevantChange[]
  locale: string
  slug: string
  routeId: string
  stanceAction: (formData: FormData) => void | Promise<void>
  clearStanceAction: (formData: FormData) => void | Promise<void>
  dictionary: Dictionary
  /** Renders the announcement's own before/after. Supplied by the page, which can await. */
  exactChange?: (changeId: string) => React.ReactNode
}) {
  if (entries.length === 0) {
    return <p className="mt-3 text-sm text-ink-700">{t.changes.noAnnouncements}</p>
  }

  return (
    <ul className="mt-3 space-y-3">
      {entries.map((entry) => (
        <AnnouncedChangeCard
          key={entry.change.id}
          change={entry.change}
          locale={locale}
          dictionary={t}
        >
          {exactChange?.(entry.change.id)}
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
      className={`rounded-panel border p-4 ${
        disruption.active
          ? 'border-caution-500/40 bg-caution-50'
          : 'border-hairline bg-surface opacity-80'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <ChangeTypeMark kind="temporary" dictionary={t} />
          <h3 className="mt-1 text-sm font-semibold text-ink-900">{disruption.title}</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <SeverityChip severity={disruption.severity} dictionary={t} />
          <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-micro whitespace-nowrap text-ink-700">
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
        <div className="mt-3 rounded-control border border-caution-500/40 bg-surface px-3 py-2">
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
        className="rounded-control border border-hairline px-2.5 py-1.5 text-xs text-ink-900 hover:border-brand-700 hover:text-brand-900"
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

/**
 * The precise before/after an announcement points at — FR-22, FR-31, FR-77.
 *
 * Rendered only when the announcement actually names a revision. When it names none, the
 * disclosure says so plainly rather than showing a comparison assembled from dates, which is
 * the thing this whole relation exists to stop being possible.
 *
 * Both sides come from rows the database refuses to update or delete, so this reads the same
 * today and in five years. It is not a re-derivation that could drift.
 */
export function ExactChange({
  shadow,
  dictionary: t,
}: {
  shadow: ChangeShadow | null
  dictionary: Dictionary
}) {
  if (shadow === null) {
    return <p className="mt-3 text-xs leading-5 text-ink-500">{t.changes.noLinkedEdit}</p>
  }

  return (
    <Disclosure
      summary={t.changes.exactlyWhatChanged}
      className="mt-3 border-t border-hairline pt-2"
    >
      <p className="mt-2 text-meta leading-5 text-ink-500">{t.changes.exactlyWhatChangedHint}</p>

      {shadow.fieldChanges.length === 0 ? null : (
        <ul className="mt-2 space-y-2">
          {shadow.fieldChanges.map((entry) => (
            <li key={entry.revisionId} className="rounded-control border border-hairline p-2.5">
              {entry.before === null ? (
                <p className="text-xs text-ink-500">{t.changes.valueAdded}</p>
              ) : (
                <p className="text-xs leading-5 text-ink-500">
                  {t.changes.valueBefore}:{' '}
                  <span className="text-ink-700 line-through">{entry.before}</span>
                </p>
              )}
              <p className="mt-0.5 text-xs leading-5 text-ink-500">
                {t.changes.valueAfter}: <span className="text-ink-900">{entry.after}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {shadow.comparison.structureChanged ? (
        <ComparisonRows
          comparison={shadow.comparison}
          beforeHeading={t.changes.valueBefore}
          afterHeading={t.changes.valueAfter}
          dictionary={t}
        />
      ) : null}
    </Disclosure>
  )
}
