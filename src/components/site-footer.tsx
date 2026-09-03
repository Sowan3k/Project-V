import { PageCanvas } from '@/components/layout'
import { SUPPORT_URL } from '@/lib/support'
import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * Shell footer. Carries the two statements that must never be ambiguous: this is a public
 * good, and it is not an agency (CLAUDE.md §1, §44.2).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The voluntary support link — CLAUDE.md §10.1, Phase 12.**
 *
 * The footer is where it belongs, and this is the only place it appears. §10.1: "Placed
 * unobtrusively: footer, About/Community area, or menu. It must never compete visually with
 * `Find My Route`, route navigation or community contribution." It is one line of body text
 * among three, in the same size and colour as the sentences beside it — deliberately not a
 * button, because a button is a call to action and this is not one.
 *
 * **It is a link and nothing more.** The reader leaves for Gumroad and completes everything
 * there. This application processes, stores and sees no payment information, has no Gumroad
 * API integration, no payment table, no donor profile, no supporter status, no receipt and no
 * verification. Those absences are asserted by `tests/architecture/support-link.test.ts`, not
 * merely intended.
 *
 * **A supporter and a non-supporter are indistinguishable to the system by construction**,
 * which is stronger than a promise not to distinguish them: there is no supporter flag for
 * any code to read, so nothing about route ranking, maturity, confidence, source
 * classification, moderation, contributor standing or feature access *could* condition on it
 * (invariant 13, FR-78, BR-13, BR-14, D-28, D-43).
 *
 * The wording is "Support", never "Donate" — §10.1 avoids tax-deductible charitable framing —
 * and the line beside it says plainly that supporting changes nothing, because a reader who
 * suspects it buys standing has been told something false about the whole platform.
 */
export function SiteFooter({ dictionary: t }: { dictionary: Dictionary }) {
  return (
    <footer className="border-t border-hairline bg-surface">
      <PageCanvas className="space-y-1 py-6 text-sm text-ink-500">
        <p>{t.footer.publicGood}</p>
        <p>{t.footer.notAnAgency}</p>
        <p>
          <a
            href={SUPPORT_URL}
            // Leaving the platform, and said so in the accessible name rather than only in a
            // visual marker — CLAUDE.md invariant 10: never hide where a link goes.
            target="_blank"
            rel="noreferrer noopener external"
            className="underline underline-offset-2 hover:text-ink-700 focus-visible:text-ink-700"
          >
            {t.footer.support}
            <span className="sr-only"> {t.footer.supportOpensExternal}</span>
          </a>{' '}
          <span>{t.footer.supportChangesNothing}</span>
        </p>
      </PageCanvas>
    </footer>
  )
}
