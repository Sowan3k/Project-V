import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CategoryLegend } from '@/components/category-legend'
import { ContentColumn, GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import {
  Breadcrumb,
  FactList,
  GuidanceList,
  LinkButton,
  NumberedFlow,
  Panel,
  Rail,
} from '@/components/ui'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'

/**
 * How this works — Phase 12J.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Two links have pointed at this page since Phase 12D and it did not exist.** VR-01's
 * secondary call to action is "How It Works"; VR-03's rail carries "New Here? … See How It
 * Works". Both were wired to an anchor on the landing page holding three short lines.
 *
 * The gap was real. This product's central object is a *ribbon* that *unfolds into a road* of
 * *steps* containing *fields*, and a visitor is expected to arrive knowing none of that. Being
 * honest about a route is worth nothing to somebody who cannot tell what they are looking at.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What this page is, and the three things it deliberately is not.**
 *
 * It is *reference*, written for somebody who has already looked at a route and is confused —
 * not a sales page. So it explains the vocabulary, shows the actual category key drawn from
 * the same record the renderer paints from, and states plainly what the platform does not do.
 *
 * It is **not** a tour, an overlay or a modal. Those need state, state on the read path needs
 * a client component, and a reader who dismisses a tour can never find it again. A page is
 * linkable, re-readable, indexable and costs nothing.
 *
 * It is **not** on the homepage. §8.5.1 is explicit that the homepage must never expose the
 * whole application, and the answer to a thin homepage is not a thicker homepage — it is a
 * place for the depth to live.
 *
 * It contains **no route content and no example route.** Every explanation here is about the
 * product's own vocabulary. A worked example would need a route, and an invented one is the
 * single thing this platform cannot afford (§45, Gate 2, CLAUDE.md §10.2).
 */
export const dynamic = 'force-static'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  return { title: t.howItWorks.title, description: t.howItWorks.lede }
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  return (
    <PageCanvas className="py-8">
      <Breadcrumb
        label={t.common.breadcrumb}
        crumbs={[{ label: t.nav.home, href: `/${locale}` }, { label: t.howItWorks.title }]}
      />

      <h1 className="mt-3 text-title font-semibold tracking-tight text-ink-900">
        {t.howItWorks.title}
      </h1>
      <ContentColumn width="reading">
        <p className="mt-3 text-base leading-7 text-ink-700">{t.howItWorks.lede}</p>
      </ContentColumn>

      <PageGrid className="mt-8">
        <GridRegion span={8} tablet={4}>
          {/* 1. The words. Everything else on the site assumes these. */}
          <Panel as="section">
            <h2 className="text-section font-semibold text-ink-900">
              {t.howItWorks.vocabularyTitle}
            </h2>
            <ContentColumn width="reading">
              <p className="mt-1 text-meta leading-5 text-ink-500">
                {t.howItWorks.vocabularyLede}
              </p>
            </ContentColumn>
            <FactList className="mt-4" layout="stacked" facts={t.howItWorks.vocabulary} />
          </Panel>

          {/* 2. The loop, in order. The same four stages the landing tiles show, with the
                 detail a tile has no room for. */}
          <Panel as="section" className="mt-5">
            <h2 className="text-section font-semibold text-ink-900">
              {t.howItWorks.readingTitle}
            </h2>
            <NumberedFlow className="mt-4" stages={t.howItWorks.reading} />
          </Panel>

          {/* 3. Contributing — and specifically *which* of the four actions to use, which is
                 the question the route page cannot answer in the width of a link. */}
          <Panel as="section" className="mt-5">
            <h2 className="text-section font-semibold text-ink-900">
              {t.howItWorks.contributingTitle}
            </h2>
            <ContentColumn width="reading">
              <p className="mt-1 text-meta leading-5 text-ink-500">
                {t.howItWorks.contributingLede}
              </p>
            </ContentColumn>
            <FactList className="mt-4" layout="stacked" facts={t.howItWorks.actions} />
          </Panel>

          {/* 4. The limits, stated by us rather than discovered by a reader. */}
          <Panel as="section" tone="sunken" className="mt-5">
            <h2 className="text-section font-semibold text-ink-900">
              {t.howItWorks.limitsTitle}
            </h2>
            <GuidanceList className="mt-3" lines={t.howItWorks.limits} />
          </Panel>

          <div className="mt-6">
            <LinkButton href={`/${locale}/routes`}>{t.landing.findMyRoute}</LinkButton>
          </div>
        </GridRegion>

        <GridRegion span={4} tablet={2}>
          <div className="space-y-3 lg:sticky lg:top-6">
            {/* The key, from the same record the renderer paints from, so it cannot drift. */}
            <Rail title={t.search.legendTitle} level={2}>
              <p className="mb-3 text-meta leading-5 text-ink-500">{t.search.legendLede}</p>
              <CategoryLegend dictionary={t} />
            </Rail>

            <Rail title={t.howItWorks.privacyTitle} level={2}>
              <p className="text-meta leading-5 text-ink-700">{t.howItWorks.privacyBody}</p>
            </Rail>
          </div>
        </GridRegion>
      </PageGrid>
    </PageCanvas>
  )
}
