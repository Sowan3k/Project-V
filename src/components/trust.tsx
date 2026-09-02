import { classifyLink } from '@/domain/links'
import type { LinkTrustClass } from '@/domain/enums'
import {
  fieldSignals,
  RECENT_ACTIVITY_WINDOW_DAYS,
  routePassport,
  snapshotCautions,
  type FieldSignal,
  type FieldTrustInput,
  type RoutePassport,
  type RouteTrustInput,
  type RouteTrustSnapshot,
} from '@/domain/trust'
import type { Dictionary } from '@/i18n/dictionaries/en'

/**
 * The trust surface, rendered — Phase 6.
 *
 * FR-10, FR-11, FR-33, FR-34, FR-49, FR-52, FR-53, FR-54, FR-62, FR-64, FR-65, FR-66,
 * FR-67, FR-70, FR-74, FR-81. Invariants 9-17.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * The question this file answers is not "can we show the metadata?" — by now the data
 * carries source class, applicability, freshness, review dates, expiry, revision counts,
 * fork history, lifecycle state, contributor counts and change activity, and showing all of
 * it is easy. The question is **what must a student notice immediately, and what should wait
 * until they ask?**
 *
 * Three levels, and the third is the one that keeps the page readable:
 *
 *   1. **Caution** — an icon, a border and words. Reserved for things that change what the
 *      reader should conclude: disputed, contested, expired, uncorroborated, or scoped
 *      narrower than the route.
 *   2. **Context** — one quiet grey line. Source, last confirmed, version count.
 *   3. **Nothing** — the ordinary case. An official, route-wide, recently confirmed fact
 *      shows its provenance line and no marker at all.
 *
 * Two structural decisions do most of the work of keeping level 1 rare:
 *
 *   **Provenance is a heading, not a badge.** Fields are grouped into "official and
 *   institutional", "from the community" and "disputed" regions. Eleven fields in a step
 *   therefore carry the provenance once, at the top of their group, instead of eleven times
 *   — and the official/community separation FR-54 requires becomes positional, which is
 *   harder to miss and impossible to confuse than two similar-looking chips.
 *
 *   **`route_wide` renders as nothing.** It is what a reader already assumes. Marking it
 *   would put a chip on almost every field and drown the `programme`-scoped one beside it,
 *   which is precisely the confusion FR-81 exists to prevent.
 *
 * Nothing here is a client component: every disclosure is a `<details>`, so the whole trust
 * surface still works with JavaScript disabled, as Phase 5 requires.
 */

/** A small triangle. Decorative: the words beside it carry the meaning (§10.4). */
function CautionIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-caution-500"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 1.6 15 14H1L8 1.6Zm0 4.1a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.7Zm0 6.9a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7Z" />
    </svg>
  )
}

/** One caution: icon plus words, on a tinted row. Never colour alone. */
export function Caution({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs leading-5 text-caution-900">
      <CautionIcon />
      <span>{children}</span>
    </p>
  )
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Field level
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The signals attached to one field — FR-49, FR-52, FR-53, FR-70, FR-81.
 *
 * Cautions first, as a block. Context signals join the quiet provenance line rendered by the
 * caller, so they never compete with the value they describe.
 */
export function FieldSignals({
  input,
  dictionary: t,
  now,
}: {
  input: FieldTrustInput
  dictionary: Dictionary
  now: Date
}) {
  const signals = fieldSignals(input, now)
  const cautions = signals.filter((signal) => signal.weight === 'caution')
  if (cautions.length === 0) return null

  return (
    <div className="mt-2 space-y-1 rounded-md border border-caution-500/40 bg-caution-50 px-2.5 py-2">
      {cautions.map((signal) => (
        <Caution key={signal.id}>{cautionText(signal, t)}</Caution>
      ))}
    </div>
  )
}

function cautionText(signal: FieldSignal, t: Dictionary): string {
  const label = t.trust.fieldSignal[signal.id]
  if (signal.scopes === undefined || signal.scopes.length === 0) return label
  // "Applies only to: this university only · this programme only" — composed from the
  // applicability labels the dictionary already owns, so nothing is interpolated twice.
  return `${label}: ${signal.scopes.map((scope) => t.applicability[scope]).join(' · ')}`
}

/**
 * The quiet line: everything worth knowing that is not worth interrupting for.
 *
 * The **precise** source class leads it. The group heading a field sits under already says
 * official-versus-community, which is what FR-33 asks for — but it cannot distinguish
 * `official` from `institutional_public`, or `community_confirmed` from an uncorroborated
 * submission. Losing that would trade one kind of imprecision for another, so the exact class
 * is stated here, quietly, where it informs without competing with the value above it.
 */
export function FieldContext({
  input,
  dictionary: t,
  now,
}: {
  input: FieldTrustInput
  dictionary: Dictionary
  now: Date
}) {
  const context = fieldSignals(input, now).filter((signal) => signal.weight === 'context')

  const parts: string[] = [
    t.sourceClass[input.sourceClass],
    input.lastConfirmedAt === null
      ? t.route.neverConfirmed
      : `${t.route.lastConfirmed}: ${isoDate(input.lastConfirmedAt)}`,
    t.route.revisionCount(input.revisionCount),
    ...context
      .filter((signal) => signal.id !== 'never_confirmed')
      .map((signal) => t.trust.fieldSignal[signal.id]),
  ]

  return <p className="mt-2 text-xs text-ink-500">{parts.join(' · ')}</p>
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// External links — FR-34, FR-64, FR-65, FR-66, FR-67. Invariants 9 and 10.
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * An external link that always says where it goes.
 *
 * The **host is the link text**, never the contributor's own words and never a bare "apply
 * here" (FR-64, §22.2). For `https://embassy.example.de@evil.example.com` the host is
 * `evil.example.com`, so the label is the destination rather than the disguise.
 *
 * A link that cannot be parsed, uses a scheme a browser should not follow, or has been
 * quarantined is printed as text with no `href` at all — showing it is honest, making it
 * one click away is not (FR-34).
 *
 * Nothing external is ever embedded. There is no iframe, no preview card and no fetched
 * thumbnail anywhere in this application, so unknown content cannot borrow the platform's
 * chrome and look like ours (FR-67, invariant 9).
 */
export function ExternalSourceLink({
  url,
  declaredTrust,
  dictionary: t,
}: {
  url: string
  declaredTrust: LinkTrustClass | null
  dictionary: Dictionary
}) {
  const link = classifyLink(url, declaredTrust)

  return (
    <div className="mt-2">
      <p className="text-xs break-all">
        <span className="text-ink-500">{t.trust.goesTo} </span>
        {link.href === null ? (
          <span className="font-medium text-ink-700">{link.host ?? link.rawUrl}</span>
        ) : (
          <a
            href={link.href}
            rel="nofollow noopener noreferrer external"
            target="_blank"
            className="font-medium text-brand-700 underline underline-offset-2"
          >
            {link.host}
            <span className="sr-only"> — {t.trust.opensExternally}</span>
          </a>
        )}
      </p>

      {link.cautions.length === 0 ? null : (
        <div className="mt-1 space-y-1">
          {link.cautions.map((caution) => (
            <Caution key={caution}>{t.trust.linkCaution[caution]}</Caution>
          ))}
        </div>
      )}

      {/* The full address stays available for anyone who wants to inspect it, one
          disclosure away rather than competing with the host for attention. */}
      {link.host === null ? null : (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-ink-500">{t.trust.fullAddress}</summary>
          <p className="mt-1 text-xs break-all text-ink-500">{link.rawUrl}</p>
        </details>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Route level — FR-10, FR-11, FR-62, FR-74
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The route passport — what is known, as evidence rather than as a score.
 *
 * Cautions are outside the disclosure because they change what a reader should do; the
 * counts and dates are inside it because they are the working. There is no confidence
 * percentage and no freshness percentage: VR-14 shows both, and both are illustrative
 * sample data (CLAUDE.md §8.6). A number implies a precision we do not have.
 *
 * Ends with the sentence invariant 12 exists for. A page with no warnings on it is the most
 * dangerous page we can render, because a reader will read the silence as reassurance.
 */
export function RoutePassportPanel({
  trust,
  dictionary: t,
}: {
  trust: RouteTrustInput
  dictionary: Dictionary
}) {
  const passport = routePassport(trust)

  return (
    <section
      aria-label={t.trust.passport.title}
      className="rounded-xl border border-hairline bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-ink-900">
          {t.routeLifecycle[passport.lifecycleState]}
        </span>
        <span className="text-xs text-ink-500">
          {t.trust.passport.information(passport.informationCount)} ·{' '}
          {t.trust.passport.contributors(passport.contributorCount)}
        </span>
      </div>

      {passport.cautions.length === 0 ? null : (
        <div className="mt-3 space-y-1 rounded-md border border-caution-500/40 bg-caution-50 px-2.5 py-2">
          <p className="text-xs font-medium text-caution-900">{t.trust.passport.readWithCare}</p>
          {passport.cautions.map((caution) => (
            <Caution key={caution}>{t.trust.routeCaution[caution]}</Caution>
          ))}
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-brand-700">
          {t.trust.passport.moreDetail}
        </summary>
        <RoutePassportEvidence passport={passport} dictionary={t} />
      </details>

      <p className="mt-3 border-t border-hairline pt-3 text-xs leading-5 text-ink-500">
        {t.trust.passport.noVerificationClaim}
      </p>
    </section>
  )
}

function RoutePassportEvidence({
  passport,
  dictionary: t,
}: {
  passport: RoutePassport
  dictionary: Dictionary
}) {
  const rows: [string, string][] = [
    [t.trust.passport.firstPublished, isoDate(passport.createdAt)],
    [
      t.trust.passport.lastChanged,
      passport.lastChangedAt === null ? t.trust.passport.never : isoDate(passport.lastChangedAt),
    ],
    [
      t.trust.passport.lastConfirmed,
      passport.lastConfirmedAt === null
        ? t.trust.passport.never
        : isoDate(passport.lastConfirmedAt),
    ],
  ]

  const counts: string[] = [
    t.trust.passport.confirmed(passport.confirmedCount),
    t.trust.passport.disputed(passport.disputedCount),
    t.trust.passport.needsReview(passport.needsReviewCount),
    t.trust.passport.recentChanges(passport.recentChangeCount, RECENT_ACTIVITY_WINDOW_DAYS),
    t.trust.passport.followers(passport.followerCount),
  ]

  return (
    <div className="mt-2 text-xs text-ink-700">
      <p className="text-ink-500">{t.trust.passport.lede}</p>
      <ul className="mt-2 space-y-0.5">
        {counts.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <dl className="mt-2 space-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-1">
            <dt className="text-ink-500">{label}:</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {/* Self-reported completions, worded as self-reported — FR-41, §26, invariant 17.
          "116 users marked this journey completed", never "116 verified visas". The note
          below it is not decoration: without it a count reads as a platform claim. */}
      {passport.selfReportedCompletionCount === 0 ? null : (
        <p className="mt-2">
          {t.trust.passport.selfReportedCompletions(passport.selfReportedCompletionCount)}{' '}
          <span className="text-ink-500">{t.trust.passport.selfReportedNote}</span>
        </p>
      )}
    </div>
  )
}

/**
 * The one-line trust note on a ribbon — FR-74.
 *
 * A search result is a place to decide what to open, not to read a dossier, so this shows
 * the stored maturity and the *number* of things to know rather than listing them. It draws
 * its cautions from `snapshotCautions`, the same function the route passport starts from, so
 * a ribbon can never claim a route is quieter than its own page says.
 */
export function RibbonTrust({
  trust,
  dictionary: t,
}: {
  trust: RouteTrustSnapshot
  dictionary: Dictionary
}) {
  const cautions = snapshotCautions(trust)

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="rounded-full border border-hairline px-2 py-0.5 text-ink-700">
        {t.routeLifecycle[trust.lifecycleState]}
      </span>
      {cautions.length === 0 ? null : (
        <span className="flex items-center gap-1 text-caution-900">
          <CautionIcon />
          {t.trust.cautionLabel}
          <span className="text-ink-500">({cautions.length})</span>
        </span>
      )}
    </span>
  )
}

/** ISO dates everywhere, deliberately: unambiguous, and locale formatting is Phase 12. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
