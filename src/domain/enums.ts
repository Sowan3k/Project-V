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
 * How widely a claim applies — FR-81, D-47.
 *
 * Separate from `SourceClass` and deliberately so: source class says **who asserts** a fact,
 * applicability says **whom it applies to**. Every combination occurs — an official fact can be
 * route-wide (a blocked-account amount) or apply to a single programme (a GRE percentile), and
 * both are equally official.
 *
 * Established by Bangladesh → Germany research: presented side by side with no applicability,
 * "€11,904 blocked account" and "GRE required" read as if Germany demanded both. It demands one.
 *
 * A claim may carry more than one of these — a deadline can be both programme-specific and
 * intake-specific — so this is stored as a set, not a single value.
 *
 * These are labels, not rules. Nothing here evaluates whether a fact applies to a given reader;
 * it states the dimension along which the fact varies, so the reader can see what follows them
 * if they change university, channel or intake.
 */
export const FIELD_APPLICABILITIES = [
  /** True for everyone on this route, whatever they choose within it. */
  'route_wide',
  /** Depends on the applicant's origin country — typically mission or embassy rules. */
  'origin_specific',
  /** Depends on which application channel is used, e.g. uni-assist versus direct. */
  'application_channel',
  /** Depends on the university. */
  'institution',
  /** Depends on the individual programme. */
  'programme',
  /** Depends on the intake or semester. */
  'intake',
] as const
export type FieldApplicability = (typeof FIELD_APPLICABILITIES)[number]

/**
 * What a follower may record about one step of their own journey — FR-24, §12.1.
 *
 * These five are the baseline's own list, verbatim: "not started, in progress, completed,
 * skipped or not applicable". `skipped` and `not_applicable` are distinct on purpose — a step
 * a student chose not to do and a step that never applied to them are different facts, and
 * collapsing them would lose the difference for no gain.
 *
 * Private state. Never revisioned, never visible to another ordinary user (FR-26, BR-16,
 * D-10, invariant 5), and never evidence of anything: the platform does not verify that a
 * student did what they say they did, and does not ask them to prove it (FR-25, §12.2).
 */
export const JOURNEY_STEP_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
  'skipped',
  'not_applicable',
] as const
export type JourneyStepStatus = (typeof JOURNEY_STEP_STATUSES)[number]

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
 * What a signed-in person may do — §22, §23.3.
 *
 * Two roles, and the baseline is explicit about the shape: "The administrator should not be
 * expected to approve every normal contribution. Manual intervention is primarily for safety,
 * disputes, abuse, annual maintenance and exceptional cases."
 *
 * So `admin` is a **safety** role, not an editorial one. It gates quarantine and report
 * handling and nothing else — there is no approval queue for it to sit at the head of, and
 * ordinary contribution is deliberately outside its reach (FR-16, FR-69, §43.1).
 */
export const USER_ROLES = ['member', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

/**
 * How an administrator answered a report — §23.2.
 *
 * "The administrator can then restore, correct, archive or remove the item." These are those
 * four, plus the case the baseline implies but does not name: a report that was looked at and
 * found to need nothing.
 *
 * `removed` is the only permanent deletion anywhere in this product, and it is reserved for
 * abuse, legal and safety cases (FR-45, BR-15, invariant 4). It is a recorded decision by a
 * named person, not a cleanup.
 */
export const REPORT_OUTCOMES = [
  'no_action_needed',
  'content_corrected',
  'content_archived',
  'content_removed',
  'quarantine_upheld',
] as const
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number]

/**
 * Study levels — FR-01, REQUIREMENTS.md §9.
 * The baseline names three explicitly and allows "another supported higher-education
 * level". `other` is that escape hatch; inventing `diploma`/`foundation` would be
 * extrapolating beyond the frozen baseline.
 */
export const STUDY_LEVELS = ['bachelors', 'masters', 'phd', 'other'] as const
export type StudyLevel = (typeof STUDY_LEVELS)[number]

/**
 * Route mechanism — the optional "funding / route mechanism" filter, REQUIREMENTS.md §9.
 * What makes two routes for the same origin and destination materially different (§40.1).
 */
export const ROUTE_MECHANISMS = [
  'direct_admission',
  'government_scholarship',
  'university_scholarship',
  'other_mechanism',
] as const
export type RouteMechanism = (typeof ROUTE_MECHANISMS)[number]

/**
 * How one step leads to another — FR-57, D-37, REQUIREMENTS.md §40.3.
 *
 * This is the enum that makes CLAUDE.md invariant 22 enforceable: ordering lives in typed
 * edges, so a route is a graph and never a list with an index.
 */
export const STEP_EDGE_KINDS = ['sequential', 'optional_branch', 'alternative', 'rejoin'] as const
export type StepEdgeKind = (typeof STEP_EDGE_KINDS)[number]

/**
 * Semantic step categories — CLAUDE.md §7, §8.5, REQUIREMENTS.md §10.4.
 *
 * Deliberately distinct strings from FIELD_CATEGORIES: a step is a stage of the journey,
 * a field is one piece of information inside it, and the two vocabularies must not blur.
 * Colour is never the only carrier of this meaning — it always pairs with text and an icon.
 */
export const STEP_CATEGORIES = [
  'documents_preparation',
  'language_testing',
  'admission_university',
  'funding_scholarship',
  'immigration_visa',
  'travel_departure',
] as const
export type StepCategory = (typeof STEP_CATEGORIES)[number]

/**
 * Builds a value map from a literal array, so code can compare against an enum value
 * without writing the literal.
 *
 * This is what makes the single-source rule livable rather than merely enforced. Without it
 * the only way to write `kind === 'rejoin'` is to hardcode the literal, the architecture
 * test fails, and the pressure is on the test rather than on the code. With it, the correct
 * form is `kind === StepEdgeKind.rejoin` — typed, refactorable, and impossible to misspell.
 */
function valueMap<const T extends readonly string[]>(values: T): { readonly [K in T[number]]: K } {
  return Object.fromEntries(values.map((v) => [v, v])) as { readonly [K in T[number]]: K }
}

export const StudyLevel = valueMap(STUDY_LEVELS)
export const RouteMechanism = valueMap(ROUTE_MECHANISMS)
export const StepEdgeKind = valueMap(STEP_EDGE_KINDS)
export const StepCategory = valueMap(STEP_CATEGORIES)
export const FieldCategory = valueMap(FIELD_CATEGORIES)
export const SourceClass = valueMap(SOURCE_CLASSES)
export const RouteLifecycleState = valueMap(ROUTE_LIFECYCLE_STATES)
export const ChangeSeverity = valueMap(CHANGE_SEVERITIES)
export const LinkTrustClass = valueMap(LINK_TRUST_CLASSES)
export const FieldApplicability = valueMap(FIELD_APPLICABILITIES)
export const JourneyStepStatus = valueMap(JOURNEY_STEP_STATUSES)
export const UserRole = valueMap(USER_ROLES)
export const ReportOutcome = valueMap(REPORT_OUTCOMES)
export const ChallengeReason = valueMap(CHALLENGE_REASONS)
export const ReportReason = valueMap(REPORT_REASONS)

/**
 * The registry the Prisma generator and the architecture tests read.
 * Key = Prisma enum type name. Value = the ordered literal values.
 */
export const DOMAIN_ENUMS = {
  StudyLevel: STUDY_LEVELS,
  RouteMechanism: ROUTE_MECHANISMS,
  StepEdgeKind: STEP_EDGE_KINDS,
  StepCategory: STEP_CATEGORIES,
  FieldCategory: FIELD_CATEGORIES,
  SourceClass: SOURCE_CLASSES,
  RouteLifecycleState: ROUTE_LIFECYCLE_STATES,
  ChangeSeverity: CHANGE_SEVERITIES,
  LinkTrustClass: LINK_TRUST_CLASSES,
  FieldApplicability: FIELD_APPLICABILITIES,
  JourneyStepStatus: JOURNEY_STEP_STATUSES,
  UserRole: USER_ROLES,
  ReportOutcome: REPORT_OUTCOMES,
  ChallengeReason: CHALLENGE_REASONS,
  ReportReason: REPORT_REASONS,
} as const satisfies Record<string, readonly string[]>

export type DomainEnumName = keyof typeof DOMAIN_ENUMS
