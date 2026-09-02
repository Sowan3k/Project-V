/**
 * The single source of truth for every domain enumeration in Vindeshi Express.
 *
 * CLAUDE.md §9: "Enums live in one place and are shared by the Prisma schema,
 * TypeScript types and UI labels. Never duplicate a status string literal across files."
 *
 * Nothing else in `src/` may write one of these literals as a quoted string. Two tests
 * enforce that:
 *   - tests/architecture/enum-single-source.test.ts — no enum literal appears as a quoted
 *     string anywhere in `src/` except this file.
 *   - tests/architecture/prisma-enums-generated.test.ts — `prisma/enums.prisma` is generated
 *     from this file and is not stale.
 *
 * Regenerate the Prisma half with `npm run prisma:enums`.
 *
 * Values are deliberately valid Prisma/Postgres enum identifiers, so the TypeScript literal
 * and the database value are the same string with no mapping layer in between.
 */

/** Field categories — FR-51, REQUIREMENTS.md §39.1. */
export const FIELD_CATEGORIES = [
  'requirement',
  'procedure',
  'document',
  'contact',
  'address',
  'link',
  'cost',
  'deadline',
  'duration',
  'community_experience',
  'warning',
] as const
export type FieldCategory = (typeof FIELD_CATEGORIES)[number]

/** Source classes — REQUIREMENTS.md §21. Invariant 11: official and community never merge. */
export const SOURCE_CLASSES = [
  'official',
  'institutional_public',
  'community_confirmed',
  'community_submission',
  'disputed_under_review',
] as const
export type SourceClass = (typeof SOURCE_CLASSES)[number]

/** Route lifecycle states — FR-11, REQUIREMENTS.md §19. Invariant 23. */
export const ROUTE_LIFECYCLE_STATES = [
  'experimental',
  'developing',
  'established',
  'quiet',
  'stale',
  'disputed',
  'dormant',
  'archived',
  'removed',
] as const
export type RouteLifecycleState = (typeof ROUTE_LIFECYCLE_STATES)[number]

/** Change severity — FR-60, REQUIREMENTS.md §41.2. */
export const CHANGE_SEVERITIES = ['informational', 'relevant', 'important', 'critical'] as const
export type ChangeSeverity = (typeof CHANGE_SEVERITIES)[number]

/** Link trust classes — FR-34, REQUIREMENTS.md §22.1. Invariants 9 and 10. */
export const LINK_TRUST_CLASSES = ['trusted', 'community_submitted', 'quarantined'] as const
export type LinkTrustClass = (typeof LINK_TRUST_CLASSES)[number]

/**
 * Challenge reasons — REQUIREMENTS.md §17.4.
 * A challenge says "this may be wrong". Distinct from a report (CLAUDE.md §5).
 */
export const CHALLENGE_REASONS = [
  'obsolete',
  'incorrect',
  'broken_link',
  'wrong_contact_or_address',
  'duplicate_information',
  'unsafe_or_scam',
  'personal_information_or_harassment',
  'other',
] as const
export type ChallengeReason = (typeof CHALLENGE_REASONS)[number]

/**
 * Report reasons — REQUIREMENTS.md §23.1.
 * A report says "this may be dangerous". Reports are structured and textual: there is no
 * attachment path in V1 (CLAUDE.md §8.6, decided 2026-09-02).
 */
export const REPORT_REASONS = [
  'phishing_or_scam',
  'adult_content',
  'malware_or_download',
  'impersonation',
  'harassment_or_personal_information',
  'malicious_contact',
  'spam',
  'other_serious_concern',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

/**
 * The registry the Prisma generator and the architecture tests read.
 * Key = Prisma enum type name. Value = the ordered literal values.
 */
export const DOMAIN_ENUMS = {
  FieldCategory: FIELD_CATEGORIES,
  SourceClass: SOURCE_CLASSES,
  RouteLifecycleState: ROUTE_LIFECYCLE_STATES,
  ChangeSeverity: CHANGE_SEVERITIES,
  LinkTrustClass: LINK_TRUST_CLASSES,
  ChallengeReason: CHALLENGE_REASONS,
  ReportReason: REPORT_REASONS,
} as const satisfies Record<string, readonly string[]>

export type DomainEnumName = keyof typeof DOMAIN_ENUMS
