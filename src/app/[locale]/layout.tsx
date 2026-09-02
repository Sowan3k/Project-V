import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { LOCALES, LOCALE_HTML_LANG, isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'

import '../globals.css'

/**
 * Root layout.
 *
 * It lives under `[locale]` rather than at `src/app/` so `<html lang>` is always the
 * locale actually being rendered — the scaffolding that lets Bangla be added without
 * rework (CLAUDE.md §4).
 */

export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)

  return {
    title: `${t.brand.nameEn} — ${t.brand.tagline}`,
    description: t.shell.underConstructionBody,
    applicationName: t.brand.nameEn,
    robots: {
      // Nothing here is route content yet. Phase 5 opens the read path to indexing.
      index: false,
      follow: false,
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const t = await getDictionary(locale)

  return (
    <html lang={LOCALE_HTML_LANG[locale]}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-brand-700 focus:shadow"
        >
          {t.common.skipToContent}
        </a>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader dictionary={t} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter dictionary={t} />
        </div>
      </body>
    </html>
  )
}
