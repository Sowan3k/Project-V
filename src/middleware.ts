import { NextResponse, type NextRequest } from 'next/server'

import { DEFAULT_LOCALE, LOCALES } from '@/i18n/config'

/**
 * Every page lives under a locale segment, so an unprefixed path is redirected to the
 * default locale. Adding Bangla later means adding it to LOCALES and negotiating here —
 * not restructuring the route tree (CLAUDE.md §4).
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )
  if (hasLocale) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|.*\\..*).*)'],
}
