import Link from 'next/link'

import { Caution } from '@/components/trust'
import { ContributorLink } from '@/components/ui'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { AttentionItem, RouteAttention } from '@/server/routes/read'

/**
 * What needs help on one route — Phase 15. FR-50, FR-53, FR-70. VR-14.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The passport already counted these. Nothing led from the count to the fields.** A
 * contributor who wanted to help had to open every step and look, which is the friction FR-50
 * exists to remove. This is the list, and every item links to the field it names on this same
 * page, with the road above it (CLAUDE.md §7.1).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **A worklist, not a verdict.** A route with more on this list is not thereby worse; it may
 * simply be better attended (invariant 14). And a contested field is not a defective one: the
 * list says so in words, because a reader who skims "Contested (3)" as "3 wrong" has learned
 * something false (invariant 15).
 *
 * **No comment threads.** VR-14 draws "2 comments" on a challenge. A challenge carries a reason
 * and is answered by a revision, not a conversation (§25, §33). So each challenge shows what
 * was objected to, when and by whom, and the only thing to do with it is go to the field.
 */
export function NeedsHelp({
  attention,
  locale,
  slug,
  stepOrder,
  dictionary: t,
}: {
  attention: RouteAttention
  locale: string
  slug: string
  /** The road's own order, so the list reads in the order somebody walks the route. */
  stepOrder: ReadonlyMap<string, number>
  dictionary: Dictionary
}) {
  const ordered = (items: readonly AttentionItem[]) =>
    [...items].sort(
      (a, b) =>
        (stepOrder.get(a.stepId) ?? Number.MAX_SAFE_INTEGER) -
        (stepOrder.get(b.stepId) ?? Number.MAX_SAFE_INTEGER),
    )

  const nothing = attention.needsReview.length === 0 && attention.contested.length === 0

  return (
    <section id="needs-help" className="mt-8 scroll-mt-6">
      <h2 className="text-section font-semibold tracking-tight text-ink-900">
        {t.needsHelp.title}
      </h2>

      {nothing ? (
        <p className="mt-2 text-sm leading-6 text-ink-700">{t.needsHelp.none}</p>
      ) : (
        <>
          <p className="mt-1 text-sm leading-6 text-ink-700">{t.needsHelp.lede}</p>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-panel font-semibold text-ink-900">
                {t.needsHelp.reviewTitle(attention.needsReview.length)}
              </h3>
              {attention.needsReview.length === 0 ? (
                <p className="mt-2 text-meta text-ink-700">{t.needsHelp.noneReview}</p>
              ) : (
                <ItemList
                  items={ordered(attention.needsReview)}
                  locale={locale}
                  slug={slug}
                  dictionary={t}
                />
              )}
            </div>

            <div>
              <h3 className="text-panel font-semibold text-ink-900">
                {t.needsHelp.contestedTitle(attention.contested.length)}
              </h3>
              {attention.contested.length === 0 ? (
                <p className="mt-2 text-meta text-ink-700">{t.needsHelp.noneContested}</p>
              ) : (
                <>
                  <p className="mt-1 text-meta leading-5 text-ink-500">
                    {t.needsHelp.contestedIsNotWrong}
                  </p>
                  <ItemList
                    items={ordered(attention.contested)}
                    locale={locale}
                    slug={slug}
                    dictionary={t}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function excerpt(text: string): string {
  return text.length <= 140 ? text : `${text.slice(0, 137)}…`
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function ItemList({
  items,
  locale,
  slug,
  dictionary: t,
}: {
  items: readonly AttentionItem[]
  locale: string
  slug: string
  dictionary: Dictionary
}) {
  return (
    <ul className="mt-2 space-y-2">
      {items.map((item) => (
        <li
          key={item.fieldId}
          className="rounded-control border border-hairline bg-surface px-3 py-2"
        >
          <p className="text-micro font-medium tracking-wide text-ink-500 uppercase">
            {item.stepLabel} · {t.fieldCategory[item.category]}
          </p>
          <p className="mt-1 text-sm leading-6 text-ink-900">
            {item.valueText === null ? (
              <span className="text-ink-500">{t.needsHelp.withheld}</span>
            ) : (
              excerpt(item.valueText)
            )}
          </p>
          <ul className="mt-1 space-y-0.5">
            {item.reasons.map((reason) => (
              <li key={reason} className="text-meta text-ink-700">
                {t.needsHelp.reason[reason]}
              </li>
            ))}
          </ul>

          {item.challenges.length === 0 ? null : (
            <ul className="mt-2 space-y-1 rounded-control border border-caution-500/40 bg-caution-50 px-2.5 py-2">
              {item.challenges.map((challenge) => (
                <li key={challenge.id}>
                  <Caution>
                    <span className="font-medium">{t.challengeReason[challenge.reason]}</span>
                    {challenge.note === null ? null : <>: “{challenge.note}”</>}
                    <span className="text-ink-700">
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
          )}

          <p className="mt-2 text-meta">
            {item.stepArchived ? (
              <Link
                href={`/${locale}/routes/${slug}/history`}
                className="text-brand-700 underline"
              >
                {t.needsHelp.archivedStep}
              </Link>
            ) : (
              <Link
                href={`/${locale}/routes/${slug}?step=${encodeURIComponent(item.stepId)}#field-${item.fieldId}`}
                className="font-medium text-brand-700 underline"
              >
                {t.needsHelp.goToField}
              </Link>
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}
