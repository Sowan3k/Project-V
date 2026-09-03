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
| 10 | Change propagation and shadow route | Followers see what changed | ⬜ |
| 11 | Lifecycle, dormancy, merge, admin | Maintenance without data loss | ⬜ |
| 12 | Responsive, accessibility, polish, support link | Launch-quality UI | ⬜ |
| 13 | Pre-launch gates and release | Gates 1–3 pass | ⬜ |
| — | **Content track** (parallel, from Phase 1) | Real seeded routes | 🟡 |

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
