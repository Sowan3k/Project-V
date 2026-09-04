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
| 0 | Foundation spine | Deployed empty shell, green CI | ✅ |
| 1 | Kill spikes: renderer + revision graph | Two go/no-go answers, throwaway code | ✅ |
| 2 | Route graph + revision ledger schema | The irreversible migration | ✅ |
| 3 | Revision write engine | The only door into shared knowledge | ✅ |
| 4 | Route renderer (production) | Ribbon + road from data, any structure | ✅ |
| 5 | Anonymous read path | Search → ribbon → road → step → field | ✅ |
| 6 | Trust, provenance and freshness surface | Uncertainty is visible | ✅ |
| 7 | Identity and private journeys | Follow a route, track privately | ✅ |
| 8 | Contribution loop | ADD / UPDATE / CONFIRM / CHALLENGE | ✅ |
| 9 | Safety: reporting and quarantine | Abuse containment | ✅ |
| 10 | Change propagation and shadow route | Followers see what changed | ✅ |
| 11 | Lifecycle, dormancy, merge, admin | Maintenance without data loss | ✅ |
| 12 | Responsive, accessibility, polish, support link | Launch-quality **mechanics** | 🟡 |
| 12B | Design system and visual foundation | Tokens, primitives, brand — what a screen is made of | ✅ |
| 12C | Ribbon and road as drawn | A route looks like a route, still route-agnostic | ✅ |
| 12D | Public read path composition | Landing, discovery, route, step | ⬜ |
| 12E | Signed-in and community surfaces | Journey, changes, contribution, safety | ⬜ |
| 12F | Mobile and tablet as their own product | Phone IA, not a narrower desktop | ⬜ |
| 12G | Visual acceptance | Gate 4 green, screenshots reviewed | ⬜ |
| 13 | Pre-launch gates and release | Gates 1–4 pass | ⬜ |
| — | **Content track** (parallel, from Phase 1) | Real seeded routes | 🟡 |

**Phase 12 is 🟡, not ✅:** its implementation landed but one E2E assertion is still red — 4px
of horizontal overflow at 360px on the route page (run #53, `e53794a`). Phase 12F owns the fix.

**Why 12B–12G exist at all** is explained in full below, before Phase 12B. The short version:
no phase in this plan ever had an exit criterion that a screen must *look* like anything, so
appearance was the one dimension nothing could fail on.

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
- CI: lint + typecheck + unit on every commit; **Vercel** preview deploys (Node runtime,
  standard Prisma client — not the edge driver)
- ESLint import-boundary rule scaffolded now, so Phase 4's renderer boundary is enforceable
  the moment the renderer exists rather than retrofitted

**Exit criteria**
- ✅ `lint`, `typecheck`, `test`, `build` all pass from a clean checkout
- ✅ Playwright smoke test loads the deployed preview — 11/11 against the Vercel deployment
- ✅ A migration applies on a scratch branch, then on `production`, with no data loss
- ✅ A test fails the build if any enum literal appears in more than one source file
- ✅ Zero `any` in `src/`; lint rule enforces it

**FRs:** FR-79, FR-80

### Phase 0 as built (2026-09-02)

Delivered: Next.js 15.5.25 App Router on React 19 with TypeScript strict, Tailwind 4,
Prisma 6.19.3 against Neon, the shared enums module and its two generation guards,
locale-routed i18n, Vitest + Playwright, GitHub Actions CI, and the renderer import
boundary armed ahead of Phase 4. 84 unit/architecture tests and 10 E2E assertions pass.

Decisions taken while building, all recorded in `Status.md` (session 4):

- **Phase 0 commits one table, `platform_meta`, and the seven shared enum types.** No
  domain tables: the route graph and revision ledger are Phase 2's irreversible migration
  and must not be pre-empted by a guess. `platform_meta` gives the migration rehearsal a
  real object and lets `/api/health` prove Prisma reaches Neon.
- **`prisma migrate dev` is not usable in an agent session** — it needs a shadow database
  and prompts interactively, and hung for ten minutes against Neon. The migration was
  produced with `prisma migrate diff` and applied with `migrate deploy`, which is also
  what CI and production use. Recorded in CLAUDE.md §4.
- **Next's ESLint rules are wired from `@next/eslint-plugin-next` directly**, not through
  `eslint-config-next`, because that shared config replaces the parser project-wide and
  silently disables every type-aware rule — including `no-explicit-any`, which is a
  Phase 0 exit criterion.

**All five exit criteria are met.** Vercel project `vindeshi-express` is linked to
`Sowan3k/Project-V` on the `main` production branch, and the smoke suite passes against
the deployed build as well as a local one.

Two follow-ups remain, neither blocking Phase 1 (`Test.md` §5): the deployed
`/api/health` returns 503 until `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are added to
the Vercel project (OF-3), and no GitHub Actions run has been inspected from this
environment (OF-2).

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
- ✅ Both go/no-go answers recorded in `Status.md` with evidence
- ✅ Fixture set from Spike A promoted into `Test.md` §7 as the permanent stress-route spec
- ✅ Spike code quarantined outside `src/` in `spikes/`, excluded from CI, imported by nothing

**FRs (proved, not delivered):** FR-04, FR-05, FR-09, FR-20, FR-22, FR-57, FR-77

### Phase 1 result (2026-09-02): both GO

**Spike A — renderer: GO.** 10 fixtures render legibly at 360/768/1280 with no per-fixture
code and no page-wide overflow. Ribbon and road share one `layout()`, differing only in
density constants, so step count and order match at both densities for every fixture. The
road adapts to 360px through a density constant alone — `ROAD_NARROW` changes
`columnsPerRow` and sizing, nothing else — so **Phase 4 needs no mobile renderer**, only a
media query choosing a density.

**Spike B — revision graph: GO.** The decisive diff reads
`1 step added, route structure changed (2 branch connections), 1 field changed` — naming the
`alternative` and `rejoin` connections, not just counting steps. Concurrent revisions against
one parent all survive and read as `contested`; a sequential chain correctly does not.
Archived content leaves the projection and stays in history. `project({ at })` reconstructs
the route as a follower first saw it, which is what the shadow comparison needs.

**Four real defects were caught**, all promoted into `Test.md` §7 as assertions Phase 4 must
carry. The one that justifies the phase: at ribbon density the lane gap was smaller than the
marker height, so concurrent steps stacked and **the ribbon silently showed fewer steps than
the road** — a correctness bug in exactly the place invariant 25 lives, invisible to every
assertion until a screenshot was inspected.

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
- ✅ A fixture with a real alternative branch and a real overlap persists, round-trips, validates
- ✅ Cycle / orphan / dangling-rejoin fixtures are rejected
- ✅ Timeline ordering over the overlapping fixture yields parallel lanes, not a flattened line
- ✅ A structural test asserts every revisable model has a matching revision model, edges included
- ✅ Schema review confirms no ordered step array anywhere — and it is a test, not a review

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
- ✅ Invariant tests 1–4 in `Test.md` pass
- ✅ Two concurrent field revisions both persist and are ordered
- ✅ No route reachable by a non-admin performs a destructive delete

### Phase 3 result (2026-09-02)

Enforcement is three independent layers — ESLint import boundary, a Prisma client extension
checking an async-local write context, and Postgres triggers. Any one alone would be a
convention; together they are a property. 35 integration tests and 71 architecture/unit tests.

**Two real concurrency defects were found by the tests and fixed**, neither of which static
review would have caught: writes to one field **deadlocked** (the revision insert took a
share lock on the parent row that the pointer update then needed exclusively), and once
serialised, Prisma's default 5s transaction timeout **aborted the fifth queued contributor**.
Both would have silently lost contributions in production.

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
- ✅ The Phase 1 stress route renders correctly through the production renderer
- ✅ **Genericity proved by construction** (Test.md tests 24–24d)
- ✅ A route created with **zero developer involvement** renders — proved through the Phase 3
  service, which is what the Phase 8 UI will call. See the note below.
- ✅ Ribbon and road step counts and order match for every fixture

### Phase 4 result (2026-09-02)

`src/renderer/` — one `layout()`, a primitive library, and `Ribbon`/`Road` as the same
component at different densities. 88 layout tests, 25 identity/boundary tests, 5 database
round-trip tests.

**The mobile strategy is a constant, not a renderer.** `ROAD_NARROW` differs from `ROAD` only
in `columnsPerRow` and sizing, and fits a 15-step route inside 360px. There is no second
implementation to keep in step.

**On "a route created through the Phase 8 UI":** that UI does not exist yet, so the criterion
is met through the layer beneath it. `tests/db/renderer-roundtrip.db.test.ts` builds a
branching route at runtime through the Phase 3 revision service — the same functions the
Phase 8 UI will call — loads it back, and renders it. No fixture, no mapping, no renderer
change. Phase 8 should re-run the equivalent through the real UI, but the renderer's part of
the claim is proved.

**One finding recorded for Phase 10:** the shadow-route primitives draw correctly, but an
overlay at identical geometry is invisible — a previous version with a similar shape sits
exactly behind the current one. VR-07 shows side-by-side rather than pure overlay. Phase 10
owns that design decision; Phase 4 deliberately did not invent it.

**FRs:** FR-04, FR-05, FR-06, FR-09, FR-57
**Invariants:** 24, 25

---

## Phase 5 — Anonymous read path

**Goal:** a Bangladeshi student can search and understand routes with no account.

**Scope:** search (origin/destination/level/intake/mechanism), ribbon results, ribbon→road
unfold, step expansion, field display, route/step/field history views, expected fly window and
timing (VR-01, VR-02 intent, VR-03, VR-04, VR-05).

**Exit criteria:**
- ✅ Every read path works signed-out
- ✅ No anonymous route hits an auth check
- ✅ Playwright covers landing → search → ribbon → road → step → field

### Phase 5 result (2026-09-02)

Landing (VR-01), search, road with in-place step expansion, fields, and route history. All
server-rendered, all anonymous — **no function in `src/server/routes/read.ts` takes a
session, an actor or a role**, which is a stronger guarantee than remembering not to check
one.

**Step expansion is `?step=<id>`, not client state.** It is deep-linkable, shareable and
works with JavaScript disabled — proved by a test that runs the whole journey in a context
with JS off. Search is the first thing a visitor does and must not wait on a bundle (§8.1).

**The renderer was reused unchanged.** The ribbon on the search page and the road on the
route page are the same component from the same graph, so opening a route unfolds the same
object (D-33). Phase 4's architecture needed no integration changes.

**Production stays empty and that is deliberate.** The E2E server runs against the test
database; the seeded route is labelled test data and never reaches production. The search
page has a real empty state that says routes are researched and reviewed rather than
generated — §45's cold-start risk answered honestly rather than disguised.

**Deferred as agreed:** the shadow-route overlap issue is untouched (Phase 10), and the full
trust surface — badges, freshness scoring, confidence, dispute markers — is Phase 6. Fields
show their source class as plain text, which is the honest minimum without which the page
would misrepresent its own data (invariant 11).

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

**FRs:** FR-10, FR-11, FR-33, FR-34, FR-49, FR-52, FR-53, FR-54, FR-62, FR-64, FR-65, FR-66,
FR-67, FR-70, FR-74, FR-81

**Note on FR-81 (information applicability).** The data half landed ahead of this phase as
Amendment 001 — an approved requirements change, since Germany research showed source class
alone cannot tell a reader whether a claim is route-wide or applies to one programme. Phase 6
owns rendering it *alongside* source and freshness without implying that programme-specific
information applies universally. A minimal honest rendering already exists on the step-field
list so the read path does not misrepresent its own data in the meantime.

### Phase 6 result (2026-09-03)

`src/domain/trust.ts` and `src/domain/links.ts` decide **which signals are true**;
`src/components/trust.tsx` decides how loud each one is; the dictionary owns every word. That
split is why invariants 9–17 are testable without a browser or a database.

**The design question this phase actually had to answer was not "can we show the metadata?"**
By now a field carries source class, applicability, freshness, review and expiry dates,
revision count, fork history; a route adds lifecycle state, contributors and change activity.
Rendering all of it is trivial and would have been a failure — a wall of badges hides the one
marker that mattered. So every signal is weighted: **caution** (changes what the reader should
conclude), **context** (one quiet grey line), or **nothing at all**.

The third category is the load-bearing one, and it has a test: *an official, route-wide,
recently confirmed field produces zero cautions.* `route_wide` deliberately renders as
nothing — it is what a reader already assumes, and marking it would drown the
`programme`-scoped fact beside it, which is the exact confusion FR-81 exists to prevent.

**Two structural decisions do most of the work of keeping cautions rare.** Fields are
**grouped** into disputed / official-and-institutional / community regions rather than badged
individually — so eleven fields state their provenance once, at the top of their group, and
the FR-54 separation becomes positional rather than a matter of telling two chips apart.
And the route's standing lives in a **passport**: cautions outside a disclosure, evidence
inside it.

**No thresholds were invented.** CLAUDE.md §11 leaves staleness thresholds open, so nothing
decides a fact is stale after N days — staleness comes only from `reviewDueAt` and `expiresAt`
dates a contributor actually stored. Dispute is structural too: a field is contested when its
revision chain has **forked**, which is real evidence Phase 3 already preserves, not a
"revised more than N times" guess. And no percentages: VR-14's "28% confidence" is
illustrative sample data (§8.6), and a number implies precision we do not have.

**Invariant 12 is enforced by construction rather than by discipline.** `RouteTrustInput` has
no report count and no field one could be inferred from, so the function that summarises a
route *cannot observe reports at all*. Phase 9 must add reporting to a caution path, never to
this one. Similarly invariant 14: the passport echoes the stored `lifecycleState` and is
asserted to return it unchanged across every state and counts up to ten million.

**Deliberately not done, and why each is right to defer.**

- **Assigning** `trusted` or `quarantined` to a link is a contribution and a moderation
  action — Phase 8 and Phase 9. Phase 6 delivers the *capability* to distinguish all three
  classes, proven in tests, and the honest default: an unclassified link is a community
  submission, because silence is not endorsement.
- **FR-10 names followers among a route's activity signals.** Followers do not exist until
  Phase 7, so the passport reports contributors, recent changes and last confirmation, and
  says nothing about followers rather than showing a zero that means "not built yet". When
  Phase 7 adds them, note invariant 14: a follower count describes, it never confers.
- **Lifecycle *transitions*** — dormancy, staleness, quiet — are Phase 11. Phase 6 displays
  the stored state and is asserted never to change it.

**Gate: verified in full.** GitHub Actions run #24, commit `b9348c3` — lint, typecheck, 430
unit/architecture tests, build, migrations onto an empty database, schema-drift check, the
integration suite and **28 E2E assertions**, all on a `postgres:18` container. E2E was not in
CI before this phase closed; adding it caught a stale spec on its first run (Test.md §15).

**FRs:** FR-10, FR-11, FR-33, FR-34, FR-49, FR-52, FR-53, FR-54, FR-62, FR-64, FR-65, FR-66,
FR-67, FR-70, FR-74, FR-81 · **Invariants:** 9–17

---

## Phase 7 — Identity and private journeys

**Scope:** Auth.js + Google sign-in, pseudonymous public handle, follow a route, private
progress (status, target date, actual date, private notes), optional personal tasks,
self-reported completion, `My Journey` (VR-06).

**Exit criteria:** invariant tests 5–8, 18 pass. **No file-upload path exists in the journey
flow.** User A cannot read User B's journey through any endpoint. Aggregates say "users marked
completed".

### Phase 7 result (2026-09-03)

Auth.js with Google, a generated pseudonymous handle, following a route, and a private journey
that is edited in place and never revisioned.

**Privacy is structural, not remembered.** Every exported function in `src/server/journeys/`
takes `userId`, and every query against a private model filters on it *in its own `where`
clause* — not fetched-then-checked, because a fetch followed by an `if` is a rule somebody can
forget to write. Public aggregates live in `src/server/routes/read.ts` instead, so the rule in
that directory needs no exceptions. The architecture suite asserts the shape; the integration
suite has one user hold another's journey id and try four separate writes, and asserts nothing
moves.

**We keep the email and discard the rest.** Google offers a name and a photograph with every
sign-in; the adapter drops both, and there are no columns for them to land in. The handle is
*generated*, never derived — one taken from a display name would publish the real identity
§24.3 says a contributor need not expose, by default, without asking. Its alphabet drops the
vowels, which **reduces the likelihood** that a random suffix reads as a recognisable word —
worth doing because every handle lands on a real person who did not choose it, but not a
guarantee, and not described as one.

**Database sessions rather than JWTs**, for two reasons that both mattered: signing out
revokes immediately, and the E2E suite can write a session row directly — so **the application
contains no test-only authentication path at all.** Nothing to misconfigure, nothing to leave
switched on.

**Invariant 8 is held at two levels.** Archiving a step leaves a follower's progress untouched,
and the foreign key is `RESTRICT`, so the database refuses to delete a tracked step even with
the write guard bypassed. One is the product rule; the other is the floor under it.

**Unfollow archives; delete is separate and explicit** (owner's decision, 2026-09-03). Months
of notes should not go to a mis-click, and "I stopped following" is not "erase my data". The
explicit delete is the only hard delete in the application — invariant 1 protects *shared*
knowledge and deliberately not this.

**Followers and self-reported completions joined the passport as evidence, never as a lever.**
A route with 250,000 followers stays `experimental`, asserted (invariant 14).

**Two findings recorded in Test.md §16:** Next.js encodes every server-action form as
`multipart/form-data`, so "no upload path" cannot be proved from markup and is enforced at the
action boundary instead; and Auth.js silently returns no session when `trustHost` is unset,
which looks exactly like a bad cookie.

**Gate: verified in full.** GitHub Actions run #28, commit `cc42268` — lint, typecheck, 460
unit/architecture tests, build, migrations onto an empty database, schema-drift check, the
integration suite and 38 E2E assertions, all on a `postgres:18` container.

**Deferred deliberately:** the "Was this still accurate?" prompt after completing a step
belongs to the contribution loop (Phase 8, FR-42, §16.5), and contributor credibility signals
with it.

**FRs:** FR-12, FR-23, FR-24, FR-25, FR-26, FR-27, FR-41 · **Invariants:** 5, 5b, 6, 7, 8, 18

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

### Phase 8 result (2026-09-03)

Four distinct contribution actions, a create-route flow, the post-completion prompt, and
contributor history.

**The most important thing this phase did not build is the approval gate**, and its absence is
now guarded rather than merely intended. Source scans forbid `pendingApproval`, `reviewQueue`,
`isApproved` and their relatives in `src/` **and** in the schema; the dictionary is asserted to
say "goes live immediately"; and the browser suite checks the page body after creating a route
and after correcting a field for any word suggesting a wait. VR-08's "All updates are reviewed"
is a mockup exception (§8.6), and a review queue would have inverted the product — a student
with a corrected deadline told to wait, by a platform asserting an authority it does not have.

**CHALLENGE gained storage; CONFIRM gained an author.** Both are a new fourth model class,
`communitySignal`: public and community-authored but not revisioned, so they do not belong in
the revision engine — while still being shared knowledge, so the write guard refuses `delete`
on them exactly as it does for revisioned models. A deletable challenge is a deletable safety
signal.

**A revision resolves a challenge; a confirmation never does.** Somebody vouching that a field
is fine is a competing signal, not an answer, and letting it clear a challenge is how a dispute
gets buried under reassurance (FR-70). The challenge row survives resolution carrying its
reason, its author, and a pointer to the revision that answered it.

**Confirmations count people, not clicks** — one row per person per field, so a count cannot be
inflated by one enthusiastic contributor (invariant 14, BR-32).

**Contributor history is evidence, not a score.** §11 leaves reputation weights open and §25
warns against a competitive points game, so there is no score, level, rank or badge; a guard
forbids `leaderboard`, `reputationScore`, `karma`, `trustScore` and friends. A further test
asserts the summary is imported by exactly one page and by nothing that orders, gates or
promotes anything.

**VR-09's five-stage wizard became one form and then the route itself.** Only the basics need a
page, because until the route exists there is nothing to add steps to; "Review" is looking at
the route, and "Publish" already happened. Every other contribution control is a `<details>`
disclosure containing a plain form — the route stays on screen (§7.1) and the whole loop works
with JavaScript disabled.

**The completion prompt introduces no new contribution type**: "yes" is CONFIRM, and "something
changed" opens the step where UPDATE and CHALLENGE already live.

**Gate: verified in full.** GitHub Actions run #34, commit `69132e2` — lint, typecheck, 480
unit/architecture tests, build, migrations onto an empty database, schema-drift check, the
integration suite, and 46 E2E assertions, all on a `postgres:18` container.

**Two testing findings recorded in Test.md §17**, both of which will recur: E2E specs that
create public content race specs that read it, and Playwright's accessible name for a control
includes the control's own content.

**FRs:** FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-42, FR-43, FR-50, FR-55, FR-69
**Invariants:** 1, 2, 3, 11, 14, 15

---

## Phase 9 — Safety: reporting and quarantine

**Scope:** report categories distinct from challenge, quarantine of high-risk content, admin
review/restore/archive/remove, contact-safety handling, anti-gaming (burst detection), agency
neutrality (VR-11).

**Reports are structured and textual (decided 2026-09-02).** A report references the field,
link, contact or content being reported, plus a category and free-text detail. **No file or
screenshot upload in V1** — no upload endpoint, no blob storage, no attachment table. The
mockup shows one; it is deferred (CLAUDE.md §8.6).

**Exit criteria:** invariant tests 12–14 pass; a quarantined link is not normally clickable but
remains in history; no raw count alone triggers any state change.

### Phase 9 result (2026-09-03)

REPORT as an action distinct from CHALLENGE, quarantine that hides without deleting, and an
administrator queue that shows evidence and recommends nothing.

**The threshold question dissolved rather than being answered.** §23.2 leaves quarantine
thresholds "an operational decision … not fixed in this concept baseline" and CLAUDE.md §11
lists them as open — but FR-71 and invariant 14 independently forbid a raw count being the sole
automatic determinant of a state change. Automatic quarantine was therefore never available,
and making it an administrator action means **no number has to be guessed**. Guards forbid
`reportThreshold`, `autoQuarantine`, `MIN_REPORTS` and `abuseScore` in both `src/` and the
schema, and assert the safety module never compares a report count to anything at all.

**Invariant 12 survived the phase that could have broken it.** `RouteTrustInput` still cannot
observe a report; what this phase added is `quarantinedCount`, a count of *administrator
actions* — a caution, never a reassurance.

**Quarantine withholds server-side.** A phishing URL that reaches the page has already done
most of its work, so `display: none` is not containment. The read layer returns an empty value
and a null `sourceUrl`, while the field, its revisions and the whole history stay untouched —
proved by the history tab still returning the withheld text, and by the browser suite reading
the raw HTML and finding neither the text nor the URL.

**Reports are not public.** A challenge is a claim about information and belongs beside it; a
report is an accusation about conduct, and a public accusation board would be a defamation
surface and a brigading target. Readers see the outcome — whether something is withheld — and
nothing else.

**The administrator is a safety role, not an editorial one** (§23.3). It gates quarantine and
report handling and nothing else; a test asserts it has no reach into contribution at all. A
non-administrator requesting the queue gets a 404, not a 403 — there is no reason to tell
somebody a moderation queue exists and they are not allowed in.

**Caught by an existing guard:** the first draft put the quarantine field-write in the safety
service, and the model-classification test refused it — `Field` is revisioned, and only
`src/server/revisions` may write one. Authorisation stayed in safety; execution moved beside
`confirmField` and `archiveField`.

**Two older guards were rescoped rather than deleted.** The approval-gate scan now reads the
contribution block rather than the whole dictionary, because "Withheld pending review" is
honest copy about a quarantine. And "no report action exists" became a **separation** guard,
which is the property that mattered all along.

**Gate: verified in full.** GitHub Actions run #39, commit `e3dea2b` — lint, typecheck, 508
unit/architecture tests, build, migrations onto an empty database, schema-drift check, the
integration suite, and 52 E2E assertions, all on a `postgres:18` container.

**FRs:** FR-35, FR-36, FR-37, FR-68, FR-71, FR-73 · **Invariants:** 1, 4, 12, 13, 14

---

## Phase 10 — Change propagation and shadow route

**Scope:** change severity, announcement vs effective date, relevance scoped to follower
progress, shadow-route comparison showing scale and location of change, temporary disruptions
with date/location/process scope and expiry (VR-07, VR-10).

**Exit criteria:** invariant tests 19, 21 pass; a follower who completed a step before an
effective date keeps completion and sees context; a disruption expires without mutating the
base route; shadow diff reports added/archived/reordered/changed counts.

**FRs:** FR-28, FR-29, FR-30, FR-32, FR-59, FR-60, FR-61, FR-63, FR-76, FR-77, FR-22

### Phase 10 result (2026-09-03)

**The design decision the whole phase rests on: a change has a derived half and a declared
half, and they are never mixed.**

*Derived* — which steps were added, archived, reordered, relabelled or retimed, and where — is
a fact about the append-only ledger. It needs no contributor and no judgement, so it is
**always available**: every follower can see that the route moved and where, even if nobody
wrote a word about it. *Declared* — severity and effective date — is a judgement about the
world that no diff contains, so a contributor states it or it is absent, and absent renders as
absent. The failure this avoids is inferring "important" from "three fields changed", which
FR-71 forbids and which is wrong in both directions.

**Severity is therefore carried, never computed.** A test asserts that two changes identical
but for severity produce *identical* relevance, and that the domain module never assigns a
`ChangeSeverity` at all. No threshold was invented; CLAUDE.md §11 stays open.

**Relevance is a position, not a score.** `ChangeBearing` is a closed set of checkable
situations — ahead, underway, completed-before-effective, already-done, set-aside, whole-route,
not-following — and a test asserts the returned object contains no number of any kind. There is
deliberately no member meaning "your progress is now invalid", because no such conclusion is
ever ours to draw.

**The shadow route is reconstructed, not stored.** No snapshot table, no version pointer on a
journey: `loadRouteGraphAt(routeId, at)` asks the ledger what the route looked like on a date,
reading existence, archival and content each as of that moment. It works for any date, cannot
drift from the ledger, and needed no schema support because Phase 3 had already bought it.

**Phase 4's overlap problem, resolved deliberately.** Phase 4 proved that drawing the previous
version underneath the current one makes it invisible whenever the shapes are similar — which
is the common case, since a route with one new step is 90% identical. That is the wrong
encoding, not a tuning problem. So the comparison is **side by side, aligned by step identity
on a shared numbered spine**, which is what VR-07 shows. Crucially each side is the ordinary
`Road` from the ordinary layout pass: **no second renderer exists**, and a guard asserts the
comparison component contains no `<svg>`, `<path>` or `viewBox` of its own. The Phase 4 overlay
primitives are kept for ribbon density, where there is no room for two columns.

**A disruption expires by arithmetic.** There is no `active` column and no status field, so
expiry is a comparison against `endsAt` evaluated at read time — it cannot fail to happen, run
twice, or leave a closure showing a month late. Guards forbid a status column on the model and
any cron or sweeper in `src/`. The integration suite counts route revisions before, during and
after a disruption's whole life and asserts the number never moves.

**Applicability is reported, never resolved.** Where a change concerns a fact scoped narrower
than the route, the platform says the scope is narrow and **asks** — §13.3's "applicable /
already handled / not applicable" — rather than guessing which programme somebody applied to.
An answer is believed: `not_applicable` silences the change entirely, and the control stops
asking.

**Caught by an existing guard, twice.** The first draft loaded both sides of the comparison
inside `src/server/journeys/`, which pulled the revision engine into the journey directory —
refused by the Phase 7 privacy guard. Following the rule produced the better design: **the
comparison is public and only the date is private**, so a follower and an anonymous reader now
run identical comparison code. And `promoteDisruptionToChange` was refused by the invariant-13
monetisation guard reading "promote" as paid placement; renamed to `disruptionBecamePermanent`,
which is BR-08's own wording and a better name regardless.

**Deliberately not built:** any notification infrastructure. VR-10's "Subscribe to Alerts",
"Get instant alerts" and "Manage Alert Settings" are §8.6 exceptions; a guard forbids mailers,
push channels and subscription tables, and the page says outright that nothing is sent. VR-10's
second "Impact: High/Medium/Low" axis was also dropped — §41.2 defines exactly four levels, and
two scales for one judgement is one too many. A cross-route Updates feed is not in this phase's
scope and was not added.

**Schema:** four additive models — `RouteChange`, `TemporaryDisruption`,
`RouteChangeRevision` (all `communitySignal`: editable, never deletable) and
`JourneyChangeNote` (`privateUserState`). Migrations
`20260903210000_change_propagation_and_disruptions` and `20260903223000_change_revision_link`
are `CREATE`-only; no `DROP`, no `ALTER` of an existing column, nothing touching a revision
table.

### Phase 10 review follow-up (2026-09-03) — the change→revision link

The review found one real gap: a change announcement could only be associated with the history
it described **by date**. That is not good enough here, and the reasons are properties Phase 3
chose on purpose — revisions written in one transaction share a `createdAt` to the millisecond;
`previousRevisionId` is non-unique so a chain forks and "the revision current at time T" can
have two correct answers (FR-70, invariant 15); and announcements cluster around edits made
together. Phase 10 had already hit the first of these in CI.

**`RouteChangeRevision` names the revision rows an announcement describes.** Chosen over
paired from/to columns because **only the "to" side needs storing** — every revision already
carries an immutable `previousRevisionId`, so a stored "from" would be duplicating a fact the
ledger owns, and a duplicate can disagree. A named revision with no predecessor is meaningful
in itself: the entity did not exist before.

It is **not a second versioning system**. No snapshot, no version number, no sequence — four
nullable foreign keys into revision tables that already exist, with a database CHECK constraint
requiring exactly one per row, because a link resolving to nothing would make the
reconstruction quietly wrong rather than loudly broken. A guard asserts the schema contains no
snapshot or version concept anywhere.

**`shadowForChange` contains no date comparison**, asserted on the function's own source. It
builds `after` from the named revision and `before` from that revision's predecessor, so it
answers "what did *this* change do" even after later edits superseded it — and both sides come
from rows the database refuses to UPDATE or DELETE, which is what makes the comparison read the
same in five years.

`loadRouteGraphAt` stays date-keyed, correctly: "what did this look like the day I started
following it?" is a temporal question and a journey stores a date, not a set of revisions. Its
ordering gained an `id` tie-break so the query has a total order rather than returning whichever
row the planner reached first.

**The link is populated by a person, not inferred.** The announce form offers the route's recent
edits and the contributor picks the one they are announcing. Attaching "whichever revision is
newest" would have looked identical and been a guess — which is the thing the link exists to
stop.

**Severity recorded explicitly** (CLAUDE.md §5): contributor-assigned metadata, never a
system-derived score, and never described as objectively determined. Three guards — no
derivation, no effect on relevance, and no claim of measurement in the copy.

---

## Phase 11 — Lifecycle, dormancy, merge, admin

**Scope:** dormancy for unused new routes only, staleness for established routes, archival,
duplicate flagging and route merge preserving followers and history, annual maintenance tools.

**Exit criteria:** invariant tests 20, 23 pass; merging two routes preserves both follower sets
and both histories; an established quiet route is never auto-invalidated.

**FRs:** FR-38, FR-39, FR-40, FR-46, FR-58

### Phase 11 result (2026-09-03)

**Two rules carry the whole phase, and both are structural rather than remembered.**

**Invariant 23 — dormancy is guarded by a type check, not a comment.** The only branch that
can propose `dormant` sits inside `if (current === Lifecycle.experimental)`, so an established
route cannot reach it however long it has been silent. §19.1 refined "everything is inactive
after 30 days" into exactly that distinction, and a unit test runs the *same silent evidence*
— created 3650 days ago, no followers, no confirmations, nothing for 3000 days — across every
lifecycle state and asserts none but `experimental` is ever proposed dormant.

**The direction rule — automation may only lower prominence or ask for a review; raising a
route's standing requires a person.** Every piece of evidence available for promotion is a
count, and FR-71 forbids counts alone conferring standing. So `proposeLifecycle` never returns
`established` or `developing` from below, never touches `archived`, `removed` or `disputed`,
and its only upward moves undo moves it made itself. Asserted over follower counts up to ten
million.

**Dormancy, quiet and staleness are three different things.**

| State | Says | Comes from |
|---|---|---|
| `dormant` | Nobody ever used this route | `experimental` + 30 days + zero followers, confirmations and edits (FR-38's own number) |
| `quiet` | An established route has gone still | No activity in the recent window. **Not a defect** |
| `stale` | This route's own information is overdue | Stored `reviewDueAt` / `expiresAt` only — no invented period |

**`quiet` carries no caution at all**, which is FR-39 in a line: "Established routes shall not
be treated as false merely because of 30 days without activity; they shall instead expose
freshness/last-confirmed information." `snapshotCautions` and `proposeLifecycle` both read one
shared `lifecycleWarrantsCaution`, so the transition and the rendering cannot drift apart.

**Merge is a canonical-successor declaration, and its whole physical effect is one pointer.**
The duplicate keeps every step, field, revision, contributor attribution and follower it ever
had; it leaves search and gains a signpost. Physically relocating content was rejected — it
would put revision chains under a route that did not author them, detach `JourneyStepProgress`
from the route its owner chose, and produce two histories for one fact. FR-58 requires that
progress and history "shall not be lost", and the reliable way not to lose something is not to
move it. §40.4 describes exactly this shape.

Because nothing moves, **both follower sets survive by construction** rather than by careful
handling. The integration suite proves it end to end: two routes, independent histories, a
different follower with private progress on each, and after the merge every history entry is
identical, both journeys are intact, the private note and completion date are untouched, and
every contribution is still attributed to whoever made it. Merges chain, refuse cycles and
self-merges, and are reversible — §40.1 protects routes that overlap heavily but are genuinely
different, and a judgement that cannot be withdrawn is one nobody should make.

**A duplicate flag changes nothing.** Ten people flagging a pair leaves the route in search
with its standing untouched; the queue is ordered oldest-first and carries no tally, because
two routes are the same journey or they are not and no count settles it (invariant 14). An
administrator closing a flag as "genuinely different" is a real answer, not a failure.

**Reports can never move a lifecycle state.** `LifecycleEvidence` has no report field, and the
lifecycle modules never read the `Report` table or import the safety service — asserted
structurally. Automatic archival on report volume would have made brigading a way to bury a
route, which is what BR-11 keeps safety reports apart from accuracy signals to prevent.

**Caught by an existing guard.** The first draft wrote `prisma.route.update` directly for
lifecycle and merge, and the Phase 3 model-classification test refused it — only
`src/server/revisions` may write a revisioned model. Execution moved to
`setRouteLifecycleState` / `setRouteMergePointer` there; authorisation stayed in
`src/server/lifecycle`. Exactly the split Phase 9's quarantine work arrived at.

**Schema:** two additive models — `RouteLifecycleEvent` and `DuplicateFlag`, both
`communitySignal` and undeletable — plus three nullable columns on `routes` recording a merge
decision. `Route.mergedIntoId` itself has existed since Phase 2. Migration
`20260903235000_lifecycle_duplicates_and_merge` is `CREATE`/`ADD COLUMN` only.

**Two owner decisions, both recorded in CLAUDE.md §5** (2026-09-03):

- **The 90-day quiet window is an approved V1 implementation parameter, not a baseline rule.**
  §19 defines `quiet` as "no recent activity" and never defines *recent*. It stays
  informational, generates no caution, and never downgrades an established route. Phase 12
  reviews its wording.
- **Canonical-successor merge is the approved V1 semantics**, recorded explicitly so §40.4's
  "combine them into a stronger canonical route" is never reinterpreted as destructive content
  movement. Information reaches the survivor through the ordinary attributed contribution
  system, never by transplanting revision chains.

---

## Phase 12 — Responsive, accessibility, polish, support link

**Scope:** mobile reflow per VR-12 and VR-13 (not scaled desktop), accessibility (meaning never
colour-only, keyboard, contrast, screen-reader labels), performance, empty/error states,
advertising-separation guarantees, and the **voluntary support link** per CLAUDE.md §10.1.

**Exit criteria:** no horizontal page overflow at 360px; wide content scrolls in its own
container; automated a11y pass; the support link is an outbound Gumroad link with no payment
code, no supporter flag, and no effect on any trust mechanism.

**FRs:** FR-47, FR-78 · **Scope change:** §10.1

### Phase 12 result (2026-09-04)

A product-quality pass, not an architectural one. No domain, revision, trust, journey,
contribution, safety, shadow-route or lifecycle behaviour changed; the guards that protect
each of them still pass unmodified.

**Four things were silently wrong, and "silently" is the point of all four.**

**`ROAD_NARROW` had existed since Phase 4 and nothing ever selected it.** Every phone was
served the 5-column, ~890px desktop road inside a horizontal scroller — exactly the "scaled
desktop" §7 and VR-12 forbid. `ResponsiveRoad` renders both densities and lets a media query
choose, so a 360px screen gets a road that wraps at 2 columns: a different composition, not a
smaller one. It costs **no JavaScript** — the application still has exactly one client
component, the error boundary Next requires to be one.

**`ink-500` measured 4.28:1 against white — below WCAG AA for normal text.** It carries almost
every explanatory line in the product, and those lines are `text-xs`, so the 3:1 large-text
allowance never applied to them. The copy that was failing is the copy explaining what a source
class means, why a route is quiet, and that a follower's progress is untouched. Darkened to
L=0.55 (4.85:1). A test now recomputes every text token against every background it sits on,
**reading the palette out of `globals.css`** so the numbers cannot drift from the theme.

**`bg-canvas` and `bg-brand-50` were never defined.** Tailwind emits no CSS and no warning for
an undefined utility, so those elements simply had no background — invisible on a white page.
A guard now checks every colour utility inside every `className` resolves to a real token.

**Indexing was still off.** Phase 0 set `robots: index: false` with a note that Phase 5 would
open it; Phase 5 opened the read path and this was missed for six phases. Every public route
page has been unlisted since. Now on for the read path, with `/admin` and `/journeys` excluded.

**Tablets got the phone layout.** `PageGrid` jumped from one column straight to twelve at
`lg`, so everything from 640px to 1023px stacked with half the screen unused. There is now a
middle composition at `md` on a six-column grid — six rather than twelve because a tablet has
room for two panels and not three.

**Presentation:** an icon (the road, not a letterform — the public name is not frozen, D-32),
a theme colour, per-page titles through a template (every page shared one title until now, so
tabs, history and bookmarks were all useless), an error boundary that leaks nothing about what
failed and says outright that saved progress is unaffected, and a loading skeleton for Neon's
cold starts. A global `:focus-visible` ring at 7.81:1 replaces whatever the browser drew, which
on a `<summary>` — this product's disclosure element everywhere — was easy to lose entirely.
The dead Phase 0 "under construction" copy was removed.

**The two judgement calls the review flagged, both acted on.**

*The quiet wording.* The first draft opened "Nothing has changed on this route recently", which
a skimmer reads as neglect and stops. It now leads with **agency** — "no one has needed to
change this route recently" — names the two ordinary reasons so the benign reading is offered
rather than merely permitted, and ends by pointing at the last-confirmed date. And that date is
now shown **outside** the passport's disclosure for quiet routes specifically: FR-39 says such a
route "shall instead expose freshness/last-confirmed information", and behind a click is not
exposed. Only for `quiet`, so it does not become a date on every route.

*The shadow comparison.* The roads carried no marking of which steps changed, so a reader had
to compare two pictures by eye — the comprehension problem the side-by-side layout was supposed
to solve. `RouteAnnotations` gained `archivedStepIds`, and the comparison now marks arriving
steps on the current road and departing ones on the older road, using the primitives Phase 4
already had. Both roads still come from the one generic renderer.

**The §10.1 support link** is one line in the footer, in body text, next to a sentence saying it
changes nothing. It is a link and nothing more: no API, no payment table, **no supporter flag**
— so nothing *could* condition on one, which is a stronger form of invariant 13 than a rule
about how a flag may be used.

---

## The visual phases (12B–12G) — why they exist

Phase 12 shipped and the deployed product still did not look like the product. The owner's
inspection after it closed is the finding: *"still looks like an engineering prototype rather
than the Vindeshi Express product represented by our visual references."*

**The cause is in this file, and it is structural.** Search every phase above for a visual
reference and you find them cited for *behavioural* lessons only — VR-07 taught side-by-side
comparison, VR-10 taught disruption scope, VR-09 taught step grouping, VR-08 taught that there
is no approval gate. Correct, all of them. But **no phase in this plan ever had an exit
criterion that a screen must look like anything.** Twelve phases each passed their own gate
honestly while the visual dimension went unbuilt, because nothing could fail on it.

Everything else in this product is enforced by a test that fails the build. Appearance was
enforced by intention. That asymmetry is the whole explanation, and these phases exist to
remove it: **every phase below has at least one exit criterion naming a visual reference, and
Gate 4 blocks release on it.**

The goal, in the owner's words (2026-09-04): *when the real data is there, the platform shows
exactly like those mockups.*

### What a mockup is binding on, and what it is not

CLAUDE.md §8.1 ranks the mockups third and says "if a mockup conflicts with the baseline or
this file, the mockup loses." That stays true and is not being weakened. It is being made
precise, because "design intent only" was read as "optional", and that reading is what these
phases repair.

| | Binding? | Example |
|---|---|---|
| **Arrangement** | **Yes — acceptance criteria now** | A ribbon spans its row as a segmented band; a road wraps with curved connectors; a route page has a left nav rail, a centre roadmap and a right rail; a step's fields are a table with source and freshness columns; a phone gets bottom tabs, not a narrower desktop |
| **Assertion** | **No — the baseline and the §6 invariants win** | "Verified Route", "Community Verified 98%", "4.8/5", "28% confidence", "All updates are reviewed", "Safety Leaderboard", "Subscribe to Alerts", screenshot upload, "Share Progress" |
| **Content** | **Never** | Every university, fee, IELTS score, visa rule, processing time, follower count and username in every mockup is illustrative (§8.6) |

Where arrangement and assertion collide — a panel whose *layout* we want and whose *claim* we
refuse — the phase **builds the panel and records the substitution in writing**. VR-14's "28%
confidence" ring becomes the route passport's counted evidence, in the same position, at the
same visual weight. Silently dropping the panel is how a screen ends up empty; silently keeping
the claim is how the product starts lying. Neither is available.

### Two open decisions become blocking here

CLAUDE.md §11 has deferred both since Phase 0, correctly — nothing needed them until now.
Phase 12B needs both and cannot proceed without them:

- **The six category colours** (documents/preparation, language/tests, admission/university,
  funding/scholarship, immigration/visa, travel/departure). Every mockup depends on them and
  the ribbon is unreadable without them. `globals.css` currently defines **zero**.
- **Route maturity label wording and its palette.** VR-14 is built almost entirely out of it.

Phase 12B proposes both and **stops for owner approval before implementing them.** Inventing
either would be answering an open decision by accident, which §11 exists to prevent.

### What does not change

These are presentation phases. None of them may alter the route graph, the revision ledger,
trust derivation, journey privacy, lifecycle transitions, merge semantics or safety handling —
the guards protecting each must pass **unmodified** at every gate. Specifically:

- **Invariant 24 holds absolutely.** 12C makes the renderer look like the mockups by making the
  *primitive library* richer. No route-specific artwork, no destination branching, no second
  renderer. Structural equivalence, generative coverage, the import boundary and the identity
  check all still pass.
- **Invariant 25 holds.** Ribbon and road stay one representation at two densities.
- **The no-JavaScript guarantee holds.** The whole read path works with JS disabled and the
  application keeps exactly one client component. "Make it feel snappy" is not a licence to
  ship a single-page application; server rendering *is* the performance strategy.
- **No fake data, ever.** A screen with nothing to show gets an honest empty state, never a
  plausible-looking sample route. §45's cold-start risk is answered by seeding real research
  (content track), not by decoration.

---

## Phase 12B — Design system and visual foundation

**Goal:** the vocabulary every later screen is built from. Nothing here is a screen; everything
here is what a screen is made of.

Today `globals.css` has **15 colour tokens and zero typography, spacing, radius or elevation
tokens**, so every component invents its own sizes inline. That is the mechanical reason the
product reads as a uniform stack of grey cards: there is no scale to build hierarchy with.

**Scope**
- **Type scale** — display, page title, section, panel title, body, small, micro — with line
  heights and weights, as tokens. Most of the mockups' hierarchy comes from this alone.
- **Spacing, radius and elevation scales.** The mockups use a consistent 8px-family rhythm, a
  large panel radius and a very light shadow; all three are currently ad hoc per component.
- **The six category colours** and their icons — *pending owner approval, see above.* Colour is
  always paired with a label and an icon (§10.4).
- **The maturity palette and label wording** — *pending owner approval.*
- **Brand lockup**: the Bengali wordmark ভিনদেশী এক্সপ্রেস over VINDESHI EXPRESS with the
  paper-plane mark. VR-01/03/04 all lead with it; we currently render plain text.
- **Component primitives**, extracted from what the mockups actually repeat: `Button`
  (primary/secondary/quiet), `Chip`, `Panel`, `PanelHeader`, `StatRow`, `Breadcrumb`, `Tabs`,
  `Rail`, `FieldTable`, `EmptyState`, `Stepper`, contributor mark.
- ~~One dev-only component gallery route.~~ **Deferred to 12G, deliberately.** A gallery is a
  page that has to be excluded from indexing, kept out of any sitemap, and given a title and a
  canvas like every other page — real surface area whose only reader is a developer. 12G's
  screenshot suite gives the same "see every primitive at once" benefit from screens that
  actually ship, and it is reviewed rather than merely available. Recorded rather than
  silently dropped.

### Phase 12B result (2026-09-04)

`src/app/globals.css` grew from 15 colour tokens and no scale to a type, spacing, radius and
elevation scale plus a measured category palette; `src/components/ui.tsx` holds the primitives.

**The two open decisions are closed in CLAUDE.md §11, and one of them is closed by saying no.**
The category palette was *fitted*, not picked: constant lightness across the six so they read
as a family, chroma bisected per hue to the sRGB boundary, hues in journey order. Every value
is re-measured on each commit from the CSS itself — worst category ink 6.13:1, worst road line
3.40:1. The **maturity** palette was declined: there are no `--color-lifecycle-*` tokens and a
test fails if one appears, because a hue per state fights §7.3's weight system, a green
`established` chip is a safety claim invariant 12 forbids, and `quiet` versus `established` is
a difference in activity rather than in how much care to take (FR-39).

**Three guards caught three real errors during the phase, which is the argument for writing
them first.** `text-hairline` on a breadcrumb separator — a border token at L=0.91, invisible
as text. Six colour literals still hardcoded in the renderer after the palette moved to
tokens, meaning the contrast test would have been certifying values that were not being
painted. And `tone="quiet"` on a panel, which collided with the `quiet` lifecycle state under
the §9 single-source rule; renamed `sunken`, which is a slightly worse name and a much better
outcome than two meanings for one word in a codebase where one of them decides how a route is
presented.

**Also fitted-then-floored.** Three of the first eighteen tones were written 0.3% outside sRGB
because the chroma fit was rounded *up* afterwards. Invisible, and enough to make every
measurement a fiction — the browser clamps, so the certified colour is not the painted one.
There is now a gamut test.

Gate: `lint`, `typecheck`, 686 unit/architecture tests, and a clean production build. Verified
by screenshot at 360/768/1280/1440: every page 200, zero horizontal overflow, and the six
categories rendering with icon, colour and label on a branching road.

**Exit criteria**
- ✅ Owner has approved the category palette and the maturity palette/wording; both recorded in
  CLAUDE.md §11 as **closed**, with the date
- ✅ A test asserts every category colour resolves to a real token, and that no component
  renders a category by colour alone — label and icon always present
- ✅ Contrast recomputation covers the new tokens; every text pair still passes WCAG AA
- ✅ A test asserts no arbitrary-value sizing utility (`text-[`, `p-[`, `rounded-[`) in
  `src/components` or `src/app` — sizes come from the scale
- ✅ The brand lockup renders in the header at all four viewports and matches VR-01
- ✅ Zero new client components; zero new dependencies

**Visual references:** VR-01 (brand, chips), VR-03/04/05 (panels, rails, tables), VR-14 (maturity)

---

## Phase 12C — Ribbon and road as drawn

**Goal:** the two objects the product is named for finally look like themselves — still from one
generic, data-driven renderer.

This is the single largest visual defect and it is measurable. `RIBBON.columnWidth` is **30px**,
so an eight-step ribbon draws about 160px wide inside a ~790px result row: a thumbnail, where
VR-03 shows a full-width band of eight labelled chevrons carrying the route's whole shape. And
`ROAD` draws plain markers on straight connectors where VR-04 shows an actual road surface
wrapping through three rows with curved returns and step cards sitting on it.

**Scope**
- **Ribbon**: proportional to its container rather than a fixed 30px column — a segmented band
  filling the row, one segment per step in the road's order, category-coloured, labelled where
  width permits and icon-only where it does not. Still the compressed road (invariant 25).
- **Road**: road-surface primitives — carriageway, centre line, curved return between wrapped
  rows, junction, merge — and step *cards* rather than bare markers, carrying number, icon,
  title and duration as VR-04 does.
- **Category colour and icon** applied by the renderer from step category data.
- **Step state** drawn on the road — completed / in progress / not started / optional — from
  data the journey already holds (VR-04's legend).
- **Compact horizontal stepper** as a third density, for step-detail headers (VR-05, VR-13).
- Wrapping tuned per density so 3–20 steps read well at 360 / 768 / 1280 / 1440.

**Exit criteria**
- ✅ **Structural equivalence still passes** — two routes, same graph, different destinations,
  identical geometry. This is the invariant-24 proof and it is not negotiable
- ✅ **Generative coverage still passes** on random valid graphs, 3–20 steps
- ✅ **No identity branching** in `src/renderer/**`; the import boundary still holds
- ✅ Ribbon and road step counts and order still match for every fixture (invariant 25)
- ✅ A ribbon occupies **at least 85% of its row's width** at every viewport, asserted in E2E —
  this is the defect that must not silently return
- ⬜ Side-by-side screenshots of a real seeded route against VR-03 (ribbon) and VR-04 (road),
  reviewed and accepted by the owner
- ✅ Renders with JavaScript disabled; zero client components added

**Visual references:** VR-03 (ribbon band), VR-04 (wrapping road), VR-05/VR-13 (stepper)
**Invariants:** 24, 25

### Phase 12C result (2026-09-04)

The ribbon is a band and the road is a road. Both still come out of the one `layout()` pass
from the one primitive library; no route-specific code, no second renderer, and the
structural-equivalence, generative, import-boundary and identity guards all pass unchanged.

**The ribbon defect had two halves and fixing only the first made it worse.** `columnWidth`
was 30, so an eight-step ribbon drew ~160px inside a ~790px row. Stretching the *spacing* to
a target width (`fitWidth`) fixed the extent and produced five small chevrons adrift in 960
units of whitespace — wider, and still not a ribbon. The segments have to grow with the
columns (`fillColumns`), and because the marker width then depends on the column width which
depends on the marker width, the equation is *substituted* rather than iterated:
`width = 2·padding + columnWidth·(FILL + columns − 1)`, one unknown, solved directly.

Both are derived from **structure alone** — the rank count — so identical shapes still lay out
identically. `columnWidth` became a floor rather than a value, which is what preserves the
non-overlap guarantee Spike A bought: a route long enough that the fitted spacing would be
narrower than a marker keeps the minimum and simply comes out wider than the target, and the
viewBox scales it back.

**The road joins card centres, not card edges.** Edge-to-edge left the asphalt visible only
in the 38-unit gaps between cards, which reads as a connector between boxes. VR-04 runs one
continuous road with the cards sitting *on* it, so the connectors now meet at centres and the
opaque cards hide the part that passes behind them. Ribbon density keeps edge-to-edge, because
its chevrons abut and a centre-joined connector would start underneath a segment.

Also: step *cards* rather than markers (176×74, ordinal badge, category rail, icon, title,
duration), a real carriageway with a dashed centre line, `columnsPerRow` 4 → 5 after a
five-rank route wrapped onto a second row carrying one card and a band of dead space, and
`durationShort` in the dictionary — which says "about", always, because a bare "6 weeks" on a
road is a promise invariant 16 and BR-18 do not let us make.

**Two things the type system and a guard caught.** Removing `width`/`height` from the SVG broke
the E2E that read `getAttribute('width')` to tell which density was painted; it reads the
viewBox now, which is the honest signal. And adding `duration` to `RouteVisualStrings` failed
the build in three places at once — the renderer holds no strings of its own, so every caller
had to supply the formatter.

Gate: `lint`, `typecheck`, 686 unit/architecture tests, clean production build. Screenshots at
360/768/1280/1440: every page 200, zero horizontal overflow, and at 360px the road wraps into
a serpentine with curved returns rather than shrinking.

---

## Phase 12D — Public read path composition

**Goal:** the screens an anonymous visitor sees are composed the way the mockups compose them.

**Scope**

*Landing (VR-01).* Bilingual hero — Bengali headline, English subhead — the illustrated
Bangladesh→destination route, `Find My Route` and `How It Works`, the three honest trust chips
(Free / Community Maintained / No Document Upload), a three-step "how it works" strip, popular
destinations. The route illustration comes from the **renderer**, drawn from real seeded route
data — not a hand-drawn hero image. Invariant 24 applies to the homepage too.

*Discovery and search (VR-12 desktop, VR-03 search bar).* The four controls as one horizontal
band with flag-marked selects; results as full-width ribbons carrying duration, fly window,
followers, activity and maturity on the row (VR-03); destination cards; a recently-updated rail.
**Pagination**, which does not exist today — 359 routes currently renders a page tens of
thousands of pixels tall.

*Route (VR-04, VR-13).* Three regions: a left route-navigation rail (Roadmap / About /
Requirements / Costs / Shadow Route / Updates), the centre roadmap, a right rail carrying the
passport, fly window and recent updates. Breadcrumbs. A route header with origin→destination,
level, intake, following count and maturity.

*Step detail (VR-05).* The horizontal stepper, the step's header and status, and the **field
table** — Field / Information / Source / Last Updated / Applicability / Action. Fields stay
grouped by provenance (Phase 6) *within* the table rather than badged individually.

*Low-trust route (VR-14).* The experimental/disputed presentation: caution banner, evidence row
(contributors, following, recent confirmations, fields needing review, open challenges), "Use
with Caution", and the route-state legend.

**Substitutions to record, not silently omit:** VR-14's confidence ring and VR-13's 4.8/5 stars
become the passport's counted evidence in the same position and at the same weight; VR-12's and
VR-13's "Verified" / "98%" become source and last-confirmed language (BR-20, §8.6).

**Exit criteria**
- ⬜ Screenshots at 360/768/1280/1440 of landing, search, route and step reviewed side by side
  against VR-01, VR-12, VR-04, VR-05 and VR-14, and accepted by the owner
- ⬜ Search results paginate; no page exceeds a reasonable document height
- ⬜ Every page uses `PageCanvas`; one left edge across header, content and footer (guarded)
- ⬜ Breadcrumbs on every route-context page, each segment a real link
- ⬜ Every §8.6 exception is absent, asserted by the existing guards, and each substitution is
  recorded in this file
- ⬜ The whole read path still works with JavaScript disabled
- ⬜ A destination with no routes shows an honest empty state, not a sample route

**Visual references:** VR-01, VR-03, VR-04, VR-05, VR-12, VR-13, VR-14
**FRs:** FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-08, FR-09, FR-10, FR-11, FR-74

---

## Phase 12E — Signed-in and community surfaces

**Goal:** the screens behind sign-in look like the same product as the ones in front of it.

**Scope**

*My Journey (VR-06).* Private badge and the privacy explainer panel, route summary card, the
progress ring and fly window, a left section rail (Overview / All Steps / Calendar & Deadlines /
Notes / Route Changes / Settings), per-step rows with status, target and completion dates and
expandable private notes, an upcoming-deadlines rail and a recent-changes rail.
*Substitution:* no "Share Progress" (FR-26, BR-16, D-10).

*Route changes and shadow comparison (VR-07).* The two-column comparison on a shared numbered
spine — built in Phase 10 and correct — recomposed to VR-07's density: change-summary counts,
the most-recent-change panel, and the "How changes affect you" panel stating the follower's
start date, whether the change applies, and that completed steps remain valid.

*Contribution (VR-08, VR-09).* Update: current value beside proposed value with route/step/field
context, applicability, reason and source. Create route: the basics form and then the route
itself, composed as VR-09 composes it, with its step strip drawn by the renderer.
*Substitution:* VR-08's "reviewed by the community / goes live when confirmed" staging is **not**
built; the copy says updates go live immediately, and the Phase 8 guard enforces it.

*Safety (VR-11).* Report category grid, detail form, "what happens next", quarantine explanation.
*Substitutions:* no screenshot upload (§8.6, decided 2026-09-02), no Safety Leaderboard (§25),
and the recently-quarantined list is not public (Phase 9 — reports are not a public board).

*Updates (VR-10).* A route's own updates and disruptions surface, with the four severity levels
and the permanent-change vs temporary-disruption distinction made visual. *Substitutions:* no
"Subscribe to Alerts", no "Manage Alert Settings", no second Impact axis (§35, §41.2). **A
cross-route updates feed is a scope question, not an assumption** — it was explicitly outside
Phase 10's scope; if it is wanted it is a change request first.

*Also:* sign-in, contributor page, admin queues and the 404, composed to the same system.

**Exit criteria**
- ⬜ Screenshots at all four viewports reviewed against VR-06, VR-07, VR-08, VR-09, VR-10 and
  VR-11, and accepted by the owner
- ⬜ Privacy, revision, safety, lifecycle and monetisation guards pass **unmodified**
- ⬜ Every substitution above is present in this file and enforced by an existing guard
- ⬜ No upload control exists anywhere in the application, asserted at the action boundary
- ⬜ Contribution controls remain reachable in minimal interaction and work without JavaScript

**Visual references:** VR-06, VR-07, VR-08, VR-09, VR-10, VR-11
**FRs:** FR-13–FR-18, FR-23–FR-30, FR-35–FR-37, FR-42, FR-50, FR-55, FR-60, FR-61, FR-77

---

## Phase 12F — Mobile and tablet as their own product

**Goal:** the phone gets the composition VR-12 and VR-13 draw, which is **not** the desktop
composition at a smaller width.

Phase 12 fixed the two mechanical failures — the road no longer scales down, tablets no longer
get the phone layout. Neither delivered the mobile *product* the mockups show, which differs in
its information architecture, not in its widths.

**Scope**
- **Bottom tab bar** — Explore / My Journey / Updates / Profile (VR-12, VR-13, VR-14 phones)
- **Route as tabs on a phone** — Route / Details / Updates — with the horizontal step-chip strip
  above them (VR-13)
- Compact ribbons, stacked filters and a swipeable destination row on discovery (VR-12)
- Step detail as its own phone view with its own tab strip (VR-13)
- A tablet composition that is genuinely two-panel rather than one wide column
- The 4px horizontal overflow at 360px on the route page, still open from Phase 12, fixed at its
  actual cause — the non-wrapping four-tab nav in `route-context.tsx` is the next suspect

**Exit criteria**
- ⬜ Zero horizontal overflow on every page at 360px, 390px and 768px — the outstanding Phase 12
  E2E failure is green and stays green
- ⬜ Phone screenshots reviewed against the phone panels in VR-12, VR-13 and VR-14 and accepted
- ⬜ A phone reaches every read-path destination in the same number of interactions as desktop,
  or fewer
- ⬜ Bottom navigation is server-rendered and keyboard reachable; no client component added
- ⬜ Touch targets ≥ 44px; the whole phone path works with JavaScript disabled

**Visual references:** VR-12, VR-13, VR-14
**FRs:** FR-47 · **Quality expectation:** Mobile usefulness (§32)

---

## Phase 12G — Visual acceptance

**Goal:** make the fidelity provable and keep it from decaying — so it never silently regresses
the way it silently never arrived.

**Scope**
- A **screenshot suite** in CI: every screen at 360 / 768 / 1280 / 1440, published as build
  artifacts so a human can compare them against `Visual References/` without running anything
- A written **fidelity checklist per mockup** in `Test.md`: what matches, what is deliberately
  substituted and why, what is genuinely outstanding
- Performance: confirm everything is server-rendered, the client-component count is still
  **one**, and record cold and warm navigation timings
- A full keyboard pass and an automated accessibility pass over every screen
- Empty, loading and error states for every screen, including Neon's 25–30s cold start
- Remove every remaining prototype characteristic: placeholder copy, unstyled controls, default
  browser widgets, debug text

**Exit criteria**
- ⬜ **Gate 4 passes** (below)
- ⬜ The whole project gate is green on one commit — lint, typecheck, unit, architecture, build,
  migrations, drift, integration and E2E
- ⬜ Owner has reviewed the screenshot artifact set and accepted it
- ⬜ The client-component count is still exactly one
- ⬜ `Test.md`, `Status.md` and this file record the verified run and commit

---

## Phase 13 — Pre-launch gates and release

Run the four gates below. Fix and re-run until all pass. Then release.

**Phase 13 cannot start while any of 12B–12G is open.** A product that works and does not look
like itself is not releasable, and this phase previously implied otherwise by following Phase 12
directly.

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
Bangladesh** (FR-48), not a generic "study in X" article. Where relevant, cover: academic requirements;
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

All four must pass before public launch. Each has an owner artifact in `Test.md`.

Note the division of labour between Gate 1 and Gate 4, because conflating them is what let the
visual dimension go missing: **Gate 1 is renderer *correctness*** — every graph shape draws,
with no route-specific code and no overflow. It would pass on a renderer that draws grey boxes.
**Gate 4 is whether the product looks like the product.** Neither substitutes for the other.

### Gate 1 — Visualisation scalability

The ribbon/road renderer handles seeded and community-created routes **with no route-specific
code**.

- [ ] Renders: linear, wrapping, optional branch, alternative branch, parallel activities,
      rejoining branch, newly added step, archived step, shadow/previous version, temporary
      disruption indicator
- [ ] Usable from 3 to 20 primary steps
- [ ] Legible on desktop, tablet and mobile; no page-wide horizontal overflow
- [ ] Ribbon and road derive from one structure and one layout pass; step count and order match
- [ ] **Structural equivalence holds** — same graph shape, different destination, identical geometry
- [ ] **Generative coverage passes** — randomly generated valid graphs all render validly
- [ ] **Renderer imports nothing from seed, content or destination modules** (lint-enforced)
- [ ] **No identity branching** in `src/renderer/**` (scoped check, not a repo-wide grep)
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

### Gate 4 — Visual fidelity

The product looks like the product. This gate is **human-judged and cannot be automated away**,
in the same way and for the same reason as Gate 2's last line.

- [ ] A screenshot exists for every screen at 360, 768, 1280 and 1440, produced by CI
- [ ] Each is reviewed against its visual reference and accepted by the owner:
      VR-01 landing · VR-03 ribbon-to-road · VR-04 full road · VR-05 step and fields ·
      VR-06 My Journey · VR-07 shadow comparison · VR-08 update flow · VR-09 create route ·
      VR-10 updates and disruptions · VR-11 report and safety · VR-12 responsive search ·
      VR-13 responsive road and step · VR-14 experimental/disputed route
- [ ] Every deliberate departure from a mockup is **written down** in the fidelity checklist
      with the rule that forced it — an unexplained difference is a defect, not a decision
- [ ] Every §8.6 exception is genuinely absent, asserted by an existing guard
- [ ] The design system is used throughout: no arbitrary-value sizing utilities remain
- [ ] Category colour is never the only carrier of meaning; contrast passes WCAG AA everywhere
- [ ] No horizontal page overflow at any of the four viewports
- [ ] Server-rendered throughout; the client-component count is still exactly one; the whole
      read path works with JavaScript disabled
- [ ] **No screen contains invented sample data.** Where content is absent, the empty state is
      honest — this is what makes "looks like the mockups" compatible with §45 and Gate 2

The gate's real question, and it needs a person: *would a Bangladeshi student landing on this
believe it was built for them, or would they believe it was a developer's test page?*

---

## Open plan items

**Phase 0 has no remaining blocking decisions.**

Still open, but none of it blocks starting:

- ~~FR coverage audit not yet run.~~ **Run 2026-09-02, during Phase 2.** All 80 FRs are now
  assigned; two orphans were found and fixed (FR-48 → content track, FR-54 → Phase 6). The
  audit is now `tests/architecture/fr-coverage.test.ts` and runs on every commit, so it
  cannot decay again.

  **The original rule — "exactly one phase" — was wrong, and has been corrected.** Nine FRs
  legitimately span two phases because a mechanism and its surfacing are different work:
  FR-57 is the branching *schema* in Phase 2 and the branching *renderer* in Phase 4; FR-12
  is the write gate in Phase 3 and sign-in in Phase 7; FR-79/FR-80 are delivered in Phase 0
  and re-verified at the Phase 13 gate. Forcing those into one phase each would have made the
  plan less accurate, not more. The rule is now: **every FR appears in at least one delivering
  phase**, and Phase 1 citations are proofs rather than assignments.
- **Presentation details deferred by the baseline itself** (§46.2): final brand name, exact
  maturity label wording and colours, staleness thresholds for established routes, quarantine
  and report numeric thresholds, reputation labels and weights. Needed during their own phases,
  not now — see CLAUDE.md §11.

### Decisions resolved 2026-09-02 (were blocking)

| Was open | Resolved |
|---|---|
| Hosting target | **Vercel** + Neon, Node runtime, standard Prisma client. Cloudflare Workers explicitly out of the initial architecture. |
| Report attachments (VR-11) | **Deferred from V1.** Structured, textual reports only; no upload or storage path. |
| Renderer enforcement | Grep replaced with structural-equivalence, generative, import-boundary and scoped identity-branching tests. |
| Gate 3 scope | Golden-path E2E **plus** focused unit/integration tests, not instead of them. |
| Requirements copies | DOCX frozen archival authority; `REQUIREMENTS.md` generated dev-readable representation; MHT optional browser copy. |
