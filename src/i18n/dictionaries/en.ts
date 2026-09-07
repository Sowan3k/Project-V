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
  StepEdgeKind,
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
    /** Accessible names for the landmarks a screen-reader user navigates between. */
    primaryNavigation: 'Primary',
    breadcrumb: 'Breadcrumb',
  },

  /**
   * Primary navigation — Phase 12B.
   *
   * Two items, because two pages exist. VR-01, VR-03 and VR-04 show five; three of them
   * (Updates, Community, Resources) are pages this product does not have, and a nav link to
   * a page that does not exist is worse than an absent one. The mockups are binding on
   * arrangement, not on inventory.
   */
  nav: {
    home: 'Home',
    howItWorks: 'How this works',
    routes: 'Routes',
    myJourney: 'My Journey',
    /**
     * Shown only to an administrator — Phase 12E, audit F12.
     *
     * "Moderation", not "Admin": §23.3 confines the role to safety, disputes, abuse and
     * annual maintenance, and there is deliberately no approval queue for it to sit at the
     * head of. "Admin" would suggest it runs the platform; it does not, and ordinary
     * contribution is outside its reach entirely.
     */
    moderation: 'Moderation',

    // ── The phone's bottom bar — Phase 12F, VR-12 and VR-13 ──────────────────────
    //
    // "Explore" rather than "Routes", which is the mockups' own word for this tab and the
    // better one on a phone: the header link names the noun you are going to, the bottom tab
    // names what you are about to do.
    //
    // There is no "Updates" tab. VR-12 draws four, and the fourth would need a cross-route
    // updates feed, which is out of scope (§35) and would be a change request — a tab leading
    // nowhere is worse than an absent one, which is the argument this header already made
    // about VR-01's five desktop items.
    explore: 'Explore',
    account: 'Account',
    phoneNavigation: 'Main sections',
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

  /**
   * The four kinds of connection between stages — Phase 12E, FR-57, D-37, §40.3.
   *
   * ═══════════════════════════════════════════════════════════════════════════════════════
   * **These words are the feature.** The schema calls them `sequential`, `optional_branch`,
   * `alternative` and `rejoin`, which is exactly right for the schema and useless to the
   * person maintaining a route. A student who knows the APS certificate must be done before
   * the visa appointment, and that a blocked account and a scholarship letter are two ways of
   * proving finance, is describing `sequential` and `alternative` — and would never find them
   * under those names.
   *
   * Each carries an explainer because these are genuinely different claims about the world,
   * and choosing the wrong one changes what the road tells the next reader. The explainers are
   * written as the contributor's own test — "is that true of this route?" — not as
   * definitions of graph terms.
   *
   * Note what is absent: there is no "parallel" kind, and there must not be one. Two stages
   * happen at the same time when their TIMING overlaps, never because an edge says so
   * (§20.2, §20.3, invariant 22). `timingExplainer` below is where that is said to the person
   * who needs to know it.
   */
  stepEdgeKind: {
    sequential: {
      label: 'Must be finished first',
      explainer: 'You cannot start the later stage until the earlier one is done.',
    },
    optional_branch: {
      label: 'An optional extra',
      explainer: 'Some people do this and some skip it. The route still works without it.',
    },
    alternative: {
      label: 'Another way of doing it',
      explainer: 'A different way to achieve the same thing. You do one or the other, not both.',
    },
    rejoin: {
      label: 'Where the paths meet again',
      explainer: 'Different ways of getting there come back together at this stage.',
    },
  } satisfies Record<StepEdgeKind, { label: string; explainer: string }>,

  /**
   * Maintaining the shape of a road — Phase 12E, audit F6.
   *
   * Plain verbs throughout. "Remove this connection", not "archive this edge"; "Take this
   * stage off the road", not "set archivedAt". The notes beside the destructive-sounding ones
   * say what actually happens, because "remove" reads as deletion and nothing here deletes
   * (FR-21, FR-45, BR-15, invariant 4).
   */
  structure: {
    maintainTitle: 'Maintain this road',
    maintainLede:
      'Anyone signed in can correct the shape of a route. Every change keeps the earlier version, nothing is deleted, and nothing waits for approval.',

    reviseRoute: 'Rename this route',
    routeTitle: 'Route name',
    routeSummary: 'What this route covers',

    reviseStep: 'Correct this stage',
    stepLabel: 'Stage name',
    stepCategory: 'Kind of stage',
    earliestStart: 'Earliest it can start (days from the beginning)',
    typicalDuration: 'How long it usually takes (days)',
    /**
     * The one sentence that makes a parallel road possible.
     *
     * There is no "these happen together" control, because overlap is not a flag — it is what
     * two intersecting time windows mean (§20.2, §20.3). A contributor who does not know that
     * will describe a genuinely parallel journey as a straight line, and the road will be
     * wrong in a way nothing flags.
     */
    timingExplainer:
      'Two stages whose times overlap are shown side by side on the road, as work you can do at the same time. That is how a route says two things happen together — leave these empty if you are not sure.',

    connectSteps: 'Connect two stages',
    connections: 'Connections between stages',
    connectionKind: 'How are they connected?',
    fromStep: 'Earlier stage',
    toStep: 'Later stage',
    connect: 'Connect them',
    removeConnection: 'Remove this connection',
    restoreConnection: 'Put this connection back',

    archiveStep: 'Take this stage off the road',
    restoreStep: 'Put this stage back',
    archiveStepNote:
      'It stops appearing on the road and stays in the history, with everything in it. Anyone following this route keeps their progress, and you can put it back.',
    restoreStepNote: 'It appears on the road again, with everything it had.',
    archivedNote: 'not on the road',

    archiveField: 'Take this information off the route',
    restoreField: 'Put this information back',
    archiveFieldNote:
      'It stops appearing on the route and stays in the history. Nothing is deleted, and you can put it back.',

    reason: 'Why (kept with the change)',
    save: 'Save the change',

    /**
     * What is unfinished about a road — never what is wrong with it.
     *
     * A cycle or a duplicate connection cannot reach here: the revision service refuses to
     * commit either. Everything below is repaired by adding the next connection, which is the
     * ordinary state of a road somebody is still building — so it is shown, not blocked
     * (§7.3: a caution changes what the reader should do; it never forbids).
     */
    unfinishedTitle: 'This road is not finished yet',
    unfinished: {
      orphan_step: 'Not connected to anything yet',
      unreachable_step: 'Nothing leads to this stage yet',
      no_start: 'No stage starts this route yet',
      dangling_rejoin:
        'Marked as where paths meet again, but only one path arrives so far',
    },
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

  /**
   * The same six categories in one or two words — Phase 12D.
   *
   * Not a second vocabulary: these are the *same* categories, named for places where the full
   * form does not fit. A step card on the road is about 130 units wide for its text, and
   * "Documents and preparation" truncates to "Documents and pre…" — which is worse than a
   * short name, because a reader cannot tell whether the label was cut or the step is
   * genuinely called that.
   *
   * The full names stay everywhere there is room, and stay the accessible name in the
   * renderer's `<title>`, so nothing is lost to a screen reader.
   */
  stepCategoryShort: {
    documents_preparation: 'Documents',
    language_testing: 'Tests',
    admission_university: 'Admission',
    funding_scholarship: 'Funding',
    immigration_visa: 'Visa',
    travel_departure: 'Departure',
  } satisfies Record<StepCategory, string>,

  /**
   * How this works — Phase 12J.
   *
   * Reference for somebody who has already looked at a route and is confused, not a sales
   * page. Wording rules that carry requirements rather than tone:
   *   - It never claims the platform checks anything (BR-20, invariant 12).
   *   - It states the limits in our own words rather than leaving a reader to discover them.
   *   - It contains no example route: an invented one is the single thing this platform
   *     cannot afford (§45, Gate 2, CLAUDE.md §10.2).
   */
  howItWorks: {
    title: 'How this works',
    lede:
      'This platform describes the ways people actually get from Bangladesh to studying abroad — every stage, in order, with the requirements inside it. It is written and corrected by the people who have been through it. Here is what the words on it mean.',
    /** Beside the 'How it works' heading, so it must not repeat it. */
    readMore: 'The full explanation',
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,

    vocabularyTitle: 'The five words this site uses',
    vocabularyLede:
      'Everything else on the site assumes these. They are worth two minutes.',
    vocabulary: [
      {
        label: 'Route',
        value:
          'One recognisable way of reaching a study destination — for example applying directly to a German university, as opposed to going through a scholarship. Two genuinely different processes are two routes, not one route with notes.',
      },
      {
        label: 'Ribbon',
        value:
          'A route, compressed into a single band, so you can compare several at a glance. It is not a preview or a summary card: it is the same route, drawn small. Opening it unfolds the same thing.',
      },
      {
        label: 'Road',
        value:
          'The ribbon opened out: every stage in order, with how long each one takes and which ones happen at the same time. Where a route genuinely branches — two ways of proving English, say — the road shows the branch rather than pretending there is one path.',
      },
      {
        label: 'Step',
        value:
          'One stage of the journey: preparing documents, sitting a test, applying, waiting for a visa. Opening a step shows what is inside it.',
      },
      {
        label: 'Field',
        value:
          'One piece of information inside a step — a requirement, a cost, a deadline, an address, a warning, or somebody’s experience. Each one carries where it came from and when it was last checked, and each one can be corrected on its own.',
      },
    ],

    readingTitle: 'Reading a route',
    reading: [
      {
        title: 'Search from Bangladesh',
        body: 'Choose a destination and a study level. You do not need an account to read anything on this site.',
      },
      {
        title: 'Compare the ribbons',
        body: 'Each band is one route. The colours are the kind of stage — documents, language, admission, funding, visa, travel — in the order you meet them. The key is beside the results.',
      },
      {
        title: 'Open one into a road',
        body: 'Stages appear in order, with their length. Branches are labelled: “Choose one pathway” means the route splits and you take one; “Optional branch” means a stage that applies to some people; “Parallel work” means stages that overlap.',
      },
      {
        title: 'Open a stage to see what is inside',
        body: 'Fields are grouped by who is making the claim. Official and institutional sources sit apart from community experience, always, so you can tell a government rule from somebody’s story.',
      },
      {
        title: 'Follow it, if you want to',
        body: 'Signing in lets you keep private progress against a route — what you have finished, target dates, your own notes. Nobody else can see any of it, and you are never asked to upload a document to prove anything.',
      },
    ],

    contributingTitle: 'Correcting something',
    contributingLede:
      'Four actions, and they mean different things. Picking the right one is most of what makes this work.',
    actions: [
      {
        label: 'Still accurate',
        value:
          'You checked and nothing has changed. One click, nothing to fill in. This is the most useful thing you can do and the one people skip.',
      },
      {
        label: 'Correct this',
        value:
          'You know what the right answer is now. Your correction goes live immediately — there is no queue and nobody approves it. The previous value is kept, with your name on the change, and anyone can correct it again.',
      },
      {
        label: 'Flag a problem',
        value:
          'You know something is wrong but not what is right. This leaves the value alone and marks it as needing review, so the next reader is warned and somebody who knows can fix it.',
      },
      {
        label: 'Report as unsafe',
        value:
          'Different from the three above, and rarer. For something dangerous rather than merely wrong: a phishing link, somebody impersonating an office, a scam, a private person’s details. A person looks at it.',
      },
    ],

    limitsTitle: 'What this platform does not do',
    limits: [
      'It does not check anything. Nothing here has been through an authority, and the absence of a warning is not evidence that a fact is right — always confirm anything that matters against the official source.',
      'It is not an agency or a consultancy. Nobody here submits an application for you, and there is nothing to buy.',
      'It never asks for a document. No passport, no transcript, no certificate, no bank statement — there is nowhere on this platform to upload a file, for anything.',
      'It cannot promise a date. Timings are built from what a route says about itself, and are planning aids rather than commitments.',
      // Worded around the invariant-13 guard, which forbids that vocabulary anywhere in
      // src/ and is right to: it is the thing standing between this product and a paid
      // ranking. The claim is unchanged; only the words it cannot use are.
      'It does not rank routes by anything anybody paid for. Nobody can buy a better position, a badge, or standing of any kind — there is nothing on this platform that money changes.',
    ],

    newHereTitle: 'New here?',
    newHereBody:
      'Every band below is one whole route, compressed. Two minutes on what a ribbon, a road, a stage and a field are will make the rest of this site read easily.',
    privacyTitle: 'What is private',
    privacyBody:
      'Your progress, your dates and your notes are visible only to you. No other user can see them, aggregate figures cannot be traced back to you, and a route changing underneath you never alters what you recorded.',
  },

  landing: {
    headlineBn: 'ভিনদেশী এক্সপ্রেস',
    headline: 'Understand the road before you fly',
    subhead:
      'Compare the ways to reach an overseas study destination, open a route to see every step, and benefit as the community keeps it current.',
    findMyRoute: 'Find my route',
    howItWorks: 'How it works',
    /**
     * Four tiles, not three lines — Phase 12J, VR-12's "How Vindeshi Express Works".
     *
     * The fourth is the one that was missing, and it is the half this product is actually
     * about: a reader is also a contributor, and nothing on the landing page said so.
     */
    steps: [
      { title: 'Search', body: 'Say where you are going and what you are studying. No account needed.' },
      { title: 'Compare', body: 'Each way of getting there appears as a ribbon — the whole route, compressed into one band.' },
      { title: 'Open', body: 'A ribbon unfolds into a road: every stage in order, with the requirements, costs and deadlines inside it.' },
      { title: 'Follow', body: 'Sign in to keep your own private progress against a route — and to correct anything you find is out of date.' },
    ],

    /**
     * The hero illustration — Phase 12D, VR-01.
     *
     * VR-01 leads with a Bangladesh → Germany road carrying Documents, Test, Admission, Visa
     * and Fly. Ours draws the **six step categories** instead of a named destination, and the
     * caption says so, because a made-up route on the homepage is exactly the fake content
     * Gate 2 forbids and §45 warns about: a reader cannot tell an illustrative route from a
     * researched one, and the whole product rests on that difference being visible.
     *
     * What it shows is real: these are the categories every route is built from, drawn by the
     * same renderer that draws every route.
     */
    illustrationCaption: 'The kinds of stage a route is made of',
    illustrationNote:
      'An illustration of the six stages, not a route you can follow. Real routes are researched from official sources and carry their own steps, sources and dates.',

    destinationsTitle: 'Destinations with routes',
    destinationsEmpty:
      'No destinations have routes yet. They are researched and reviewed before they appear here.',
    destinationRouteCount: (n: number) => (n === 1 ? '1 route' : `${n} routes`),
    browseAll: 'Browse all routes',
  },

  search: {
    title: 'Find a route',
    lede: 'A few filters, not a profile. Nothing here needs an account.',
    /** The band's own accessible name — it is a landmark a screen reader can skip past. */
    filtersLabel: 'Narrow the routes',
    /**
     * The rail — Phase 12H.
     *
     * VR-12 puts "Recently Updated" here, which is a cross-route feed this product does not
     * have and would not add without a change request (§35). The position is the mockup's;
     * what fills it is a key to the thing the reader is actually looking at.
     */
    legendTitle: 'How to read a ribbon',
    legendLede:
      'Each band is one route, compressed — its stages in order, left to right, coloured by what kind of stage each one is. Opening it unfolds the same thing into a road.',
    missingTitle: 'Not here?',
    missingLede:
      'If the way you are going is missing, add it. New routes appear straight away, marked experimental until the community has worked on them.',
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

    /** Paging — Phase 12D. Before this, every match rendered on one page. */
    pagination: 'Search result pages',
    pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
    firstPage: 'First',
    previousPage: 'Previous',
    nextPage: 'Next',
    lastPage: 'Last',
  },

  route: {
    start: 'Start of the route',
    destination: 'Departure',
    stepAdded: 'New',
    stepArchived: 'Archived',
    stepDisrupted: 'Temporary disruption affects this step',
    stepChanged: 'Changed',
    previousRoute: 'Previous route',
    selectedStep: 'Selected step',
    mapGuide: 'Open a station to explore its requirements and sources.',
    ribbonContinue: 'Scroll to follow every stage',
    routeIndex: 'All route steps',
    backToMap: 'Back to the road',
    timingUnknown: 'Timing not recorded',
    routeRelationships: {
      alternative: 'Choose one pathway',
      optional: 'Optional branch',
      parallel: 'Parallel work',
    },
    tabOverview: 'Route',
    tabHistory: 'History',
    tabsLabel: 'Route views',
    selectAStep: 'Select a step to see the information inside it.',
    ribbonLabel: 'Route overview',
    roadLabel: 'The full road',
    steps: 'Steps',
    stepCount: (n: number) => (n === 1 ? '1 step' : `${n} steps`),

    /**
     * Labels for the route header's stat band — Phase 12D, VR-04/VR-05.
     *
     * `followersLabel` is the one that has to be exactly right. §26 and invariant 17: a
     * follower count says how many people are tracking this route privately, and nothing
     * whatever about whether any of them succeeded. "Following privately" rather than
     * "students" or "users on this route" keeps both facts in the label — the number is
     * people, and their progress is not ours to describe.
     */
    /** The header panel is a landmark; it needs a name a screen reader can skip by. */
    factsLabel: 'About this route',
    stepsLabel: 'Steps',
    contributorsLabel: 'Contributors',
    followersLabel: 'Following privately',
    flyWindowShort: (from: string, to: string) => `${from} – ${to}`,
    openStep: 'Open this step',
    closeStep: 'Close',
    noSteps: 'This route has no steps yet.',
    noFields: 'No information has been added to this step yet.',
    history: 'Route history',
    /**
     * What a revision was made to — Phase 12H.
     *
     * The ledger used to print the union member itself, uppercased, so a reader saw FIELD and
     * had to work out what it meant. These are the same three things in words a student reads.
     */
    historyKind: {
      route: 'Route details',
      step: 'A stage',
      field: 'Information',
    },
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
    /**
     * The short form that fits on a step card on the road — Phase 12C, VR-04.
     *
     * Rounded to the largest unit that still says something useful, because a card has room
     * for three words and "about 6 weeks" is more use at a glance than "43 days".
     *
     * **"about", always.** Invariant 16 and BR-18: a duration is a planning aid, never a
     * promise, and a bare "6 weeks" on a road reads as a commitment the platform is in no
     * position to make. The long form beside the field keeps the exact number.
     */
    durationShort: (days: number) => {
      if (days < 14) return days === 1 ? 'about 1 day' : `about ${days} days`
      if (days < 60) {
        const weeks = Math.round(days / 7)
        return weeks === 1 ? 'about 1 week' : `about ${weeks} weeks`
      }
      const months = Math.round(days / 30)
      return months === 1 ? 'about 1 month' : `about ${months} months`
    },
    startsAfter: (n: number) => `Can start about day ${n}`,
    startsAfterShort: (n: number) => `Around day ${n}`,
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
    mapGuide: 'Your marks are private and self-reported. Open a station to update your progress.',
    tab: 'My journey',
    title: 'My journey',
    indexTitle: 'My journeys',
    indexLede: 'Routes you are following, and the progress you have recorded on each. Only you can see this.',
    indexEmpty: 'You are not following any routes yet. Open a route and choose “Follow this route” to start one.',
    indexEmptyBody:
      'Open any route and choose “Follow this route”. Your progress, dates and notes then live here — private to you, and never shown to anyone else.',
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
    /**
     * The complete list, checked against the database — audit F13.
     *
     * This used to read "Your email address … Nothing else", which was not true: the account
     * row also held Google's access token and id token, and an id token is a signed JWT
     * carrying the name and photograph the sentence promised we did not keep. The tokens are
     * gone now — dropped from the schema and no longer written — but the lesson is that a
     * closed claim like "nothing else" has to be checkable, so this enumerates instead.
     *
     * Four things, and each is here because something breaks without it: the email
     * recognises a returning person, the Google account id is what the sign-in resolves
     * through, the handle is how contributions appear, and the date is when the row began.
     */
    whatWeStoreBody:
      'Four things: your email address, so we recognise you when you come back; the account identifier Google gives us, which is how signing in finds you again; the handle we generate for you; and the date your account started. Not your name, not your photograph, and no sign-in tokens. You appear to other people only as your handle.',
    yourHandle: 'Your public handle',
    handleExplainer: 'This is how contributions appear to others. It is not your name.',
    notConfigured:
      'Sign-in is not configured on this deployment yet. Reading works without an account.',

    /**
     * What an account is for — Phase 12E.
     *
     * Exactly the two things FR-12 gates, described as what they do rather than as benefits.
     * There is deliberately nothing here about status, recognition, streaks or standing: §25
     * warns against turning contribution into a competitive points game, and a sign-in page
     * promising standing would be the first place that started.
     */
    whatItIsFor: 'What an account is for',
    offerContribute: {
      title: 'Correct what is wrong',
      body:
        'Add a missing route, update a value that has changed, confirm that something is still current, or challenge something that is not. Every change keeps the earlier version, and nothing waits for approval.',
    },
    offerJourney: {
      title: 'Follow a route privately',
      body:
        'Mark your own progress, keep your own dates and notes, and see which route changes reach the part you have not done yet. Nobody else can see any of it, and you are never asked to upload anything.',
    },
    readingNeedsNoAccount:
      'Searching, routes, steps, sources and history are readable without an account, and always will be.',
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

    // ── VR-08's comparison, in words — Phase 12E ─────────────────────────────────
    //
    // The mockup's rail runs "1. Check current information … 5. Update goes live when
    // confirmed by the community". Stages 1-3 are honest and are the tips below; 4 and 5 are
    // a mockup exception (CLAUDE.md §8.6) and are not written anywhere, because they are not
    // true here — the correction is live when it is saved.
    //
    // "Avoid personal opinions" is VR-08's fourth tip and is *replaced* rather than dropped.
    // A student's own experience is community experience, it is a first-class claim type
    // (FR-54, invariant 11), and telling contributors to suppress it would remove the thing
    // this platform is mostly made of. What we actually need from them is that they say which
    // kind of claim it is, so that is what the tip asks for.
    updateContext: 'What you are correcting',
    currentTitle: 'What it says now',
    currentAsOf: (date: string) => `As recorded on ${date}`,
    currentNeverRevised: 'As first recorded',
    proposedTitle: 'Your correction',
    proposedValue: 'The corrected information',
    appliesToNow: 'Applies to',
    whoSaysSo: 'Who says so',
    lastConfirmedLabel: 'Last confirmed',
    neverConfirmedShort: 'Nobody yet',
    versionsLabel: 'Versions kept',
    versionCount: (n: number) => (n === 1 ? '1 version' : `${n} versions`),
    updateTipsTitle: 'What makes a correction useful',
    updateTips: [
      'Be specific about what changed, and about whom it changed for.',
      'Link the page you found it on, where there is one.',
      'Say who says so honestly. Your own experience is community experience, and it is worth recording as exactly that — it is not a lesser kind of information, it is a different one.',
      'Say why you are changing it. The next reader is deciding between your value and the one before it, and the reason is most of what they have to go on.',
    ],
    updateAttribution:
      'Your correction is recorded against your handle, and the value before it stays in this route’s history where anyone can read it. Nothing is overwritten.',
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
    /**
     * VR-09's "Build Your Road", on the route — Phase 12E.
     *
     * These controls had been three disclosures hanging off the bottom of the route index
     * with no heading between them and it. For a route somebody created five minutes ago,
     * building the road is not housekeeping — it is the whole point of the page.
     */
    buildRoadTitle: 'Build the road',
    buildRoadLede:
      'Add the stages a student goes through, connect them, and give each one a realistic length. Two stages whose windows overlap is how this route says they happen at the same time. You can change any of it later, and so can anyone else.',
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
    routeSummaryHint: 'What kind of student is this route for, and what makes it different from the other ways of getting there?',
    from: 'From',
    to: 'To',
    countryHint: 'Two-letter country code — BD for Bangladesh, DE for Germany.',
    mechanismHint: 'Leave it unset if the route does not depend on one.',
    intakeHint: 'The intake this route describes, if it is specific to one.',
    publish: 'Create this route',

    // ── VR-09's stage bar, at the two stages this product has — Phase 12E ────────
    //
    // The mockup draws five (Route Basics, Build Road, Add Fields, Review, Publish). Ours are
    // two, because only the basics need a form of their own: until the route exists there is
    // nothing to add steps or fields to, and everything after happens on the route itself
    // where the contributor can see the road change as they build it (CLAUDE.md §7.1).
    //
    // Naming stage two matters more than the count. A contributor who does not know the road
    // comes next publishes a route with no steps and assumes they have finished.
    stagesLabel: 'How adding a route works',
    stageBasicsTitle: 'The basics',
    stageBasicsBody: 'Where it goes, for whom, and what to call it.',
    stageRoadTitle: 'Build the road, on the route itself',
    stageRoadBody:
      'Add the stages and the information inside them on the route once it exists, so you can see the road change as you build it.',
    communityContribution: 'Community contribution',
    basicsTitle: 'Route basics',
    routeTipsTitle: 'What makes a route useful',
    routeTips: [
      'Group the stages the way a student lives them. “Documents” is one stage, not seven.',
      'Give each stage a realistic length. Two stages whose windows overlap are how this product says they happen at the same time — there is no separate control for it.',
      'Link an official page for anything an authority publishes, and say plainly when something is your own experience instead.',
      'Describe one way of getting there. If your route and an existing one are genuinely different journeys, they should stay two routes.',
    ],
    publishMeansTitle: 'What publishing does',
    publishMeans: [
      'The route appears immediately, marked experimental, so readers can see it is new and has not been worked on yet.',
      'It is not yours. Anyone signed in can add to it, correct it or reorganise it — including changing what you wrote.',
      'Nothing you write here is checked by Vindeshi Express before or after it appears. What the route says is what the community has put into it, and readers are told that.',
      'Nothing is ever deleted. Every correction keeps the value before it, with your name against what you wrote.',
    ],
    stillAccurate: 'Was this step still accurate?',
    stillAccurateLede:
      'You have just been through it, so you know better than anyone. This is the most useful moment to say.',
    yesAccurate: 'Yes — everything here was still accurate',
    somethingChanged: 'Something changed',
    somethingChangedHint: 'Opens the step so you can correct or flag the part that is wrong.',
    contributorSince: 'First contributed',

    // ── The contributor page — Phase 12E ─────────────────────────────────────────
    //
    // Short labels rather than sentences, because the counts lead now and a `Stat` puts the
    // figure first. The three sentence-forms these replaced were the whole page: four lines
    // of unstyled list, which reads as a debug view to a reader who arrived by clicking a
    // handle beside a claim they are deciding whether to believe.
    //
    // §25 and CLAUDE.md §11: nothing here is a score, a level or a badge, and the second
    // count is deliberately not divided by the first — a ratio is a rating with its
    // arithmetic hidden, and what a rating would mean is an open decision.
    contributorRecord: 'What this account has done here',
    contributionsLabel: 'contributions',
    confirmedByOthersLabel: 'of them since confirmed by somebody else',
    confirmationsGivenLabel: 'times they confirmed somebody else’s information',
    countsAreNotAScore:
      'These are counts, not a rating. A high number means somebody has been active, not that they are right; a low one often just means they are new. Read what they actually contributed on the routes themselves.',
    whatThisPageIsTitle: 'Why this page exists',
    whatThisPageIs:
      'Every claim on a route says who made it, and a reader deciding how much weight to give one should be able to see what else that person has done. This platform deliberately has no reputation score to show instead — so what it shows is the record, and you judge it.',
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

    // ── VR-11's category grid, "what happens next" and quarantine explanation ────
    //
    // The eight reasons had been eight one-line options in a `<select>`, which is the shape
    // most likely to produce the wrong report: "phishing or a scam" and "another serious
    // concern" look equally plausible to somebody who has just found an out-of-date deadline.
    // A sentence per category is what keeps a challenge from being filed as a report (§23.1).
    reportWhatTitle: 'What are you reporting?',
    reportReasonDetail: {
      phishing_or_scam:
        'A fake page, a fake offer, or a request for money or details that nobody legitimate would ask for.',
      adult_content: 'Explicit or otherwise inappropriate material.',
      malware_or_download:
        'A link that installs something, or downloads a file you did not ask for.',
      impersonation:
        'Somebody claiming to be an embassy, a university, an official office or a person they are not.',
      harassment_or_personal_information:
        'Abuse, or a private person’s number, address or documents published without their consent.',
      malicious_contact:
        'A phone number, email address or account listed here that is being used against people.',
      // "Selling something" rather than the obvious word for it: the invariant-13 guard
      // forbids advertising vocabulary anywhere in src/ and cannot tell a description of
      // what somebody is reporting from a feature we are building. The guard is right to be
      // blunt about that word; this reads the same to a reporter.
      spam: 'Selling something, or the same thing posted over and over.',
      other_serious_concern:
        'Something dangerous that none of the above describes. Say what it is below.',
    } satisfies Record<ReportReason, string>,
    /**
     * VR-11 offers "Add screenshot (optional), PNG, JPG up to 5MB". Deferred from V1 on
     * 2026-09-02 (CLAUDE.md §8.6): no upload endpoint, no blob storage, no attachment table.
     * Said out loud rather than left as a missing control, because "there is nowhere on this
     * platform to upload a file" is a fact about the product worth knowing (invariant 6).
     */
    reportTextOnly:
      'Text only. There is nowhere to attach a file here, and nowhere on this platform to upload one — not for a report, and not for your own journey either.',
    /**
     * VR-11's "What happens next?", written as what happens rather than as a promise.
     *
     * The mockup's version ends "Issue Resolved — the community stays safe" and its rail
     * opens with "We review all reports and take action". Both are commitments with a volume
     * in them. What replaces them is the sequence itself, including the part that matters
     * most and is easiest to leave out: a person decides, and no number of reports decides
     * anything on its own (FR-71, invariant 14).
     */
    whatHappensTitle: 'What happens next',
    whatHappens: [
      {
        title: 'You send it',
        body: 'Nothing on the route changes yet, and nothing appears publicly. Your handle is not shown against the report anywhere a reader can see.',
      },
      {
        title: 'An administrator reads it',
        body: 'A person, not a rule. How many reports something has had never decides anything by itself, and neither does how quickly they arrived.',
      },
      {
        title: 'They may withhold it while they look',
        body: 'The value is hidden from the route and replaced by a notice saying it was withheld and why. Nothing is deleted, and restoring it is one action.',
      },
      {
        title: 'They record what they decided',
        body: 'What appears on the route is the state of the content — withheld, restored, or archived and kept in history. The report itself stays private.',
      },
    ],
    quarantineHowTitle: 'How withholding works',
    quarantineHow: [
      'Withholding hides one value from the route. The field, every version of it and the whole history are untouched.',
      'A reader sees that something was withheld and the reason given, rather than a blank. Hiding something without saying so reads as censorship.',
      'Restoring it is a single action, as soon as the concern turns out to be unfounded.',
      'Withholding one item says nothing about the rest of the route. Nothing on this platform has been checked by Vindeshi Express.',
    ],
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
    // The two queues are siblings, so each names the other (Phase 12M).
    tabsLabel: 'Moderation queues',
    title: 'Reported content',
    lede: 'Content that people have reported as unsafe, and what is known about each report.',
    noRecommendation:
      'This list is not ranked and suggests nothing. It shows what was reported, by how many different people, and when — the judgement is yours.',
    empty: 'Nothing has been reported.',
    /**
     * An empty queue is the ordinary state, and it must not read as an all-clear. Invariant
     * 12 and BR-04: an absence of reports is an absence of reports, and nothing more.
     */
    emptyNote:
      'That is the usual state of this page. It means nobody has reported anything — not that anything here has been checked and found sound.',
    roleScopeTitle: 'What this role is for',
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
    routesEmpty: 'There are no routes yet.',
    /**
     * The state production is actually in, and has always been in (CLAUDE.md §10.2). Saying
     * so beats an empty list that reads as a page that failed to load.
     */
    routesEmptyNote:
      'Nothing has been published on this platform yet. Once routes exist, every one of them appears here, oldest first — never ordered by how many people follow them.',
    duplicatesTitle: 'Duplicate flags',
    duplicatesEmpty: 'No open duplicate flags.',
    duplicatesOldestFirst:
      'Oldest first. Nothing here is ranked by how many people flagged it — two routes are the same journey or they are not, and no number of flags settles that.',
    mergeInto: 'Merge into',
    mergeSubmit: 'Merge',
    mergeNote: 'Why (kept with the decision)',
    mergeExplainer:
      'The duplicate keeps every step, field, revision and follower it has. It leaves search and sends readers to the surviving route. Nothing is copied, moved or deleted, and the merge can be undone.',
    /**
     * Only routes that could be the same journey are offered — audit F5.
     *
     * The words say what the filter did, because an administrator who cannot find the route
     * they expected needs to know it was excluded rather than missing.
     */
    mergeCandidatesHint:
      'Only routes with the same origin, destination and study level. Two routes that differ on any of those are different journeys, not two descriptions of one.',
    mergeNoCandidates:
      'No other route shares this route’s origin, destination and study level, so there is nothing it could be a duplicate of.',
    /**
     * Named beside a candidate, never used to hide it.
     *
     * §40.1 says a mechanism is what makes two routes for the same pair materially different,
     * and §40.4 equally permits judging that one of them is simply mislabelled. The baseline
     * does not say which reading wins, so this is shown to the person deciding rather than
     * decided for them (src/domain/merge.ts).
     */
    mergeCaution: {
      differing_mechanism: 'different funding route',
      differing_intake: 'different intake',
    },
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
    severityLegendTitle: 'The four levels',

    // ── VR-10's type column and activity band — Phase 12E ────────────────────────
    //
    // BR-27's distinction on the face of every card, not only in the heading above the list:
    // a card reached by deep link arrives without its heading, and "Germany adds a visa
    // document" and "the Dhaka centre is shut for a fortnight" are different claims about the
    // world — one of which expires by itself (invariant 19).
    typePermanent: 'Permanent change to the route',
    typeTemporary: 'Temporary — it expires on its own',

    // The counts in VR-10's rail, for this route. They decide nothing and nothing reads them
    // (FR-71, invariant 14), which is what the last line says out loud.
    activityAnnounced: (n: number) =>
      n === 0
        ? 'No changes have been announced on this route.'
        : n === 1
          ? '1 change has been announced on this route.'
          : `${n} changes have been announced on this route.`,
    activityDisruptions: (n: number) =>
      n === 0 ? 'No disruption is running now.' : n === 1 ? '1 disruption is running now.' : `${n} disruptions are running now.`,
    activityNone: 'Nothing has been announced or reported as disrupted on this route yet.',
    activityNotAJudgement:
      'These are counts, and nothing on this platform reads them. A route with many announced changes is being maintained; a route with none may simply be one nobody has corrected yet.',
    permanentVsTemporaryTitle: 'Two different things',
    permanentVsTemporary: [
      'A change alters the route itself. It stays until somebody changes it again, and every version before it is kept.',
      'A disruption is a closure, a delay or a shortage with a date and a place. It expires on its own and rewrites nothing.',
      'They are recorded separately and on purpose. A fortnight of flooding filed as a permanent change to a country’s visa rules cannot be told apart from the real thing afterwards.',
    ],

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

    /** The step-by-step table, behind a disclosure — the roads above already show where. */
    exactRowsSummary: 'Compare the two roads step by step',
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
    /**
     * Says "every edit", plural — audit F8.
     *
     * The control took one revision until Phase 12E, so the hint said "the edit". A real
     * structural change is several: a document added to the visa stage and the APS moved
     * earlier is a field revision and a step revision at least. Naming one made the shadow
     * describe a fragment and stay silent about the rest, which under-states the scale of the
     * change — and scale is what FR-77 asks the shadow to show.
     */
    fieldDescribesHint:
      'Tick every edit this announcement is about. Linking them lets anyone see exactly what changed, now and years from now — and a change that touched several stages needs all of them ticked to show its full scale. Left blank, the announcement still appears; it just cannot show a before and after.',
    describesNone: 'No recent edits to link to',
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
