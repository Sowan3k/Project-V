import type {
  ChallengeReason,
  ChangeSeverity,
  FieldApplicability,
  FieldCategory,
  FollowerChangeStance,
  JourneyStepStatus,
  LinkTrustClass,
  ReportOutcome,
  ReportReason,
  SourceClass,
  RouteChangeKind,
  RouteLifecycleState,
  RouteMechanism,
  StepCategory,
  StudyLevel,
} from '@/domain/enums'
import type {
  ChangeBearing,
  ChangeNote,
  DisruptionBearing,
  StepChangeMark,
} from '@/domain/changes'
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

  /**
   * What a browser tab, a shared link and a search result say — Phase 12.
   *
   * The description is the product's own one-line answer, not the Phase 0 placeholder that
   * stood here until now ("This platform is being built"), which was still being served to
   * every link preview months after the platform stopped being under construction.
   */
  meta: {
    description:
      'Compare the ways to reach an overseas study destination, open a route to understand every step, and privately follow it as your own journey. Community maintained, free, and no document upload.',
    searchTitle: 'Find a route',
    journeysTitle: 'My journeys',
    signInTitle: 'Sign in',
    newRouteTitle: 'Create a route',
    routeChanges: (route: string) => `What has changed — ${route}`,
    routeHistory: (route: string) => `History — ${route}`,
    routeJourney: (route: string) => `My journey — ${route}`,
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
    /**
     * The voluntary support link — CLAUDE.md §10.1.
     *
     * "Support", never "Donate": §10.1 avoids tax-deductible charitable framing, and this is
     * not a purchase prompt either. The sentence after it is not decoration — a reader who
     * suspects that paying buys standing has been told something false about the entire
     * platform, and invariant 13 is the reason the sentence can be made without qualification.
     */
    support: 'Support Vindeshi Express',
    supportOpensExternal: '(opens gumroad.com in a new tab)',
    supportChangesNothing:
      'Optional, external, and it changes nothing: the platform is free, and supporting it affects no route’s ranking, standing or moderation. We never see your payment details.',
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
      open_challenge: 'Challenged — somebody says this needs review, and no correction has been made yet',
      withheld: 'Withheld — this was reported and an administrator has hidden it while it is reviewed',
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
      content_quarantined: 'Something on this route has been reported and withheld while it is reviewed',
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


  /**
   * Report reasons — §23.1, verbatim from the baseline's own list.
   *
   * "Reports should therefore support reasons such as phishing/scam, adult content,
   * malware/download, impersonation, harassment/personal information, malicious contact, spam
   * or other serious concern."
   *
   * Deliberately a different vocabulary from `challengeReason`. A reader choosing between them
   * is choosing between two different claims, and identical wording would make that choice
   * meaningless.
   */
  reportReason: {
    phishing_or_scam: 'Phishing or a scam',
    adult_content: 'Adult content',
    malware_or_download: 'Malware or an unexpected download',
    impersonation: 'Impersonating an official office or person',
    harassment_or_personal_information: 'Harassment, or someone’s private information',
    malicious_contact: 'A contact that is being misused',
    spam: 'Spam',
    other_serious_concern: 'Another serious concern',
  } satisfies Record<ReportReason, string>,

  /**
   * Challenge reasons — §17.4, verbatim from the baseline's own list.
   *
   * A challenge captures a reason rather than acting as a generic dislike button (§16.4).
   */
  challengeReason: {
    obsolete: 'No longer required or out of date',
    incorrect: 'Incorrect',
    broken_link: 'Broken link',
    wrong_contact_or_address: 'Wrong contact or address',
    duplicate_information: 'Duplicate information',
    unsafe_or_scam: 'Unsafe, scam or phishing concern',
    personal_information_or_harassment: 'Personal information or harassment concern',
    other: 'Something else — explained below',
  } satisfies Record<ChallengeReason, string>,

  /**
   * The contribution loop — Phase 8.
   *
   * Wording rules that carry requirements rather than tone:
   *   - Nothing says "submit for review", "pending" or "awaiting approval". Updates go live
   *     and the community corrects afterwards (FR-16, FR-69, §43.1, CLAUDE.md §8.6).
   *   - CONFIRM, UPDATE and CHALLENGE are named as the different things they are (§16).
   *   - No wording implies a community submission carries official standing (invariant 11).
   */
  contribute: {
    signInToContribute: 'Sign in to correct or confirm this',
    confirm: 'Still accurate',
    update: 'Correct this',
    challenge: 'Flag a problem',
    updateExplainer:
      'Your correction goes live immediately. The previous value is kept, and anyone can correct it again — including you.',
    challengeExplainer:
      'This leaves the information as it is and marks it as needing review. Use it when you know something is wrong but not what the right answer is.',
    value: 'Information',
    reason: 'Why are you changing it?',
    reasonHint: 'Optional, but it helps the next reader',
    note: 'What is wrong?',
    noteHint: 'Optional',
    challengeReason: 'Reason',
    saveUpdate: 'Save correction',
    raiseChallenge: 'Flag it',
    sourceClass: 'Who says so?',
    sourceClassHint:
      'Choose “official” only for something an authority actually publishes. Your own experience is community experience, and it is valuable as that.',
    applicability: 'Who does this apply to?',
    applicabilityHint:
      'Leave everything unticked if you are not sure. Silence is honest; a wrong scope is not.',
    sourceUrl: 'Link to the source',
    addField: 'Add information to this step',
    addFieldSubmit: 'Add this information',
    addStep: 'Add a step',
    addStepSubmit: 'Add this step',
    fieldCategory: 'What kind of information?',
    stepLabel: 'What is this step called?',
    stepCategory: 'What kind of step?',
    afterStep: 'Comes after',
    afterStepNone: 'Not connected yet',
    afterStepHint: 'You can connect it later if you are not sure.',
    createRoute: 'Add a missing route',
    createRouteLede:
      'If the way you are going is not here, add it. New routes are published straight away and shown as experimental until the community has worked on them.',
    createRouteNote:
      'Creating a route does not make it yours. Anyone signed in can improve it, including changing what you wrote.',
    routeTitle: 'What is this route called?',
    routeTitleHint: 'Plain language, as a student would say it',
    routeSummary: 'One or two sentences about it',
    from: 'From (2-letter country code)',
    to: 'To (2-letter country code)',
    publish: 'Create this route',
    stillAccurate: 'Was this step still accurate?',
    stillAccurateLede:
      'You have just been through it, so you know better than anyone. This is the most useful moment to say.',
    yesAccurate: 'Yes — everything here was still accurate',
    somethingChanged: 'Something changed',
    somethingChangedHint: 'Opens the step so you can correct or flag the part that is wrong.',
    confirmedCount: (n: number) =>
      n === 0 ? 'Nobody has confirmed this yet' : n === 1 ? '1 person confirms this' : `${n} people confirm this`,
    contributorSince: 'First contributed',
    contributions: (n: number) => (n === 1 ? '1 contribution' : `${n} contributions`),
    contributionsConfirmed: (n: number) => `${n} of them have since been confirmed by others`,
    newContributor: 'New contributor',
    newContributorNote:
      'This account is new here. That is not a mark against it — everyone starts here — but it means the community has not had a chance to check its work yet.',
  },


  /**
   * Safety — Phase 9. FR-35, FR-36, FR-37, §23.
   *
   * Wording rules that carry requirements:
   *   - REPORT and CHALLENGE are named as the different things they are. "Flag a problem"
   *     means the information may be wrong; "Report" means it may be dangerous (§23.1).
   *   - A quarantine notice says what happened and why. Withholding without explanation is
   *     indistinguishable from a platform quietly editing what it shows.
   *   - Nothing claims content has been checked and found safe. An absence of reports means
   *     nothing (invariant 12, BR-04, D-19).
   */
  safety: {
    report: 'Report as unsafe',
    reportExplainer:
      'Use this if something here looks dangerous rather than merely wrong — a phishing link, someone impersonating an office, a private person’s number, adult content or a scam. A person will look at it.',
    reportVsChallenge:
      'If the information is simply out of date or incorrect, use “Flag a problem” instead — it reaches the community faster than a report reaches an administrator.',
    reportReason: 'What is the concern?',
    reportDetail: 'What did you see?',
    reportDetailHint: 'Optional. Text only — please do not paste anything private.',
    submitReport: 'Send this report',
    reportSent: 'Reported. An administrator will look at this.',
    reportPrivate:
      'Reports are not shown publicly. What appears on the route is only the outcome — whether the content is withheld.',
    quarantinedTitle: 'Withheld pending review',
    quarantinedBody:
      'This information was reported and an administrator has hidden it while it is checked. It has not been deleted: it is still in this route’s history, and it can be restored.',
    quarantinedNoReason: 'No reason was recorded.',
    quarantineNote: 'Reason given',
    /** §42.5: containment, not a guarantee. Never claim the rest of the page has been vetted. */
    quarantineNotAGuarantee:
      'Withholding one item is containment, not a safety check of everything else on this route. Nothing on this route has been checked by Vindeshi Express.',
  },


  reportOutcome: {
    no_action_needed: 'Looked at — nothing needed changing',
    content_corrected: 'Corrected',
    content_archived: 'Archived — removed from view, kept in history',
    content_removed: 'Removed permanently',
    quarantine_upheld: 'Left withheld',
  } satisfies Record<ReportOutcome, string>,

  /**
   * The administrator's queue — §23.2, §23.3.
   *
   * Wording rules that carry requirements:
   *   - Nothing here recommends an action or ranks by severity. Raw counts must never decide
   *     (FR-71, invariant 14), and the thresholds that would be needed are open (§11).
   *   - "Archived" and "removed" are named as the different things they are: one is
   *     reversible and stays in history, the other is permanent and reserved for abuse,
   *     legal and safety cases (FR-45, BR-15, invariant 4).
   */
  admin: {
    title: 'Reported content',
    lede: 'Content that people have reported as unsafe, and what is known about each report.',
    noRecommendation:
      'This list is not ranked and suggests nothing. It shows what was reported, by how many different people, and when — the judgement is yours.',
    empty: 'Nothing has been reported.',
    evidence: 'What is known',
    actions: 'What you can do',
    openReports: (n: number) => (n === 1 ? '1 open report' : `${n} open reports`),
    distinctReporters: (n: number) =>
      n === 1 ? 'from 1 person' : `from ${n} different people`,
    firstReported: 'First reported',
    lastReported: 'Most recent report',
    quarantine: 'Withhold this while it is reviewed',
    quarantineReason: 'Reason to show readers',
    quarantineReasonHint:
      'A reader will see this. Withholding something without saying why reads as censorship.',
    release: 'Restore it',
    quarantineIsNotDeletion:
      'Withholding hides a value from current views. It deletes nothing — the field, its revisions and its history are untouched, and restoring it is one action.',
    outcome: 'What did you decide?',
    outcomeNote: 'Why (kept with the decision)',
    recordDecision: 'Record this decision',
    roleScope:
      'This role exists for safety, disputes, abuse and exceptional cases. Ordinary contributions are not reviewed here and never need approval — they go live when they are made, and the community corrects them.',

    // ── Phase 11: route maintenance (FR-46, §19.2) ──────────────────────────────
    routesTitle: 'Route maintenance',
    routesLede:
      'The periodic review: archive obsolete routes, merge duplicates, and set standing where the record cannot decide it.',
    routesDirection:
      'Automatic transitions can only lower a route’s prominence or ask for a review. Raising a route’s standing is a judgement, so it happens here and is recorded with your name against it.',
    duplicatesTitle: 'Duplicate flags',
    duplicatesEmpty: 'No open duplicate flags.',
    duplicatesOldestFirst:
      'Oldest first. Nothing here is ranked by how many people flagged it — two routes are the same journey or they are not, and no number of flags settles that.',
    mergeInto: 'Merge into',
    mergeSubmit: 'Merge',
    mergeNote: 'Why (kept with the decision)',
    mergeExplainer:
      'The duplicate keeps every step, field, revision and follower it has. It leaves search and sends readers to the surviving route. Nothing is copied, moved or deleted, and the merge can be undone.',
    unmergeSubmit: 'Undo this merge',
    notDuplicate: 'They are different journeys',
    setState: 'Set standing',
    stateNote: 'Why (kept with the decision)',
    runReview: 'Run the periodic review',
    runReviewHint:
      'Applies what each route’s own record proposes — dormancy for unused new routes, staleness where information is overdue, quiet where nothing has happened lately. It never promotes a route and never archives one.',
    reviewedNone: 'Nothing needed changing.',
    reviewedCount: (n: number) =>
      n === 1 ? '1 route changed standing' : `${n} routes changed standing`,
  },

  /**
   * Change propagation, shadow route and disruptions — Phase 10.
   *
   * Wording rules specific to this section:
   *   - A change **never** tells somebody their completed step is wrong. It says what changed
   *     and when it took effect, and lets them judge (FR-30, BR-17, §41.3).
   *   - Severity words read as meaning-to-the-reader, which is how §41.2 defines them, rather
   *     than as an alarm scale.
   *   - Nothing here promises an alert, a notification or a subscription. In-product
   *     visibility is the first-release mechanism (CLAUDE.md §8.6, §35).
   */
  changes: {
    tab: 'Changes',
    title: 'What has changed',
    lede: 'How this route has changed over time, and where. Contributors maintain it, so it moves.',
    nothingYet: 'Nothing has changed on this route yet.',
    nothingYetHint:
      'This route has had only one state so far. That is normal for a new route and is not a sign of quality either way.',
    since: 'Comparing with',
    sinceYouStarted: 'The route when you started',
    sinceLastChange: 'The route before the most recent change',
    currentRoute: 'The route now',
    asOf: (date: string) => `as it stood on ${date}`,
    today: 'today',

    summaryTitle: 'Scale of change',
    stepsAdded: (n: number) => `${n} ${n === 1 ? 'step' : 'steps'} added`,
    stepsArchived: (n: number) => `${n} ${n === 1 ? 'step' : 'steps'} archived`,
    stepsReordered: (n: number) => `${n} ${n === 1 ? 'step' : 'steps'} reordered`,
    stepsRelabelled: (n: number) => `${n} ${n === 1 ? 'step' : 'steps'} renamed`,
    stepsRetimed: (n: number) => `${n} ${n === 1 ? 'step' : 'steps'} retimed`,
    fieldsChanged: (n: number) =>
      `${n} ${n === 1 ? 'information element' : 'information elements'} changed`,
    stepsUnchanged: (n: number) => `${n} unchanged`,
    archivedIsNotDeleted:
      'Archived steps leave the current route and stay in its history. Nothing is deleted.',

    mark: {
      step_added: 'Added',
      step_archived: 'Archived',
      step_reordered: 'Moved',
      step_relabelled: 'Renamed',
      step_retimed: 'Timing changed',
    } satisfies Record<StepChangeMark, string>,
    noChangeRow: 'No change',
    notPresentThen: 'Was not part of the route then',
    notPresentNow: 'No longer part of the route',

    announcedTitle: 'Announced changes',
    announcedLede:
      'Changes a contributor thought followers should know about, with how much it matters and when it starts to apply. A change nobody announced still appears in the comparison above.',
    noAnnouncements: 'No changes have been announced on this route.',
    announcedOn: 'Recorded',
    effectiveFrom: 'Takes effect',
    effectiveUnknown: 'No start date given',
    effectiveExplainer:
      'Where a change has a start date, it is the start date that decides whether it affects what you have already done — not the date somebody typed it here.',
    concerns: 'Concerns',
    wholeRoute: 'The whole route',
    announcedBy: 'Recorded by',

    kind: {
      structural: 'Route structure',
      field_correction: 'Information corrected',
    } satisfies Record<RouteChangeKind, string>,

    severity: {
      informational: 'Information',
      relevant: 'May affect planning',
      important: 'May need action',
      critical: 'Could disrupt your path',
    } satisfies Record<ChangeSeverity, string>,
    severityExplainer:
      'Set by the contributor who recorded the change, describing what it means for someone following this route. It is a judgement, not a measurement.',

    bearing: {
      not_following: 'About this route',
      ahead: 'Ahead of you',
      underway: 'On the step you are working on',
      completed_before_effective: 'Came after you finished this step',
      already_done: 'On a step you have finished',
      set_aside: 'On a step you set aside',
      whole_route: 'Affects the whole route',
    } satisfies Record<ChangeBearing, string>,

    note: {
      not_yet_effective: 'Not in force yet — it starts on the date shown.',
      effective_after_your_date:
        'This took effect after the date you recorded, so what you did still stands.',
      completion_preserved: 'Your record of finishing this step is unchanged.',
      scope_narrower_than_route:
        'This concerns information that does not apply to everyone on this route, so it may not apply to you.',
      shape_changed: 'This changes the shape of the route, so later steps may have moved.',
      you_marked_this: 'You have already said what this means for you.',
    } satisfies Record<ChangeNote, string>,

    yourPositionTitle: 'How this affects you',
    needsAttention: (n: number) =>
      n === 0
        ? 'Nothing here is waiting on you.'
        : `${n} ${n === 1 ? 'change needs' : 'changes need'} a look`,
    startedFollowing: (date: string) => `You started following this route on ${date}.`,
    progressUntouched:
      'Nothing on this page has changed your progress. Your completed steps, dates, tasks and notes are exactly as you left them.',

    stanceQuestion: 'Does this apply to your case?',
    stanceHint:
      'Only you can tell. We do not know which university, programme or intake you applied for, and we do not ask.',
    stance: {
      applies: 'Yes, this applies to me',
      already_handled: 'I have already handled this',
      not_applicable: 'This does not apply to me',
    } satisfies Record<FollowerChangeStance, string>,
    stanceSaved: 'Saved. Only you can see this.',
    stanceClear: 'Change my answer',

    exactlyWhatChanged: 'Exactly what this change did',
    exactlyWhatChangedHint:
      'Reconstructed from the edit this announcement is linked to, not from dates. It reads the same today and in five years, because the stored history cannot be altered.',
    noLinkedEdit: 'This announcement is not linked to a specific edit, so there is no before and after to show.',
    valueBefore: 'Before',
    valueAfter: 'After',
    valueAdded: 'Added — there was nothing here before',

    disruptionsTitle: 'Temporary disruptions',
    disruptionsLede:
      'Short-term interruptions — a closure, a strike, a suspended service. These sit on top of the route and expire on their own. They never change the route itself.',
    noDisruptions: 'No temporary disruptions are recorded on this route.',
    activeNow: 'Happening now',
    disruptionEnded: 'Ended',
    disruptionUpcoming: 'Starts later',
    disruptionResolved: 'Resolved early',
    disruptionWindow: (from: string, to: string) => `${from} to ${to}`,
    disruptionOpenEnded: (from: string) => `From ${from}, no end date given`,
    disruptionWhere: 'Where',
    disruptionAffects: 'Affects',
    disruptionEverywhere: 'Not limited to one place',
    daysLeft: (n: number) => (n === 1 ? '1 more day' : `${n} more days`),
    disruptionNotARouteChange:
      'This is a temporary condition, not a change to the route. When it ends it stops showing here and the route is exactly as it was.',
    disruptionBearing: {
      inactive: 'Not in effect',
      active: 'In effect now',
      affects_your_next_steps: 'Touches a step you have not finished',
      affects_your_planned_date: 'Overlaps the date you planned for this step',
      already_past_it: 'On a step you have finished',
    } satisfies Record<DisruptionBearing, string>,

    recordTitle: 'Record a change or a disruption',
    recordLede:
      'Anyone signed in can do this. There is no approval queue — it goes live when you record it, and the community corrects it afterwards.',
    announceHeading: 'Announce a permanent change',
    announceHint:
      'Use this when the route itself has changed for good — a new requirement, a corrected fee, a step that no longer applies.',
    disruptHeading: 'Record a temporary disruption',
    disruptHint:
      'Use this for something that will pass — a closure, a flood, a suspended appointment system. It expires on its own and leaves the route alone.',
    fieldTitle: 'What happened',
    fieldDetail: 'Anything a follower should understand',
    fieldSeverity: 'What does this mean for someone following this route?',
    fieldKind: 'What kind of change',
    fieldStep: 'Which step (optional)',
    fieldEffective: 'When does it start to apply? (optional)',
    fieldDescribes: 'Which edit does this describe? (optional)',
    fieldDescribesHint:
      'Linking the edit lets anyone see exactly what changed, now and years from now. Left blank, the announcement still appears — it just cannot show a before and after.',
    describesNone: 'Not linked to a specific edit',
    describesKind: {
      step: 'Step',
      edge: 'Connection',
      field: 'Information',
      route: 'Route details',
    },
    fieldStarts: 'Starts',
    fieldEnds: 'Ends (optional)',
    fieldLocation: 'Where it applies (optional)',
    locationPlaceholder: 'Dhaka, Bangladesh',
    submitAnnounce: 'Record this change',
    submitDisrupt: 'Record this disruption',
    resolveDisruption: 'It has ended',
    signInToRecord: 'Sign in to record a change or a disruption.',
    noAlerts:
      'We do not send emails or push notifications. Changes appear here and on your journey when you next look.',
  },

  /**
   * Lifecycle, duplicates and merge — Phase 11.
   *
   * The wording rule that governs this whole section: **silence is not a defect.** FR-39 and
   * BR-10 are explicit that an established route does not become false because nothing has
   * happened for a while, so nothing here says or implies that it has. A quiet route states
   * when it was last confirmed and stops.
   */
  lifecycle: {
    /**
     * **Quiet describes activity. It says nothing about accuracy, and must not.**
     *
     * Two rounds of correction got here, and the second is the important one.
     *
     * The first draft opened "Nothing has changed on this route recently", which a skimmer
     * reads as neglect. That was replaced with "no one has needed to change this route
     * recently" — which reads better and is **not something the platform knows**. The absence
     * of recorded changes does not establish that no change was needed; a route can be badly
     * out of date precisely because nobody has looked at it. That wording quietly turned an
     * activity record into a claim about correctness, which is the one thing this state must
     * never do.
     *
     * So the sentence is now strictly evidential: what was recorded, and nothing inferred
     * from it. The three examples deliberately include the unfavourable one — an overlooked
     * route looks identical from here — because listing only the benign readings is a way of
     * implying confidence without claiming it.
     *
     * It ends by pointing at the last-confirmed date, which is FR-39's own remedy and which
     * the passport shows outside its disclosure for exactly this state.
     */
    quietExplainer:
      'No recent changes have been recorded for this route. That describes its activity, not its accuracy — a settled process, a seasonal intake and an overlooked route can all look the same from here. Its last confirmation date is shown with its standing.',
    dormantExplainer:
      'No followers, confirmations or edits have been recorded for this route since it was created. It has been set aside so it does not crowd routes people are using. Nothing has been deleted, and it returns the moment anyone uses it.',
    staleExplainer:
      'Some information on this route has passed a review or expiry date that a contributor set for it. That is a request to check, not a claim that it is wrong.',
    archivedExplainer:
      'An administrator archived this route. It is no longer offered in search, and everything it contains stays readable here.',

    mergedTitle: 'This route has been merged',
    mergedBody: (title: string) =>
      `The community now maintains this journey as “${title}”. Everything here stays readable, and if you are following this route your progress is untouched.`,
    mergedGoTo: 'Open the current route',
    mergedNothingLost:
      'Nothing was moved or deleted. Both routes keep their own steps, information, history and followers.',
    mergedFromTitle: 'Routes merged into this one',

    historyTitle: 'Standing over time',
    historyLede:
      'How this route’s standing has changed, and why. Automatic changes have no author; an administrator’s do.',
    historyEmpty: 'This route’s standing has not changed since it was created.',
    historyAutomatic: 'Automatic',
    reason: {
      unused_since_creation: 'Created, then unused for 30 days',
      activity_resumed: 'Activity resumed',
      no_recent_activity: 'No recent activity',
      review_overdue: 'Information is due for review',
      review_caught_up: 'No information is overdue any more',
      administrative: 'An administrator decided',
    },

    flagDuplicate: 'Flag as a duplicate',
    flagDuplicateHint:
      'Use this when another route describes the same journey. Two routes can legitimately look similar and still be different — a different funding route, entrance exam or embassy process makes a genuinely different journey — so an administrator compares them rather than a count deciding.',
    flagDuplicateOf: 'Which route does it duplicate?',
    flagDuplicateNote: 'What makes you think they are the same journey?',
    flagDuplicateSubmit: 'Send for comparison',
    flagDuplicateSaved: 'Sent. An administrator will compare the two.',
    signInToFlag: 'Sign in to flag a duplicate.',
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
