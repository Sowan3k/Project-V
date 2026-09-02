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
| Test database strategy | ✅ | Scratch branch via `neon branches create` — never run tests against `production`. No test yet connects to a database. |
| CI pipeline | 🟡 | `.github/workflows/ci.yml`: lint → typecheck → test → build on push to `main` and every PR. Command chain verified locally from a real clone; **the GitHub Actions run itself has not been observed** (private repo, no token in this environment). |
| Vercel deployment | ✅ | Project `vindeshi-express` linked to `Sowan3k/Project-V`; production branch `main`. Deployment Protection is on (repo is private) — the setup project in `e2e/deployment-access.setup.ts` handles it. |
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
| 2026-09-02 | `DATABASE_URL` is the pooled endpoint | Parsed host from `.env.local` | ✅ `ep-misty-star-aekpcd3g-pooler` |
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
| 1 | No non-admin route reaches a hard delete for Route, Step or Field | ⬜ |
| 2 | Updating a field creates a revision; the prior value is still readable afterwards | ⬜ |
| 2b | Concurrent updates to one field produce two revisions, neither lost | ⬜ |
| 3 | A user who did not create a route can still revise its fields | ⬜ |
| 4 | Archived content disappears from current view but is returned by history queries | ⬜ |

### Privacy

| # | Test | State |
|---|---|---|
| 5 | User A cannot read User B's journey progress, notes or dates via any endpoint | ⬜ |
| 5b | Public aggregates cannot be reduced to an individual's progress | ⬜ |
| 6 | No file-upload path exists anywhere in the journey flow | ⬜ |
| 7 | No schema field accepts passport, transcript, certificate, bank or address data | ⬜ |
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
| 22 | The route model represents a branch that diverges and reconnects | ⬜ |
| 23 | 30-day dormancy applies to unused new routes only; established routes go quiet/stale | ⬜ |

### Rendering

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
| 24 | **Structural equivalence** — two routes with identical graph structure but different destination, title and ids produce identical geometry; only labels differ | ⬜ |
| 24b | **Generative coverage** — randomly generated valid route graphs (3–20 steps, mixed branch kinds, parallelism, archived/new steps) all render to valid geometry | ⬜ |
| 24c | **Dependency boundary** — ESLint import rule: the renderer may not import from seed, content or destination modules | 🟡 |
| 24d | **No identity branching** — scoped check over `src/renderer/**` only: no comparison against route id, slug, destination or title. Not a repo-wide country grep | ⬜ |
| 24e | A route created through the UI renders with zero developer involvement | ⬜ |
| 24f | The stress route (§7) renders correctly through the production renderer, no per-route code | ⬜ |
| 25 | Ribbon and road derive from one layout pass — step count and order match for every fixture | ⬜ |
| 25b | Adding a step to a route changes both ribbon and road with no separate work | ⬜ |

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

### 4.1 Product feature coverage

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
| OF-2 | **CI has not been observed running on GitHub.** `.github/workflows/ci.yml` is committed and pushed, and its exact command chain was verified locally against a real clone, but no GitHub Actions run has been inspected — the repository is private and this environment has no GitHub token. | "lint + typecheck + unit on every commit" | 🟡 Open — check the Actions tab on the next push. |
| OF-3 | **The deployed `/api/health` returns 503.** The page renders, but Vercel has no `DATABASE_URL` / `DATABASE_URL_UNPOOLED`, so the probe correctly reports `degraded`. Local runs against Neon return 200. | Runtime database reachability in the deployed environment | 🟡 Open — add both variables in the Vercel project (or connect the Vercel–Neon integration). Not a code defect. |

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

## 7. Visualisation stress route (development only)

A fixture route that exists **only** to prove the renderer is route-agnostic. It is never
seeded, never published, and must be excluded from production data. Built in Phase 1 as JSON
fixtures, promoted to a permanent test asset, and re-run at every renderer change.

The point is that the architecture must not only work for the tidy 8–9 step Germany examples in
the mockups.

**Required contents**

| Feature | Requirement | State |
|---|---|---|
| Length | ~15 primary steps | ⬜ |
| Optional branch | One step reachable but skippable | ⬜ |
| Alternative branch | Two mutually exclusive paths (e.g. IELTS vs PTE) | ⬜ |
| Parallel activities | At least two steps running concurrently | ⬜ |
| Rejoining branch | A divergence that reconnects downstream | ⬜ |
| Archived step | Present in history, absent from current view | ⬜ |
| Newly added step | Marked as added, visible in shadow diff | ⬜ |
| Previous version | A prior route version for shadow comparison | ⬜ |
| Temporary disruption | Scoped by date and location, attached to one step | ⬜ |
| Wrapping | Long enough to wrap across rows | ⬜ |

**Responsive acceptance**

| Width | Target | State |
|---|---|---|
| 360px | Mobile — legible, no page-wide horizontal overflow | ⬜ |
| 768px | Tablet — legible | ⬜ |
| 1280px | Desktop — legible | ⬜ |

**Range acceptance:** also verify a 3-step route and a 20-step route render usably. ⬜

---

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
