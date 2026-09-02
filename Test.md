# Test.md — Vindeshi Express test ledger

Running record of every test written or run, its result, and what remains unverified.
**Update this after every test run.** If a test was skipped, say so — an unrecorded gap
reads as coverage that does not exist.

Read alongside [CLAUDE.md](CLAUDE.md) §6 (the 25 invariants) and [Phases.md](Phases.md).

---

## Legend

| Mark | Meaning |
|---|---|
| ✅ | Written and passing |
| ❌ | Written and failing — must be listed in Open failures below |
| 🟡 | Partially covered — happy path only, edges unverified |
| ⬜ | Not written yet |
| 🚫 | Deliberately not tested — reason required |

---

## 1. Test infrastructure

| Item | State | Notes |
|---|---|---|
| Vitest (unit/architecture) | ✅ | Vitest 4.1.11, node environment. `tests/**`, `src/**/*.test.ts`. Playwright specs excluded. |
| Playwright (E2E) | ✅ | Playwright 1.62.1, Chromium. Two projects: `mobile-360` and `desktop-1280`. |
| E2E target selection | ✅ | Local production build by default; `E2E_BASE_URL` points the same specs at a deployed preview. |
| Integration tests (`test:db`) | ✅ | `vitest.db.config.mts` against `TEST_DATABASE_URL`. Neon `test` branch locally, a `postgres:18` service container in CI. Excluded from `npm run test` rather than left to self-skip — a suite reporting "skipped" reads like dormant coverage. |
| Test database strategy | ✅ | Scratch branch via `neon branches create` — never run tests against `production`. No Vitest test connects to a database; the E2E health probe does, through the running app. Neon branches: `production`, `vercel-dev` (created by the integration, schema-identical), `phase-0-migration-rehearsal` (kept as evidence). |
| CI pipeline | ✅ | `.github/workflows/ci.yml`, two jobs. The `database` job now also marks its throwaway Postgres as disposable and runs the integration suite. `verify`: lint → typecheck → test → build. `database`: applies migrations to an empty Postgres, fails on schema/migration drift, runs the integration suite. |
| Vercel deployment | ✅ | Project `vindeshi-express` linked to `Sowan3k/Project-V`; production branch `main`. Neon–Vercel integration supplies `DATABASE_URL`; the deployed `/api/health` returns 200. Deployment Protection is on (repo is private) — `e2e/deployment-access.setup.ts` handles it. |
| Coverage reporting | ⬜ | Not set up. Deliberate: coverage of a shell is a meaningless number. Revisit at Phase 3. |

**Command reference** (once Phase 0 lands):

```bash
npm run test           # vitest
npm run test:e2e       # playwright
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
```

---

## 2. Verification log

Manual and automated checks actually performed, newest first.

| Date | What was verified | Method | Result |
|---|---|---|---|
| 2026-09-02 | **Revision rows are immutable — enforced by Postgres** | `UPDATE` and `DELETE` attempted on all four revision tables through an **unguarded** client | ✅ All refused by trigger with "revision rows are immutable"; prior values unchanged afterwards |
| 2026-09-02 | **Shared knowledge cannot be hard-deleted** | `delete` attempted on routes/steps/edges/fields via guarded client, unguarded client and trigger | ✅ Refused at all three layers |
| 2026-09-02 | **Application code cannot bypass the revision service** | ESLint boundary probes + guarded-client writes outside the service context + a scan of the real tree | ✅ Rejected; and no file outside `src/server/` imports a client today |
| 2026-09-02 | **Private state is not forced through the revision engine** | Guard applied to a non-revisioned model; revision service surface inspected | ✅ Non-revisioned models remain writable in place; the service exposes no journey or progress function |
| 2026-09-02 | **Revision + pointer move atomically** | Forced a mid-transaction foreign-key failure | ✅ Nothing persisted; no orphan revision, no dangling pointer; graph still validates |
| 2026-09-02 | **Concurrent contributions are all preserved** | 2-way and 5-way `Promise.all` `reviseField` from one parent revision | ✅ All revisions kept, all sharing the parent, field reads `contested`; exactly one wins the pointer and none is lost |
| 2026-09-02 | **Deadlock found and fixed** | The 5-way concurrency test | ❗→✅ Postgres reported `deadlock detected`; fixed by taking the parent row lock first. Would have lost contributions in production |
| 2026-09-02 | **Transaction timeout found and fixed** | The same test, after the deadlock fix | ❗→✅ Prisma's default 5s aborted the fifth queued contributor; budget raised to 20s |
| 2026-09-02 | Integration suite refuses to run against an unmarked database | `tests/db/setup.ts` global setup | ✅ Requires a `platform_meta` marker row that production does not have |
| 2026-09-02 | **Phase 2 migration applied to `production`** | Rehearsed on `phase-2-migration-rehearsal`, then `npm run db:deploy`; `neon diff` afterwards | ✅ 9 tables and 4 enum types added, **zero DROP statements**; `platform_meta` and its row count unchanged; no schema difference from the rehearsal branch |
| 2026-09-02 | **A branching, overlapping route round-trips through Postgres** | `npm run test:db` — persist 6 steps / 7 edges, read back, validate | ✅ Branch structure preserved with typed edge kinds (2 `alternative`, 3 `rejoin`); validates clean after the round trip |
| 2026-09-02 | Timeline over the round-tripped fixture yields parallel lanes | `buildTimeline` on the persisted graph | ✅ >1 lane; language prep and document collection on different lanes; total span shorter than the sum of durations |
| 2026-09-02 | **Postgres physically refuses to destroy history** | `prisma.step.delete` and `prisma.route.delete` on rows with revisions | ✅ Both rejected by `onDelete: Restrict` — a database property, not an application check |
| 2026-09-02 | Concurrent field revisions both persist at the database level | Two revisions written against one parent revision | ✅ 3 revisions retained, 2 sharing a parent — a unique constraint there would have rejected the second contributor |
| 2026-09-02 | **FR coverage audit** (owed since session 2) | `tests/architecture/fr-coverage.test.ts` | ✅ All 80 FRs assigned. **Two orphans found and fixed**: FR-48 (Bangladesh origin specificity) → content track, FR-54 (official/community separation) → Phase 6. Now enforced on every commit |
| 2026-09-02 | **Spike A go/no-go — renderer** | 79 assertions in `spikes/renderer/layout.spike.test.ts` + screenshots at 360/768/1280 | ✅ **GO.** All 10 fixtures render legibly at all three widths with no per-fixture code; no page-wide horizontal overflow at any width |
| 2026-09-02 | Ribbon and road share one layout pass | Order and count compared for every fixture | ✅ Identical step count and order at both densities, for all 10 |
| 2026-09-02 | Structural equivalence across destinations (test 24, early) | `wrapping15` vs `wrapping15Twin` | ✅ Identical width, height, row count, node geometry and every connector path |
| 2026-09-02 | Generative coverage (test 24b, early) | 60 random valid graphs, 3–20 steps, mixed edge kinds, both densities | ✅ All render to valid, in-bounds, non-overlapping geometry |
| 2026-09-02 | Road adapts to 360px by density constant alone | `ROAD_NARROW` (columnsPerRow 2) on the 15-step fixture | ✅ Whole route fits 360px in 8 rows, correct order, no horizontal scroll, no branching in the renderer |
| 2026-09-02 | **Spike B go/no-go — revision graph** | 13 assertions in `spikes/revision/revision.spike.test.ts` | ✅ **GO.** Diff of a branch addition reads `1 step added, route structure changed (2 branch connections), 1 field changed` — it names the branch kinds, not just a step count |
| 2026-09-02 | Concurrent revisions preserve both edits | Two revisions against the same parent revision | ✅ 3 revisions retained, none lost, `contested: true` — conflict surfaced, not auto-resolved |
| 2026-09-02 | Archived content leaves the current view and stays in history | Field and step archival, then history query | ✅ Absent from `project()`, present in `project({includeArchived:true})` and in the operation log with actor and reason |
| 2026-09-02 | Time-travel projection for the shadow route | `project({ at })` at a follower's start date | ✅ Returns the route as it was; diff against now reports the added step and the changed field |
| 2026-09-02 | **Deployment healthy on the rotated credential** | Authenticated fetch of `/api/health` on `dpl_4uLewvGDfHYTjKearPDfb3vCz4J4` (commit `8c4a0d2`) | ✅ 200 `{"status":"ok","database":"reachable","latencyMs":269}`, and no `branch` field — Vercel re-synced and the deployed environment no longer announces it |
| 2026-09-02 | **Database credential rotated on every branch** | `reset_postgres_role_password` on `production`, `vercel-dev` and `phase-0-migration-rehearsal` | ✅ Rotated. The previously exposed password was verified **still live on `vercel-dev` and `phase-0-migration-rehearsal`** before rotation — branches inherit the role password — and REJECTED on all three afterwards |
| 2026-09-02 | Refreshed local credential works | `neon deploy` → `npm run db:objects` | ✅ `.env.local` regenerated; schema reads correctly |
| 2026-09-02 | Rotation actually took effect in the deployment | Authenticated fetch of the deployed `/api/health` | ✅ Went 200 → 503 `unreachable`, confirming the build's snapshot holds the now-dead credential. Needs a Vercel env re-sync + rebuild |
| 2026-09-02 | **CI is green on GitHub Actions** | GitHub REST API, runs 1–5 on `main` | ✅ 5/5 `success`; latest run's steps Install / Lint / Typecheck / Unit and architecture tests / Build all pass in 80s — closes OF-2 |
| 2026-09-02 | **No credential has ever been committed** | Enumerated all 111 blobs in the full history and scanned each for connection strings, `npg_` passwords, Neon hostnames, API keys, `sk-`/`ghp_`/`AKIA` tokens | ✅ Zero matches. `.env.local` and `.neon` were never tracked; `.env.example` holds placeholders only |
| 2026-09-02 | No personal email address is in the repository history | Same blob scan, matching common mail providers | ✅ Zero matches; commits carry the GitHub `noreply` address |
| 2026-09-02 | **Deployed `/api/health` reaches Neon** | Authenticated fetch of `.../api/health` on `dpl_AvcFpWzgxKnK2wFyD5ZQnZThKGJG` | ✅ 200 `{"status":"ok","database":"reachable","latencyMs":300}` — closes OF-3 |
| 2026-09-02 | Playwright smoke suite against the deployment, with the stricter probe assertion | `E2E_BASE_URL` + `E2E_BYPASS_URL` → `npm run test:e2e` | ✅ 11/11; same suite also 11/11 against a local build |
| 2026-09-02 | The `vercel-dev` branch created by the Neon–Vercel integration carries the committed schema | `neon diff vercel-dev` + `scripts/db-objects.mjs` | ✅ No schema differences from `production`; 7 enum types, `platform_meta`, 1 migration applied |
| 2026-09-02 | The health probe's `unconfigured` vs `unreachable` split is accurate | Vercel runtime logs during the outage | ✅ Logs showed `Environment variable not found: DATABASE_URL` while the old build could only report `unreachable`; the new build reports `ok` |
| 2026-09-02 | The runtime client needs only `DATABASE_URL`, not `DATABASE_URL_UNPOOLED` | Ran a live query with `DATABASE_URL_UNPOOLED` deleted from the environment | ✅ Succeeded — `directUrl` is read by the Prisma CLI, never by the running app. Keeps the direct credential out of Vercel |
| 2026-09-02 | **Playwright smoke suite against the deployed Vercel build** | `E2E_BASE_URL` + `E2E_BYPASS_URL` → `npm run test:e2e` | ✅ 11/11 passed at 360px and 1280px against `vindeshi-express-noor-mohammad-sowans-projects.vercel.app` |
| 2026-09-02 | Vercel build succeeds with no database configured | Vercel build log for `dpl_BQ94Rr8b6RLHPqiarift3EmkdknY` | ✅ Built in 45s; 4 routes; confirms `next build` never touches the database |
| 2026-09-02 | Deployed page renders the shell and the Bengali brand | `curl` through the share cookie | ✅ `<title>Vindeshi Express — Community-maintained routes for studying abroad</title>`, brand renders |
| 2026-09-02 | Deployed `/api/health` degrades safely without credentials | `curl` through the share cookie | 🟡 503 `{"status":"degraded","database":"unreachable","branch":null}` — correct behaviour, but the deployment has no `DATABASE_URL` yet. See OF-3 |
| 2026-09-02 | Playwright suite still green against a local build after the setup project was added | `npm run test:e2e` | ✅ 11/11 |
| 2026-09-02 | Real `git clone` of the branch builds and tests clean | Clone → `npm ci` → lint → typecheck → test → build; `enums.prisma` checked out with LF | ✅ 84 tests; no CRLF; build succeeded |
| 2026-09-02 | Full check chain passes from a clean checkout | `npm ci` → `lint` → `typecheck` → `test` → `build` in a fresh copy of tracked files, no `.env.local`, dummy `DATABASE_URL` | ✅ All five pass; 84 tests; build emits 4 routes |
| 2026-09-02 | Enum-duplication guard actually fails the build | Wrote `src/tmp_probe/violation.ts` containing `'community_submission'` | ✅ Failed with the offending path named; probe deleted |
| 2026-09-02 | Generated Prisma enum staleness guard fails the build | Appended a bogus `enum Tampered` to `prisma/schema/enums.prisma` | ✅ Failed with "is stale. Run `npm run prisma:enums`"; file restored |
| 2026-09-02 | `no-explicit-any` guard fails the build | Wrote `src/tmp_probe/anyprobe.ts` using `any` | ✅ Failed and named the file and line; probe deleted |
| 2026-09-02 | Renderer import boundary is armed before the renderer exists | `ESLint.lintText` against `src/renderer/probe.ts` for all three forbidden groups, plus two control cases | ✅ 10 assertions pass — blocks `@/seed`, `@/content`, `@/destinations` and their relative forms; allows `@/domain`; inert outside `src/renderer` |
| 2026-09-02 | Initial migration is additive only | `grep -ci drop` over the generated `migration.sql` | ✅ 0 DROP statements; 7 `CREATE TYPE`, 1 `CREATE TABLE` |
| 2026-09-02 | Migration applies on a scratch branch first | Branch `phase-0-migration-rehearsal`; snapshot → `prisma migrate deploy` → snapshot | ✅ Empty before; 7 enums + `platform_meta` + `_prisma_migrations` after |
| 2026-09-02 | Re-applying the migration does not lose data | Wrote a `platform_meta` row on the scratch branch, re-ran `migrate deploy`, read it back | ✅ No-op; row and timestamp unchanged |
| 2026-09-02 | Migration applies on `production` with no data loss | Snapshot before (0 tables, 0 enums, 0 rows) → `npm run db:deploy` → snapshot after | ✅ Additive only; nothing pre-existing to lose; `migrate status` clean |
| 2026-09-02 | `production` and the scratch branch agree | `neon diff phase-0-migration-rehearsal` | ✅ "No schema differences" |
| 2026-09-02 | Enum value counts in Postgres match `src/domain/enums.ts` | `scripts/db-objects.mjs` against `production` | ✅ 11 / 5 / 9 / 4 / 3 / 8 / 8 |
| 2026-09-02 | Prisma reaches Neon at runtime on the Node runtime | `GET /api/health` against a local production build | ✅ 200 `{"status":"ok","database":"reachable","branch":"production"}` |
| 2026-09-02 | Locale routing and 404 behaviour | `/` → 307 → `/en`; `/en` → 200; `/en/does-not-exist` → 404 | ✅ |
| 2026-09-02 | Playwright smoke suite, local production build | `npm run test:e2e` at 360px and 1280px | ✅ 10/10 passed |
| 2026-09-02 | Playwright smoke suite against a **deployed preview** | Not run — no Vercel project exists yet | ❌ See Open failures |
| 2026-09-02 | Neon branch policy has not drifted | `neon config plan` | ✅ Branch `production` matches `neon.ts` |
| 2026-09-02 | Secrets stay out of git after scaffolding | Tracked-file listing of a clean checkout | ✅ `.env.local` and `.neon` absent; only `.env.example` present |
| 2026-09-02 | Neon database reachable | `@neondatabase/serverless` live query — `select version(), current_database()` | ✅ PostgreSQL 18.6, db `neondb` |
| 2026-09-02 | `neon.ts` policy matches remote branch | `neon config plan` | ✅ No drift on branch `production` |
| 2026-09-02 | `DATABASE_URL` is the pooled endpoint | Parsed host from `.env.local` | ✅ Host ends in `-pooler` (endpoint id not recorded — see §10) |
| 2026-09-02 | Secrets excluded from git | `git check-ignore -v .env.local .neon` | ✅ Both ignored; nothing sensitive staged |
| 2026-09-02 | Baseline extract complete | Counted FR/BR/D rows in extracted text | ✅ 80 FR, 35 BR, 46 D |

---

## 3. Invariant test checklist

These are the tests that matter most. Each maps to an invariant in [CLAUDE.md](CLAUDE.md) §6.
An invariant with no test is an invariant that will eventually be violated by a refactor.
**None of these can be written until the relevant phase lands — that is expected. What is not
acceptable is shipping the phase without them.**

### Non-destructive knowledge

| # | Test | State |
|---|---|---|
| 1 | No non-admin route reaches a hard delete for Route, Step or Field | ✅ |
| 2 | Updating a field creates a revision; the prior value is still readable afterwards | ✅ |
| 2b | Concurrent updates to one field produce two revisions, neither lost | ✅ |
| 3 | A user who did not create a route can still revise its fields | ✅ |
| 4 | Archived content disappears from current view but is returned by history queries | ✅ |

### Privacy

| # | Test | State |
|---|---|---|
| 5 | User A cannot read User B's journey progress, notes or dates via any endpoint | ⬜ |
| 5b | Public aggregates cannot be reduced to an individual's progress | ⬜ |
| 6 | No file-upload path exists anywhere in the journey flow | ⬜ |
| 7 | No schema field accepts passport, transcript, certificate, bank or address data | ✅ |
| 8 | Revising a route does not cascade-delete or reset JourneyStepProgress | ⬜ |

### Trust and truth

| # | Test | State |
|---|---|---|
| 9 | A community-submitted link renders with an unverified marker, never as official | ⬜ |
| 10 | External links expose their real host; shortened domains never classify as `trusted` | ⬜ |
| 11 | A community experience cannot overwrite or occupy an official requirement field | ⬜ |
| 12 | Zero reports never produces a "safe"/"verified" badge | ⬜ |
| 13 | No code path lets payment or sponsorship affect ordering, confidence or source class | ⬜ |
| 14 | Follower/vote/report counts alone never trigger archival, deletion or trusted status | ⬜ |
| 15 | A rapidly re-revised field renders as disputed / frequently changed | ⬜ |
| 16 | Fly window and durations always render with estimate wording | ⬜ |
| 17 | Completion aggregates render as "users marked completed", never "verified" | ⬜ |

### Structure

| # | Test | State |
|---|---|---|
| 18 | Following a route does not create a detached copy; route edits surface in the journey | ⬜ |
| 19 | A temporary disruption expires without mutating the base route | ⬜ |
| 20 | Merging two routes preserves both follower sets and both revision histories | ⬜ |
| 21 | Change relevance is computed from effective date, not edit date | ⬜ |
| 22 | The route model represents a branch that diverges and reconnects | ✅ |
| 23 | 30-day dormancy applies to unused new routes only; established routes go quiet/stale | ⬜ |

### Rendering

**🟡 rows below were proved in Phase 1 against throwaway spike code, not against production
code.** Spike A and Spike B answered their go/no-go questions (§2, 2026-09-02) and the
assertions are written down — but `spikes/` does not ship and does not run in CI. A 🟡 here
means "the approach is known to work"; it becomes ✅ only when the same assertion passes
against `src/` in Phases 2–4.

Invariant 24 prohibits destination- or route-specific *rendering logic*, not the appearance of
destination names in data, labels, alt text or fixtures. These tests prove genericity by
construction rather than by string-matching the repository.

**Test 24c is armed early (Phase 0).** The ESLint entry `vindeshi/renderer-import-boundary`
exists and `tests/architecture/renderer-import-boundary.test.ts` proves it rejects
`@/seed`, `@/content` and `@/destinations` (and their relative forms) from
`src/renderer/**`, allows route-agnostic domain imports, and stays inert elsewhere. It is
🟡 rather than ✅ because `src/renderer/` has no files yet: the rule is proven to fire, but
nothing real is standing behind it until Phase 4.

| # | Test | State |
|---|---|---|
| 24 | **Structural equivalence** — two routes with identical graph structure but different destination, title and ids produce identical geometry; only labels differ | 🟡 |
| 24b | **Generative coverage** — randomly generated valid route graphs (3–20 steps, mixed branch kinds, parallelism, archived/new steps) all render to valid geometry | 🟡 |
| 24c | **Dependency boundary** — ESLint import rule: the renderer may not import from seed, content or destination modules | 🟡 |
| 24d | **No identity branching** — scoped check over `src/renderer/**` only: no comparison against route id, slug, destination or title. Not a repo-wide country grep | ⬜ |
| 24e | A route created through the UI renders with zero developer involvement | ⬜ |
| 24f | The stress route (§7) renders correctly through the production renderer, no per-route code | ⬜ |
| 25 | Ribbon and road derive from one layout pass — step count and order match for every fixture | 🟡 |
| 25b | Adding a step to a route changes both ribbon and road with no separate work | 🟡 |

---

## 4. Feature test coverage

### 4.0 Phase 0 foundation (landed 2026-09-02)

84 Vitest tests across 6 files, plus 10 Playwright assertions in 2 browser projects.

| Area | Tests | State | File |
|---|---|---|---|
| Domain vocabulary matches the baseline | 9 | ✅ | `tests/unit/enums.test.ts` |
| i18n scaffolding, brand identity, forbidden wording | 6 | ✅ | `tests/unit/i18n.test.ts` |
| Enum single source — no literal duplicated in `src/` | 53 | ✅ | `tests/architecture/enum-single-source.test.ts` |
| Generated Prisma enums are not stale | 4 | ✅ | `tests/architecture/prisma-enums-generated.test.ts` |
| Renderer import boundary is armed | 10 | 🟡 | `tests/architecture/renderer-import-boundary.test.ts` |
| Zero `any` in `src/`, rule configured as an error | 2 | ✅ | `tests/architecture/no-any-in-src.test.ts` |
| Shell renders, locale redirect, no verification claim, no 360px overflow, health probe leaks nothing | 10 | ✅ | `e2e/smoke.spec.ts` — green against both a local production build and the deployed Vercel build |
| Deployment-protection bypass for E2E | 1 | ✅ | `e2e/deployment-access.setup.ts` |

Each of the four architecture guards was **also confirmed to fail** when deliberately
violated (§2). A guard nobody has watched fail is a guard that may do nothing.

### 4.1 Phase 2 — route graph and revision ledger (landed 2026-09-02)

| Area | Tests | State | File |
|---|---|---|---|
| Graph validation — cycle, self-loop, orphan, unknown step, dangling rejoin, duplicate active edge | 11 | ✅ | `tests/unit/graph.test.ts` |
| Ordering derived from edges, never stored | 4 | ✅ | `tests/unit/graph.test.ts` |
| Timeline lanes and overlap | 6 | ✅ | `tests/unit/graph.test.ts` |
| Schema shape — revision model per revisable model, no position column, no personal-document fields | 55 | ✅ | `tests/architecture/schema-shape.test.ts` |
| FR traceability | 4 | ✅ | `tests/architecture/fr-coverage.test.ts` |
| Round-trip, restrict-on-delete, concurrent revisions | 7 | ✅ | `tests/db/route-graph.db.test.ts` |

### 4.2 Phase 3 — revision write engine (landed 2026-09-02)

| Area | Tests | State | File |
|---|---|---|---|
| ESLint write boundary + runtime guard decisions | 47 | ✅ | `tests/architecture/write-boundary.test.ts` |
| Model classification, shared vs private | 24 | ✅ | `tests/architecture/model-classification.test.ts` |
| Append-only history, immutability, bypass refusal, transactional safety, concurrency, archival, diff, no-ownership | 28 | ✅ | `tests/db/revision-service.db.test.ts` |

### 4.3 Product feature coverage

Populated as phases land. One row per feature area.

| Area | Unit | Integration | E2E | Notes |
|---|---|---|---|---|
| Route search and filters | ⬜ | ⬜ | ⬜ | |
| Ribbon rendering | ⬜ | ⬜ | ⬜ | |
| Ribbon → road expansion | ⬜ | ⬜ | ⬜ | Visual continuity (D-33) |
| Step / field display | ⬜ | ⬜ | ⬜ | |
| Revision engine | ⬜ | ⬜ | ⬜ | Highest-risk area |
| ADD / UPDATE / CONFIRM / CHALLENGE | ⬜ | ⬜ | ⬜ | |
| Journey follow and progress | ⬜ | ⬜ | ⬜ | |
| Change propagation to followers | ⬜ | ⬜ | ⬜ | |
| Shadow route diff | ⬜ | ⬜ | ⬜ | |
| Reporting and quarantine | ⬜ | ⬜ | ⬜ | |
| Link trust classification | ⬜ | ⬜ | ⬜ | |
| Route lifecycle and freshness | ⬜ | ⬜ | ⬜ | |
| Auth and session | ⬜ | ⬜ | ⬜ | |
| Anonymous access paths | ⬜ | ⬜ | ⬜ | Must work with no session |
| Accessibility | ⬜ | ⬜ | ⬜ | Meaning never colour-only |
| Mobile layout | ⬜ | ⬜ | ⬜ | Phone browser is primary |

---

## 5. Open failures

| # | What | Guards | Status |
|---|---|---|---|
| OF-4 | **`CLAUDE.md` and the Neon endpoint id are still in public git history** — 8 and 2 commits respectively on `origin/main`. Untracking and redaction stopped future publication, not past publication. | Test.md §10 publication rules | ⏸️ **Deferred by the owner (2026-09-02): to be removed manually, not by this project's tooling.** Not a credential exposure — neither is a secret, and the password behind that endpoint is rotated. Note that a rewrite cannot guarantee erasure anyway: GitHub retains unreachable objects, and old SHAs stay referenced by Vercel deployments and Actions runs. |
| OF-5 | **The Neon API key `3303456` is account-scoped and embedded in 7 local config files.** Neon's own warning: it reaches everything the account can, in every organization. Minted by `neon mcp -y` in session 1. | Least privilege | ⏸️ **Pending, owner: project owner. Deferred 2026-09-02 — see §11 for the procedure.** Not a leak: never committed, confirmed by the full-history blob scan. |

> When a test fails, add it here with the failing output and the FR/invariant it guards.
> Remove the row only when it passes — never by deleting the test.

---

## 6. Known gaps and deliberate non-tests

| Gap | Reason | Revisit |
|---|---|---|
| Everything above marked ⬜ | No domain code exists yet — Phase 0 delivered the spine, not features | As each phase lands |
| Invariant tests 1–23 | The behaviour they guard does not exist yet. Phase 0 deliberately commits no domain tables — the route graph and revision ledger are Phase 2's single irreversible migration | Phases 2–11 |
| No test connects to a database | Nothing to query: `platform_meta` holds no domain data. Database wiring is evidenced by `/api/health` and by the migration verification in §2 instead | Phase 2, when there is a schema worth testing |
| Coverage percentage | Coverage of a shell measures nothing. Adding the number now would invite optimising it | Phase 3, with the revision engine |
| `src/renderer/**` has no files | The renderer is Phase 4. Its lint boundary is armed and proven to fire (test 24c) so it cannot be retrofitted later | Phase 4 |
| Verification of users' real-world claims | 🚫 Out of scope by design (FR-25, D-09) — the platform never verifies personal progress | Never |
| External link destination safety scanning | 🚫 Not a first-release feature; containment is via reporting + quarantine (§42.5) | Post-launch |

---

## 7. Visualisation stress fixtures (development only)

Fixtures that exist **only** to prove the renderer is route-agnostic. Never seeded, never
published, excluded from production data.

**Promoted from Spike A on 2026-09-02** (Phases.md Phase 1 exit criterion). They were
authored and exercised in `spikes/renderer/fixtures.ts`; this table is the durable
specification and outlives that directory. Phase 4 must reimplement them against the
production renderer and re-run at every renderer change.

**Every value in them is invented for layout testing. None is seed data and none is
factual** (CLAUDE.md §8.6). Destination names are deliberately `Placeholder A…I` so no
fixture can be mistaken for content.

### Required fixtures

| # | Fixture | Feature it forces | Proven in Spike A |
|---|---|---|---|
| F1 | `tiny3` | Minimum viable route, 3 steps | ✅ |
| F2 | `linear4` | The simple case must survive supporting the hard ones | ✅ |
| F3 | `optionalBranch` | One step reachable but skippable | ✅ |
| F4 | `alternativeBranch` | Two mutually exclusive paths (IELTS vs PTE) | ✅ |
| F5 | `parallelActivities` | Three steps genuinely concurrent, on separate lanes | ✅ |
| F6 | `rejoiningBranch` | A divergence that reconnects downstream | ✅ |
| F7 | `evolvedRoute` | Archived step, newly added step, prior version for the shadow overlay, and a scoped disruption — all in one route | ✅ |
| F8 | `wrapping15` | Long enough to wrap across rows (VR-04) | ✅ |
| F9 | `large20` | Upper bound of the 3–20 step range | ✅ |
| F10 | `wrapping15Twin` | Structural twin of F8: same shape, different destination, title and **every id** — geometry must be identical (test 24) | ✅ |

### Responsive acceptance

| Width | Target | Spike A result |
|---|---|---|
| 360px | Legible, no page-wide horizontal overflow | ✅ Ribbon fits whole; road scrolls inside its own container |
| 768px | Legible | ✅ |
| 1280px | Legible | ✅ |

**Range acceptance:** 3-step and 20-step routes both render usably. ✅

### Automated invariants the fixtures are not enough on their own to catch

Spike A found three real defects that no fixture exercised and no eye caught reliably. Phase 4
must carry these assertions forward, not just the fixtures:

| Assertion | Defect it caught |
|---|---|
| Every node's **full box** lies within the canvas | A dense rank fanned its lanes past the top edge — nodes at negative `y`, silently clipped |
| Every node's box lies within the canvas **horizontally** | Node coordinates are centres, so the leftmost marker overhung the viewBox |
| **No two node boxes overlap** | At ribbon density the lane gap was smaller than the marker height, so concurrent steps stacked and the ribbon showed fewer steps than the road |
| Every **connector coordinate** lies within the canvas | Wrap hooks overshot by a fixed offset and were clipped at both edges |
| Generative coverage over 60 random valid graphs, both densities | All four of the above were found here or by looking at output these seeds produced |

### Density parametrisation

Spike A proved the road adapts to a 360px screen through **density constants alone** —
`ROAD_NARROW` differs from `ROAD` only in `columnsPerRow` and sizing, with no branching and
no second code path. Phase 4 should select density from a media query rather than writing a
mobile renderer.

## 8. Pre-launch gate verification

The three gates in [Phases.md](Phases.md). None can be signed off from a passing unit test
alone — each needs the checklist walked deliberately.

| Gate | Covers | State |
|---|---|---|
| Gate 1 — Visualisation scalability | §7 above + invariant tests 24, 25 | ⬜ |
| Gate 2 — Real launch content | Germany/Australia/USA/Malaysia sourced routes, zero mockup-derived values | ⬜ |
| Gate 3 — Complete community loop | Full E2E: search → ribbon → road → step → field → follow → progress → contribute → revision → change → shadow → progress intact | ⬜ |

Gate 3 requires **one Playwright golden-path test** that walks the whole loop end to end — the
loop is the thing being verified, and fragments that each pass separately do not prove it.

**That golden path is additive, never a substitute.** Each mechanism it touches — revision
creation, privacy scoping, change relevance, shadow diffing, progress preservation — must also
have its own focused unit and integration tests, listed in §3 and §4 above. A single broad E2E
test tells you *that* something broke; the focused tests tell you *what*. Ship both.

Gate 2 additionally requires human judgement: a Bangladeshi reader confirming a route explains
something they were genuinely trying to understand. Record who reviewed and when.

---

## 9. How to update this file

After any test run, in the same session:

1. Flip the state marks that changed.
2. Add a row to the Verification log for anything checked manually.
3. Record any new failure in Open failures with its output.
4. If you chose not to test something, put it in Known gaps with a reason — do not leave it silent.

---

## 10. Public repository hygiene

**The repository is public as of 2026-09-02.** Anyone can read every file and every commit,
including commits that have since been changed.

### What was verified when it went public

Every one of the 111 blobs in the full history was enumerated and scanned for connection
strings, `npg_` passwords, Neon hostnames, API keys and `sk-` / `ghp_` / `AKIA` tokens.
**Zero matches.** `.env.local` and `.neon` were never tracked at any point; `.env.example`
has only ever held placeholders. No personal email address appears either — commits carry
the GitHub `noreply` address.

### What is public, and what that does and does not mean

| In the repository | Is it a credential? | Notes |
|---|---|---|
| Neon project id `young-river-98582189` | No | Identifies the project. Useless without authentication, and `.neon` supplies it locally anyway. |
| Neon branch ids (`br-…`) | No | Branch identifiers only. |
| Neon compute endpoint id | **It is the database hostname** | Redacted going forward. Still present in history — see below. |

None of these lets anyone connect. What the endpoint id does is name the host, which
removes a layer of defence in depth: it gives a target for credential stuffing against
`neondb_owner`, and there is currently no Neon IP allow list.

**Redacting a file does not remove it from history.** The endpoint id is still readable in
earlier commits of this file. The thing that actually closes that exposure is rotating the
database password, not editing the current tree.

### CLAUDE.md is not published (decided 2026-09-02)

`CLAUDE.md` holds the working rules, invariants and conventions for this repo. It stays on
disk, is read at the start of every session, and is gitignored — it is simply not uploaded.

Two consequences, stated rather than discovered later:

- **It is still in the public history.** It was tracked from commit `64f5a1c` until
  2026-09-02 and remains readable in those commits. Untracking stops future publication; it
  does not retract past publication. Removing it from history needs a rewrite and a force
  push, which is a separate, destructive decision.
- **Tracked files still reference it.** Roughly 70 references across `Status.md`,
  `Phases.md`, source comments and tests point at CLAUDE.md sections and invariant numbers.
  Those citations remain accurate and useful to anyone working from a full local checkout;
  they are dangling for someone reading only the public repository.

### Credential rotation, 2026-09-02

The database password was rotated after it appeared in a chat transcript and its host became
public. One finding worth carrying forward: **Neon branches inherit the role password**, so
rotating the default branch is not enough. The exposed password was verified still live on
`vercel-dev` and `phase-0-migration-rehearsal` after `production` had been rotated, and was
only dead once all three were done. Any future rotation must cover every branch, and must be
verified by attempting the old credential rather than assumed.

### Rules from here

1. **Never write a connection string, endpoint hostname, password, API key, token or
   personal address into a tracked file** — not in docs, not in a test fixture, not in a
   verification log. Record the *shape* of a finding ("host ends in `-pooler`"), not the
   value.
2. Secrets live only in `.env.local` and `.neon`, both gitignored.
3. Re-run the history scan before any future visibility change, and after any incident.
4. Treat the rotation trigger as: a credential left the password manager, **or** its host
   became public. Either one alone is worth rotating; both together is not optional.
5. `CLAUDE.md` is gitignored and must stay that way. If a rule in it needs to be visible to
   outside contributors, restate that rule in a tracked file rather than un-ignoring it.

---

## 11. Pending: Neon API key `3303456` (OF-5)

**Status: open, deferred by the owner on 2026-09-02. Do not close this section until the
verification in step 5 has actually been run.**

### What is wrong

The key is **account-scoped** — Neon's own warning is that it "reaches everything your
account can, in every organization" — and it is long-lived. It was minted automatically by
`neon mcp -y` during session 1.

It has never been committed. That is verified, not assumed: every blob in the full git
history was scanned for `napi_` and other token shapes with zero matches (§10). This is an
over-privilege problem, not a leak.

### Where it actually is

Seven files, not the six recorded in session 1:

```
~/.claude.json
~/.codex/config.toml
~/.copilot/mcp-config.json
~/.gemini/config/mcp_config.json
~/.gemini/settings.json
%APPDATA%/Code/User/mcp.json
%APPDATA%/Code/User/sync/mcp/lastSyncmcp.json     <- VS Code Settings Sync
```

**The last one matters more than the rest.** It is a Settings Sync artifact, so if Settings
Sync is enabled the key has probably been uploaded to Microsoft's cloud and pulled down onto
every other machine signed into the same VS Code account. Those copies cannot be recalled.
Revocation is what makes them worthless, which is why this should not be deferred
indefinitely.

### Procedure

1. `neon mcp --oauth` — rewrites the MCP entries to a plain server URL and **mints no key
   at all**; each agent signs in on demand. Select every agent when prompted.
2. `neon api-keys revoke 3303456`
3. `neon api-keys list` — `3303456` must be gone.
4. `grep -rlE 'napi_[A-Za-z0-9]{10,}' ~ --include='*.json' --include='*.toml' | grep -v node_modules`
   — expect no output. If `lastSyncmcp.json` persists, delete it; VS Code regenerates it.
5. Restart the editors so they load the new config.

Running step 2 first is also valid and kills the key sooner; the only cost is Neon MCP being
broken until step 1 completes.

### What this does and does not break

- **The `neon` CLI keeps working.** It authenticates with separate OAuth credentials in
  `~/.config/neon/credentials.json`, not this API key — verified. Every command in
  CLAUDE.md §4 is unaffected.
- **Neon MCP breaks** in every agent until step 1 is complete and the editors restart.
  Nothing in this project depends on MCP; the CLI covers all documented workflows.

### Why it is not done yet

Step 1 rewrites `~/.claude.json` while an agent is running inside Claude Code, and its
sign-in flow cannot complete in a non-interactive session. It needs an interactive terminal.
