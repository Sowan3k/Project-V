# Phases.md — Vindeshi Express development plan

Ordered build plan from empty repo to first release. Read [CLAUDE.md](CLAUDE.md) first —
this file assumes its vocabulary and its 25 invariants.

**Status legend:** ⬜ not started · 🟡 in progress · ✅ complete

---

## How this plan is ordered

Two things in this product cannot be retrofitted, and everything else is downstream of them:

1. **The route graph** — routes branch, run in parallel and rejoin (FR-57, D-37). A linear
   `Step[]` with an `orderIndex` is a dead end that makes shadow-route diffing, merging and
   the renderer impossible later.
2. **The revision ledger** — every mutation preserves prior state (FR-20, BR-03). Bolting this
   on later means rewriting every write path in the application.

So the plan front-loads both, and puts **kill spikes** before them: cheap, throwaway
experiments that answer "does this idea even work?" before we build on the answer. If the
ribbon-to-road renderer cannot handle a branching 15-step route on a phone, we need to know in
week two, not month five.

Content research runs as a **parallel track** from Phase 1 — real route information takes
calendar time to gather and verify, and cannot be compressed at the end.

---

## Overview

| # | Phase | Ends with | State |
|---|---|---|---|
| 0 | Foundation spine | Deployed empty shell, green CI | ⬜ |
| 1 | Kill spikes: renderer + revision graph | Two go/no-go answers, throwaway code | ⬜ |
| 2 | Route graph + revision ledger schema | The irreversible migration | ⬜ |
| 3 | Revision write engine | The only door into shared knowledge | ⬜ |
| 4 | Route renderer (production) | Ribbon + road from data, any structure | ⬜ |
| 5 | Anonymous read path | Search → ribbon → road → step → field | ⬜ |
| 6 | Trust, provenance and freshness surface | Uncertainty is visible | ⬜ |
| 7 | Identity and private journeys | Follow a route, track privately | ⬜ |
| 8 | Contribution loop | ADD / UPDATE / CONFIRM / CHALLENGE | ⬜ |
| 9 | Safety: reporting and quarantine | Abuse containment | ⬜ |
| 10 | Change propagation and shadow route | Followers see what changed | ⬜ |
| 11 | Lifecycle, dormancy, merge, admin | Maintenance without data loss | ⬜ |
| 12 | Responsive, accessibility, polish, support link | Launch-quality UI | ⬜ |
| 13 | Pre-launch gates and release | Gates 1–3 pass | ⬜ |
| — | **Content track** (parallel, from Phase 1) | Real seeded routes | ⬜ |

---

## Phase 0 — Foundation spine

**Goal:** a deployable, typed, tested empty shell so every later phase compiles against fixed
vocabulary and a proven deploy path.

**Scope**
- Next.js 15 App Router, TypeScript strict, ESLint, Tailwind, app shell
- Prisma wired to Neon: `DATABASE_URL_UNPOOLED` for migrations, `DATABASE_URL` for queries
- Migration discipline rehearsed once on a `neon checkout` scratch branch before `production`
- **Single shared enums module** consumed by Prisma schema, TS types and UI labels: field
  categories, source classes, lifecycle states, change severity, link trust, challenge reasons,
  report reasons
- i18n scaffolding (locale routing + dictionary), English strings, Bengali brand tokens; no
  hardcoded user-facing strings
- Vitest + Playwright harnesses; npm scripts per CLAUDE.md §4
- CI: lint + typecheck + unit on every commit; Vercel preview deploys

**Exit criteria**
- `lint`, `typecheck`, `test`, `build` all pass from a clean checkout
- Playwright smoke test loads the deployed preview
- A migration applies on a scratch branch, then on `production`, with no data loss
- A test fails the build if any enum literal appears in more than one source file
- Zero `any` in `src/`; lint rule enforces it

**FRs:** FR-79, FR-80

---

## Phase 1 — Kill spikes (throwaway)

**Goal:** answer the two questions that would invalidate the architecture, using disposable
code and hardcoded fixtures. **Nothing here ships.** Delete it after.

### Spike A — Ribbon-to-road renderer

Can one data-driven renderer draw every route shape, on a phone, without route-specific code?

Feed it hand-written JSON fixtures — no database — covering: a 4-step linear route, a 15-step
wrapping route, an optional branch, an alternative branch (IELTS vs PTE), two parallel
activities, a branch that rejoins, an archived step, a newly added step, and a shadow overlay.
Render ribbon and road **from the same structure through the same layout pass**.

**Go/no-go:** all fixtures render legibly at 360px, 768px and 1280px with no per-fixture code.
If this fails, the visual model needs rethinking before Phase 2 commits a schema to it.

### Spike B — Revision graph

Headless, no UI. Prove that a branching route graph with append-only revisions supports: two
contributors revising one field concurrently without loss, a diff between two versions that
identifies added/removed/reordered steps *and* changed fields, and archival that leaves current
views while staying in history.

**Go/no-go:** the diff correctly describes a change involving a branch, not just a field edit.

**Exit criteria**
- Both go/no-go answers recorded in `Status.md` with evidence
- Fixture set from Spike A promoted into `Test.md` as the permanent stress-route spec
- Spike code deleted or clearly quarantined outside `src/`

**FRs (proved, not delivered):** FR-04, FR-05, FR-09, FR-20, FR-22, FR-57, FR-77

---

## Phase 2 — Route graph + revision ledger schema

**Goal:** commit, in one migration, the two shapes no later phase can retrofit.

**Scope**
- `Route` as persistent identity (stable id, origin, destination, level, intake, mechanism)
  held separately from revisable content, so followers/revisions/merges stay attached (§18.3)
- `Step` nodes plus a **`StepEdge`** table forming a DAG: `sequential`, `optional_branch`,
  `alternative`, `rejoin`. Overlap expressed via non-constraining edges and timing offsets —
  **never** by array position or a single `orderIndex`
- `Field` rows: category, source class, typed value, freshness columns (`lastConfirmedAt`,
  `reviewDueAt`, `effectiveFrom`, `expiresAt`), `archivedAt`
- Revision tables for route, step, field **and edge** — a route whose branch structure changes
  must be diffable, which requires versioned edges
- Graph validators: acyclicity, reachability, rejoin targets exist, no orphans

**Exit criteria**
- A fixture with a real alternative branch and a real overlap persists, round-trips, validates
- Cycle / orphan / dangling-rejoin fixtures are rejected
- Timeline ordering over the overlapping fixture yields parallel lanes, not a flattened line
- A structural test asserts every revisable model has a matching revision model, edges included
- Schema review confirms no ordered step array anywhere

**FRs:** FR-03, FR-07, FR-51, FR-56, FR-57, FR-72

---

## Phase 3 — Revision write engine

**Goal:** make non-destructive, attributed, append-only writing the *only* physical way shared
knowledge can change — before any API, seed script or UI can write.

**Scope**
- One service layer owning all mutations: `createRoute`, `addStep`, `addField`, `reviseField`,
  `reviseStep`, `reviseEdge`, `archiveField`, `archiveStep` — each writing its revision row in
  the same transaction
- Actor attribution, change reason, revision chaining, diff function
- Archive semantics: leaves current view, stays in history
- **No hard-delete surface for any non-admin role**
- Concurrent revision handling (both preserved, neither lost)
- A test that fails if any code outside the service layer writes these tables

**Exit criteria**
- Invariant tests 1–4 in `Test.md` pass
- Two concurrent field revisions both persist and are ordered
- No route reachable by a non-admin performs a destructive delete

**FRs:** FR-12, FR-16, FR-19, FR-20, FR-21, FR-45, FR-69, FR-44

---

## Phase 4 — Route renderer (production)

**Goal:** the real, data-driven ribbon/road renderer, built on Spike A's proven approach.

**Scope**
- Hand-authored **primitive library only**: road segment, curved segment, junction, step
  marker, optional branch, parallel branch, merge point, start marker, destination/fly marker,
  archived segment, new/changed segment, shadow segment, disruption indicator
- Layout engine: takes the route graph, produces positioned geometry — handles wrapping,
  branches, parallel lanes, rejoins, 3–20 primary steps
- **Ribbon and road share the layout pass**; ribbon is the compressed density (invariant 25)
- Category colours always paired with text + icon
- Responsive at 360 / 768 / 1280

**Exit criteria**
- The Phase 1 stress route renders correctly through the production renderer
- **No file in the codebase contains a country, destination or route name in SVG or layout
  code** — enforced by a grep test in CI
- A route created through the Phase 8 UI renders with zero developer involvement
- Ribbon and road step counts and order match for every fixture

**FRs:** FR-04, FR-05, FR-06, FR-09, FR-57
**Invariants:** 24, 25

---

## Phase 5 — Anonymous read path

**Goal:** a Bangladeshi student can search and understand routes with no account.

**Scope:** search (origin/destination/level/intake/mechanism), ribbon results, ribbon→road
unfold, step expansion, field display, route/step/field history views, expected fly window and
timing (VR-01, VR-02 intent, VR-03, VR-04, VR-05).

**Exit criteria:** every read path works signed-out; no anonymous route hits an auth check;
Playwright covers landing → search → ribbon → road → step → field.

**FRs:** FR-01, FR-02, FR-03, FR-06, FR-08, FR-09, FR-31

---

## Phase 6 — Trust, provenance and freshness surface

**Goal:** uncertainty is visible *before* the community can write anything.

Deliberately ordered before Phase 8: the day an unverified link can be added is the day it must
already render as unverified.

**Scope:** source-class badges, link trust classes with visible destination domain, route
maturity/lifecycle display, freshness and last-confirmed, volatility, dispute markers, route
passport summary, official-vs-community separation (VR-14).

**Exit criteria:** invariant tests 9–17 pass; a `community_submission` field is visually
distinct from an `official` one; no badge derives from absence of reports.

**FRs:** FR-10, FR-11, FR-33, FR-34, FR-49, FR-52, FR-53, FR-62, FR-64, FR-65, FR-66, FR-67, FR-70, FR-74

---

## Phase 7 — Identity and private journeys

**Scope:** Auth.js + Google sign-in, pseudonymous public handle, follow a route, private
progress (status, target date, actual date, private notes), optional personal tasks,
self-reported completion, `My Journey` (VR-06).

**Exit criteria:** invariant tests 5–8, 18 pass. **No file-upload path exists in the journey
flow.** User A cannot read User B's journey through any endpoint. Aggregates say "users marked
completed".

**FRs:** FR-12, FR-23, FR-24, FR-25, FR-26, FR-27, FR-41

---

## Phase 8 — Contribution loop

**Scope:** ADD (route/step/field), UPDATE, CONFIRM, CHALLENGE with reasons; create-route flow
(VR-09); update-field flow (VR-08); post-step-completion "Was this still accurate?" prompt;
contributor history and credibility signals.

**Note:** updates go live and create a revision. **There is no approval gate** — see the VR-08
mockup exception in CLAUDE.md §8.6.

**Exit criteria:** a new signed-in user creates a route that renders and is immediately
improvable by a different user; every action produces a revision; new routes publish as
`experimental`.

**FRs:** FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-42, FR-43, FR-50, FR-55, FR-69

---

## Phase 9 — Safety: reporting and quarantine

**Scope:** report categories distinct from challenge, quarantine of high-risk content, admin
review/restore/archive/remove, contact-safety handling, anti-gaming (burst detection), agency
neutrality (VR-11).

**Exit criteria:** invariant tests 12–14 pass; a quarantined link is not normally clickable but
remains in history; no raw count alone triggers any state change.

**FRs:** FR-35, FR-36, FR-37, FR-68, FR-71, FR-73

---

## Phase 10 — Change propagation and shadow route

**Scope:** change severity, announcement vs effective date, relevance scoped to follower
progress, shadow-route comparison showing scale and location of change, temporary disruptions
with date/location/process scope and expiry (VR-07, VR-10).

**Exit criteria:** invariant tests 19, 21 pass; a follower who completed a step before an
effective date keeps completion and sees context; a disruption expires without mutating the
base route; shadow diff reports added/archived/reordered/changed counts.

**FRs:** FR-28, FR-29, FR-30, FR-32, FR-59, FR-60, FR-61, FR-63, FR-76, FR-77, FR-22

---

## Phase 11 — Lifecycle, dormancy, merge, admin

**Scope:** dormancy for unused new routes only, staleness for established routes, archival,
duplicate flagging and route merge preserving followers and history, annual maintenance tools.

**Exit criteria:** invariant tests 20, 23 pass; merging two routes preserves both follower sets
and both histories; an established quiet route is never auto-invalidated.

**FRs:** FR-38, FR-39, FR-40, FR-46, FR-58

---

## Phase 12 — Responsive, accessibility, polish, support link

**Scope:** mobile reflow per VR-12 and VR-13 (not scaled desktop), accessibility (meaning never
colour-only, keyboard, contrast, screen-reader labels), performance, empty/error states,
advertising-separation guarantees, and the **voluntary support link** per CLAUDE.md §10.1.

**Exit criteria:** no horizontal page overflow at 360px; wide content scrolls in its own
container; automated a11y pass; the support link is an outbound Gumroad link with no payment
code, no supporter flag, and no effect on any trust mechanism.

**FRs:** FR-47, FR-78 · **Scope change:** §10.1

---

## Phase 13 — Pre-launch gates and release

Run the three gates below. Fix and re-run until all pass. Then release.

**FRs:** FR-75, FR-79, FR-80

---

## Content track (parallel, from Phase 1)

Real route content takes calendar time and cannot be compressed at the end. Research starts
early and runs alongside engineering; it gates release, not development.

**Principle: depth over country count.** Four destinations with excellent routes beats twenty
with shallow ones.

**Priority destinations:** Germany, Australia, USA, Malaysia. UK and Canada only if time and
reliable sources permit — and after, never instead.

**Separate routes only when the real process materially differs** — e.g. Germany direct
Master's admission vs a funded/DAAD-type route vs a research PhD route. Never to look populated.

**Every seeded route must be written from the perspective of an applicant starting in
Bangladesh**, not a generic "study in X" article. Where relevant, cover: academic requirements;
documents and where a Bangladeshi applicant obtains them; authentication/legalisation; degree
recognition; English and entrance tests and local availability; university application;
scholarship process; financial requirements; visa documents; **embassy jurisdiction for
Bangladesh, including destinations with no embassy in Bangladesh**; appointment, biometrics and
medical locations; official contacts and portals; processing timelines; pre-departure; expected
fly window. Not every route needs every item.

**Sourcing rules**
- Real information from official or clearly-attributed sources, with `lastConfirmedAt` set.
- **UI mockups are never a source.** Every requirement, fee, duration and statistic in
  `Visual References/` is illustrative (CLAUDE.md §8.6).
- Seeded routes carry **no "Verified by Vindeshi Express" claim** — we are not an admission or
  immigration authority (BR-20). They show sources, last reviewed date, maturity and community
  confirmations.
- **Community confirmations start at 0. That is correct and expected**, and must not be
  disguised. A well-researched route with zero confirmations is honest; a fake confirmation
  count is not.
- Confirmations accumulate naturally as real students complete steps and answer "Was this step
  still accurate?" (Phase 8) — that is how our seed content becomes community-maintained rather
  than permanently dependent on us.

---

## Pre-launch gates

All three must pass before public launch. Each has an owner artifact in `Test.md`.

### Gate 1 — Visualisation scalability

The ribbon/road renderer handles seeded and community-created routes **with no route-specific
code**.

- [ ] Renders: linear, wrapping, optional branch, alternative branch, parallel activities,
      rejoining branch, newly added step, archived step, shadow/previous version, temporary
      disruption indicator
- [ ] Usable from 3 to 20 primary steps
- [ ] Legible on desktop, tablet and mobile; no page-wide horizontal overflow
- [ ] Ribbon and road derive from one structure and one layout pass; step count and order match
- [ ] **CI grep proves no country, destination or route name appears in any SVG or layout file**
- [ ] The development-only stress route (Test.md §7) renders correctly at all three widths
- [ ] A route created through the UI by a non-developer renders with zero code changes

### Gate 2 — Real launch content

- [ ] Germany, Australia, USA and Malaysia each have **at least one genuinely useful route**
- [ ] Every route is written from a Bangladeshi applicant's starting position
- [ ] Every factual field carries a real source and a last-reviewed date
- [ ] **Zero values traceable to the UI mockups**
- [ ] No route claims verification by Vindeshi Express
- [ ] Routes exist separately only where the real process materially differs
- [ ] A Bangladeshi reader who has never used the site says the route explains something they
      were actually trying to understand — this is the gate's real test, and it needs a human

### Gate 3 — Complete community loop

One test user completes the entire cycle end to end:

- [ ] Search a destination → see ribbons → open a ribbon → see the road → open a step →
      inspect fields
- [ ] Follow the route → it appears in My Journey → update private progress
- [ ] Contribute a correction to a public field → a revision is created → prior value preserved
- [ ] The live route changes → the follower sees that something changed
- [ ] Shadow comparison shows what changed, where and whether it affects them
- [ ] **Private progress remains intact throughout**

If this loop works, the product concept is implemented — not merely screened.

---

## Open plan items

- **FR coverage audit not yet run.** The phase FR assignments above are authored, not
  machine-verified — the audit agent did not complete (session limit). Before Phase 2 closes,
  verify every FR-01…FR-80 appears in exactly one phase and none are orphaned.
- **Report-screenshot upload (VR-11)** — decide deliberately whether abuse reports may carry an
  attachment. It must stay out of the journey flow regardless (invariant 6).
- **Hosting** — Vercel is planned; Cloudflare tooling was installed. If Workers becomes the
  target, that changes CLAUDE.md §4 and forces Prisma's edge driver. Settle before Phase 0.
