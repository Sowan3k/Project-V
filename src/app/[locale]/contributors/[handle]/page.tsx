import { notFound } from 'next/navigation'

import { ContentColumn, PageCanvas } from '@/components/layout'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { getContributorHistory } from '@/server/contributors/read'

/**
 * A contributor's observable history — Phase 8, FR-43, §25.
 *
 * Evidence, not a score. There is no reputation number, no level and no badge, because
 * CLAUDE.md §11 leaves reputation labels and weights open and §25 warns against turning
 * contribution into a competitive points game. The same discipline as the route passport:
 * report what is countable and let the reader weigh it.
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
      <ContentColumn width="normal">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{history.handle}</h1>
        <ContentColumn width="reading">
          <p className="mt-2 text-sm leading-6 text-ink-500">{t.auth.handleExplainer}</p>
        </ContentColumn>

        {isNew ? (
          <div className="mt-6 rounded-xl border border-hairline bg-surface p-4">
            <p className="text-sm font-medium text-ink-900">{t.contribute.newContributor}</p>
            <ContentColumn width="reading">
              <p className="mt-1 text-sm leading-6 text-ink-700">{t.contribute.newContributorNote}</p>
            </ContentColumn>
          </div>
        ) : (
          <ul className="mt-6 space-y-1 text-sm text-ink-700">
            <li>{t.contribute.contributions(history.contributionCount)}</li>
            <li>{t.contribute.contributionsConfirmed(history.confirmedContributionCount)}</li>
            <li>{t.contribute.confirmedCount(history.confirmationsGiven)}</li>
            <li>
              {t.contribute.contributorSince}:{' '}
              {history.firstContributionAt?.toISOString().slice(0, 10) ?? ''}
            </li>
          </ul>
        )}
      </ContentColumn>
    </PageCanvas>
  )
}
