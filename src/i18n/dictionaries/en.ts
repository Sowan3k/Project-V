import type {
  FieldApplicability,
  FieldCategory,
  SourceClass,
  RouteLifecycleState,
  RouteMechanism,
  StepCategory,
  StudyLevel,
} from '@/domain/enums'

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

  studyLevel: {
    bachelors: "Bachelor's",
    masters: "Master's",
    phd: 'PhD',
    other: 'Other level',
  } satisfies Record<StudyLevel, string>,

  routeMechanism: {
    direct_admission: 'Direct admission',
    government_scholarship: 'Government scholarship',
    university_scholarship: 'University scholarship',
    other_mechanism: 'Other route type',
  } satisfies Record<RouteMechanism, string>,

  stepCategory: {
    documents_preparation: 'Documents and preparation',
    language_testing: 'Language and testing',
    admission_university: 'Admission and university',
    funding_scholarship: 'Funding and scholarship',
    immigration_visa: 'Immigration and visa',
    travel_departure: 'Travel and departure',
  } satisfies Record<StepCategory, string>,

  landing: {
    headlineBn: 'ভিনদেশী এক্সপ্রেস',
    headline: 'Understand the road before you fly',
    subhead:
      'Compare the ways to reach an overseas study destination, open a route to see every step, and benefit as the community keeps it current.',
    findMyRoute: 'Find my route',
    howItWorks: 'How it works',
    steps: [
      { title: 'Search', body: 'Choose where you are going and what you are studying.' },
      { title: 'Compare', body: 'Each route appears as a ribbon you can compare at a glance.' },
      { title: 'Open', body: 'A ribbon unfolds into a road: every step, in order, with its detail.' },
    ],
  },

  search: {
    title: 'Find a route',
    lede: 'A few filters, not a profile. Nothing here needs an account.',
    origin: 'From',
    destination: 'To',
    studyLevel: 'Study level',
    intake: 'Intake',
    mechanism: 'Route type',
    any: 'Any',
    submit: 'Search routes',
    reset: 'Clear filters',
    resultCount: (n: number) => (n === 1 ? '1 route' : `${n} routes`),
    emptyTitle: 'No routes yet',
    emptyBody:
      'Nothing has been published for these filters. This platform is new and its routes are researched and seeded carefully rather than generated — an empty result is honest, not an error.',
    emptyBodyNoFilters:
      'No routes have been published yet. Routes are researched from official sources and reviewed before they appear here.',
  },

  route: {
    start: 'Start of the route',
    destination: 'Departure',
    stepAdded: 'New',
    stepArchived: 'Archived',
    stepDisrupted: 'Temporary disruption affects this step',
    tabOverview: 'Route',
    tabHistory: 'History',
    tabsLabel: 'Route views',
    selectAStep: 'Select a step to see the information inside it.',
    backToSearch: 'Back to search',
    ribbonLabel: 'Route overview',
    roadLabel: 'The full road',
    steps: 'Steps',
    stepCount: (n: number) => (n === 1 ? '1 step' : `${n} steps`),
    openStep: 'Open this step',
    closeStep: 'Close',
    noSteps: 'This route has no steps yet.',
    noFields: 'No information has been added to this step yet.',
    history: 'Route history',
    viewHistory: 'See what has changed',
    historyEmpty: 'No changes recorded yet.',
    historyLede:
      'Every change is kept. Earlier values are never overwritten, so you can see what a route said before.',
    fieldsIn: (step: string) => `Information in "${step}"`,
    source: 'Source',
    lastConfirmed: 'Last confirmed',
    neverConfirmed: 'Not yet confirmed by anyone',
    fieldCount: (n: number) => (n === 0 ? 'no information yet' : n === 1 ? '1 item' : `${n} items`),
    revisionCount: (n: number) => (n === 1 ? '1 version' : `${n} versions`),
    duration: 'Typical duration',
    days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    startsAfter: (n: number) => `Can start about day ${n}`,
    deadline: 'Deadline',
  },

  flyWindow: {
    label: 'Expected fly window',
    /** Never a date. Wording is deliberate — this is a planning aid, not a promise (BR-18). */
    value: (from: string, to: string) => `Roughly ${from} to ${to}`,
    estimate: 'An estimate from this route’s own timing, not a guarantee.',
    partial: 'Some steps have no timing yet, so the real journey is likely longer.',
    unknown: 'Not enough timing information yet',
    totalDuration: 'Estimated total',
    months: (n: number) => (n === 1 ? 'about 1 month' : `about ${n} months`),
  },

  notPublished: {
    title: 'This route is not available',
    body: 'It may have been archived, merged into another route, or never existed.',
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

  /**
   * Applicability labels — FR-81.
   *
   * Phrased as what changes if the reader changes something, because that is the question a
   * student actually has. "Programme-specific" is accurate but abstract; "applies to this
   * programme only" tells them the requirement does not follow them elsewhere.
   */
  applicability: {
    route_wide: 'Applies to this whole route',
    origin_specific: 'Applies to applicants from this country',
    application_channel: 'Depends on the application channel',
    institution: 'Applies to this university only',
    programme: 'Applies to this programme only',
    intake: 'Depends on the intake',
  } satisfies Record<FieldApplicability, string>,

  /** Silence is not a claim of universality, and must not read like one. */
  applicabilityUnknown: 'Scope not stated',
  applicabilityLabel: 'Applies to',

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
