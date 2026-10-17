import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageCanvas } from '@/components/layout'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'

import { UPDATE_TABS, UpdatesView, type UpdateTab } from '../updates-view'

/**
 * Updates, the other three tabs — Phase 14. `/updates/journey`, `/updates/following` and
 * `/updates/elsewhere`, each its own URL (CLAUDE.md §7.1).
 *
 * The two journey-scoped tabs are noindex. Signed out they hold only an explanation; signed in
 * they hold a reader's own position on each change, which is as private as their progress
 * (invariant 5).
 */
export const dynamic = 'force-dynamic'

const PRIVATE_TABS: readonly UpdateTab[] = ['journey', 'following']

function tabFrom(value: string): UpdateTab | null {
  const tab = UPDATE_TABS.find((id) => id === value)
  // "all" is `/updates` itself. `/updates/all` would be a second address for the same page.
  return tab === undefined || tab === 'all' ? null : tab
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; tab: string }>
}): Promise<Metadata> {
  const { locale, tab: raw } = await params
  if (!isLocale(locale)) return {}
  const tab = tabFrom(raw)
  if (tab === null) return {}
  const t = await getDictionary(locale)
  const title = `${t.meta.updatesTitle}: ${t.updates.tab[tab]}`
  return PRIVATE_TABS.includes(tab)
    ? { title, robots: { index: false, follow: false } }
    : { title }
}

export default async function UpdatesTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; tab: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tab: raw } = await params
  const tab = tabFrom(raw)
  if (tab === null) notFound()
  return (
    <PageCanvas className="py-8">
      <UpdatesView params={params} searchParams={searchParams} tab={tab} />
    </PageCanvas>
  )
}
