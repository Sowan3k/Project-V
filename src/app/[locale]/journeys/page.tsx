import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ContentColumn, PageCanvas } from '@/components/layout'
import { LinkButton } from '@/components/ui'
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

/**
 * A title of this page's own - Phase 12.
 *
 * Before Phase 12 every page in the application shared one title, so a reader with three
 * routes open had three identical tabs and a useless history. The layout supplies the
 * "<subject> - Vindeshi Express" template; this supplies the subject.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  return {
    title: t.meta.journeysTitle,
    // **noindex, and not only a robots.txt disallow.** A disallow asks a crawler not to
    // *fetch* the page; it does not stop the URL being indexed from a link elsewhere, and an
    // indexed journey URL would advertise that a private page exists at a guessable address.
    // This is the directive that actually keeps it out of a search index (invariant 5).
    robots: { index: false, follow: false },
  }
}

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
    // Same omission as `routes/new`, found by the same browser assertion: this branch had no
    // `PageCanvas`, so it rendered with no gutter while the header and footer were inset.
    // The architecture guard reads the file for `<PageCanvas` and this file has one — in the
    // signed-in branch below.
    return (
      <PageCanvas className="py-12">
        <ContentColumn width="reading">
          <h1 className="text-title font-semibold tracking-tight text-ink-900">
            {t.journey.indexTitle}
          </h1>
          <p className="mt-3 text-base leading-7 text-ink-700">{t.journey.privateExplainer}</p>
          <div className="mt-6">
            <LinkButton
              href={`/${locale}/signin?next=${encodeURIComponent(`/${locale}/journeys`)}`}
            >
              {t.auth.signIn}
            </LinkButton>
          </div>
        </ContentColumn>
      </PageCanvas>
    )
  }

  const journeys = await listJourneys(viewer.id)

  return (
    <PageCanvas className="py-8">
      <ContentColumn width="wide">
        <h1 className="text-title font-semibold tracking-tight text-ink-900">{t.journey.indexTitle}</h1>
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
                <li key={journey.id} className="rounded-panel border border-hairline bg-surface">
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
    </PageCanvas>
  )
}
