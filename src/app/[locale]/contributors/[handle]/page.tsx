import { notFound } from 'next/navigation'

import { ContentColumn, GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import { Breadcrumb, EmptyState, Panel, Rail, Stat, StatBand } from '@/components/ui'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { getContributorHistory } from '@/server/contributors/read'

/**
 * A contributor's observable history — Phase 8, composed to the system in Phase 12E.
 * FR-43, §25.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Evidence, not a score.** There is no reputation number, no level and no badge, because
 * CLAUDE.md §11 leaves reputation labels and weights open and §25 warns against turning
 * contribution into a competitive points game. The same discipline as the route passport:
 * report what is countable and let the reader weigh it.
 *
 * That discipline is also why this page has no mockup of its own and needed composing from
 * first principles. It had been four sentences in an unstyled list, which is the shape a
 * reader reads as a debug view — and the reader who arrives here has arrived by clicking a
 * handle beside a claim they are deciding whether to believe. The counts are the page, so
 * they lead, in the band VR-04 and VR-14 use for a route's own counted facts.
 *
 * **Four counts, and the second is the one that matters.** "How many of their contributions
 * others have since confirmed" is the only figure here that anybody but the contributor has
 * had a hand in, which is exactly what makes it evidence rather than activity. It is still
 * not a score: nothing divides it by the first number, because a ratio is a rating with the
 * arithmetic hidden, and §11 has not decided what a rating would mean.
 *
 * The handle is the whole identity shown. No name, no photograph, no email — the platform
 * does not hold them (§24.3).
 */
export const dynamic = 'force-dynamic'

export default async function ContributorPage({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>
}) {
  const { locale, handle } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const history = await getContributorHistory(handle)
  if (!history) notFound()

  const isNew = history.contributionCount === 0 || history.firstContributionAt === null

  return (
    <PageCanvas className="py-8">
      <Breadcrumb
        label={t.common.breadcrumb}
        crumbs={[
          { label: t.nav.routes, href: `/${locale}/routes` },
          { label: history.handle },
        ]}
      />

      <h1 className="mt-3 text-title font-semibold tracking-tight text-ink-900">
        {history.handle}
      </h1>
      <ContentColumn width="reading">
        <p className="mt-2 text-sm leading-6 text-ink-500">{t.auth.handleExplainer}</p>
      </ContentColumn>

      <PageGrid className="mt-8">
        <GridRegion span={8}>
          {isNew ? (
            <EmptyState
              title={t.contribute.newContributor}
              body={t.contribute.newContributorNote}
            />
          ) : (
            <Panel as="section">
              <h2 className="text-panel font-semibold text-ink-900">
                {t.contribute.contributorRecord}
              </h2>
              <StatBand className="mt-4 lg:grid-cols-4">
                <Stat
                  value={history.contributionCount}
                  label={t.contribute.contributionsLabel}
                />
                {/* The one figure somebody else had a hand in — deliberately not divided by
                    the one beside it. A ratio is a rating with its arithmetic hidden (§11). */}
                <Stat
                  value={history.confirmedContributionCount}
                  label={t.contribute.confirmedByOthersLabel}
                />
                <Stat
                  value={history.confirmationsGiven}
                  label={t.contribute.confirmationsGivenLabel}
                />
                <Stat
                  value={history.firstContributionAt?.toISOString().slice(0, 10) ?? '—'}
                  label={t.contribute.contributorSince}
                />
              </StatBand>

              <p className="mt-5 border-t border-hairline pt-4 text-meta leading-5 text-ink-500">
                {t.contribute.countsAreNotAScore}
              </p>
            </Panel>
          )}
        </GridRegion>

        <GridRegion span={4}>
          <Rail title={t.contribute.whatThisPageIsTitle} level={2}>
            <p className="text-meta leading-5 text-ink-700">{t.contribute.whatThisPageIs}</p>
          </Rail>
        </GridRegion>
      </PageGrid>
    </PageCanvas>
  )
}
