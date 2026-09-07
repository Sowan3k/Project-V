import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentColumn, PageCanvas } from '@/components/layout'
import { buttonClass, FactList, inputClass, LinkButton, Panel } from '@/components/ui'
import { Caution } from '@/components/trust'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { currentViewer } from '@/server/auth'

import { closeAccountAction } from './actions'

/**
 * Your account — Phase 13 (FR-26, BR-16, §24.1, invariant 5).
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **A person could delete one journey but could not leave.** That gap is what this page
 * closes, and it is not a small one: this platform asks somebody to sign in with Google and
 * then holds their private dates and notes. A privacy promise you cannot act on is a slogan.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why the whole page and not just a button.**
 *
 * The right moment to tell somebody what is stored about them is the moment they came looking
 * — which is the moment they are considering leaving. So the page leads with the complete list
 * of what is kept, and the list is genuinely complete: a handle, an email, journeys, and
 * contributions. It reads short because the product *is* short on data, and saying so plainly
 * is worth more than a paragraph about how much we value privacy.
 *
 * It also names what does **not** exist — no documents, no passport, no transcript, no bank
 * statement (§24.1, invariant 7) — because a student who has used an agency portal has every
 * reason to assume otherwise.
 *
 * **A new URL rather than a tab or a modal** (§7.1): "my account" is a different primary
 * context from "my journeys", not a sibling view of it.
 *
 * The page is anonymous-unreachable by construction: no viewer, `notFound()`. Not a redirect
 * to sign-in — the existence of a particular person's account page is not something an
 * anonymous visitor needs confirmed.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  return {
    title: t.account.title,
    // A signed-in, personal page. It has no business in a search index, and `robots.ts`
    // excludes the path as well — this is the second layer, not the only one.
    robots: { index: false, follow: false },
  }
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const viewer = await currentViewer()
  if (viewer === null) notFound()

  const query = await searchParams
  const mismatch = query.confirm === 'mismatch'

  return (
    <PageCanvas className="py-10">
      <ContentColumn width="reading">
        <h1 className="text-title font-semibold tracking-tight text-ink-900">{t.account.title}</h1>
        <p className="mt-3 text-base leading-7 text-ink-700">{t.account.lede}</p>

        {/* ── What is stored ─────────────────────────────────────────────────────────────
            First, because it is what somebody arriving here actually wants to know, and
            because the honest answer is short. */}
        <Panel className="mt-8">
          <h2 className="text-panel font-semibold text-ink-900">{t.account.whatWeKeepTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-500">{t.account.whatWeKeepLede}</p>
          <FactList
            className="mt-4"
            facts={[
              { label: viewer.handle, value: t.account.keepsHandle },
              { label: t.auth.signIn, value: t.account.keepsEmail },
              { label: t.nav.myJourney, value: t.account.keepsJourneys },
              { label: t.account.keepsContributionsLabel, value: t.account.keepsContributions },
            ]}
          />
          {/*
            The absence, stated. §24.1 and invariant 7 forbid collecting documents, and a
            student who has used an agency portal has every reason to assume we do anyway.
            An absence nobody mentions is an absence nobody believes.
          */}
          <p className="mt-4 text-meta leading-5 text-ink-700">{t.account.keepsNothingElse}</p>
        </Panel>

        {/* ── The public half ────────────────────────────────────────────────────────────── */}
        <Panel className="mt-4">
          <h2 className="text-panel font-semibold text-ink-900">{t.account.publicPageTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-700">{t.account.publicPageLede}</p>
          <div className="mt-4">
            <LinkButton
              href={`/${locale}/contributors/${encodeURIComponent(viewer.handle)}`}
              tone="secondary"
            >
              {t.account.viewPublicPage}
            </LinkButton>
          </div>
        </Panel>

        {/* ── Leaving ────────────────────────────────────────────────────────────────────
            Last on the page and behind a typed phrase. Irreversible and one click apart is
            irreversible and one mis-click apart, and there is no undo here at all. */}
        <Panel className="mt-4">
          <h2 className="text-panel font-semibold text-ink-900">{t.account.closeTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-700">{t.account.closeLede}</p>

          <h3 className="mt-5 text-sm font-semibold text-ink-900">
            {t.account.closeDestroysTitle}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ink-700">
            <li>{t.account.closeDestroysEmail}</li>
            <li>{t.account.closeDestroysSessions}</li>
            <li>{t.account.closeDestroysJourneys}</li>
          </ul>

          <h3 className="mt-5 text-sm font-semibold text-ink-900">{t.account.closeKeepsTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-700">
            {t.account.closeKeepsContributions}
          </p>

          {mismatch ? (
            <div className="mt-5">
              <Caution>{t.account.closeConfirmationMismatch}</Caution>
            </div>
          ) : null}

          <form action={closeAccountAction} className="mt-5">
            <input type="hidden" name="locale" value={locale} />
            <label
              htmlFor="close-confirmation"
              className="block text-sm font-medium text-ink-900"
            >
              {t.account.closeConfirmationLabel}
            </label>
            <input
              id="close-confirmation"
              type="text"
              name="confirmation"
              required
              autoComplete="off"
              // No `defaultValue` and no placeholder showing the phrase: it has to be typed,
              // and a placeholder somebody can copy from is a placeholder that defeats it.
              className={inputClass('default', 'max-w-xs')}
            />
            <button type="submit" className={buttonClass('caution', { className: 'mt-4' })}>
              {t.account.closeButton}
            </button>
          </form>
        </Panel>
      </ContentColumn>
    </PageCanvas>
  )
}
