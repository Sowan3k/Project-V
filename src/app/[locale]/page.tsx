import Link from 'next/link'
import { notFound } from 'next/navigation'

import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'

/**
 * Landing — VR-01, FR-01, D-03.
 *
 * Deliberately minimal. "The first interaction should resemble searching for a journey
 * rather than browsing articles" (§8.1), and complexity appears only after the visitor acts.
 * Nothing here needs an account.
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
    <div className="mx-auto w-full max-w-2xl px-5 py-14 sm:py-20">
      <p lang="bn" className="text-2xl font-semibold text-brand-900">
        {t.landing.headlineBn}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-ink-900 sm:text-4xl">
        {t.landing.headline}
      </h1>
      <p className="mt-5 text-base leading-7 text-ink-700">{t.landing.subhead}</p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href={`/${locale}/routes`}
          className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900"
        >
          {t.landing.findMyRoute}
        </Link>
        <a href="#how-it-works" className="text-sm font-medium text-brand-700 hover:underline">
          {t.landing.howItWorks}
        </a>
      </div>

      <ul className="mt-8 flex flex-wrap gap-2">
        {principles.map((principle) => (
          <li
            key={principle}
            className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm text-ink-700"
          >
            {principle}
          </li>
        ))}
      </ul>

      <section id="how-it-works" className="mt-14 scroll-mt-8">
        <h2 className="text-lg font-semibold text-ink-900">{t.landing.howItWorks}</h2>
        <ol className="mt-4 space-y-4">
          {t.landing.steps.map((entry, index) => (
            <li key={entry.title} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline text-xs text-ink-700">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-ink-900">{entry.title}</p>
                <p className="text-sm leading-6 text-ink-700">{entry.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
