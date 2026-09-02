import type { LinkTrustClass } from '@/domain/enums'
import { LinkTrustClass as Trust } from '@/domain/enums'

/**
 * External link classification — FR-34, FR-64, FR-65, FR-66, FR-67. Invariants 9 and 10.
 *
 * Pure and synchronous: no network call, no reputation service, no allow-list fetched from
 * anywhere. A link is judged on what its own URL discloses, which is the only thing we can
 * honestly claim to know before the reader clicks.
 *
 * The single property that makes this safe, and the one the tests hold:
 *
 *   **Classification can only ever LOWER trust, never raise it.**
 *
 * A contributor's declared class is a ceiling. Nothing a URL can contain will promote a
 * `community_submitted` link to `trusted`, so a submitted link cannot dress itself up as an
 * official process link merely by looking official (FR-65, FR-66). Quarantine is absolute:
 * a quarantined link is never given an `href` at all (FR-34).
 *
 * The reader always sees the real host before leaving (FR-64, §22.2). That matters most in
 * exactly the case where the raw string lies: `https://embassy.example.de@evil.example.com`
 * reads as an embassy and resolves to `evil.example.com`. `URL` parses it correctly, so the
 * host we print is the host the browser will visit — which is why the host, not the raw
 * string, is the link's visible label.
 */

export type LinkCautionId =
  /** Quarantined by a safety action. Never linked (FR-34). */
  | 'link_quarantined'
  /** Could not be parsed, so we cannot say where it goes. Never linked. */
  | 'unparseable'
  /** A scheme a browser should not follow from here. Never linked. */
  | 'unsupported_scheme'
  /** `http:` rather than `https:`. */
  | 'insecure_scheme'
  /** Credentials before the host — the classic host-spoofing shape. */
  | 'embedded_credentials'
  /** A bare IP address instead of a name. */
  | 'ip_address_host'
  /** Punycode: may be a homograph of a name the reader trusts. */
  | 'punycode_host'
  /** A known URL shortener: the real destination is hidden (FR-65). */
  | 'known_shortener'
  /** Nobody has corroborated this link (invariant 9). */
  | 'not_corroborated'

export interface LinkPresentation {
  /** `null` means: show it, do not make it clickable. */
  readonly href: string | null
  /** The host a browser would actually visit. `null` only when unparseable. */
  readonly host: string | null
  /** The full URL, for a reader who wants to inspect it. Never the primary label. */
  readonly rawUrl: string
  readonly trust: LinkTrustClass
  readonly cautions: readonly LinkCautionId[]
}

/**
 * Low to high. Exported so the monotonicity property can be asserted rather than trusted:
 * `rank(classifyLink(url, declared).trust) <= rank(declared)` for every input.
 */
export const LINK_TRUST_RANK: Readonly<Record<LinkTrustClass, number>> = {
  [Trust.quarantined]: 0,
  [Trust.community_submitted]: 1,
  [Trust.trusted]: 2,
}

/**
 * Hosts whose whole purpose is to hide the destination.
 *
 * Not exhaustive and never will be — which is why it is one of several reasons to withhold
 * trust rather than the only one, and why an unrecognised host is not thereby trusted. The
 * default for anything a contributor submits is `community_submitted`, not `trusted`.
 */
const KNOWN_SHORTENERS: readonly string[] = [
  'bit.ly',
  'buff.ly',
  'cutt.ly',
  'goo.gl',
  'is.gd',
  'lnkd.in',
  'ow.ly',
  'rb.gy',
  'rebrand.ly',
  's.id',
  'shorturl.at',
  't.co',
  't.ly',
  'tiny.cc',
  'tinyurl.com',
]

const HTTPS = 'https:'
const HTTP = 'http:'

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/

function isIpLiteral(hostname: string): boolean {
  // `URL` wraps IPv6 hosts in brackets, which is a reliable marker.
  return IPV4.test(hostname) || hostname.startsWith('[')
}

function isKnownShortener(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return KNOWN_SHORTENERS.some((known) => host === known || host.endsWith(`.${known}`))
}

function lower(a: LinkTrustClass, b: LinkTrustClass): LinkTrustClass {
  return LINK_TRUST_RANK[a] <= LINK_TRUST_RANK[b] ? a : b
}

/**
 * Classify one external URL for display.
 *
 * `declared` is what the platform has recorded about the link — `null` for a link that has
 * never been classified, which is treated as a community submission rather than as an
 * absence of concern. Silence is not endorsement.
 */
export function classifyLink(
  rawUrl: string,
  declared: LinkTrustClass | null = null,
): LinkPresentation {
  const ceiling = declared ?? Trust.community_submitted
  const cautions: LinkCautionId[] = []

  // Quarantine short-circuits everything: no href, whatever else the URL looks like.
  if (ceiling === Trust.quarantined) {
    return {
      href: null,
      host: safeHost(rawUrl),
      rawUrl,
      trust: Trust.quarantined,
      cautions: ['link_quarantined'],
    }
  }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return {
      href: null,
      host: null,
      rawUrl,
      trust: lower(ceiling, Trust.community_submitted),
      cautions: ['unparseable'],
    }
  }

  // Anything that is not plain web traffic is never followed from here — `javascript:`,
  // `data:` and `file:` in particular, which are attacks rather than destinations.
  if (url.protocol !== HTTPS && url.protocol !== HTTP) {
    return {
      href: null,
      host: url.host || null,
      rawUrl,
      trust: lower(ceiling, Trust.community_submitted),
      cautions: ['unsupported_scheme'],
    }
  }

  let trust: LinkTrustClass = ceiling

  if (url.protocol === HTTP) {
    cautions.push('insecure_scheme')
    trust = lower(trust, Trust.community_submitted)
  }
  if (url.username !== '' || url.password !== '') {
    cautions.push('embedded_credentials')
    trust = lower(trust, Trust.community_submitted)
  }
  if (isIpLiteral(url.hostname)) {
    cautions.push('ip_address_host')
    trust = lower(trust, Trust.community_submitted)
  }
  if (url.hostname.includes('xn--')) {
    cautions.push('punycode_host')
    trust = lower(trust, Trust.community_submitted)
  }
  if (isKnownShortener(url.hostname)) {
    cautions.push('known_shortener')
    trust = lower(trust, Trust.community_submitted)
  }

  // Said last so it reads last: an ordinary community link with nothing else wrong with it
  // still has to say that nobody has corroborated it (invariant 9, FR-34).
  if (trust === Trust.community_submitted) {
    cautions.push('not_corroborated')
  }

  return { href: url.toString(), host: url.host, rawUrl, trust, cautions }
}

function safeHost(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).host || null
  } catch {
    return null
  }
}
