import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentColumn, GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import {
  Breadcrumb,
  buttonClass,
  Chip,
  FormField,
  GuidanceList,
  inputClass,
  LinkButton,
  NumberedFlow,
  Panel,
  Rail,
} from '@/components/ui'
import { ROUTE_MECHANISMS, STUDY_LEVELS } from '@/domain/enums'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { currentViewer } from '@/server/auth'

import { createRouteAction } from './actions'

/**
 * Add a missing route — Phase 8, recomposed against VR-09 in Phase 12E.
 * FR-13, FR-44, FR-74, BR-01.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **VR-09 draws a five-stage wizard. This is stage one, and it says so.**
 *
 * Only the basics have a form of their own, because until the route exists there is nothing
 * to add steps to. Everything after — the road, the fields — happens on the route itself,
 * where the contributor can see what they are building (CLAUDE.md §7.1). That is not a
 * reduction of VR-09: it is where VR-09's own "Build Your Road" panel *should* live, because
 * the road it draws is the real renderer output and the real renderer needs real steps.
 *
 * So the stage bar is honest and has two stages rather than five, and the second stage names
 * where it happens. A contributor who does not know the road comes next will publish a route
 * with no steps and assume they are finished, which is the failure the mockup's progress bar
 * exists to prevent.
 *
 * **Departures from VR-09, all deliberate:**
 *
 *   *No "Save as Draft" and no "Draft saved 2 min ago".* A draft is server state for a form
 *   that fits on one screen, and it would need somewhere to live that is neither a route nor
 *   a revision. Publishing is the save: the route is created immediately as experimental,
 *   which is what FR-74 asks for and what removes the need for a draft in the first place.
 *
 *   *No live "Route Summary (Draft)" panel.* It mirrors fields as they are typed, which needs
 *   JavaScript, and the read path ships one client component. The rail says what publishing
 *   *does* instead, which is the thing a first-time contributor actually does not know.
 *
 *   *Country codes, not a country picker.* VR-09 shows dropdowns with flags. A curated list
 *   would either restrict where a contributor may say they are going — contrary to FR-13,
 *   which exists so that a missing route can be added — or require shipping an ISO-3166 table
 *   nobody has decided on. Two-letter codes with an example are honest and unbounded.
 *
 * The page says two things plainly that the product depends on: the route is published
 * immediately as experimental, and creating it confers no ownership (FR-74, FR-44, BR-01).
 */
export const dynamic = 'force-dynamic'

const INPUT = inputClass()

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
      <Breadcrumb
        label={t.common.breadcrumb}
        crumbs={[
          { label: t.nav.routes, href: `/${locale}/routes` },
          { label: t.contribute.createRoute },
        ]}
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-title font-semibold tracking-tight text-ink-900">
          {t.contribute.createRoute}
        </h1>
        {/* VR-09's badge beside the title. Not a status and not a claim about quality — it
            names who is writing, which is the one thing a reader of a new route most needs
            to know about it (FR-74, invariant 12). */}
        <Chip>{t.contribute.communityContribution}</Chip>
      </div>
      <ContentColumn width="reading">
        <p className="mt-3 text-base leading-7 text-ink-700">{t.contribute.createRouteLede}</p>
      </ContentColumn>

      <PageGrid className="mt-8">
        <GridRegion span={8} tablet={4}>
          {/* VR-09's stage bar, at the two stages this product actually has. */}
          <Panel tone="sunken" as="section">
            <h2 className="sr-only">{t.contribute.stagesLabel}</h2>
            <NumberedFlow
              orientation="horizontal"
              current={1}
              stages={[
                { title: t.contribute.stageBasicsTitle, body: t.contribute.stageBasicsBody },
                { title: t.contribute.stageRoadTitle, body: t.contribute.stageRoadBody },
              ]}
            />
          </Panel>

          <Panel as="section" className="mt-5">
            <h2 className="text-panel font-semibold text-ink-900">{t.contribute.basicsTitle}</h2>
            <p className="mt-1 text-meta leading-5 text-ink-500">{t.contribute.createRouteNote}</p>

            <form action={createRouteAction} className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="locale" value={locale} />

              <FormField label={t.contribute.from} hint={t.contribute.countryHint}>
                <input
                  type="text"
                  name="originCountry"
                  required
                  minLength={2}
                  maxLength={2}
                  pattern="[A-Za-z]{2}"
                  autoCapitalize="characters"
                  defaultValue="BD"
                  className={INPUT}
                />
              </FormField>

              <FormField label={t.contribute.to} hint={t.contribute.countryHint}>
                <input
                  type="text"
                  name="destinationCountry"
                  required
                  minLength={2}
                  maxLength={2}
                  pattern="[A-Za-z]{2}"
                  autoCapitalize="characters"
                  placeholder="DE"
                  className={INPUT}
                />
              </FormField>

              <FormField label={t.search.studyLevel}>
                <select name="studyLevel" className={INPUT}>
                  {STUDY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {t.studyLevel[level]}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label={t.search.mechanism} hint={t.contribute.mechanismHint}>
                <select name="mechanism" className={INPUT} defaultValue="">
                  <option value="">{t.search.any}</option>
                  {ROUTE_MECHANISMS.map((mechanism) => (
                    <option key={mechanism} value={mechanism}>
                      {t.routeMechanism[mechanism]}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label={t.search.intake} hint={t.contribute.intakeHint}>
                <input type="text" name="routeIntake" className={INPUT} placeholder="2027 autumn" />
              </FormField>

              {/* The two long fields take the whole band, as VR-09's second row does. */}
              <FormField
                label={t.contribute.routeTitle}
                hint={t.contribute.routeTitleHint}
                className="sm:col-span-2 lg:col-span-3"
              >
                <input type="text" name="title" required maxLength={120} className={INPUT} />
              </FormField>

              <FormField
                label={t.contribute.routeSummary}
                hint={t.contribute.routeSummaryHint}
                className="sm:col-span-2 lg:col-span-3"
              >
                <textarea name="summary" rows={3} className={INPUT} />
              </FormField>

              <div className="sm:col-span-2 lg:col-span-3">
                <button type="submit" className={buttonClass('primary')}>
                  {t.contribute.publish}
                </button>
              </div>
            </form>
          </Panel>
        </GridRegion>

        <GridRegion span={4} tablet={2}>
          <div className="space-y-3">
            <Rail title={t.contribute.routeTipsTitle} level={2}>
              <GuidanceList lines={t.contribute.routeTips} />
            </Rail>

            {/* VR-09's "Route Summary (Draft)" position, carrying what a first-time
                contributor does not know instead of echoing what they just typed. */}
            <Rail title={t.contribute.publishMeansTitle} level={2}>
              <GuidanceList lines={t.contribute.publishMeans} />
            </Rail>
          </div>
        </GridRegion>
      </PageGrid>
    </PageCanvas>
  )
}
