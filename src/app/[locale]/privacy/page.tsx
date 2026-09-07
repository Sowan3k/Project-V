import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentColumn, PageCanvas } from '@/components/layout'
import { LegalDraftBanner, LegalList, LegalSection } from '@/components/legal'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'

/**
 * Privacy — Phase 13 (B1, FR-26, BR-16, §24.1, §24.2, invariants 5 and 7).
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **The platform stored Google-linked accounts and private journey notes and had no page
 * saying so.** That is the gap this closes, and it was a real one: a student is being asked
 * to sign in and write down their visa timeline, and nothing told them what happened to it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Every claim on this page was read out of the code, not written from a template.**
 *
 *   "no access token is stored"      `linkAccount` writes four columns and the token columns
 *                                    were dropped from the schema (`config.ts`, audit F13)
 *   "never put on your session"      the session callback sets `email: ''`
 *   "no upload anywhere"             asserted by the presentation guard; no route accepts a file
 *   "requires your own user id"      every export in `src/server/journeys/` names `userId`,
 *                                    asserted by `journey-privacy.test.ts`
 *   what closing destroys            the list in `closeAccount`, proven by
 *                                    `tests/db/account-closure.db.test.ts`
 *
 * A test in `tests/architecture/legal-pages.test.ts` re-checks the load-bearing ones against
 * the source, so this page cannot quietly become untrue when the code changes.
 *
 * **It is short because the product is.** Most of it is a list of things that do not happen —
 * no analytics, no tracking, no advertising, no third-party scripts, no documents. That is
 * unusual enough to be worth stating plainly rather than burying in a section called "Your
 * Choices".
 *
 * Statically rendered: it touches no database and depends on no session, so it is one of the
 * few pages in this application that costs nothing to serve — which also means it is readable
 * when the database is asleep.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  return { title: t.legal.privacyTitle, description: t.legal.privacyLede }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  return (
    <PageCanvas className="py-10">
      <ContentColumn width="reading">
        <h1 className="text-title font-semibold tracking-tight text-ink-900">
          {t.legal.privacyTitle}
        </h1>
        <p className="mt-3 text-base leading-7 text-ink-700">{t.legal.privacyLede}</p>

        <LegalDraftBanner dictionary={t} />

        <LegalSection title={t.legal.principleTitle}>
          <p>{t.legal.principleBody}</p>
        </LegalSection>

        <LegalSection title={t.legal.collectTitle}>
          <LegalList
            items={[
              t.legal.collectEmail,
              t.legal.collectHandle,
              t.legal.collectLink,
              t.legal.collectSession,
              t.legal.collectNotName,
            ]}
          />
        </LegalSection>

        <LegalSection title={t.legal.privateTitle}>
          <p>{t.legal.privateBody}</p>
          <p>{t.legal.privateNoProof}</p>
        </LegalSection>

        <LegalSection title={t.legal.publicTitle}>
          <p>{t.legal.publicBody}</p>
        </LegalSection>

        <LegalSection title={t.legal.trackingTitle}>
          <p>{t.legal.trackingBody}</p>
        </LegalSection>

        <LegalSection title={t.legal.leavingTitle}>
          <p>{t.legal.leavingBody}</p>
          <p>{t.legal.leavingKeeps}</p>
        </LegalSection>

        <LegalSection title={t.legal.processorsTitle}>
          <p>{t.legal.processorsBody}</p>
        </LegalSection>

        <LegalSection title={t.legal.contactTitle}>
          {/* B2 in Phases.md. There is no address to publish yet, and an invented one is worse
              than a visible gap — a contact route that goes nowhere is how a takedown request
              disappears. */}
          <p>{t.legal.contactPending}</p>
        </LegalSection>
      </ContentColumn>
    </PageCanvas>
  )
}
