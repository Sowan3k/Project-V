import type { FlyWindow } from '@/domain/fly-window'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { RouteVisualStrings } from '@/renderer'

/** Bundles the dictionary into the shape the renderer expects, in one place. */
export function rendererStrings(t: Dictionary): RouteVisualStrings {
  return {
    categories: t.stepCategory,
    start: t.route.start,
    destination: t.route.destination,
    added: t.route.stepAdded,
    archived: t.route.stepArchived,
    disrupted: t.route.stepDisrupted,
    summary: (n) => `${t.route.roadLabel} — ${t.route.stepCount(n)}`,
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

function monthLabel(point: { year: number; month: number }): string {
  return `${MONTHS[point.month - 1] ?? ''} ${point.year}`
}

/**
 * Expected fly window — FR-56, §20.1.
 *
 * Always rendered as a range with the estimate wording attached. There is deliberately no
 * variant of this component that shows a single date, because a planning aid presented as a
 * promise is the failure invariant 16 exists to prevent.
 */
export function FlyWindowNote({
  window,
  dictionary: t,
  compact = false,
}: {
  window: FlyWindow | null
  dictionary: Dictionary
  compact?: boolean
}) {
  if (window === null) {
    return <span className="text-ink-500">{t.flyWindow.unknown}</span>
  }

  const value = t.flyWindow.value(monthLabel(window.from), monthLabel(window.to))

  if (compact) {
    return (
      <span className="text-ink-700">
        {t.flyWindow.label}: {value}{' '}
        <span className="text-ink-500">({t.flyWindow.estimate})</span>
      </span>
    )
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-muted p-3 text-sm">
      <p className="font-medium text-ink-900">{t.flyWindow.label}</p>
      <p className="mt-0.5 text-ink-700">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{t.flyWindow.estimate}</p>
      {window.partialTiming ? (
        <p className="mt-1 text-xs text-ink-500">{t.flyWindow.partial}</p>
      ) : null}
    </div>
  )
}
