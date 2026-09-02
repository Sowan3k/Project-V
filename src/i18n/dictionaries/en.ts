import type {
  FieldApplicability,
  FieldCategory,
  JourneyStepStatus,
  LinkTrustClass,
  SourceClass,
  RouteLifecycleState,
  RouteMechanism,
  StepCategory,
  StudyLevel,
} from '@/domain/enums'
import type { LinkCautionId } from '@/domain/links'
import type { FieldGroupId, FieldSignalId, RouteCautionId } from '@/domain/trust'

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

  sourceClass: {
    official: 'Official source',
    institutional_public: 'Institutional public source',
    community_confirmed: 'Community confirmed',
    community_submission: 'Community submission',
    disputed_under_review: 'Disputed',
  } satisfies Record<SourceClass, string>,


  /**
   * The trust surface — Phase 6.
   *
   * Every label here is deliberately static, with no interpolation. Counts and dates are
   * composed at the render site from labels that already exist, which keeps each map an
   * exhaustive `Record` — so adding a signal in src/domain/trust.ts fails typecheck until
   * every locale has words for it, rather than silently rendering an id to a reader.
   *
   * Wording rules, non-negotiable:
   *   - Nothing claims anything is verified, safe or checked (BR-20, invariant 12).
   *   - A caution says what is true, not what to feel.
   */
  trust: {
    /** Field-level signals. Order of appearance is decided by src/domain/trust.ts. */
    fieldSignal: {
      source_disputed: 'Disputed — under review',
      history_forked: 'Contested — two contributors corrected this from the same starting point',
      unverified_submission: 'Community submission — not corroborated by anyone else',
      past_expiry: 'Past the expiry date given for it',
      not_yet_effective: 'Not in effect yet',
      review_due: 'Due for review',
      narrow_scope: 'Applies only to',
      scope_not_stated: 'Scope not stated',
      changed_recently: 'Changed recently',
      never_confirmed: 'Not yet confirmed by anyone',
    } satisfies Record<FieldSignalId, string>,

    /**
     * Group headings. Official requirements and community experience sit in separate,
     * labelled regions rather than being told apart by a badge colour (FR-54, invariant 11).
     */
    fieldGroup: {
      group_disputed: {
        title: 'Disputed information',
        note: 'Contributors do not agree on this yet. Treat it as unsettled.',
      },
      group_official: {
        title: 'From official and institutional sources',
        note: 'Stated by an authority or an institution. Check the source and the date — rules change.',
      },
      group_community: {
        title: 'From the community',
        note: 'Shared by people who have been through this. Useful, and not an official rule.',
      },
    } satisfies Record<FieldGroupId, { title: string; note: string }>,

    /** Route-level cautions — FR-11, FR-74. */
    routeCaution: {
      lifecycle_not_established: 'This route has not reached established standing yet',
      no_information: 'This route has steps but no information inside them yet',
      disputed_information: 'Some information on this route is disputed or contested',
      information_needs_review: 'Some information is past the review date given for it',
      no_confirmations: 'Nobody has confirmed any of this information yet',
      single_contributor: 'Only one person has worked on this route, so nothing here has been checked by anyone else',
    } satisfies Record<RouteCautionId, string>,

    linkCaution: {
      link_quarantined: 'Quarantined — this link is not opened from here',
      unparseable: 'This address cannot be read, so we cannot tell you where it goes',
      unsupported_scheme: 'Not an ordinary web address — not opened from here',
      insecure_scheme: 'Not a secure (https) address',
      embedded_credentials: 'This address is written to look like one site and goes to another',
      ip_address_host: 'Goes to a numeric address rather than a named site',
      punycode_host: 'This domain name may be imitating another one',
      known_shortener: 'A shortened link — the real destination is hidden',
      not_corroborated: 'Submitted by a community member and not corroborated',
    } satisfies Record<LinkCautionId, string>,

    /**
     * What we recognise about a domain — never a claim about the content behind it. We are
     * not an admission or immigration authority (BR-20).
     */
    linkTrust: {
      trusted: 'Recognised official domain',
      community_submitted: 'Community-submitted link',
      quarantined: 'Quarantined link',
    } satisfies Record<LinkTrustClass, string>,

    cautionLabel: 'Read with care',
    goesTo: 'Goes to',
    fullAddress: 'Full address',
    opensExternally: 'Opens an external site in a new tab',

    passport: {
      title: 'What is known about this route',
      lede: 'Evidence, not a score. Weigh it yourself.',
      readWithCare: 'Read this route with care',
      contributors: (n: number) =>
        n === 0 ? 'No named contributors' : n === 1 ? '1 contributor' : `${n} contributors`,
      information: (n: number) =>
        n === 0 ? 'No information items yet' : n === 1 ? '1 information item' : `${n} information items`,
      confirmed: (n: number) => `${n} confirmed by someone`,
      needsReview: (n: number) => `${n} past their review date`,
      disputed: (n: number) => `${n} disputed or contested`,
      recentChanges: (n: number, days: number) =>
        n === 1 ? `1 change in the last ${days} days` : `${n} changes in the last ${days} days`,
      /**
       * FR-41 and invariant 17, in the wording itself. §26 is explicit that the copy reads
       * "116 users marked this journey completed" and never "116 verified visas" — we do not
       * check, and the sentence must not imply that we did.
       */
      followers: (n: number) =>
        n === 0 ? 'Nobody is following this route yet' : n === 1 ? '1 person is following this route' : `${n} people are following this route`,
      selfReportedCompletions: (n: number) =>
        n === 1
          ? '1 user marked this journey completed'
          : `${n} users marked this journey completed`,
      selfReportedNote: 'Self-reported by followers. Nobody checked, and nobody was asked to prove anything.',
      firstPublished: 'First published',
      lastChanged: 'Last changed',
      lastConfirmed: 'Last confirmed',
      never: 'Never',
      moreDetail: 'What is known about this route',
      /**
       * Invariant 12, said out loud (BR-04, D-19). The most dangerous reading of a clean
       * page is "nothing is flagged, so this is fine". This paragraph exists to deny it.
       */
      noVerificationClaim:
        'Vindeshi Express does not verify routes. Nothing here has been checked by an authority, and the absence of a warning is not evidence that there is nothing wrong. Confirm anything that matters against the official source before you rely on it.',
    },
  },


  /**
   * My Journey — Phase 7. FR-23, FR-24, FR-26, FR-41.
   *
   * The wording carries two guarantees the code cannot: that this is private, and that
   * nothing here is checked by anyone.
   */
  journey: {
    tab: 'My journey',
    title: 'My journey',
    indexTitle: 'My journeys',
    indexLede: 'Routes you are following, and the progress you have recorded on each. Only you can see this.',
    indexEmpty: 'You are not following any routes yet. Open a route and choose “Follow this route” to start one.',
    privateBadge: 'Private to you',
    privateExplainer:
      'Your progress, dates and notes are visible only to you. No other user can see them, and the platform never asks you to upload a document to prove anything.',
    follow: 'Follow this route',
    following: 'You are following this route',
    unfollow: 'Stop following',
    unfollowNote: 'Your notes and dates are kept, and come back if you follow again.',
    resume: 'Follow again',
    resumed: 'Your earlier progress is back.',
    deletePermanently: 'Delete this journey permanently',
    deleteExplainer: 'Erases your progress, dates and notes for this route. This cannot be undone.',
    signInToFollow: 'Sign in to follow this route and track your progress privately.',
    progressTitle: 'Your progress',
    overall: (done: number, total: number) => `${done} of ${total} steps marked done`,
    status: 'Status',
    targetDate: 'Target date',
    actualDate: 'Completed on',
    privateNote: 'Private note',
    privateNotePlaceholder: 'Only you will ever read this.',
    save: 'Save',
    saved: 'Saved',
    markCompleted: 'Mark this journey completed',
    unmarkCompleted: 'Not completed after all',
    completedNote: 'You marked this journey completed. This is your own record — the platform does not verify it.',
    tasksTitle: 'Your own tasks',
    tasksLede: 'Things that matter to you and do not belong in the public route.',
    taskPlaceholder: 'Something to remember',
    addTask: 'Add',
    removeTask: 'Remove',
    noTasks: 'No personal tasks yet.',
    routeChangedNote: 'This route is maintained by the community and may change. Your progress stays as you left it.',
  },

  journeyStepStatus: {
    not_started: 'Not started',
    in_progress: 'In progress',
    completed: 'Completed',
    skipped: 'Skipped',
    not_applicable: 'Not applicable to me',
  } satisfies Record<JourneyStepStatus, string>,

  auth: {
    signIn: 'Sign in',
    signOut: 'Sign out',
    signInTitle: 'Sign in',
    signInLede:
      'You never need an account to read this platform. Signing in lets you contribute corrections and keep a private journey.',
    withGoogle: 'Continue with Google',
    whatWeStore: 'What we keep',
    whatWeStoreBody:
      'Your email address, so we recognise you when you come back. Nothing else — not your name, not your photograph. You appear to other people only as a generated handle.',
    yourHandle: 'Your public handle',
    handleExplainer: 'This is how contributions appear to others. It is not your name.',
    notConfigured:
      'Sign-in is not configured on this deployment yet. Reading works without an account.',
  },

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
