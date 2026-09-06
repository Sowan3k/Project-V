import { NextResponse, type NextRequest } from 'next/server'

import { DEFAULT_LOCALE, LOCALES } from '@/i18n/config'

/**
 * Every page lives under a locale segment, so an unprefixed path is redirected to the
 * default locale. Adding Bangla later means adding it to LOCALES and negotiating here —
 * not restructuring the route tree (CLAUDE.md §4).
 */
/**
 * The header the shell reads to know where it is — Phase 12F.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * A bottom tab bar has to mark the tab you are on, and a Server Component cannot ask for the
 * pathname: `usePathname` is a client hook, and making the shell a client component to light
 * one tab would put a bundle in front of every page in the application to save a request
 * header (CLAUDE.md §12B, "the read path ships one client component").
 *
 * The alternative to this would be threading an `activeTab` prop down from every page, which
 * is the same information written out fourteen times and wrong the first time somebody adds a
 * page and forgets. The middleware already runs on every one of these requests and already
 * knows the answer.
 *
 * It costs nothing in cache terms: the shell renders the signed-in header, which reads
 * cookies, so this tree has never been static.
 */
export const PATH_HEADER = 'x-vindeshi-path'

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )
  if (hasLocale) {
    const headers = new Headers(request.headers)
    headers.set(PATH_HEADER, pathname)
    return NextResponse.next({ request: { headers } })
  }

  const url = request.nextUrl.clone()
  url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|.*\\..*).*)'],
}
