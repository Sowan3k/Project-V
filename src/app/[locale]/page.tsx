import { notFound } from 'next/navigation'

import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'

/**
 * Phase 0 shell page.
 *
 * Deliberately not the VR-01 landing page: search, ribbons and roads are Phase 5.
 * This page exists to prove the shell renders, the locale segment resolves and every
 * user-facing string comes from a dictionary.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const principles = [
    t.principles.free,
    t.principles.communityMaintained,
    t.principles.noDocumentUpload,
    t.principles.noAccountNeededToRead,
  ]

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:py-24">
      <h1 className="text-3xl font-semibold tracking-tight text-balance text-ink-900 sm:text-4xl">
        {t.shell.underConstructionTitle}
      </h1>

      <p className="mt-6 text-base leading-7 text-ink-700">{t.shell.underConstructionBody}</p>

      <p className="mt-4 text-sm leading-6 text-ink-500">{t.shell.underConstructionNote}</p>

      <ul className="mt-10 flex flex-wrap gap-2" aria-label={t.brand.tagline}>
        {principles.map((principle) => (
          <li
            key={principle}
            className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm text-ink-700"
          >
            {principle}
          </li>
        ))}
      </ul>
    </div>
  )
}
