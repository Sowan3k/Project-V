import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FlyWindowNote, rendererStrings } from '@/components/route-shared'
import { StepFields } from '@/components/step-fields'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { Road } from '@/renderer'
import { getRouteBySlug, getStepFields } from '@/server/routes/read'

/**
 * The road — FR-03, FR-06, FR-09, VR-03, VR-04, VR-05.
 *
 * The ribbon on the search page and this road are drawn by the same renderer from the same
 * graph, so opening a route unfolds the same object rather than navigating to a disconnected
 * detail page (D-33, invariant 25).
 *
 * A step expands via `?step=<id>` rather than client state: the expansion is server-rendered,
 * deep-linkable and works without JavaScript, and "the user should be able to collapse the
 * detail and return to the visual journey at any time" (§8.3) is then just a link.
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

  const query = await searchParams
  const requested = Array.isArray(query.step) ? query.step[0] : query.step
  const openStep = route.steps.find((s) => s.id === requested) ?? null
  const fields = openStep ? await getStepFields(openStep.id) : []

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10">
      <Link href={`/${locale}/routes`} className="text-sm text-brand-700 hover:underline">
        ← {t.route.backToSearch}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink-900">{route.title}</h1>
      <p className="mt-1 text-sm text-ink-500">
        {route.originCountry} → {route.destinationCountry} · {t.studyLevel[route.studyLevel]}
        {route.mechanism === null ? '' : ` · ${t.routeMechanism[route.mechanism]}`}
        {route.intake === null ? '' : ` · ${route.intake}`}
      </p>
      {route.summary === null ? null : (
        <p className="mt-3 text-base leading-7 text-ink-700">{route.summary}</p>
      )}

      <div className="mt-5 flex flex-wrap items-start gap-3">
        <span className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs text-ink-700">
          {t.routeLifecycle[route.lifecycleState as keyof typeof t.routeLifecycle]}
        </span>
        <Link
          href={`/${locale}/routes/${route.slug}/history`}
          className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs text-brand-700 hover:underline"
        >
          {t.route.viewHistory}
        </Link>
      </div>

      <div className="mt-5 max-w-md">
        <FlyWindowNote window={route.flyWindow} dictionary={t} />
      </div>

      <section className="mt-8">
        <h2 className="sr-only">{t.route.roadLabel}</h2>
        {/* Wide content scrolls in its own container; the page never scrolls sideways. */}
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface p-3">
          <Road graph={route.graph} strings={rendererStrings(t)} />
        </div>
      </section>

      <section className="mt-8">
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
                <li
                  key={step.id}
                  id={`step-${step.id}`}
                  className="rounded-xl border border-hairline bg-surface"
                >
                  <Link href={href} className="flex items-baseline gap-3 p-4" scroll={false}>
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

                  {isOpen ? (
                    <div className="border-t border-hairline p-4">
                      <StepFields step={step} fields={fields} dictionary={t} />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
