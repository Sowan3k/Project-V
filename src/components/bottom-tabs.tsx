import { headers } from 'next/headers'
import Link from 'next/link'

import type { Dictionary } from '@/i18n/dictionaries/en'
import { PATH_HEADER } from '@/middleware'
import { currentViewer } from '@/server/auth'

/**
 * The phone's primary navigation — Phase 12F, VR-12 and VR-13.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Why a bottom bar rather than a smaller header.** Every phone panel in VR-12, VR-13 and
 * VR-14 has one, and it is not decoration: a phone's reachable area is the bottom third of
 * the screen, and this product's two primary destinations — find a route, look at my journey
 * — are things a reader moves between constantly. A header nav on a phone puts both of them
 * where a thumb cannot get to them, and the whole of Phase 12F is the observation that a
 * phone needs a different *information architecture*, not a narrower one.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Three tabs, not VR-12's four, and the missing one is Updates.**
 *
 * There is no cross-route updates feed in this product. It was explicitly outside Phase 10's
 * scope, Phases.md records that adding one "is a change request first", and proactive
 * notification is deferred entirely (§35, §8.6) — so a fourth tab would lead nowhere. The
 * site header made exactly this argument about VR-01's five desktop nav items and dropped
 * three of them: **a nav link to a page that does not exist is worse than an absent one**, and
 * inventing the page to justify the tab is adding scope from a picture. Change activity for a
 * route lives on that route's Changes tab, which is where a reader is when they want it.
 *
 * **Account is one tab that means two things**, because on this platform they are the same
 * thing. Signed in it goes to the reader's own contributor page — the same page everybody else
 * sees, since there is no private profile and nothing private to show (§24.3). Signed out it
 * goes to sign-in. Both answer "who am I here?".
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Server-rendered, no client component, and the active tab comes from a request header.**
 *
 * `usePathname` is a client hook and this bar must not add a bundle. The middleware sets
 * `x-vindeshi-path` on every localised request and this reads it — see `src/middleware.ts`
 * for why that beats threading an `activeTab` prop through fourteen pages.
 *
 * Every tab is a real `<Link>` to a real URL, so the whole bar works with JavaScript disabled,
 * is keyboard reachable in document order, and `aria-current="page"` announces the active one
 * rather than leaving it to a colour. Touch targets are 56px tall, comfortably over the 44px
 * minimum, and the bar carries `env(safe-area-inset-bottom)` so it clears the home indicator
 * on a notched phone rather than sitting under it.
 */
export async function BottomTabs({
  dictionary: t,
  locale,
}: {
  dictionary: Dictionary
  locale: string
}) {
  const viewer = await currentViewer()
  const pathname = (await headers()).get(PATH_HEADER) ?? ''

  const tabs = [
    { id: 'explore', href: `/${locale}/routes`, label: t.nav.explore, icon: <ExploreIcon /> },
    { id: 'journey', href: `/${locale}/journeys`, label: t.nav.myJourney, icon: <JourneyIcon /> },
    {
      id: 'account',
      href:
        viewer === null
          ? `/${locale}/signin`
          : `/${locale}/contributors/${encodeURIComponent(viewer.handle)}`,
      label: viewer === null ? t.auth.signIn : t.nav.account,
      icon: <AccountIcon />,
    },
  ]

  return (
    <nav
      aria-label={t.nav.phoneNavigation}
      /*
       * `md:hidden`, not `lg:hidden`. A tablet has room for the header navigation and gets the
       * two-panel composition beside it; a bar pinned across the bottom of a 768px screen
       * would be taking a whole row of a layout that does not need it.
       */
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {tabs.map((tab) => {
          // Prefix rather than equality: /routes/<slug> and /routes/new are both Explore.
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <li key={tab.id} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-micro ${
                  active ? 'font-semibold text-brand-900' : 'text-ink-500'
                }`}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span className="leading-none">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/*
 * Three marks, drawn here rather than imported.
 *
 * They are fixed navigation furniture — no route data reaches them and they render identically
 * for every destination — which is the case invariant 24 permits without qualification, in the
 * same way as the brand mark. Colour never carries the active state on its own: the label is
 * bold, `aria-current` is set, and the icon is beside a word (§10.4).
 */

/** A compass rose: find your way. */
function ExploreIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" className="shrink-0">
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M13 7 L11 11 L7 13 L9 9 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** A road with a marker on it: the journey, which is a route plus where you are on it. */
function JourneyIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" className="shrink-0">
      <path
        d="M4 17 C 4 12, 10 12, 10 8 C 10 4.5, 13.5 3.5, 16 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="8" r="2.4" fill="currentColor" />
    </svg>
  )
}

/** A person. Deliberately plain — there is no avatar, because there is no photograph (§24.3). */
function AccountIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" className="shrink-0">
      <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4.2 16.5c0-2.9 2.6-4.6 5.8-4.6s5.8 1.7 5.8 4.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
