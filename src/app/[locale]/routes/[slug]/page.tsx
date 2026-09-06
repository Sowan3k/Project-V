import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AddStepForm, ContributionInvitation } from '@/components/contribute'
import {
  ConnectionList,
  ConnectStepsForm,
  IncompleteRoadNotice,
  ReviseRouteForm,
  ReviseStepForm,
  StepArchiveControl,
} from '@/components/structure'
import { ContentColumn } from '@/components/layout'
import { Panel } from '@/components/ui'
import { FlagDuplicateForm } from '@/components/lifecycle'
import { RouteContext } from '@/components/route-context'
import { RouteMap } from '@/components/route-map'
import { StepFields } from '@/components/step-fields'
import { isLocale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { getDictionary } from '@/i18n/get-dictionary'
import { CATEGORY_STYLE } from '@/renderer'
import { currentViewer } from '@/server/auth'
import type { RouteDetail } from '@/server/routes/read'
import {
  getRouteBySlug,
  getRouteStructure,
  getStepFields,
  searchRoutes,
} from '@/server/routes/read'

import { flagDuplicateAction } from './actions'

/**
 * The route overview — FR-03, FR-06, FR-09, VR-03, VR-04, VR-05.
 *
 * One coherent, vertically scrollable journey. The ribbon in search results and this road are
 * drawn by the same renderer from the same graph, so opening a route unfolds the same object
 * rather than navigating to a disconnected detail page (D-33, invariant 25).
 *
 * A step expands in place via `?step=<id>` rather than client state, so the expansion is
 * deep-linkable, shareable and works with JavaScript disabled — and the road stays on screen
 * above it, so inspecting a step never feels like leaving the route (§8.3).
 *
 * Reading remains anonymous. The session only determines which contribution controls appear.
 */
export const dynamic = 'force-dynamic'

/**
 * The route's own name in the browser tab - Phase 12.
 *
 * A reader comparing three routes has three tabs; identical titles make that impossible to
 * work with, and a bookmark or a shared link carries the same title into somebody else's
 * history. `notPublished` rather than a blank for a route that does not exist, so a broken
 * link is legible in a tab too.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  const route = await getRouteBySlug(slug)
  if (route === null) return { title: t.notPublished.title }
  return { title: route.title, description: route.summary ?? t.meta.description }
}

export default async function RoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const route = await getRouteBySlug(slug)
  if (!route) notFound()

  const viewer = await currentViewer()
  const query = await searchParams
  const requested = Array.isArray(query.step) ? query.step[0] : query.step
  const openStep = route.steps.find((s) => s.id === requested) ?? null
  const fields = openStep ? await getStepFields(openStep.id) : []
  const stepHrefs = Object.fromEntries(route.steps.map((step) => [
    step.id, `/${locale}/routes/${route.slug}?step=${encodeURIComponent(step.id)}#route-step-info`,
  ]))

  // Candidates for a duplicate flag: routes on the same origin/destination/level pair, which
  // is the only pair that could plausibly describe the same journey (§40.1). Excludes this
  // route and anything already merged away, so the list offers no dead ends.
  //
  // Page one only, since Phase 12D gave search a page size. A duplicate-flag picker is a
  // shortlist a person reads, not an index — if the right route is not among the most recent
  // dozen on this exact pair, the honest answer is that this control cannot help and the
  // flag belongs on the other route instead.
  const siblings = (
    await searchRoutes({
      originCountry: route.originCountry,
      destinationCountry: route.destinationCountry,
      studyLevel: route.studyLevel,
    })
  ).routes.filter((candidate) => candidate.id !== route.id)

  return (
    <RouteContext route={route} dictionary={t} locale={locale} tab="overview">
      <section>
        <h2 className="mb-3 text-section font-semibold text-ink-900">{t.route.roadLabel}</h2>
        <RouteMap
          route={route}
          dictionary={t}
          selectedStepId={openStep?.id}
          stepHrefs={stepHrefs}
        />
      </section>

      {/* Selected information immediately follows its map, rather than appearing after every
          index row on a phone. All original URLs and contribution controls remain available. */}
      <section id="route-step-info" className="mt-5 scroll-mt-6">
        {openStep === null ? (
          <p className="border-l-2 border-hairline py-2 pl-4 text-sm text-ink-500">
            {t.route.selectAStep}
          </p>
        ) : (
          <div
            className="rounded-panel border border-hairline border-t-4 bg-surface p-4 sm:p-5"
            style={{ borderTopColor: CATEGORY_STYLE[openStep.category as keyof typeof CATEGORY_STYLE].line }}
          >
            <div className="sticky top-0 z-10 mb-5 flex items-start justify-between gap-4 border-b border-hairline bg-surface py-4">
              <div>
                <p className="text-micro font-medium uppercase tracking-wide text-ink-500">
                  {t.route.selectedStep} · {t.stepCategory[openStep.category as keyof typeof t.stepCategory]}
                </p>
                <h2 className="mt-1 text-section font-semibold text-ink-900">{openStep.label}</h2>
                <p className="mt-1 text-meta text-ink-500">
                  {t.route.fieldCount(openStep.fieldCount)}
                  {openStep.typicalDurationDays === null
                    ? ''
                    : ` · ${t.route.durationShort(openStep.typicalDurationDays)}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <a href="#route-map" className="py-1 text-meta text-brand-700 underline">{t.route.backToMap}</a>
                <Link href={`/${locale}/routes/${route.slug}#route-map`} className="py-1 text-meta text-brand-700 underline">
                  {t.route.closeStep}
                </Link>
              </div>
            </div>
            <StepFields
              step={openStep}
              fields={fields}
              route={route}
              locale={locale}
              signedIn={viewer !== null}
              dictionary={t}
            />
          </div>
        )}
      </section>

      <section className="mt-8">
        <details open={openStep === null}>
          <summary className="cursor-pointer text-panel font-semibold text-ink-900">
            {t.route.routeIndex}{' '}
            <span className="text-meta font-normal text-ink-500">({t.route.stepCount(route.stepCount)})</span>
          </summary>

          {route.steps.length === 0 ? (
            <p className="mt-3 text-sm text-ink-700">{t.route.noSteps}</p>
          ) : (
            <ol className="mt-3 divide-y divide-hairline border-y border-hairline">
              {route.steps.map((step, index) => {
                const isOpen = openStep?.id === step.id
                const href = isOpen
                  ? `/${locale}/routes/${route.slug}`
                  : `/${locale}/routes/${route.slug}?step=${encodeURIComponent(step.id)}#route-step-info`

                return (
                  <li key={step.id}>
                    <Link
                      href={href}
                      scroll={false}
                      aria-current={isOpen ? 'true' : undefined}
                      className={`flex items-baseline gap-3 rounded-control px-2 py-4 ${
                        isOpen
                          ? 'bg-brand-50'
                          : 'hover:bg-surface-muted'
                      }`}
                    >
                      <span className="text-xs text-ink-500">{index + 1}</span>
                      <span className="flex-1">
                        <span className="block font-medium text-ink-900">{step.label}</span>
                        <span className="block text-xs text-ink-500">
                          {t.stepCategory[step.category as keyof typeof t.stepCategory]}
                          {step.typicalDurationDays === null
                            ? ''
                            : ` · ${t.route.duration}: ${t.route.days(step.typicalDurationDays)}`}
                          {` · ${t.route.fieldCount(step.fieldCount)}`}
                        </span>
                      </span>
                      <span className="text-xs text-brand-700">
                        {isOpen ? t.route.closeStep : t.route.openStep}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </details>

      </section>

      {/*
        VR-09's "Build Your Road", where the road is — Phase 12E, FR-14.

        The mockup makes this a panel of its own with a title, an instruction and the step
        strip beneath it. It had been three small disclosures hanging off the bottom of the
        route index with no heading between them and the index above, which is why the one
        capability that turns an empty experimental route into a usable one read as
        housekeeping. It is the opposite: for a route somebody created five minutes ago it is
        the whole point of the page.

        The strip itself is not repeated here. It is already at the top of this page, drawn by
        the renderer from the same graph — which is exactly what VR-09's preview pane is
        approximating, and repeating it would be a second copy that could disagree.
      */}
      <Panel as="section" tone="sunken" className="mt-8">
        <h2 className="text-section font-semibold tracking-tight text-ink-900">
          {t.contribute.buildRoadTitle}
        </h2>
        <ContentColumn width="reading">
          <p className="mt-1 text-sm leading-6 text-ink-700">{t.contribute.buildRoadLede}</p>
        </ContentColumn>

        {viewer === null ? (
          <ContributionInvitation
            dictionary={t}
            locale={locale}
            next={`/${locale}/routes/${route.slug}`}
          />
        ) : (
          <>
            <AddStepForm route={route} locale={locale} dictionary={t} />
            {/* Phase 12E, audit F6 — the rest of what the revision engine can already do,
                finally reachable. Loaded only for a signed-in viewer, so an anonymous read
                costs exactly what it did before. */}
            <MaintainRoad route={route} locale={locale} dictionary={t} />
          </>
        )}
      </Panel>

      {/* §40.4 — flagging a likely duplicate. Sits at the foot of the route, below the
          content it is about, because it is housekeeping rather than something a reader
          came for. */}
      <FlagDuplicateForm
        route={route}
        candidates={siblings}
        locale={locale}
        signedIn={viewer !== null}
        action={flagDuplicateAction}
        dictionary={t}
      />
    </RouteContext>
  )
}

/**
 * Everything a contributor can do to the *shape* of this route — Phase 12E, audit F6.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Its own async component, so an anonymous reader never pays for it.**
 *
 * `getRouteStructure` is a second pair of queries carrying every step and connection
 * including the archived ones, plus a revision id on each so an edit can declare what it was
 * based on. A reader needs none of that, and the route page is the hottest query in the
 * product. Rendering this only inside the signed-in branch means the read path is exactly as
 * heavy as it was, and React streams this region in beside the rest rather than blocking it.
 *
 * **Inside the route, not on a page of its own.** CLAUDE.md §7.1: a short transient action is
 * a disclosure or a drawer, never a page transition — and a contributor correcting a stage
 * should be able to see the road they are correcting. Every control below is a `<details>`
 * containing a plain form that posts and works with JavaScript disabled.
 */
async function MaintainRoad({
  route,
  locale,
  dictionary: t,
}: {
  route: RouteDetail
  locale: string
  dictionary: Dictionary
}) {
  const structure = await getRouteStructure(route.id)

  return (
    <section className="mt-6 border-t border-hairline pt-5">
      <h3 className="text-panel font-semibold text-ink-900">{t.structure.maintainTitle}</h3>
      <ContentColumn width="reading">
        <p className="mt-1 text-meta leading-5 text-ink-500">{t.structure.maintainLede}</p>
      </ContentColumn>

      {/* What is still unfinished — shown, never enforced (§7.3). A cycle or a duplicate
          connection cannot appear here: the revision service refuses to commit either. */}
      <IncompleteRoadNotice structure={structure} dictionary={t} />

      <ReviseRouteForm route={route} structure={structure} locale={locale} dictionary={t} />
      <ConnectStepsForm
        structure={structure}
        routeSlug={route.slug}
        locale={locale}
        dictionary={t}
      />
      <ConnectionList
        structure={structure}
        routeSlug={route.slug}
        locale={locale}
        dictionary={t}
      />

      <details className="mt-3">
        <summary className="cursor-pointer list-none text-meta font-medium text-brand-700 underline decoration-hairline underline-offset-2">
          {t.structure.reviseStep}
        </summary>
        <ul className="mt-2 space-y-3">
          {structure.steps.map((step) => (
            <li
              key={step.id}
              className="rounded-control border border-hairline bg-surface px-3 py-2"
            >
              <p className="text-sm font-medium text-ink-900">
                {step.label}
                {step.archived ? (
                  <span className="ml-2 text-meta font-normal text-ink-500">
                    {t.structure.archivedNote}
                  </span>
                ) : null}
              </p>
              {step.archived ? null : (
                <ReviseStepForm
                  step={step}
                  routeSlug={route.slug}
                  locale={locale}
                  dictionary={t}
                />
              )}
              <StepArchiveControl
                step={step}
                routeSlug={route.slug}
                locale={locale}
                dictionary={t}
              />
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
