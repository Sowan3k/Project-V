/**
 * Locale configuration.
 *
 * CLAUDE.md §4: "English UI, Bengali brand identity. i18n scaffolding from day one so
 * Bangla can be added without rework." A full Bangla interface is deliberately deferred
 * (CLAUDE.md §10) — so `en` is the only active locale, while every user-facing string
 * already goes through a dictionary and every route already carries a locale segment.
 *
 * Adding Bangla later is: add 'bn' below, add src/i18n/dictionaries/bn.ts, done.
 */
export const LOCALES = ['en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

/** BCP 47 tags for the `lang` attribute and any future `hreflang`. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: 'en',
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}
