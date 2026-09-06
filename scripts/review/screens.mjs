/**
 * The screens the owner reviews, and the mockup each one answers to — Phase 12G.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Why this list is a file rather than a paragraph inside a script.**
 *
 * Two outstanding exit criteria — 12C's "side-by-side screenshots of a real seeded route
 * against VR-03 and VR-04" and 12D's "screenshots at 360/768/1280/1440 of landing, search,
 * route and step against VR-01, VR-12, VR-04, VR-05 and VR-14" — are the same criterion
 * written twice, and neither can be closed by a passing test. They need a person looking at
 * two pictures. What engineering can do is make that pair reliable to produce, and that means
 * the pairing of screen to reference has to live somewhere both the shooter and the contact
 * sheet read from, so a screenshot can never end up captioned with the wrong mockup.
 *
 * `look` is not decoration either. A reviewer handed two images without being told what the
 * comparison is *for* will compare colours and typefaces, which are the things already decided
 * and already guarded. Each note names what this particular pair is evidence about, drawn from
 * the exit criterion or from CLAUDE.md §8.3.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **`needsSession` marks what this suite cannot yet reach**, rather than omitting it. Every
 * signed-in surface built in Phase 12E was composed without once being rendered in a browser
 * (Status.md, session 17), and a review set that silently skipped them would read as though
 * they had been looked at. They are listed, marked, and reported as not captured.
 */

/** CLAUDE.md §7: 360 is a first-class target; 768 is the `md` breakpoint exactly. */
export const WIDTHS = [360, 768, 1280, 1440]

/**
 * The fixture the route-shaped screens are captured against.
 *
 * Hypothetical content on the disposable branch, per CLAUDE.md §10.2 — it exercises the
 * mechanism and is removed by resetting that branch, never through a delete path in the
 * product. Deliberately the 13-step one: a road that *wraps* is the case VR-04 draws, and a
 * three-step fixture proves nothing about it.
 */
export const FIXTURE_SLUG = process.env.REVIEW_ROUTE_SLUG ?? 'bd-de-masters-rwth-direct-v3'

const route = (suffix = '') => `/en/routes/${FIXTURE_SLUG}${suffix}`

export const SCREENS = [
  {
    id: 'landing',
    title: 'Landing',
    path: '/en',
    reference: '01-landing-minimal-home.png',
    criterion: '12D',
    look:
      'Minimal, with complexity appearing only after the visitor acts (§8.3, VR-01). The Bengali wordmark, one primary call to action, and the trust badges — free, community maintained, no document upload — reading as claims about the platform rather than about any route.',
  },
  {
    id: 'search',
    title: 'Route search and ribbons',
    path: '/en/routes?from=BD&to=DE',
    reference: '12-responsive-route-search-and-browse.png',
    criterion: '12D',
    crops: [{ id: 'ribbon', selector: 'li:has(svg[data-route-visual="ribbon"])' }],
    look:
      'Compare against the desktop half at 1280 and 1440, and against the phone panels at 360. A ribbon is the compressed route and not a card: the same stages in the same order as the road, filling its row rather than sitting in a narrow column (12C, invariant 25).',
  },
  {
    id: 'route',
    title: 'Route — the full road',
    path: route(),
    reference: '04-route-detail-full-road-view.png',
    criterion: '12C + 12D',
    crops: [{ id: 'road', selector: 'svg[data-route-visual="road"]:visible' }],
    look:
      'The road is visually dominant and **wraps** across rows with curved connectors rather than running as a single line (§8.3, VR-04). Numbered stages, expected duration, expected fly window and the activity counts across the top. It must not read as a generic task checklist.',
  },
  {
    id: 'route-standing',
    title: 'Route — experimental standing',
    path: route(),
    reference: '14-experimental-disputed-route-state.png',
    criterion: '12D',
    look:
      'The fixture is experimental with zero confirmations, which is exactly the state VR-14 draws. Check that the route passport says so in weight, word and icon and **not** in a colour — §11 closed the maturity-palette decision by deciding there is none. No confidence percentage, no verified badge, and nothing implying safety from an absence of reports (invariant 12, §8.6).',
  },
  {
    id: 'step',
    title: 'Step and its fields',
    // Resolved at capture time by opening the first station on the road, so the suite never
    // hard-codes a step id and keeps working when the fixture is rebuilt.
    path: null,
    reference: '05-step-detail-fields-view.png',
    criterion: '12D',
    crops: [{ id: 'fields', selector: '#route-step-info' }],
    look:
      'Route → Step → Field made visible, with the route and the road still on screen around the selection (§7.1 — a step selection that visually replaces the route is wrong even when the URL is right). Fields grouped by provenance rather than each carrying its own badge (§7.3).',
  },
  {
    id: 'changes',
    title: 'Route changes and shadow comparison',
    path: route('/changes'),
    reference: '07-route-changes-shadow-comparison.png',
    criterion: '12E',
    look:
      'Two roads on a shared numbered spine, with the change summary leading. It has to answer what changed, where, when, how much, and whether it touches this reader.',
  },
  {
    id: 'history',
    title: 'Route history',
    path: route('/history'),
    reference: null,
    criterion: '12D',
    look:
      'A sibling view inside the persistent route context — title, standing and tabs stay on screen (§7.1). No mockup exists for it, so judge it against the route it belongs to.',
  },
  {
    id: 'signin',
    title: 'Sign in',
    path: '/en/signin',
    reference: null,
    criterion: '12E',
    look:
      'What an account is for, and deliberately nothing about status, recognition or standing (§25). Sign-in gates contribution and private tracking only; everything read up to here was reachable without it (FR-01, FR-12).',
  },
  {
    id: 'new-route',
    title: 'Create a route — signed out',
    path: '/en/routes/new',
    reference: '09-create-new-route-build-road.png',
    criterion: '12E',
    look:
      'The anonymous prompt. The two-stage bar and the basics band sit behind sign-in; what is visible here must still share the canvas axis with the header (§7.2 — this branch had no gutter at all until Phase 12E).',
  },
  {
    id: 'journeys',
    title: 'My Journey — signed out',
    path: '/en/journeys',
    reference: '06-my-journey-private-tracker.png',
    criterion: '12E',
    look:
      'The anonymous explainer. No "Share Progress" anywhere, because progress is private (FR-26, BR-16, §8.6).',
  },

  // ── Reachable only with a session. Listed so their absence is stated, never implied. ──
  {
    id: 'journey-tab',
    title: 'My Journey — private progress',
    path: route('/journey'),
    reference: '06-my-journey-private-tracker.png',
    criterion: '12E',
    needsSession: true,
    look:
      'Per-step status, target and completion dates, private notes, the progress ring and the fly window. Public route plus private progress, visibly linked and unmistakably personal.',
  },
  {
    id: 'contribute',
    title: 'Correcting a field',
    path: null,
    reference: '08-community-update-field-flow.png',
    criterion: '12E',
    needsSession: true,
    look:
      'Current value beside the correction, with whom the claim applies to, who asserts it, when it was last confirmed and how many versions it has had. No approval gate — updates go live immediately (§8.6).',
  },
  {
    id: 'report',
    title: 'Report and safety',
    path: null,
    reference: '11-report-safety-and-quarantine.png',
    criterion: '12E',
    needsSession: true,
    look:
      'The category grid, what happens next, and what withholding does. No screenshot upload, no safety leaderboard, no public list of quarantined items.',
  },
]
