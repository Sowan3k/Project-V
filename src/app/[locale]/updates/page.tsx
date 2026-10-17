import type { Metadata } from 'next'

import { PageCanvas } from '@/components/layout'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'

import { UpdatesView } from './updates-view'

/**
 * Updates, the "All" tab — Phase 14. Every change and disruption on a listed route.
 *
 * Public and indexable: changes to public routes are public knowledge (FR-01, D-03). The page
 * itself lives in `updates-view.tsx`, shared with the other three tabs.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  return { title: t.meta.updatesTitle }
}

export default function UpdatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <PageCanvas className="py-8">
      <UpdatesView params={params} searchParams={searchParams} tab="all" />
    </PageCanvas>
  )
}
