import Link from 'next/link'

import { RouteLifecycleState } from '@/domain/enums'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { LifecycleEventView } from '@/server/lifecycle/read'
import type { RouteDetail } from '@/server/routes/read'

/**
 * Lifecycle and merge, as a reader sees them — Phase 11.
 *
 * FR-11, FR-38, FR-39, FR-40, FR-45, FR-58. BR-09, BR-10, BR-15, BR-25. §19, §40.4.
 * Invariants 4, 20, 23.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The wording rule for this whole surface: silence is not a defect.**
 *
 * FR-39 and BR-10 say an established route does not become false because nothing has happened
 * for a while, so a quiet route is explained rather than warned about, and the explanation
 * offers the reason it is usually true — a settled process, a seasonal intake — instead of
 * leaving the reader to assume neglect.
 *
 * The trust surface agrees by construction: `lifecycleWarrantsCaution` returns false for
 * `quiet`, so a quiet route carries no caution chip at all. That rule lives in
 * `src/domain/lifecycle.ts` and is shared, so the transition and the rendering cannot drift
 * apart.
 */

/**
 * What a lifecycle state means for the person reading, where it needs saying.
 *
 * `experimental`, `developing` and `established` are absent on purpose: the passport already
 * carries the state and its evidence, and a paragraph under every route explaining that it is
 * developing would be the wall of badges Phase 6 spent its effort avoiding.
 */
const EXPLAINED: Partial<Record<RouteLifecycleState, keyof Dictionary['lifecycle']>> = {
  [RouteLifecycleState.quiet]: 'quietExplainer',
  [RouteLifecycleState.dormant]: 'dormantExplainer',
  [RouteLifecycleState.stale]: 'staleExplainer',
  [RouteLifecycleState.archived]: 'archivedExplainer',
}

export function LifecycleNote({
  state,
  dictionary: t,
}: {
  state: RouteLifecycleState
  dictionary: Dictionary
}) {
  const key = EXPLAINED[state]
  if (key === undefined) return null
  const text = t.lifecycle[key]
  if (typeof text !== 'string') return null

  // Deliberately plain — no caution border, no attention colour. This is context, and the one
  // state a reader might otherwise misread (`quiet`) is the one it exists for.
  return (
    <p className="mt-2 text-xs leading-5 text-ink-500">
      <span className="font-medium text-ink-700">{t.routeLifecycle[state]}.</span> {text}
    </p>
  )
}

/**
 * The signpost on a route that has been superseded — §40.4, FR-58, invariant 20.
 *
 * §40.4: "Archived duplicate routes may point visitors toward the active route rather than
 * simply disappearing." Everything below the notice still works — the road, the steps, the
 * history, the follower's own journey — because a merge moved nothing.
 *
 * It says so explicitly. A reader who arrives at a merged route and is told only "go here
 * instead" has reason to think their own progress went with it.
 */
export function MergedNotice({
  route,
  locale,
  dictionary: t,
}: {
  route: RouteDetail
  locale: string
  dictionary: Dictionary
}) {
  if (route.mergedInto === null) return null

  return (
    <section className="mt-4 rounded-xl border border-brand-500/40 bg-brand-500/5 p-4">
      <h2 className="text-sm font-semibold text-brand-900">{t.lifecycle.mergedTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-ink-700">
        {t.lifecycle.mergedBody(route.mergedInto.title)}
      </p>
      <Link
        href={`/${locale}/routes/${route.mergedInto.slug}`}
        className="mt-2 inline-block text-sm text-brand-700 underline"
      >
        {t.lifecycle.mergedGoTo} →
      </Link>
      {/* FR-58, BR-25 in one sentence, where the person who needs it is standing. */}
      <p className="mt-2 text-xs leading-5 text-ink-500">{t.lifecycle.mergedNothingLost}</p>
    </section>
  )
}

/** The other half of the record: what was merged into the route you are looking at. */
export function MergedFromList({
  routes,
  locale,
  dictionary: t,
}: {
  routes: readonly { slug: string; title: string; mergedAt: Date | null }[]
  locale: string
  dictionary: Dictionary
}) {
  if (routes.length === 0) return null

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-ink-900">{t.lifecycle.mergedFromTitle}</h2>
      <ul className="mt-2 space-y-1">
        {routes.map((route) => (
          <li key={route.slug} className="text-sm text-ink-700">
            <Link href={`/${locale}/routes/${route.slug}`} className="text-brand-700 underline">
              {route.title}
            </Link>
            {route.mergedAt === null ? null : (
              <span className="text-ink-500"> · {route.mergedAt.toISOString().slice(0, 10)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * How a route's standing has moved — FR-11, §19.
 *
 * Automatic transitions show no author, and say "Automatic" rather than leaving the column
 * blank. A blank would read as a person whose name was lost; the truth is that no person was
 * involved, and that is worth stating.
 */
export function LifecycleHistory({
  events,
  dictionary: t,
}: {
  events: readonly LifecycleEventView[]
  dictionary: Dictionary
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-ink-900">{t.lifecycle.historyTitle}</h2>
      <p className="mt-1 text-xs leading-5 text-ink-500">{t.lifecycle.historyLede}</p>

      {events.length === 0 ? (
        <p className="mt-2 text-sm text-ink-700">{t.lifecycle.historyEmpty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-lg border border-hairline bg-surface px-3 py-2">
              <p className="text-sm text-ink-900">
                {t.routeLifecycle[event.fromState]} → {t.routeLifecycle[event.toState]}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                {reasonLabel(event.reason, t)} ·{' '}
                {event.createdAt.toISOString().slice(0, 10)} ·{' '}
                {event.actorHandle ?? t.lifecycle.historyAutomatic}
              </p>
              {event.note === null ? null : (
                <p className="mt-1 text-xs leading-5 text-ink-700">{event.note}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Reasons are stored as plain strings, because the vocabulary belongs to
 * `src/domain/lifecycle.ts` and putting it in a database enum too would give it two homes.
 * An unrecognised one renders as itself rather than as a blank — a reason nobody can read is
 * still better than a row that looks like it had none.
 */
function reasonLabel(reason: string, t: Dictionary): string {
  const labels: Record<string, string> = t.lifecycle.reason
  return labels[reason] ?? reason
}

/**
 * "This looks like the same journey as another route" — §40.4, FR-40.
 *
 * Any signed-in contributor. It changes nothing: the route stays in search, keeps its
 * standing, and is compared by a person rather than counted toward a threshold.
 *
 * The hint does real work. §40.1 protects routes that overlap heavily but describe different
 * journeys — a different funding mechanism, entrance exam or embassy process — and a
 * contributor who thinks similarity alone is duplication will flag pairs that should stay
 * separate. Saying so here is cheaper than an administrator resolving them one by one.
 */
export function FlagDuplicateForm({
  route,
  candidates,
  locale,
  signedIn,
  action,
  dictionary: t,
}: {
  route: { id: string; slug: string }
  candidates: readonly { id: string; title: string }[]
  locale: string
  signedIn: boolean
  action: (formData: FormData) => void | Promise<void>
  dictionary: Dictionary
}) {
  if (candidates.length === 0) return null

  return (
    <details className="mt-6">
      <summary className="cursor-pointer text-xs text-ink-500">{t.lifecycle.flagDuplicate}</summary>

      {!signedIn ? (
        <p className="mt-2 text-xs text-ink-700">
          <Link
            href={`/${locale}/signin?next=${encodeURIComponent(`/${locale}/routes/${route.slug}`)}`}
            className="text-brand-700 underline"
          >
            {t.lifecycle.signInToFlag}
          </Link>
        </p>
      ) : (
        <form
          action={action}
          className="mt-2 grid gap-2 rounded-lg border border-hairline bg-surface p-3"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={route.slug} />
          <input type="hidden" name="routeId" value={route.id} />

          <p className="text-xs leading-5 text-ink-500">{t.lifecycle.flagDuplicateHint}</p>

          <label className="text-xs text-ink-700">
            {t.lifecycle.flagDuplicateOf}
            <select
              name="duplicateOfId"
              className="mt-1 block w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900"
            >
              <option value="">—</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-ink-700">
            {t.lifecycle.flagDuplicateNote}
            <textarea
              name="duplicateNote"
              rows={2}
              className="mt-1 block w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900"
            />
          </label>

          <button
            type="submit"
            className="justify-self-start rounded-lg border border-hairline px-3 py-1.5 text-xs text-ink-900"
          >
            {t.lifecycle.flagDuplicateSubmit}
          </button>
        </form>
      )}
    </details>
  )
}
