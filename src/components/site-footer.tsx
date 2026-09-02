import { PageCanvas } from '@/components/layout'
import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * Shell footer. Carries the two statements that must never be ambiguous: this is a public
 * good, and it is not an agency (CLAUDE.md §1, §44.2).
 */
export function SiteFooter({ dictionary: t }: { dictionary: Dictionary }) {
  return (
    <footer className="border-t border-hairline bg-surface">
      <PageCanvas className="space-y-1 py-6 text-sm text-ink-500">
        <p>{t.footer.publicGood}</p>
        <p>{t.footer.notAnAgency}</p>
      </PageCanvas>
    </footer>
  )
}
