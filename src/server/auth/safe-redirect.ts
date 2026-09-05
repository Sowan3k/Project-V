import { DEFAULT_LOCALE, LOCALES } from '@/i18n/config'

/**
 * Where a person may be sent after signing in — audit F14.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What was wrong, and why a prefix check could never have been right.**
 *
 * The sign-in page accepted any `?next=` beginning with `/` and rejected only `//`. That is
 * string matching applied to a problem that is not about strings: whether a value is
 * same-origin is decided by a URL parser, and parsers disagree with prefix checks in ways
 * that are exploited rather than theoretical.
 *
 *   `/\evil.example`      a backslash in the authority position is normalised to `/` by
 *                         browsers and by WHATWG URL, so this resolves to
 *                         `https://evil.example` — an off-site redirect that starts with a
 *                         single `/` and passes the old check.
 *   `/\/evil.example`     the same, with the pair split so neither `//` nor a leading `\`
 *                         appears where a naive check looks.
 *   `/%09/evil.example`   leading whitespace and control characters are stripped during
 *                         parsing, moving what follows into the authority.
 *   `/\r\nSet-Cookie: …`  header injection if the value ever reaches a raw `Location`.
 *
 * An open redirect on *this* page is worse than elsewhere. The platform's own safety story is
 * that it shows a reader the real destination host before they leave (FR-64, invariant 10);
 * a sign-in page that hands somebody to an attacker's site immediately after they typed a
 * password into Google borrows exactly the credibility we ask readers to rely on.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **How this decides instead.**
 *
 *   1. Reject anything that is not a plain string, is empty, or carries a control character
 *      or a backslash. These are rejected *before* parsing rather than normalised, because a
 *      value containing them was never a legitimate internal path.
 *   2. Resolve the candidate against the application origin with the WHATWG URL parser — the
 *      same parser the browser will use — and require the result's origin to equal that
 *      origin exactly. Anything that escapes, including every form above, fails here.
 *   3. Require the resulting path to begin with a locale segment this application serves.
 *      A valid same-origin path that is not a page (`/api/auth/signout`, say) is not
 *      somewhere to land a person after signing in.
 *
 * Anything that fails falls back to the locale home. A refused redirect is never an error
 * shown to the user: they asked to sign in, and they are signed in.
 */

/**
 * The origin every candidate is resolved against.
 *
 * `AUTH_URL` is what Auth.js itself uses, so using it here keeps this decision and Auth.js's
 * own agreeing. Where it is unset — a CI build, a unit test, a `next build` with no
 * environment — the sentinel below stands in.
 *
 * The sentinel is not a weakening. Resolution is relative, so *any* fixed origin answers the
 * only question being asked: does this candidate stay where it was resolved, or does it
 * escape? `https://evil.example` escapes both a real origin and this one; `/en/routes` escapes
 * neither. Using a `.invalid` host (RFC 2606, guaranteed never to resolve) means a
 * misconfiguration cannot accidentally name somewhere real.
 */
const SENTINEL_ORIGIN = 'https://vindeshi.invalid'

function applicationOrigin(): string {
  const configured = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  if (configured === undefined || configured.trim() === '') return SENTINEL_ORIGIN
  try {
    return new URL(configured).origin
  } catch {
    return SENTINEL_ORIGIN
  }
}

/**
 * C0 and C1 control characters, plus the backslash.
 *
 * Rejected outright rather than stripped. A leading tab or newline is removed during URL
 * parsing, which silently promotes whatever follows into the authority; a backslash is
 * normalised to `/`, which is how `/\evil.example` becomes an off-site redirect. Both are
 * cheaper to refuse than to reason about, and neither appears in a real internal path.
 */
// eslint-disable-next-line no-control-regex -- refusing control characters is the point
const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f\\]/

function hasServedLocalePrefix(pathname: string): boolean {
  return LOCALES.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))
}

/**
 * True only for a value that resolves to an internal page of this application.
 *
 * `origin` is the origin the candidate is measured against. Auth.js passes its own `baseUrl`,
 * which is how it computes the site's origin including the `AUTH_TRUST_HOST` case where no
 * `AUTH_URL` is configured; the sign-in page passes nothing and gets `applicationOrigin()`.
 * Handing the origin in rather than recomputing it means this and Auth.js can never disagree
 * about where "here" is.
 *
 * Both relative paths and absolute URLs are accepted, because the origin comparison is what
 * decides either way — a prefix rule adds nothing once the parser has spoken, and Auth.js
 * hands this an absolute URL.
 */
export function isInternalPath(candidate: unknown, origin: string = applicationOrigin()): boolean {
  if (typeof candidate !== 'string') return false
  if (candidate.trim() === '' || FORBIDDEN.test(candidate)) return false

  let resolved: URL
  try {
    resolved = new URL(candidate, origin)
  } catch {
    return false
  }

  if (resolved.origin !== origin) return false
  return hasServedLocalePrefix(resolved.pathname)
}

/**
 * The candidate as a same-origin path, or the locale home.
 *
 * `fallbackLocale` is the locale of whoever asked, so a refused redirect still lands somebody
 * where they were rather than at a default they did not choose. A refusal is never surfaced
 * as an error: they asked to sign in, and they are signed in.
 */
export function safeInternalRedirect(
  candidate: unknown,
  fallbackLocale: string = DEFAULT_LOCALE,
  origin: string = applicationOrigin(),
): string {
  if (isInternalPath(candidate, origin)) {
    // Returned from the parser, so what leaves here is exactly what was validated rather
    // than the raw input, which may differ from it.
    const resolved = new URL(candidate as string, origin)
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  }
  const locale = (LOCALES as readonly string[]).includes(fallbackLocale)
    ? fallbackLocale
    : DEFAULT_LOCALE
  return `/${locale}`
}
