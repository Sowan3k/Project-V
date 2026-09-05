import Link from 'next/link'

import { PageCanvas } from '@/components/layout'
import { BrandLockup, buttonClass } from '@/components/ui'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { currentViewer, signOut } from '@/server/auth'

/**
 * The shell header — VR-01, VR-03, VR-04.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Phase 12B: the brand is a lockup, not two spans of text.** Every mockup leads with the
 * mark beside the Bengali wordmark over the English name, and it is the first thing that
 * tells a visitor this was built for them rather than assembled from a template. It was
 * previously rendered as two words in a row.
 *
 * **The navigation is what exists, and nothing more.** VR-01, VR-03 and VR-04 show five
 * items — Routes, My Journey, Updates, Community, Resources. Three of those are pages this
 * product does not have and is not scheduled to build; a nav link to a page that does not
 * exist is worse than an absent one, and inventing the pages to justify the nav would be
 * adding scope from a picture. So: Routes always, My Journey when there is a journey to
 * see, and the sign-in that unlocks it. The arrangement is the mockups'; the contents are
 * ours (Phases.md — a mockup is binding on arrangement, not on assertion).
 *
 * The signed-in state shows the **pseudonymous handle**, never an email or a name. The
 * session does not carry either, so this could not render one by mistake (§24.3).
 */
export async function SiteHeader({
  dictionary: t,
  locale,
}: {
  dictionary: Dictionary
  locale: string
}) {
  const viewer = await currentViewer()

  const navLink = 'text-sm font-medium text-ink-700 hover:text-brand-900 hover:underline'

  return (
    <header className="border-b border-hairline bg-surface">
      <PageCanvas className="flex items-center gap-x-6 gap-y-3 py-3">
        <Link href={`/${locale}`} className="shrink-0" aria-label={t.brand.nameEn}>
          <BrandLockup nameBn={t.brand.nameBn} nameEn={t.brand.nameEn} />
        </Link>

        <nav aria-label={t.common.primaryNavigation} className="ml-auto flex items-center gap-x-5">
          <Link href={`/${locale}/routes`} className={navLink}>
            {t.nav.routes}
          </Link>

          {viewer === null ? (
            <Link href={`/${locale}/signin`} className={buttonClass('secondary', { className: 'py-2' })}>
              {t.auth.signIn}
            </Link>
          ) : (
            <>
              <Link href={`/${locale}/journeys`} className={navLink}>
                {t.nav.myJourney}
              </Link>
              {/* The handle is shown, not hidden behind a menu: a contributor's public
                  identity is the name their revisions carry, and they should be able to
                  see which one they are signed in as without clicking (§24.3). */}
              <span
                className="hidden text-meta text-ink-500 sm:inline"
                title={t.auth.handleExplainer}
              >
                {viewer.handle}
              </span>
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: `/${locale}` })
                }}
              >
                <button type="submit" className={navLink}>
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
