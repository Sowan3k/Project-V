import type { FieldCategory, SourceClass, RouteLifecycleState } from '@/domain/enums'

/**
 * English interface strings.
 *
 * Wording rules that are not negotiable here:
 *   - No "verified" claim anywhere. We are not an admission or immigration authority
 *     (CLAUDE.md §8.6, BR-20). Sources, freshness and maturity only.
 *   - Estimates read as estimates (invariant 16).
 *   - Self-reported aggregates say so (invariant 17).
 *
 * Enum label maps are typed as exhaustive Records, so adding an enum value in
 * src/domain/enums.ts fails typecheck until every locale supplies a label. Their keys are
 * intentionally unquoted — see the note in tests/architecture/enum-single-source.test.ts.
 */
export const en = {
  brand: {
    /** Bengali brand identity, English interface (CLAUDE.md §4). */
    nameBn: 'ভিনদেশী এক্সপ্রেস',
    nameEn: 'Vindeshi Express',
    /** Working candidate, not a frozen name — D-32, CLAUDE.md §11. */
    nameIsProvisional: true,
    tagline: 'Community-maintained routes for studying abroad',
  },

  common: {
    skipToContent: 'Skip to content',
    loading: 'Loading',
  },

  shell: {
    /**
     * Phase 0 is a foundation spine, not a product surface. The landing page, search and
     * ribbons arrive in Phase 5 (Phases.md). This page says exactly that.
     */
    underConstructionTitle: 'This platform is being built',
    underConstructionBody:
      'Vindeshi Express will let you compare the ways to reach an overseas study destination, open a route to understand every step, and privately follow it as your own journey.',
    underConstructionNote: 'Nothing here is a route yet. There is no content to rely on.',
  },

  principles: {
    free: 'Free to use',
    communityMaintained: 'Community maintained',
    noDocumentUpload: 'No document upload',
    noAccountNeededToRead: 'No account needed to read',
  },

  notFound: {
    title: 'That page does not exist',
    body: 'The address you followed does not match anything on this platform.',
  },

  footer: {
    publicGood: 'A public good, not a business.',
    notAnAgency:
      'Vindeshi Express is not an education agency, consultancy or application service.',
  },

  fieldCategory: {
    requirement: 'Requirement',
    procedure: 'Procedure',
    document: 'Document',
    contact: 'Contact',
    address: 'Address or location',
    link: 'Link or source',
    cost: 'Cost or fee',
    deadline: 'Deadline or date',
    duration: 'Duration or waiting time',
    community_experience: 'Community experience',
    warning: 'Warning or dependency',
  } satisfies Record<FieldCategory, string>,

  sourceClass: {
    official: 'Official source',
    institutional_public: 'Institutional public source',
    community_confirmed: 'Community confirmed',
    community_submission: 'Community submission — unverified',
    disputed_under_review: 'Disputed — under review',
  } satisfies Record<SourceClass, string>,

  routeLifecycle: {
    experimental: 'Experimental',
    developing: 'Developing',
    established: 'Established',
    quiet: 'Quiet',
    stale: 'Needs review',
    disputed: 'Disputed',
    dormant: 'Dormant',
    archived: 'Archived',
    removed: 'Removed',
  } satisfies Record<RouteLifecycleState, string>,
} as const

export type Dictionary = typeof en
