import 'server-only'

import type { Locale } from './config'
import type { Dictionary } from './dictionaries/en'

/**
 * Dictionary loader.
 *
 * Async and per-locale from day one so adding Bangla is a new entry in this map rather
 * than a refactor of every consumer (CLAUDE.md §4).
 */
const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: async () => (await import('./dictionaries/en')).en,
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]()
}
