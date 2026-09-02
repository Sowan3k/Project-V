import { PageCanvas } from '@/components/layout'
import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * Minimal shell header: Bengali brand identity beside the English name (CLAUDE.md §4).
 * No navigation yet — search, routes and journeys arrive in Phases 5 and 7.
 */
export function SiteHeader({ dictionary: t }: { dictionary: Dictionary }) {
  return (
    <header className="border-b border-hairline bg-surface">
      <PageCanvas className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-4">
        <span lang="bn" className="text-lg font-semibold text-brand-900">
          {t.brand.nameBn}
        </span>
        <span className="text-sm font-medium tracking-wide text-ink-700 uppercase">
          {t.brand.nameEn}
        </span>
      </PageCanvas>
    </header>
  )
}
