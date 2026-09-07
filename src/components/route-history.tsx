import { ContributorLink } from '@/components/ui'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { HistoryEntry } from '@/server/routes/read'

/**
 * The revision ledger — FR-08, FR-31, and a density pass in Phase 12H.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Two things were wrong, and the smaller one was the length.**
 *
 * Every entry was a bordered panel with four stacked lines, so forty revisions came to about
 * 4,400 pixels — five screens of identical cards. A ledger is scanned, not read: what a reader
 * does here is look for *when* something changed and *what*, which is a job for dense rows
 * with a date column, not for a column of cards each announcing itself.
 *
 * **The larger problem was that it under-informed.** The row rendered `entry.kind` — the
 * literal union member `'route' | 'step' | 'field'` — uppercased, so a reader was shown
 * "FIELD" and had to work out what that meant. And `entry.subject`, which carries *which*
 * stage or *what kind* of information the revision belongs to, was fetched and then never
 * displayed. So the ledger showed "Blocked account of €11,904" with nothing saying whether
 * that was a visa requirement or a funding note, on a page whose entire purpose is letting
 * somebody follow how a claim came to say what it says.
 *
 * Both are fixed here: the kind is a word from the dictionary, the subject is beside it, and
 * the row is two lines instead of six.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The date repeats only when it changes.** Revisions cluster — a contributor edits six
 * fields in one sitting, and Phase 3 writes them inside one transaction, so they share a
 * timestamp to the millisecond. Printing the same date six times is noise that hides the shape
 * of the thing; printing it once turns the ledger into what it actually is, a series of
 * sittings. Nothing is grouped or aggregated — every revision is still its own row, because
 * this page is the evidence that nothing is ever destroyed (FR-45, invariant 4).
 */
export function RouteHistoryList({
  entries,
  locale,
  dictionary: t,
}: {
  entries: readonly HistoryEntry[]
  locale: string
  dictionary: Dictionary
}) {
  let lastDate = ''

  return (
    <ol className="mt-5 border-t border-hairline">
      {entries.map((entry) => {
        const date = entry.createdAt.toISOString().slice(0, 10)
        const newDay = date !== lastDate
        lastDate = date

        return (
          <li
            key={entry.id}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline py-2.5 sm:flex-nowrap"
          >
            <time
              dateTime={entry.createdAt.toISOString()}
              className={`w-24 shrink-0 text-micro ${newDay ? 'text-ink-700' : 'text-transparent'}`}
            >
              {/*
                Rendered for every row even when repeated, and hidden with `text-transparent`
                rather than omitted. The date is genuinely true of this revision, so a screen
                reader and a copy-paste should both still get it; only the eye is spared the
                repetition.
              */}
              {date}
            </time>

            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-meta leading-5 text-ink-900">{entry.value}</p>
              <p className="mt-0.5 text-micro leading-4 text-ink-500">
                {/* The word, not the union member — and the subject, which says which stage
                    or what kind of information this revision belongs to. */}
                <span className="text-ink-700">{t.route.historyKind[entry.kind]}</span>
                {entry.subject === entry.value ? null : <> · {entry.subject}</>}
                {entry.reason === null ? null : <> · “{entry.reason}”</>}
                {entry.authorHandle === null ? null : (
                  <>
                    {' · '}
                    <ContributorLink handle={entry.authorHandle} locale={locale} />
                  </>
                )}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
