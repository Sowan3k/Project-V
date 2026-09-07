import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentColumn, PageCanvas } from '@/components/layout'
import { LegalDraftBanner, LegalSection } from '@/components/legal'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'

/**
 * Terms — Phase 13 (B1, BR-20, invariants 1, 3, 12, 13).
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **The most load-bearing paragraph on this page is the first one**, and it is not a
 * disclaimer in the legal sense — it is the product's own position, written down where
 * somebody who has been reading routes for an hour will find it.
 *
 * §44.2 says never make the platform look like an agency, and BR-20 forbids presenting
 * ourselves as an admission or immigration authority. Those hold in the interface. They also
 * have to hold *here*, because a reader who has just used a well-organised site full of visa
 * requirements has every reason to assume somebody official checked them. Nobody did. Saying
 * so is not covering ourselves; it is the same honesty the rest of the product spends its
 * effort on — every field shows its source and its last-confirmed date precisely so a reader
 * can do the checking this page tells them to do.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * The other three sections each state a rule the software already enforces rather than a
 * policy somebody is trusted to follow:
 *
 *   contributions are permanent    the revision ledger is append-only, held by an ESLint
 *                                  boundary, a Prisma write guard and Postgres triggers
 *   creating is not owning         there is no owner column (invariant 3, FR-44, BR-01)
 *   money buys nothing             there is no supporter flag for anything to read
 *                                  (invariant 13, asserted by `support-link.test.ts`)
 *
 * That distinction matters: these are descriptions of a system, and a reader can verify them.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  return { title: t.legal.termsTitle, description: t.legal.termsLede }
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  return (
    <PageCanvas className="py-10">
      <ContentColumn width="reading">
        <h1 className="text-title font-semibold tracking-tight text-ink-900">
          {t.legal.termsTitle}
        </h1>
        <p className="mt-3 text-base leading-7 text-ink-700">{t.legal.termsLede}</p>

        <LegalDraftBanner dictionary={t} />

        <LegalSection title={t.legal.notAdviceTitle}>
          <p>{t.legal.notAdviceBody}</p>
        </LegalSection>

        <LegalSection title={t.legal.noGuaranteeTitle}>
          <p>{t.legal.noGuaranteeBody}</p>
        </LegalSection>

        <LegalSection title={t.legal.contributingTitle}>
          <p>{t.legal.contributingBody}</p>
          <p>{t.legal.contributingRules}</p>
        </LegalSection>

        <LegalSection title={t.legal.moderationTitle}>
          <p>{t.legal.moderationBody}</p>
        </LegalSection>

        <LegalSection title={t.legal.freeTitle}>
          <p>{t.legal.freeBody}</p>
        </LegalSection>

        <LegalSection title={t.legal.liabilityTitle}>
          <p>{t.legal.liabilityBody}</p>
        </LegalSection>

        <LegalSection title={t.legal.contactTitle}>
          <p>{t.legal.contactPending}</p>
        </LegalSection>
      </ContentColumn>
    </PageCanvas>
  )
}
