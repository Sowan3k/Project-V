import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ContentColumn } from '@/components/layout'
import { JourneyStepStatus } from '@/domain/enums'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { currentViewer } from '@/server/auth'
import { listJourneys } from '@/server/journeys/read'

/**
 * My journeys — Phase 7, FR-23.
 *
 * A **primary context** in its own right, and therefore its own page rather than a tab: this
 * is "my routes across the platform", not a view of any single route (CLAUDE.md §7.1). The
 * per-route detail lives on that route's own journey tab, where the road and the route's
 * standing stay on screen beside it.
 *
 * Every row here comes from `listJourneys(viewer.id)`. There is no variant of that function
 * without a user id, so this page could not list somebody else's journeys even if it tried.
 */
export const dynamic = 'force-dynamic'

export default async function JourneysPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const viewer = await currentViewer()

  if (!viewer) {
    return (
      <ContentColumn width="reading">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{t.journey.indexTitle}</h1>
        <p className="mt-3 text-base leading-7 text-ink-700">{t.journey.privateExplainer}</p>
        <Link
          href={`/${locale}/signin?next=${encodeURIComponent(`/${locale}/journeys`)}`}
          className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white"
        >
          {t.auth.signIn}
        </Link>
      </ContentColumn>
    )
  }

  const journeys = await listJourneys(viewer.id)

  return (
    <ContentColumn width="wide">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{t.journey.indexTitle}</h1>
      <ContentColumn width="reading">
        <p className="mt-2 text-sm leading-6 text-ink-700">{t.journey.indexLede}</p>
      </ContentColumn>

      {journeys.length === 0 ? (
        <p className="mt-6 text-sm text-ink-700">{t.journey.indexEmpty}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {journeys.map((journey) => {
            const done = journey.progress.filter(
              (row) => row.status === JourneyStepStatus.completed,
            ).length
            return (
              <li key={journey.id} className="rounded-xl border border-hairline bg-surface">
                <Link href={`/${locale}/routes/${journey.routeSlug}/journey`} className="block p-4">
                  <p className="font-medium text-ink-900">{journey.routeTitle}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {t.journey.overall(done, journey.progress.length)}
                    {journey.selfReportedCompletedAt === null
                      ? ''
                      : ` · ${t.journeyStepStatus.completed}`}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </ContentColumn>
  )
}
