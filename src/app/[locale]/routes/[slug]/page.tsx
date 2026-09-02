import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AddStepForm, ContributionInvitation } from '@/components/contribute'
import { GridRegion, PageGrid } from '@/components/layout'
import { RouteContext } from '@/components/route-context'
import { rendererStrings } from '@/components/route-shared'
import { StepFields } from '@/components/step-fields'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { Road } from '@/renderer'
import { currentViewer } from '@/server/auth'
import { getRouteBySlug, getStepFields } from '@/server/routes/read'

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
 * Anonymous throughout. No session is read anywhere in this file.
 */
export const dynamic = 'force-dynamic'

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

  return (
    <RouteContext route={route} dictionary={t} locale={locale} tab="overview">
      <section>
        <h2 className="sr-only">{t.route.roadLabel}</h2>
        {/* Wide content scrolls in its own container; the page never scrolls sideways. */}
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface p-4">
          <Road graph={route.graph} strings={rendererStrings(t)} />
        </div>
      </section>

      <PageGrid className="mt-10">
        <GridRegion span={5}>
          <h2 className="text-lg font-semibold text-ink-900">
            {t.route.steps}{' '}
            <span className="text-sm font-normal text-ink-500">
              ({t.route.stepCount(route.stepCount)})
            </span>
          </h2>

          {route.steps.length === 0 ? (
            <p className="mt-3 text-sm text-ink-700">{t.route.noSteps}</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {route.steps.map((step, index) => {
                const isOpen = openStep?.id === step.id
                const href = isOpen
                  ? `/${locale}/routes/${route.slug}`
                  : `/${locale}/routes/${route.slug}?step=${step.id}`

                return (
                  <li key={step.id}>
                    <Link
                      href={href}
                      scroll={false}
                      aria-current={isOpen ? 'true' : undefined}
                      className={`flex items-baseline gap-3 rounded-xl border p-4 ${
                        isOpen
                          ? 'border-brand-500 bg-brand-500/5'
                          : 'border-hairline bg-surface hover:border-ink-500/30'
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

          {/* FR-14, in place. VR-09's "Build Road" stage happens on the route itself rather
              than in a wizard, so a contributor sees the road change as they add to it. */}
          {viewer === null ? (
            <ContributionInvitation
              dictionary={t}
              locale={locale}
              next={`/${locale}/routes/${route.slug}`}
            />
          ) : (
            <AddStepForm route={route} locale={locale} dictionary={t} />
          )}
        </GridRegion>

        {/* The selected step's detail sits beside the list on desktop and stacks below it on
            a phone — so selecting a step never replaces the journey it belongs to. */}
        <GridRegion span={7}>
          {openStep === null ? (
            <div className="rounded-xl border border-dashed border-hairline p-6 text-sm text-ink-500">
              {t.route.selectAStep}
            </div>
          ) : (
            <div className="rounded-xl border border-hairline bg-surface p-4 lg:sticky lg:top-6">
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
        </GridRegion>
      </PageGrid>
    </RouteContext>
  )
}
