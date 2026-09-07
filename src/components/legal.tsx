import type { ReactNode } from 'react'

import { Caution } from '@/components/trust'
import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * The shape shared by the privacy page and the terms page — Phase 13.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Two pages, one structure, so they cannot drift into looking like documents from different
 * services. Nothing here is a new visual idea: it is the reading column, the type scale and
 * the caution treatment the rest of the product already uses.
 */

/**
 * The banner both pages carry until the owner adopts them.
 *
 * **This is not boilerplate hedging.** An agent can make the words match the code; it cannot
 * make a promise on somebody else's behalf, and a privacy policy is exactly a promise. Until
 * the owner has read these and set a contact address, saying so plainly is more honest than
 * publishing something that looks adopted — and a reader who notices the gap has learned
 * something true about the service rather than being misled by a confident page.
 *
 * It uses the caution treatment (§7.3) because it changes what a reader should conclude,
 * which is the whole test for that weight.
 */
export function LegalDraftBanner({ dictionary: t }: { dictionary: Dictionary }) {
  return (
    <div className="mt-6 rounded-panel border border-hairline bg-surface-muted p-4">
      <p className="text-sm font-semibold text-ink-900">{t.legal.draftBannerTitle}</p>
      <div className="mt-2">
        <Caution>{t.legal.draftBannerBody}</Caution>
      </div>
    </div>
  )
}

/** One section: a heading and its prose. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-section font-semibold tracking-tight text-ink-900">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-7 text-ink-700">{children}</div>
    </section>
  )
}

/**
 * A list of statements inside a section.
 *
 * A real `<ul>`, because these *are* lists — what is stored, what is not — and a screen reader
 * announcing "list, five items" tells somebody the shape of the answer before they read it.
 */
export function LegalList({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
