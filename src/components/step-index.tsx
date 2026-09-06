import Link from 'next/link'

import { Rail } from '@/components/ui'
import { CATEGORY_STYLE } from '@/renderer'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { RouteDetail } from '@/server/routes/read'

/**
 * Every stage of the route, as a rail — Phase 12H, VR-13 desktop, VR-04's "All Steps" panel.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **This used to sit underneath the road, and it cost 984 pixels of a 3,439-pixel page.**
 *
 * The route page was: a 1,518px road with a 450px maturity panel beside it — so about a
 * thousand pixels of empty right-hand column — and then, stacked below both, a full-width list
 * naming the same thirteen stages the road had just drawn. A reader scrolled past the road to
 * reach a text copy of the road, while a third of the screen sat unused beside it.
 *
 * VR-04 and VR-13 both put this list in a **column beside** the route rather than below it, and
 * they are right for a reason beyond tidiness: a reader who has opened stage 4 and wants stage 5
 * should not have to scroll back past a wrapping road to find it. In the rail it is always in
 * view, and moving between stages costs one click from wherever the reader is.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **It is not a second representation of the route** (invariant 25). The road is the route
 * drawn; this is the route *indexed* — a table of contents, which is why it is a list of links
 * with no geometry, no connectors and no shape. The category colour is the only thing it
 * borrows, as a 3px edge, so a reader can see at a glance which run of stages is documents and
 * which is visa. It comes from `CATEGORY_STYLE`, the same source the renderer paints from, so
 * the two cannot drift.
 *
 * Colour is never the only carrier (§10.4): every row states its category in words.
 */
export function StepIndexRail({
  route,
  locale,
  selectedStepId,
  dictionary: t,
}: {
  route: RouteDetail
  locale: string
  selectedStepId?: string
  dictionary: Dictionary
}) {
  if (route.steps.length === 0) {
    return (
      <Rail title={t.route.routeIndex} level={2}>
        <p className="text-meta leading-5 text-ink-700">{t.route.noSteps}</p>
      </Rail>
    )
  }

  return (
    <Rail
      title={t.route.routeIndex}
      level={2}
      action={<span className="text-ink-500">{t.route.stepCount(route.stepCount)}</span>}
    >
      {/*
        A scroller with a bounded height, and the bound is deliberate.
        A twenty-stage route would make the rail taller than the road it sits beside and push
        the maturity panel off the screen, which is the opposite of the point. `max-h` plus
        `overflow-y-auto` keeps the rail the length of a rail; the road remains the place a
        long route is read whole.
      */}
      <ol className="-mx-2 max-h-128 overflow-y-auto px-2">
        {route.steps.map((step, index) => {
          const isOpen = selectedStepId === step.id
          const href = isOpen
            ? `/${locale}/routes/${route.slug}#route-map`
            : `/${locale}/routes/${route.slug}?step=${encodeURIComponent(step.id)}#route-step-info`

          return (
            <li key={step.id}>
              <Link
                href={href}
                scroll={false}
                aria-current={isOpen ? 'true' : undefined}
                className={`flex items-baseline gap-2.5 rounded-control border-l-2 py-2 pl-2.5 ${
                  isOpen ? 'bg-brand-50 font-medium' : 'hover:bg-surface-muted'
                }`}
                style={{
                  borderLeftColor:
                    CATEGORY_STYLE[step.category as keyof typeof CATEGORY_STYLE].line,
                }}
              >
                <span className="w-4 shrink-0 text-micro text-ink-500">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-meta leading-5 text-ink-900">{step.label}</span>
                  <span className="block text-micro leading-4 text-ink-500">
                    {t.stepCategory[step.category as keyof typeof t.stepCategory]}
                    {step.typicalDurationDays === null
                      ? ''
                      : ` · ${t.route.days(step.typicalDurationDays)}`}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </Rail>
  )
}
