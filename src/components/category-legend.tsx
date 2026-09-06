import { STEP_CATEGORIES } from '@/domain/enums'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { CATEGORY_STYLE } from '@/renderer'

/**
 * The key to a ribbon — Phase 12H.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **A reader arriving at search sees coloured bands and has no way to read them.** Every
 * ribbon is six categories in journey order, each an icon in its own colour, and until now
 * nothing on the page said what any of them meant. The information was there and unreadable,
 * which is the same failure as not having it.
 *
 * It belongs in the rail rather than above the results because it is reference, not content:
 * consulted once by a first-time visitor and skipped by everybody else. VR-12 uses that same
 * position for "Recently Updated", which is a cross-route feed this product does not have and
 * would not add without a change request (§35). The position is the mockup's; what fills it is
 * ours, which is the substitution rule this project already follows.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The icons come from `CATEGORY_STYLE`, the same record the renderer paints from**, so the
 * key cannot drift from the thing it is a key to — a legend that disagreed with the ribbon
 * beside it would be worse than none. Six rows, in `STEP_CATEGORIES` order, which is journey
 * order: documents, language, admission, funding, visa, travel. That ordering is itself part
 * of what the legend teaches, because it is the order a ribbon reads left to right.
 *
 * Hand-drawn SVG is permitted here for the same reason it is for the brand mark: no route data
 * reaches it and it renders identically for every destination (invariant 24). It is not a
 * route visual — it draws no graph — and every row states its category in words, so nothing
 * rests on colour (§10.4).
 */
export function CategoryLegend({ dictionary: t }: { dictionary: Dictionary }) {
  return (
    <ul className="grid gap-2.5">
      {STEP_CATEGORIES.map((category) => {
        const style = CATEGORY_STYLE[category]
        return (
          <li key={category} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-control border"
              style={{ backgroundColor: style.fill, borderColor: style.line }}
            >
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke={style.ink}
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={style.icon} />
              </svg>
            </span>
            <span className="min-w-0 text-meta leading-5 text-ink-700">
              {t.stepCategory[category]}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
