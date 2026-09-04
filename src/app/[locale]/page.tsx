import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ContentColumn, GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import { CategoryRoad } from '@/components/category-road'
import { Chip, LinkButton, Panel } from '@/components/ui'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { destinationSummaries } from '@/server/routes/read'

/**
 * Landing — VR-01, FR-01, D-03.
 *
 * "The first interaction should resemble searching for a journey rather than browsing
 * articles" (§8.1), and complexity appears only after the visitor acts. Nothing here needs an
 * account, and nothing here reads a session.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Phase 12D: the page had a hero and then a void.** VR-01's defining element is the
 * illustrated road running from origin to destination, and there was no visualisation on the
 * homepage at all — on a 1440px screen the page was a headline, four chips, and roughly six
 * hundred pixels of nothing. That is the single clearest reason the deployment read as a
 * prototype: the product's whole idea is a road, and its front page did not show one.
 *
 * **What the illustration is, and what it deliberately is not.** VR-01 draws a Bangladesh →
 * Germany road with named stages. Ours draws the **six step categories** and says so in the
 * caption. A plausible-looking route on the front page is precisely the fake content Gate 2
 * forbids and §45 warns about: a reader cannot tell an illustrative route from a researched
 * one, and this entire product rests on that difference staying visible. What is drawn is
 * real — the six categories every route is built from, through the same renderer that draws
 * every route (invariant 24).
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)
  const destinations = await destinationSummaries()

  const principles = [
    t.principles.free,
    t.principles.communityMaintained,
    t.principles.noDocumentUpload,
    t.principles.noAccountNeededToRead,
  ]

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────────────────── */}
      <PageCanvas className="pt-12 pb-14 sm:pt-16">
        <PageGrid>
          <GridRegion span={5}>
            <p lang="bn" className="text-section font-semibold text-brand-900">
              {t.landing.headlineBn}
            </p>
            <h1 className="mt-3 text-title font-semibold tracking-tight text-balance text-ink-900 lg:text-display">
              {t.landing.headline}
            </h1>
            <ContentColumn width="reading">
              <p className="mt-5 text-base leading-7 text-ink-700">{t.landing.subhead}</p>
            </ContentColumn>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href={`/${locale}/routes`}>{t.landing.findMyRoute}</LinkButton>
              <a
                href="#how-it-works"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                {t.landing.howItWorks}
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap gap-2">
              {principles.map((principle) => (
                <li key={principle}>
                  <Chip>{principle}</Chip>
                </li>
              ))}
            </ul>
          </GridRegion>

          <GridRegion span={7}>
            <Panel className="h-full">
              <CategoryRoad dictionary={t} />
              <p className="mt-4 text-panel font-medium text-ink-900">
                {t.landing.illustrationCaption}
              </p>
              {/* Said plainly rather than in a footnote: an illustration that could be
                  mistaken for a route is worse than no illustration. */}
              <p className="mt-1 text-meta leading-6 text-ink-500">
                {t.landing.illustrationNote}
              </p>
            </Panel>
          </GridRegion>
        </PageGrid>
      </PageCanvas>

      {/* ── How it works ─────────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-6 border-y border-hairline bg-surface">
        <PageCanvas className="py-12">
          <h2 className="text-section font-semibold text-ink-900">{t.landing.howItWorks}</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {t.landing.steps.map((entry, index) => (
              <li key={entry.title} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-micro font-semibold text-brand-900">
                  {index + 1}
                </span>
                <div>
                  <p className="text-panel font-semibold text-ink-900">{entry.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-700">{entry.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </PageCanvas>
      </section>

      {/* ── Destinations ─────────────────────────────────────────────────────────────── */}
      <PageCanvas className="py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="text-section font-semibold text-ink-900">
            {t.landing.destinationsTitle}
          </h2>
          <Link
            href={`/${locale}/routes`}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            {t.landing.browseAll}
          </Link>
        </div>

        {destinations.length === 0 ? (
          <p className="mt-4 max-w-prose text-sm leading-6 text-ink-700">
            {t.landing.destinationsEmpty}
          </p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map((destination) => (
              <li key={destination.country}>
                <Link
                  href={`/${locale}/routes?to=${encodeURIComponent(destination.country)}`}
                  className="block rounded-panel border border-hairline bg-surface p-4 transition-shadow hover:shadow-panel"
                >
                  <p className="text-panel font-semibold text-ink-900">{destination.country}</p>
                  {/* A count of routes written, never of followers or visits. Nothing here
                      says a destination is popular, safe or good — only that routes exist
                      for it (invariants 12, 13, 14). */}
                  <p className="mt-1 text-meta text-ink-500">
                    {t.landing.destinationRouteCount(destination.routeCount)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageCanvas>
    </>
  )
}
