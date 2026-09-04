import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentColumn, PageCanvas } from '@/components/layout'
import { buttonClass, LinkButton } from '@/components/ui'
import { ROUTE_MECHANISMS, STUDY_LEVELS } from '@/domain/enums'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { currentViewer } from '@/server/auth'

import { createRouteAction } from './actions'

/**
 * Add a missing route — Phase 8, FR-13, VR-09 (Route Basics).
 *
 * Only the basics have a form of their own, because until the route exists there is nothing
 * to add steps to. Everything after — the road, the fields, the review — happens on the route
 * itself, where the contributor can see what they are building (CLAUDE.md §7.1).
 *
 * The page says two things plainly that the product depends on: the route is published
 * immediately as experimental, and creating it confers no ownership (FR-74, FR-44, BR-01).
 */
export const dynamic = 'force-dynamic'

const INPUT =
  'mt-1 block w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink-900'
const LABEL = 'block text-sm text-ink-700'

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
  return { title: t.meta.newRouteTitle }
}

export default async function NewRoutePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)
  const viewer = await currentViewer()

  if (!viewer) {
    /**
     * **This branch had no `PageCanvas` and therefore no gutter** — its heading sat flush
     * against x=0 while the header and footer above and below were inset, on the page a
     * contributor sees at the moment they decide whether this platform is real.
     *
     * The Phase 12 guard did not catch it because it reads the file for `<PageCanvas` and
     * this file has one — in the *other* return path. A source-text check cannot see which
     * branch renders. Phase 12E adds a browser assertion that compares each page's heading to
     * the header's own left edge, which is the property §7.2 actually states.
     */
    return (
      <PageCanvas className="py-12">
        <ContentColumn width="reading">
          <h1 className="text-title font-semibold tracking-tight text-ink-900">
            {t.contribute.createRoute}
          </h1>
          <p className="mt-3 text-base leading-7 text-ink-700">{t.contribute.createRouteLede}</p>
          <div className="mt-6">
            <LinkButton
              href={`/${locale}/signin?next=${encodeURIComponent(`/${locale}/routes/new`)}`}
            >
              {t.auth.signIn}
            </LinkButton>
          </div>
        </ContentColumn>
      </PageCanvas>
    )
  }

  return (
    <PageCanvas className="py-8">
      <ContentColumn width="normal">
        <h1 className="text-title font-semibold tracking-tight text-ink-900">
          {t.contribute.createRoute}
        </h1>
        <ContentColumn width="reading">
          <p className="mt-3 text-base leading-7 text-ink-700">{t.contribute.createRouteLede}</p>
          <p className="mt-2 text-sm leading-6 text-ink-500">{t.contribute.createRouteNote}</p>
        </ContentColumn>

        <form action={createRouteAction} className="mt-6 grid gap-4">
          <input type="hidden" name="locale" value={locale} />

          <label className={LABEL}>
            {t.contribute.routeTitle}
            <input type="text" name="title" required maxLength={120} className={INPUT} />
            <span className="mt-1 block text-xs text-ink-500">{t.contribute.routeTitleHint}</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={LABEL}>
              {t.contribute.from}
              <input
                type="text"
                name="originCountry"
                required
                minLength={2}
                maxLength={2}
                defaultValue="BD"
                className={INPUT}
              />
            </label>
            <label className={LABEL}>
              {t.contribute.to}
              <input type="text" name="destinationCountry" required minLength={2} maxLength={2} className={INPUT} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className={LABEL}>
              {t.search.studyLevel}
              <select name="studyLevel" className={INPUT}>
                {STUDY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t.studyLevel[level]}
                  </option>
                ))}
              </select>
            </label>

            <label className={LABEL}>
              {t.search.mechanism}
              <select name="mechanism" className={INPUT} defaultValue="">
                <option value="">{t.search.any}</option>
                {ROUTE_MECHANISMS.map((mechanism) => (
                  <option key={mechanism} value={mechanism}>
                    {t.routeMechanism[mechanism]}
                  </option>
                ))}
              </select>
            </label>

            <label className={LABEL}>
              {t.search.intake}
              <input type="text" name="routeIntake" className={INPUT} placeholder="2027 autumn" />
            </label>
          </div>

          <label className={LABEL}>
            {t.contribute.routeSummary}
            <textarea name="summary" rows={3} className={INPUT} />
          </label>

          <button type="submit" className={buttonClass('primary', 'justify-self-start')}>
            {t.contribute.publish}
          </button>
        </form>
      </ContentColumn>
    </PageCanvas>
  )
}
