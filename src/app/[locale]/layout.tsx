import type { Metadata, Viewport } from 'next'
import { Anek_Bangla, Lexend } from 'next/font/google'
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

/**
 * Typefaces — Phase 12E.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * Until now the whole product ran on the system font stack, which is most of what was left
 * making it read as a developer's page rather than a product. Two families, and each is a
 * decision rather than a preference.
 *
 * **Lexend, for the interface.** Chosen for what it was built to do rather than for how it
 * looks: it was designed to improve *reading proficiency*, with wider default spacing and
 * unambiguous letterforms. This product exists to make dense procedural information — visa
 * conditions, document requirements, deadlines — understandable to students who are often
 * reading it in a second language and under some pressure. A typeface engineered for reading
 * performance is on the nose for that in a way a fashionable geometric sans is not.
 *
 * **Anek Bangla, for the Bengali.** The brand wordmark is Bengali and appears on every page,
 * and almost no Latin family covers the script — so until now it fell back to whatever the
 * device happened to have, which differs on every platform and is frequently poor. Anek was
 * designed for Indic scripts specifically. Bengali identity, English interface (§8.5.6) is
 * not served by letting the Bengali half render by accident.
 *
 * **Both are variable, self-hosted at build time by `next/font`.** No runtime request to
 * Google, no third-party connection on the critical path, no layout shift from a late swap,
 * and each subset to the script it is for. Design-References.md is explicit that "a student
 * in Dhaka on a slow connection is the person this product is for" — two variable subsets
 * are a few tens of kilobytes and cost no JavaScript at all, which is why this is the
 * typography change that was worth making and a shader hero is not.
 * ═════════════════════════════════════════════════════════════════════════════════════════
 */
const interfaceFont = Lexend({
  subsets: ['latin'],
  variable: '--font-interface',
  display: 'swap',
})

const bengaliFont = Anek_Bangla({
  subsets: ['bengali'],
  variable: '--font-bengali-face',
  display: 'swap',
})

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
    // A template, so every page supplies its own subject and the brand comes along.
    // Before Phase 12 every page in the application shared one title, which made browser
    // tabs, history and bookmarks useless the moment a reader had two routes open.
    title: {
      default: `${t.brand.nameEn} — ${t.brand.tagline}`,
      template: `%s — ${t.brand.nameEn}`,
    },
    description: t.meta.description,
    applicationName: t.brand.nameEn,
    // Phase 0 set `index: false` because there was nothing to index, with a note that Phase 5
    // would open it. Phase 5 opened the read path and this was missed until now: search,
    // ribbons, roads, steps, fields and history have all been readable and unlisted since.
    //
    // Indexing is turned on for the read path only. `/admin` and `/journeys` are excluded in
    // robots.ts — a moderation queue has no business in a search index, and a private journey
    // page is behind a session and would be indexed as a sign-in prompt at best.
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName: t.brand.nameEn,
      title: `${t.brand.nameEn} — ${t.brand.tagline}`,
      description: t.meta.description,
      locale: LOCALE_HTML_LANG[locale],
    },
  }
}

/**
 * Viewport and browser chrome — Phase 12.
 *
 * `themeColor` matches the icon's field so a phone browser's chrome continues the page rather
 * than framing it. Next requires it here rather than in `metadata`, and says so at build time.
 *
 * The viewport itself is left at Next's default deliberately: no `maximum-scale`, no
 * `user-scalable=no`. Pinch-zoom is how a great many people read on a phone, and disabling it
 * is one of the most common accessibility failures on the mobile web.
 */
export const viewport: Viewport = {
  themeColor: '#1d3a6b',
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
    <html
      lang={LOCALE_HTML_LANG[locale]}
      className={`${interfaceFont.variable} ${bengaliFont.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-white focus:px-3 focus:py-2 focus:text-brand-700 focus:shadow"
        >
          {t.common.skipToContent}
        </a>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader dictionary={t} locale={locale} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter dictionary={t} />
        </div>
      </body>
    </html>
  )
}
