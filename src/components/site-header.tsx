import Link from 'next/link'

import { PageCanvas } from '@/components/layout'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { currentViewer, signOut } from '@/server/auth'

/**
 * The shell header: Bengali brand identity beside the English name (CLAUDE.md §4).
 *
 * Phase 7 gives it the only navigation it needs — a way in and a way to your own journeys.
 * Deliberately not a nav bar of everything: the product's entry point is a search, and
 * complexity appears after the visitor acts (§8.5, VR-01).
 *
 * The signed-in state shows the **pseudonymous handle**, never an email or a name. The
 * session does not even carry those, so this could not render one by mistake (§24.3).
 */
export async function SiteHeader({
  dictionary: t,
  locale,
}: {
  dictionary: Dictionary
  locale: string
}) {
  const viewer = await currentViewer()

  return (
    <header className="border-b border-hairline bg-surface">
      <PageCanvas className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-4">
        <Link href={`/${locale}`} className="flex flex-wrap items-baseline gap-x-3">
          <span lang="bn" className="text-lg font-semibold text-brand-900">
            {t.brand.nameBn}
          </span>
          <span className="text-sm font-medium tracking-wide text-ink-700 uppercase">
            {t.brand.nameEn}
          </span>
        </Link>

        <nav className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          {viewer === null ? (
            <Link href={`/${locale}/signin`} className="text-brand-700 hover:underline">
              {t.auth.signIn}
            </Link>
          ) : (
            <>
              <Link href={`/${locale}/journeys`} className="text-brand-700 hover:underline">
                {t.journey.indexTitle}
              </Link>
              <span className="text-xs text-ink-500" title={t.auth.handleExplainer}>
                {viewer.handle}
              </span>
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: `/${locale}` })
                }}
              >
                <button type="submit" className="text-ink-700 hover:underline">
                  {t.auth.signOut}
                </button>
              </form>
            </>
          )}
        </nav>
      </PageCanvas>
    </header>
  )
}
