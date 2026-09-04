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
| 2026-09-03 | **Google sign-in works end to end** | Drove the real handshake: CSRF → Auth.js → `accounts.google.com`, following redirects | ✅ Google returned its email-entry form with no `invalid_client`, `deleted_client` or `redirect_uri_mismatch`. The credentials are live |
| 2026-09-03 | **Phase 9 gate verified in full** | GitHub Actions run #39, commit `e3dea2b`, all three jobs | ✅ lint · typecheck · **508** unit/architecture tests · build · migrations onto an empty database · schema-drift check · integration suite · **52 E2E assertions** |
| 2026-09-03 | **Ten reports from ten people change nothing** | Integration: burst of reports, then read the field back | ✅ Not quarantined, value intact, route projection carries no reporter id and no detail text (FR-71, invariant 14) |
| 2026-09-03 | **A quarantined value never reaches the page** | Browser: quarantined a field, then read the raw HTML | ✅ Neither the text nor the URL appears anywhere in the HTML — withheld server-side, not styled away |
| 2026-09-03 | **…and is still in the history** | Same field, history tab | ✅ The withheld text is returned by the history view, and its revision row is untouched (invariants 1, 4) |
| 2026-09-03 | Quarantine creates no revision | Quarantine then release, counting revisions | ✅ Unchanged — a safety state is not an edit |
| 2026-09-03 | The moderation queue does not exist for anyone else | Anonymous, member and admin all requested `/en/admin/reports` | ✅ 404, 404, 200. A non-administrator is not told the page exists |
| 2026-09-03 | An administrator is shown evidence, never a verdict | `openReportsFor` return shape | ✅ Counts, dates and reasons only — no score, band or recommendation. **2 distinct reporters from 3 reports** |
| 2026-09-03 | ⚠️ Two of my own assertions were too blunt for shared fixtures | Integration + E2E failures | ❗ One matched its own fixture's title (`/report/i` vs "something **report**able"); the other matched copy shared by fields accumulated across runs. §17 |
| 2026-09-03 | **Phase 8 gate verified in full** | GitHub Actions run #34, commit `69132e2`, all three jobs | ✅ lint · typecheck · **480** unit/architecture tests · build · migrations onto an empty database · schema-drift check · integration suite · **46 E2E assertions** |
| 2026-09-03 | **The Phase 8 exit criterion, walked end to end** | `e2e/contribute.spec.ts` in a browser | ✅ A new user creates a route → it renders through the ordinary renderer → publishes `experimental` → a **different** user corrects a field → the old value is still in history |
| 2026-09-03 | **No approval gate anywhere** | Source + schema + dictionary guards, and the browser body text after every contribution | ✅ No `pendingApproval`/`reviewQueue`/`isApproved` in `src/` or the schema; no "pending", "awaiting approval" or "will be reviewed" on screen after creating or correcting |
| 2026-09-03 | A revision resolves a challenge; a confirmation never does | `tests/db/contribution.db.test.ts` | ✅ Confirming leaves the challenge open; revising closes it and records **which revision** answered it. The challenge row survives with its reason and author |
| 2026-09-03 | Confirmations count people, not clicks | Same person confirmed twice, another once | ✅ `confirmationCount` is 2, and **no revision was created** — confirming is not editing |
| 2026-09-03 | A challenge changes nothing about the value | Challenged a field and re-read it | ✅ Value, source class and revision count all identical; the reason and note render against the field |
| 2026-09-03 | Concurrent corrections both survive, through the contribution path | Two users revising from one base | ✅ 3 revisions, `hasForkedHistory` true, both texts still in the ledger |
| 2026-09-03 | Confirmations never promote a community claim | Two confirmations on a `community_experience` field | ✅ Still `community_submission`. Agreement is not provenance (invariant 14) |
| 2026-09-03 | Community signals cannot be deleted | `prisma.confirmation.deleteMany`, `prisma.challenge.deleteMany` | ✅ Both refused by the write guard, in and out of a revision context |
| 2026-09-03 | ⚠️ E2E specs that **create** public content raced ones that **read** it | 10 failures across two spec files | ❗ Search is newest-first and Playwright runs fully parallel, so "click the first result" landed on a route another spec had just made. §17 |
| 2026-09-03 | ⚠️ Playwright's accessible name includes a control's own content | `getByLabel(/^information$/)` stopped matching once the field had a value | ❗ A prefilled textarea contributes its value and a select contributes every option. Locate form controls by `name`. §17 |
| 2026-09-03 | **Phase 7 gate verified in full** | GitHub Actions run #28, commit `cc42268`, all three jobs | ✅ lint · typecheck · **460** unit/architecture tests · build · migrations onto an empty database · schema-drift check · integration suite · **38 E2E assertions** |
| 2026-09-03 | **One user cannot reach another's journey** | `tests/db/journeys.db.test.ts` — Nadia holding Rahim's journey id | ✅ Read returns nothing; four separate writes all reject; his journey is byte-for-byte as he left it |
| 2026-09-03 | **And not in a browser either** | Two fabricated sessions, same route, same URL | ✅ The second follower's page never contains the first's note, before or after following |
| 2026-09-03 | **A public change never erases private progress** | Revised a step, then archived one, with progress on both | ✅ Status, note and date survive. `prisma.step.delete` on a tracked step is **refused by the foreign key** even with the write guard bypassed |
| 2026-09-03 | Following links rather than copies | Added a step to the route after two people followed it | ✅ Step count rises and the journey still points at the same live route (invariant 18) |
| 2026-09-03 | Aggregates expose counts and nothing else | Serialised the whole public route projection | ✅ No user id, no handle, no note, no date anywhere in it |
| 2026-09-03 | Unfollow keeps the data; delete really deletes | Archive → resume → hard delete | ✅ Note returns verbatim after resuming; delete removes progress and leaves every step of the route intact |
| 2026-09-03 | ⚠️ **Next encodes every server-action form as multipart** | An E2E assertion that no form is multipart, which failed | ❗ The enctype is the framework's, on forms accepting only text. "No upload" cannot be proved from markup — it is enforced at the action boundary instead. §16 |
| 2026-09-03 | ⚠️ Auth.js rejects an untrusted host silently | 10 E2E failures that looked like a bad cookie | ❗ `trustHost` derives from `AUTH_URL`, which CI did not set, so every session read returned `null`. Cookie name confirmed from `@auth/core`, not guessed |
| 2026-09-03 | **Phase 6 gate verified in full, on a container** | GitHub Actions run #24, commit `b9348c3` — all three jobs | ✅ **lint · typecheck · 430 unit/architecture tests · build · migrations to an empty database · schema-drift check · integration suite · E2E (28 assertions, 360px and 1280px, JS on and off)** |
| 2026-09-03 | **E2E now runs in CI at all** | New `e2e` job against a `postgres:18` service container | ✅ It caught a real stale test on its first run — see §15. Until now E2E ran only on a workstation against remote Neon |
| 2026-09-03 | The remote-Neon failures were **not** a Phase 6 defect | Same code, same commit, container instead of Neon | ✅ Everything that failed locally passes in CI. The variable was the network, not the code |
| 2026-09-03 | **Trust integration suite, full pass** | `npm run test:db -- tests/db/trust-surface.db.test.ts` | ✅ **10/10 in 246s.** See the caveat in §14 — one test was edited afterwards and its current form is CI-verified, not locally verified |
| 2026-09-03 | ❗ The whole integration suite could not complete locally | Repeated runs against the Neon `test` branch | ❌ **Blocked by the link, not by the code** — later confirmed by the same commit passing on a container. A re-probe at 05:10 failed **6 of 10** connects; a Phase 3 write transaction blew its 20s budget after 26s of latency. §14 |
| 2026-09-03 | **Phase 6 trust surface — full gate** | lint, typecheck, 430 unit/architecture tests, build | ✅ All pass. 67 of the 430 are new |
| 2026-09-03 | **The unremarkable case stays unremarkable** | `tests/unit/trust.test.ts` | ✅ An official, route-wide, confirmed field raises **zero** cautions — the assertion that keeps the page from becoming a wall of badges |
| 2026-09-03 | **Trust can only ever fall, never rise** | 13 URLs × 4 declared classes | ✅ No URL shape promotes a link. `https://embassy.example.de@evil.example.com` reports host `evil.example.com` |
| 2026-09-03 | **Counts never decide standing** | Every lifecycle state × counts to 10,000,000 | ✅ Stored `lifecycleState` returned unchanged; 100,000 confirmations leave an experimental route experimental |
| 2026-09-03 | **The passport cannot see reports** | Structural scan of `RouteTrustInput` | ✅ No report, flag or complaint field exists — invariant 12 is unbreakable by refactor, not merely unbroken |
| 2026-09-03 | **A ribbon never looks calmer than its route** | `tests/db/trust-surface.db.test.ts`, two separate queries | ✅ Snapshot fields identical; every ribbon caution appears in the route passport |
| 2026-09-03 | Forked revision history detected from real rows | Two `reviseField` calls sharing one `basedOnRevisionId` | ✅ `hasForkedHistory` true for the forked field, false for a linear one; counted as disputed at route level |
| 2026-09-03 | Hand-written activity SQL joins all four revision tables correctly | Exact count assertion, not "greater than zero" | ✅ 9 revisions — 1 route + 1 step + 5 addField + 2 reviseField. `confirmField` correctly creates none |
| 2026-09-03 | ⚠️ A source guard failed its own planted violation | `sponsoredRoutes` against a ``-anchored pattern | ❗ camelCase leaves no word boundary — the guard would have missed the exact identifier a real violation uses. Now unanchored stems |
| 2026-09-03 | ⚠️ OF-6 has a **second, independent** cause | 10 timed connects to a woken compute | ❗ Successful connects 2.4–8.8s, failures at ~5.01s. Not a cold start. See §14 |
| 2026-09-03 | **The MHT no longer lags the DOCX** | Regenerated from the amended DOCX via Word `wdFormatWebArchive`; QP soft breaks stripped before counting | ✅ 81 FR / 35 BR / 47 D — **identical id sets** across DOCX, `REQUIREMENTS.md` and MHT. DOCX sha256 unchanged by the export. §13 |
| 2026-09-03 | **Amendment 001 applied to the frozen baseline** | Edited `word/document.xml` in the DOCX, then verified: valid zip, well-formed XML, text extraction | ✅ 81 FR ids and 47 D ids in the DOCX; 81 FR rows and 47 D rows in the regenerated `REQUIREMENTS.md` |
| 2026-09-03 | **Applicability migration rehearsed against real data** | Branch from `test` (which holds the Germany fixture), then `migrate deploy` | ✅ **421 field revisions preserved**, column added, zero DROP statements |
| 2026-09-03 | Applicability migration applied to `test` and `production` | `prisma migrate deploy` | ✅ Column is `ARRAY`, `FieldApplicability` enum type present, existing revisions intact |
| 2026-09-03 | **The modelling gap is closed, demonstrably** | Germany fixture reloaded and inspected | ✅ Both facts are `official`, so source class cannot separate them — applicability does: GRE is `[institution + programme]`, blocked account is `[origin_specific]` |
| 2026-09-03 | Multi-dimensional applicability works | Same inspection | ✅ 17 of 18 revisions state applicability; **8 carry more than one dimension**; the RWTH deadline carries three — `institution + programme + intake` |
| 2026-09-03 | ⚠️ OF-6 misdiagnosed a **second** time | Neon dashboard screenshot + quoting inspection | ❗ Compute is 1.38/100 CU-hrs — never a quota issue. And most "unreachable" results came from my own scripts reading **quoted** values out of `.env.local`. See §12 |
| 2026-09-02 | **Germany route research pass 2** — one real programme | RWTH Aachen M.Sc. Data Science, official university and programme pages | ✅ Channel, deadlines, prerequisites, GRE, language and documents verified. Deadline for non-EU/EEA is **1 March**, not 15 July |
| 2026-09-02 | **Development fixture loads and models a real journey** | `npm run fixture:germany` against the test branch | ✅ 13 steps, 17 fields, **1136 days modelled vs 1284 summed** — overlap respected on real data |
| 2026-09-02 | Fixture refuses any database not marked disposable | `assertDisposable` against the `platform_meta` marker | ✅ Production cannot receive a development fixture |
| 2026-09-02 | Revision history built from a **verified** historical change | Blocked account €861 → €934 (01.10.2022) → €992 (~01.09.2024), German mission sources | ✅ Two revisions with sources, effective dates and reasons; prior value preserved |
| 2026-09-02 | ⚠️ Neon computes appeared intermittently unreachable | Probed all four endpoints repeatedly | ❗ **Misdiagnosed as compute exhaustion.** Actual cause: scale-to-zero cold start exceeding Prisma’s 10s default connect timeout — see §12 |
| 2026-09-02 | Cold-start behaviour measured | Retried probe against `production` pooled | ✅ Attempt 1 failed at 10023ms, attempt 2 at 10007ms, attempt 3 **OK in 4910ms** — two default timeouts, then a woken compute |
| 2026-09-02 | Two spent migration-rehearsal branches deleted | `neon diff` before deletion; migrations confirmed committed and applied to `production` | ✅ `phase-2` had no schema difference from production, `phase-0` was simply behind it. Correct housekeeping, but **not** the fix for OF-6 |
| 2026-09-02 | **Anonymous journey end to end** | Playwright: landing → search → ribbon → road → step → field, at 360px and 1280px | ✅ 22/22 including history and a 404 case |
| 2026-09-02 | **The read path works with JavaScript disabled** | Same journey in a `javaScriptEnabled: false` context | ✅ Search, road and step expansion all server-rendered |
| 2026-09-02 | **No read path redirects to a sign-in** | Every anonymous URL requested directly, checking status and final URL | ✅ All under 400, none redirected to any auth path |
| 2026-09-02 | Read layer takes no session, actor or role | `tests/db/read-path.db.test.ts` — 15 tests calling every read function with no identity | ✅ Compiles and passes; there is no parameter a caller could use to gate access |
| 2026-09-02 | Search, detail and ribbon agree on the same graph | Compared search summary against route detail | ✅ Identical step sets — search and detail cannot diverge (invariant 25) |
| 2026-09-02 | Archived content is absent from current views but present in history | Archived a field and a step, then read both views | ✅ Gone from the road, still in history |
| 2026-09-02 | Fly window is a range and never a date | Window assertions plus overlap arithmetic | ✅ End strictly later than start; 67 days not 97, because two steps overlap |
| 2026-09-02 | **Production contains no test or unreviewed data** | `npm run db:objects` after the full E2E run | ✅ 0 routes, 0 steps, 0 fields — E2E runs against the test branch only |
| 2026-09-02 | **Production renderer draws every stress fixture** | 88 layout assertions + gallery screenshots at 360/768/1280 | ✅ All fixtures render; no page-wide horizontal overflow at any width |
| 2026-09-02 | **24 — structural equivalence** | Every fixture against a twin with different ids, labels and categories | ✅ Identical width, height, rows, node geometry and every connector path |
| 2026-09-02 | **24b — generative coverage** | 60 random graphs × 3 densities, asserting containment, no overlap and in-bounds connectors | ✅ All valid |
| 2026-09-02 | **24d — no identity branching** | Scoped scan of `src/renderer/**`, with a not-vacuous proof of the patterns | ✅ No identity comparison, membership test or switch; renderer never even reads a slug or country |
| 2026-09-02 | **24e — a route built through the service renders unaided** | Route created at runtime via the Phase 3 service, loaded and rendered | ✅ No fixture, mapping or renderer change; branch reconstructed; ribbon and road agree |
| 2026-09-02 | Narrow density fits a 15-step route on a phone | `ROAD_NARROW` layout width | ✅ ≤360px, same order as the wide road, no second renderer |
| 2026-09-02 | Renderer holds no English of its own | Scan of `src/renderer/**` for hardcoded strings | ❗→✅ Found two English defaults (`'New'`, `'Archived'`) in a primitive; labels are now required props |
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
| 5 | User A cannot read User B's journey progress, notes or dates via any endpoint | ✅ |
| 5b | Public aggregates cannot be reduced to an individual's progress | ✅ |
| 6 | No file-upload path exists anywhere in the journey flow | ✅ |
| 7 | No schema field accepts passport, transcript, certificate, bank or address data | ✅ |
| 8 | Revising a route does not cascade-delete or reset JourneyStepProgress | ✅ |
| 8b | No change module writes journey progress, and no cascade reaches it from shared knowledge | ✅ |

### Trust and truth

| # | Test | State |
|---|---|---|
| 9 | A community-submitted link renders with an unverified marker, never as official | ✅ |
| 10 | External links expose their real host; shortened domains never classify as `trusted` | ✅ |
| 11 | A community experience cannot overwrite or occupy an official requirement field | ✅ |
| 12 | Zero reports never produces a "safe"/"verified" badge | ✅ |
| 13 | No code path lets payment or sponsorship affect ordering, confidence or source class | ✅ |
| 14 | Follower/vote/report counts alone never trigger archival, deletion or trusted status | ✅ |
| 15 | A rapidly re-revised field renders as disputed / frequently changed | ✅ |
| 16 | Fly window and durations always render with estimate wording | ✅ |
| 17 | Completion aggregates render as "users marked completed", never "verified" | 🟡 |

**Notes on the Phase 6 rows.**

**9** is proved twice: `fieldSignals` marks a `community_submission` uncorroborated, and
`classifyLink` marks an unclassified link `not_corroborated`. A `null` link class is treated
as a community submission, not as an absence of concern — silence is not endorsement.

**10** rests on one property rather than a list of bad hosts: **classification can only ever
lower trust, never raise it.** Asserted over every combination of thirteen URLs and four
declared classes. The credential-spoofing case (`https://embassy.example.de@evil.example.com`)
is asserted explicitly, because that is where printing the raw string and printing the parsed
host give different answers.

**11** is positional, not cosmetic. `fieldGroup` puts official/institutional and community
claims in different regions with different headings, and the tests assert every source class
maps to exactly one group and that the two never collide.

**12** has two halves. The vocabulary half forbids `verified|certified|trustworthy|guaranteed`
anywhere in `src/` — with a planted-violation check, and with the deliberate exception that
*denying* verification ("does not verify routes") is allowed. The structural half asserts
`RouteTrustInput` contains no report, flag or complaint field, so the summary function cannot
observe reports at all. **Phase 9 must not add one.**

**14** is asserted across every lifecycle state × counts up to ten million: the stored state
comes back unchanged. A route with 100,000 confirmations stays `experimental`.

**15** uses forked revision history — two revisions sharing a `previousRevisionId` — as
structural evidence of disagreement rather than a "revised more than N times" threshold.
Recent re-revision is reported as a plain count, quietly.

**17** is 🟡 rather than ✅ because no completion aggregate exists to render until Phase 7.
The vocabulary guard that would catch a violation is in place and proven to fire; the
rendering it guards is not written yet.

### Structure

| # | Test | State |
|---|---|---|
| 18 | Following a route does not create a detached copy; route edits surface in the journey | ✅ |
| 19 | A temporary disruption expires without mutating the base route | ✅ |
| 19b | The disruption model has no status/active column, and `src/` has no cron or sweeper | ✅ |
| 19c | Nothing in the change modules writes a Route, Step, StepEdge or Field | ✅ |
| 20 | Merging two routes preserves both follower sets and both revision histories | ✅ |
| 20b | Both merged routes' histories are reconstructable entry-for-entry after the merge | ✅ |
| 20c | Contributions stay attributed to their original authors across a merge | ✅ |
| 20d | A merged route still renders through the one generic renderer | ✅ |
| 20e | Merge is reversible; self-merge, double merge and cycles are refused | ✅ |
| 21 | Change relevance is computed from effective date, not edit date | ✅ |
| 21b | A step completed before a change's effective date stays completed and reads as context | ✅ |
| 21c | No module compares a follower's recorded date against the *announcement* date | ✅ |
| 21d | An announcement resolves to the exact revision it names, not to a date | ✅ |
| 21e | Two announcements at one timestamp resolve to different, correct states | ✅ |
| 21f | A forked revision chain leaves no announcement ambiguous | ✅ |
| 21g | `shadowForChange` contains no date comparison at all | ✅ |
| 22 | The route model represents a branch that diverges and reconnects | ✅ |
| 23 | 30-day dormancy applies to unused new routes only; established routes go quiet/stale | ✅ |
| 23b | The same silent evidence parks an experimental route and never an established one | ✅ |
| 23c | `quiet` produces no caution anywhere in the trust surface (FR-39, BR-10) | ✅ |
| 23d | Staleness comes only from stored review/expiry dates, never from silence | ✅ |
| 23e | No count promotes a route; no report can move a lifecycle state | ✅ |

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
| 24 | **Structural equivalence** — two routes with identical graph structure but different destination, title and ids produce identical geometry; only labels differ | ✅ |
| 24b | **Generative coverage** — randomly generated valid route graphs (3–20 steps, mixed branch kinds, parallelism, archived/new steps) all render to valid geometry | ✅ |
| 24c | **Dependency boundary** — ESLint import rule: the renderer may not import from seed, content or destination modules | ✅ |
| 24d | **No identity branching** — scoped check over `src/renderer/**` only: no comparison against route id, slug, destination or title. Not a repo-wide country grep | ✅ |
| 24e | A route created through the UI renders with zero developer involvement | 🟡 |
| 24f | The stress route (§7) renders correctly through the production renderer, no per-route code | ✅ |
| 25 | Ribbon and road derive from one layout pass — step count and order match for every fixture | ✅ |
| 25b | Adding a step to a route changes both ribbon and road with no separate work | ✅ |

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

### 4.3 Phase 5 — anonymous read path (landed 2026-09-02)

| Area | Tests | State | File |
|---|---|---|---|
| Search, filters, empty state | 5 | ✅ | `tests/db/read-path.db.test.ts` |
| Route detail, steps, fields, archival | 5 | ✅ | `tests/db/read-path.db.test.ts` |
| History readable anonymously | 2 | ✅ | `tests/db/read-path.db.test.ts` |
| Expected fly window | 3 | ✅ | `tests/db/read-path.db.test.ts` |
| Full anonymous journey, JS on and off | 6 | ✅ | `e2e/route-journey.spec.ts` |

### 4.4 Phase 6 — trust, provenance and freshness surface (landed 2026-09-03)

67 new tests: 44 unit, 13 architecture, 10 integration.

| Area | Tests | State | File |
|---|---|---|---|
| Field signals — scope, freshness, dispute, fork, quiet-by-default | 32 | ✅ | `tests/unit/trust.test.ts` |
| Link classification — host exposure, monotonic trust, quarantine, shorteners | 12 | ✅ | `tests/unit/links.test.ts` |
| Forbidden vocabulary, no monetisation, no embedding, no-JS disclosure | 13 | ✅ | `tests/architecture/trust-vocabulary.test.ts` |
| Trust surface over real rows — projection, fork detection, passport counts, ribbon agreement | 10 | ✅ | `tests/db/trust-surface.db.test.ts` |

Each source guard in `trust-vocabulary.test.ts` carries a **planted-violation check**. One of
them earned its keep immediately: the monetisation guard was written with `...` word
boundaries and failed its own planted `sponsoredRoutes`, because camelCase leaves no boundary
after `sponsored`. A guard that cannot catch the identifier a real violation would use is a
guard that does nothing. It now matches unanchored stems.

**Two assertions carry more weight than the rest:**

- *"produces no caution at all for an official, route-wide, confirmed field."* If the
  unremarkable case ever raises a marker, every field on the page raises one and the reader
  learns to ignore all of them — including the one that mattered.
- *"gives a ribbon the same standing the route page reports."* Search results and the route
  page derive cautions from one function over numbers from two different queries. A ribbon
  that looks calmer than the route behind it is a search result that misleads.

### 4.5 Phase 7 — identity and private journeys (landed 2026-09-03)

19 new unit/architecture tests, an integration suite, and 5 browser tests × 2 viewports.

| Area | Tests | State | File |
|---|---|---|---|
| Pseudonymous handles — generated, unpronounceable, unmistakable | 5 | ✅ | `tests/unit/handle.test.ts` |
| Privacy by construction — scoping, no uploads, no real identity, no revisioning | 14 | ✅ | `tests/architecture/journey-privacy.test.ts` |
| One user against another's journey; invariants 5, 5b, 8, 18 over real rows | ✅ | ✅ | `tests/db/journeys.db.test.ts` |
| The journey in a browser, signed in and anonymous | 5 | ✅ | `e2e/journey.spec.ts` |

**The architecture suite proves the shape; the integration suite proves the behaviour.** Static
analysis can assert that every exported function in `src/server/journeys/` names `userId` and
that every query against a private model filters on it. It cannot prove that a `journeyId` in
scope was verified — so the integration suite has Nadia hold Rahim's journey id and try four
different writes, and asserts his journey is untouched. Neither half is sufficient alone.

**The scoping rule is stated per model, not as a blanket.** `setStepProgress` looks up the
*step* to confirm it belongs to the journey's route: that is public data with no owner, and
demanding a `userId` on it would be cargo cult. A blanket rule would have needed an exception
list, and an exception list is where a rule like this goes to die.

### 4.6 Phase 8 — the contribution loop (landed 2026-09-03)

18 new architecture tests, an integration suite covering the exit criteria, and 4 browser
tests × 2 viewports.

| Area | Tests | State | File |
|---|---|---|---|
| No approval gate, four distinct actions, no gamification, experimental on publish | 18 | ✅ | `tests/architecture/contribution-loop.test.ts` |
| Create → render → improve; UPDATE, CONFIRM, CHALLENGE semantics; contributor history | ✅ | ✅ | `tests/db/contribution.db.test.ts` |
| The loop in a browser, signed in and anonymous | 4 | ✅ | `e2e/contribute.spec.ts` |

**The guards are mostly about what must never appear.** An approval queue, a report action, a
leaderboard, a reputation score — none of these can be caught by testing behaviour, because
the behaviour is their absence. Each guard therefore carries a planted-violation check, and
each is scoped to say why: `reviewQueue` is forbidden because VR-08's "All updates are
reviewed" is a mockup exception (§8.6); `reputationScore` because §11 leaves reputation
weights open and §25 warns against a points game.

**Two assertions carry more weight than the rest:**

- *"a revision resolves a challenge; a confirmation never does."* Letting somebody clear a
  challenge by vouching for the field is how a dispute gets buried under reassurance (FR-70).
- *"confirmations count people, not clicks."* A count that cannot tell fifty people from one
  person fifty times is not a signal (invariant 14, BR-32).

### 4.7 Phase 9 — reporting and quarantine (landed 2026-09-03)

20 new architecture tests, an integration suite covering the exit criteria, and 3 browser
tests × 2 viewports.

| Area | Tests | State | File |
|---|---|---|---|
| No threshold, no auto-quarantine, report/challenge separation, admin check, no upload, no leaderboard | 20 | ✅ | `tests/architecture/safety.test.ts` |
| Report → quarantine → withheld but in history → release; role enforcement | ✅ | ✅ | `tests/db/safety.db.test.ts` |
| Reporting offered as a distinct action; queue invisible to non-admins; value absent from HTML | 3 | ✅ | `e2e/safety.spec.ts` |

**The threshold question was dissolved rather than answered.** §23.2 leaves quarantine
thresholds open and CLAUDE.md §11 lists them as undecided — but FR-71 and invariant 14
independently forbid a raw count being the sole automatic determinant of a state change. So
automatic quarantine was never available, and making it an administrator action means no
number has to be guessed. A guard asserts the safety module never compares a report count to
anything at all, in either `src/` or the schema.

**Invariant 12 survived the phase that could have broken it.** `RouteTrustInput` still cannot
observe a report. What Phase 9 added is `quarantinedCount` — a count of *administrator
actions*, which is a caution and never a reassurance.

### 4.8 Product feature coverage

Populated as phases land. One row per feature area.

| Area | Unit | Integration | E2E | Notes |
|---|---|---|---|---|
| Route search and filters | ⬜ | ✅ | ✅ | Anonymous; GET form, no JS required |
| Ribbon rendering | ✅ | ✅ | ✅ | Same renderer and graph as the road |
| Ribbon → road expansion | ✅ | ✅ | ✅ | Visual continuity (D-33) — one component, two densities |
| Step / field display | ✅ | ✅ | ✅ | `?step=` expansion; fields grouped by claim type, not badged |
| Revision engine | ✅ | ✅ | ✅ | Exercised through the contributor's own path, not only the service API |
| ADD / UPDATE / CONFIRM / CHALLENGE | ✅ | ✅ | ✅ | Four distinct actions; no approval gate, guarded |
| Journey follow and progress | ✅ | ✅ | ✅ | Private by construction; unfollow archives, delete is separate |
| Change propagation to followers | ⬜ | ⬜ | ⬜ | |
| Shadow route diff | ⬜ | ⬜ | ⬜ | |
| Reporting and quarantine | ✅ | ✅ | ✅ | Report distinct from challenge; quarantine hides without deleting; no threshold anywhere |
| Link trust classification | ✅ | ✅ | ⬜ | Host always shown; trust can only fall. Assigning `trusted`/`quarantined` is Phase 8/9 |
| Route lifecycle and freshness | ✅ | ✅ | ⬜ | Displayed and explained. Lifecycle *transitions* are Phase 11 |
| Auth and session | ✅ | ✅ | ✅ | Google OAuth, database sessions, generated handle. **Needs `AUTH_SECRET` and Google credentials to work on a deployment** |
| Anonymous access paths | ⬜ | ✅ | ✅ | Read layer takes no session, actor or role at all |
| Accessibility | ⬜ | ⬜ | ⬜ | Meaning never colour-only |
| Mobile layout | ⬜ | ⬜ | ⬜ | Phone browser is primary |

---

## 5. Open failures

| # | What | Guards | Status |
|---|---|---|---|
| OF-4 | **`CLAUDE.md` and the Neon endpoint id are still in public git history** — 8 and 2 commits respectively on `origin/main`. Untracking and redaction stopped future publication, not past publication. | Test.md §10 publication rules | ⏸️ **Deferred by the owner (2026-09-02): to be removed manually, not by this project's tooling.** Not a credential exposure — neither is a secret, and the password behind that endpoint is rotated. Note that a rewrite cannot guarantee erasure anyway: GitHub retains unreachable objects, and old SHAs stay referenced by Vercel deployments and Actions runs. |
| OF-5 | **The Neon API key `3303456` is account-scoped and embedded in 7 local config files.** Neon's own warning: it reaches everything the account can, in every organization. | Least privilege | ⏸️ **Deliberately open. Owner's decision 2026-09-02: close it only when a phase actually needs automated Neon branch or project management.** Not a leak — never committed, confirmed by the full-history blob scan. See §11. |
| OF-6 | **Reaching Neon from a workstation is unreliable in two independent ways.** (a) Computes scale to zero; a cold branch takes ~25–30s to wake. (b) Even when awake, connects over a degraded link took 2.4–8.8s while failures cut off at ~5.01s — see §14. **Misdiagnosed twice**: as free-tier compute exhaustion, then as a quoting bug (which was also real) — see §12. | Development, integration testing, and the first visitor after an idle period | 🟡 Open — application code is unaffected (deployed `/api/health` returns 200 in 292ms once warm). Development is unblocked: `test:db` wakes first, `setup.ts` retries, and the integration suite gets a 20s connect timeout. **The user-facing half remains Phase 12 scope and was deliberately not fixed by widening the application's timeout.** |

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

The four gates in [Phases.md](Phases.md). None can be signed off from a passing unit test
alone — each needs the checklist walked deliberately.

| Gate | Covers | State |
|---|---|---|
| Gate 1 — Visualisation scalability | §7 above + invariant tests 24, 25 | ⬜ |
| Gate 2 — Real launch content | Germany/Australia/USA/Malaysia sourced routes, zero mockup-derived values | ⬜ |
| Gate 3 — Complete community loop | Full E2E: search → ribbon → road → step → field → follow → progress → contribute → revision → change → shadow → progress intact | ⬜ |
| Gate 4 — Visual fidelity | Every screen screenshotted at 360/768/1280/1440 and reviewed against its visual reference; every departure written down | ⬜ |

**Gate 4 needs a fidelity checklist per mockup**, added here when Phase 12G builds it: what
matches, what is deliberately substituted and under which rule, what is genuinely outstanding.
An unexplained difference from a mockup is a defect; an explained one is a decision. Gate 1 and
Gate 4 are not the same test — Gate 1 would pass on a renderer that draws grey boxes.

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

### When to do it

**Deliberately deferred, with a trigger rather than a date** (owner's decision, 2026-09-02):
act on this when a phase genuinely needs *automated* Neon branch or project management —
per-pull-request database branches for CI, for instance, or programmatic project setup.

The reasoning: every Neon operation this project performs today goes through the `neon` CLI,
which authenticates with its own OAuth credentials and does not use this key. The key exists
only because `neon mcp -y` minted one. Nothing depends on it, so revoking it costs nothing
and gains nothing until something does. When a phase needs scripted branch management, that
is the moment to choose the credential deliberately — and `neon mcp --oauth`, which mints no
key at all, is likely still the right answer.

**Until then this stays open on purpose**, not by oversight. Two things keep it honest: the
key has never been committed (verified by the full-history blob scan, §10), and it is not
load-bearing for any workflow in CLAUDE.md §4.

The procedure above also needs an interactive terminal — step 1 rewrites `~/.claude.json`
while an agent is running inside Claude Code, and the sign-in flow cannot complete in a
non-interactive session.

---

## 12. Cold-start latency (OF-6)

**Diagnosed 2026-09-02. The first diagnosis was wrong, and is corrected here rather than quietly
replaced — because acting on it caused an irreversible deletion.**

### What was believed

That Neon computes were failing because five branches on a free tier had exhausted compute
hours, and that retiring the two spent migration-rehearsal branches would fix it.

### What is actually true

Neon computes **scale to zero** when idle. Waking one takes roughly 25–30 seconds. Prisma's
default connect timeout is 10 seconds, so the first one or two attempts fail outright rather
than waiting.

| Observation | Meaning |
|---|---|
| `neon operations list` shows `start_compute` **finished**, no failures, no quota errors | Not exhaustion |
| Retried probe: attempt 1 failed at 10023ms, attempt 2 at 10007ms, attempt 3 **OK in 4910ms** | Exactly two default timeouts, then a woken compute |
| The Germany fixture succeeded on its third retry | Same pattern |
| Deleting two branches did **not** help — everything then read as down | Branch count was never the cause |
| Deployed `/api/health` returns 200 in 292ms once warm | Application code is fine |

### What was done anyway, and why it was still right

The two rehearsal branches were deleted. That was correct on its own terms — both were spent,
all three migrations are committed and applied to `production`, `phase-2` had no schema
difference from production and `phase-0` was simply behind it — but it was **not** the fix and
must not be recorded as one.

Three branches remain: `production`, `test`, and `vercel-dev` (created and managed by the
Neon–Vercel integration; deliberately left alone).

### A second wrong diagnosis, on 2026-09-03

The owner's Neon dashboard settled the quota question outright: **1.38 of 100 CU-hrs**. There
was never any exhaustion, and the branch deletions had no bearing on it.

Then a worse discovery. **`neon deploy` writes `.env.local` with quoted values**:

```
DATABASE_URL="postgresql://…"
```

Every diagnostic script here that read a URL with `grep … | cut -d= -f2-` therefore passed the
**quotes as part of the URL**, producing an invalid host and the error message
`Can't reach database server` — identical to a cold start. `.env.test.local` was written by
hand without quotes, which is exactly why the `test` branch migrated on attempt 3 while
`production` failed 25 times in a row.

**Two distinct faults produce the same message**, and one of them cannot be fixed by retrying:

| Fault | Signature | Fix |
|---|---|---|
| Scale-to-zero cold start | Fails ~10s, then succeeds after ~25-30s | Retry |
| A quoted value read from a .env file | Fails identically, **forever** | Strip the quotes |

Anything that reads a connection string from a file must strip surrounding quotes and check
the result still starts with `postgres`. A retry loop that never succeeds is a signal to stop
retrying and read the input, not to raise the attempt count.

### The part that matters for real users

**The first visitor after an idle period may hit a cold database.** `/api/health` degrades
honestly, but a page load on the read path would fail rather than wait. Nobody has seen this
because the site has no visitors and no routes — so it will first appear at exactly the wrong
moment.

Not fixed here: it is Phase 12 scope (performance, empty and error states). Recorded so it is a
decision rather than a surprise. Options, unranked:

- Retry with backoff on the read path, in the shape of the helper in `scripts/fixtures`.
- Raise `connect_timeout` in the connection string — fragile, since `neon deploy` regenerates
  `.env.local`.
- Accept it and render a "waking up" state rather than an error.

---

## 13. Regenerating the MHT representation

The MHT is Word's "Single File Web Page" export of the frozen DOCX. It exists so a
non-technical reader can open the baseline in a browser. It has **no authority** and is never
read during an agent session — but while it sits in the repository it must not be allowed to
disagree with the DOCX, because a file that looks like the requirements and silently isn't is
indistinguishable from one that is.

Amendment 001 landed in the DOCX and `REQUIREMENTS.md` on 2026-09-03 and left the MHT one
amendment behind for a single commit. Regenerated the same day.

### Procedure

Word is required — the format is Word's own. Run it non-interactively:

```powershell
$word = New-Object -ComObject Word.Application
$word.Visible = $false ; $word.DisplayAlerts = 0
$doc = $word.Documents.Open($docx, $false, $true, $false)   # read-only
$doc.SaveAs2($outPath, 9)                                   # 9 = wdFormatWebArchive
$doc.Close(0) ; $word.Quit()
```

Generate to a scratch path first, verify, then move it into place.

### Verification that must pass before committing a regenerated MHT

1. **The DOCX is byte-identical afterwards.** Compare `sha256sum` before and after. The export
   must not modify the authority. Verified 2026-09-03: `b9ae526b…` unchanged.
2. **Strip quoted-printable soft line breaks before counting anything** — `s/=\r?\n//g`. MHT is
   QP-encoded, so a naive `grep FR-81` can return 0 for a file that contains it. Prove the
   counter is not lying by checking a control id you know is present.
3. **The three artifacts have identical id sets** — not merely identical counts. Compare
   DOCX / `REQUIREMENTS.md` / MHT as sets of FR, BR and D ids.

Result on 2026-09-03: **81 FR, 35 BR, 47 D in all three, identical sets, `FR-81`, `D-47` and
the Amendment 001 record all present in the MHT.**

### Cost, stated honestly

The MHT is ~1.06 MB of Word-generated HTML, and each regeneration writes a new ~1 MB blob into
git history. That is the price of keeping a browser-readable copy truthful. If it is ever
judged not worth paying, the correct move is to **remove the file**, not to leave a stale one
in place.

---

## 14. Connection latency to Neon, and what it cost (2026-09-03)

Recorded because it produced four test failures that looked like three different problems,
and because the underlying number matters for Phase 12.

### What was measured

Ten sequential connect-and-`select 1` attempts against the `test` branch, from this
workstation, immediately after `scripts/db/wake.mjs` reported the compute awake:

```
 1 OK   8813ms      6 OK   2581ms
 2 FAIL 5027ms      7 FAIL 5010ms
 3 OK   3997ms      8 FAIL 5017ms
 4 OK   4250ms      9 FAIL 5018ms
 5 OK   2381ms     10 OK   7704ms
```

**Successful connects took 2.4–8.8 seconds. Failures clustered at ~5.01s.** The compute was
demonstrably awake — attempt 5 answered in 2.4s — so this is not the cold start of §12. The
connection string sets no `connect_timeout`, so Prisma's default applies, and it sits below
the latency this link was actually delivering. Four attempts in ten failed.

### Why it looked like three problems

| Symptom | First reading | Actual |
|---|---|---|
| Suite took 219s, four timeouts | Connectivity | The fixture rebuilt a full route in **every** test — ten builds of ~15 write transactions |
| `globalSetup` failed instantly | Compute asleep | One connect attempt, no retry, against a link failing ~40% of connects |
| One test timed out at 30s | Slow query | `searchRoutes` loads the full graph of **every** matching route, and this branch accumulates a fixture route per run |

Each was real and each was fixed on its own terms — the fixture builds once, `setup.ts`
retries, `routeActivity` went from four `findMany` calls pulling every revision row to one
aggregate query returning three scalars. None of them was "the network is slow", which was
the thing actually underneath.

### What changed, and what deliberately did not

`vitest.db.config.mts` raises `connect_timeout` to 20s **for the integration suite only**.

It was not raised for the application. The same exposure on the deployed read path is a real
user-facing question — the first visitor after an idle period — and it belongs to Phase 12's
performance and error-state work, where it is already recorded as OF-6. Widening the timeout
globally would have made the test suite green and the product question invisible.

### Where this ended up

The trust suite passed **10/10 in 246 seconds** while the link was merely slow. It degraded
further afterwards — a re-probe failed 6 of 10 connects, and a Phase 3 write transaction
exceeded its 20-second budget after 26 seconds of latency inside a single transaction.

**That timeout was not raised.** It was set at 20s in Phase 3 for a real reason — a queue of
concurrent contributors — and widening it to accommodate one bad afternoon on one workstation
would weaken a deliberate decision for no product benefit.

So the full integration suite's verification is **CI's**, which runs it against a `postgres:18`
service container with no network in the path. That is where it should have been all along for
a run this size; a remote branch is the right target for a focused check, not for the whole
suite. One consequence to be honest about: `tests/db/trust-surface.db.test.ts` was edited after
its 10/10 pass — the archival test now reuses the shared route instead of building a second one
— so that file's *current* form is verified by CI rather than locally.

**Docker is installed on this workstation but its daemon was not running.** Starting it would
make the whole suite run locally in seconds, which is the better local loop.

### Two things to carry forward

1. **`searchRoutes` loads every matching route's full graph.** Fine at four routes, a real
   question at four hundred. Phase 12.
2. **The `test` branch accumulates a route per fixture build.** Nothing deletes it, correctly
   — the schema forbids deleting shared knowledge. Reset the branch from its parent when the
   accumulation starts to matter, rather than adding a delete path that invariant 1 forbids.

---

## 15. Phase 6 verification, and where it actually happened (2026-09-03)

### The result

**GitHub Actions run #24, commit `b9348c3` — all three jobs green.**

| Job | Steps verified |
|---|---|
| `lint · typecheck · test · build` | eslint · `tsc --noEmit` · 430 unit and architecture tests · production build |
| `schema · migration · integration` | migrations applied to an **empty** database · schema/migration drift check · disposability marker · full integration suite |
| `end-to-end journey` | 28 browser assertions at 360px and 1280px, with JavaScript on and off |

That is the whole Phase 6 gate, and it ran against a `postgres:18` service container with no
home network anywhere in the path.

### The remote-Neon problem was not a Phase 6 defect

Worth stating plainly, because the two are easy to conflate: **the same commit that could not
finish its integration suite against Neon passed every job on a container.** The variable was
the network, not the code. §14 has the measurements — successful connects taking 2.4–8.8s,
failures cutting off at ~5.01s, 6 of 10 failing on the final probe.

**Nothing was weakened to make this pass.** The Phase 3 interactive-transaction budget stays at
20 seconds; it was set for a queue of concurrent contributors, and widening it to survive one
bad afternoon on one workstation would have traded a real guarantee for a green tick. The only
timeout raised was `connect_timeout` in `vitest.db.config.mts`, which applies to the test runner
and not to the application.

The Neon reliability question stays where it belongs: an **infrastructure and testing** concern
(OF-6, §12, §14), not a reason to revisit Phase 6 architecture. Its user-facing half — the first
visitor after an idle period — remains Phase 12 scope.

### Adding E2E to CI paid for itself immediately

CI had a `verify` job and a `database` job and **no E2E job at all**, so the one suite that
proves a reader can get from the front page to a field was also the only suite whose result
depended on a home network. It now runs on a container.

It failed on its first run, and the failure was real: the spec still clicked a
*"See what has changed"* link that the navigation work had replaced with a **History tab**.
The product was correct; the test had been stale since that refactor, and nothing was watching.
`route.viewHistory` had been orphaned copy for just as long.

The replacement asserts more than the original: it clicks the tab inside the route-views
navigation and then asserts the route's own `h1` is *still on screen*, so "a tab changes the
view, not the place" is proved rather than assumed. That itself took a second attempt — the
first read the heading before the click navigation had settled and captured the search page's
title. Both fixes are in `e2e/route-journey.spec.ts`.

**The lesson is about where tests run, not about this one test.** A suite that only ever runs
in one fragile place will drift, and the drift will be invisible.

### Phase 6 exit criteria

| Criterion | State |
|---|---|
| Invariant tests 9–17 pass | ✅ 9–16 fully; **17 is 🟡 by design** — its vocabulary guard is in place and proven to fire, but the completion aggregate it guards is not rendered until Phase 7 |
| A `community_submission` field is visually distinct from an `official` one | ✅ Separate labelled regions, asserted in the browser, official first |
| No badge derives from absence of reports | ✅ Structurally: `RouteTrustInput` cannot observe reports. Plus the passport says so in words |

### One thing that is not ours

The commit also carries a failing **`Workers Builds: project-v`** check from the
`cloudflare-workers-and-pages` GitHub app. Nothing in this repository targets Cloudflare
Workers, and CLAUDE.md §4 puts it explicitly outside the architecture. It is an integration
connected to the repository on GitHub's side, failing on every commit and adding a red mark
that has nothing to do with the build. Disconnecting it is an owner action.

---

## 16. Two Phase 7 findings worth keeping

### Next.js encodes every server-action form as `multipart/form-data`

An E2E assertion that no form on the journey page carries a multipart enctype was written,
and failed. The enctype belongs to the framework, appears on forms that accept nothing but
text, and cannot be removed.

The useful reading is not "the assertion was wrong" but what it implies: **a hand-crafted POST
to a server action can carry a file part whatever the page renders.** So "there is no upload
path in the journey flow" (FR-25, BR-06, D-09, invariant 6) can never be proved from markup.

It is enforced at the boundary instead. Every journey action reads its fields through:

```ts
function text(form: FormData, field: string): string {
  const value = form.get(field)
  if (value === null) return ''
  if (typeof value !== 'string') throw new UploadRefusedError(field)
  return value
}
```

A fabricated multipart request is refused rather than coerced to `"[object Object]"`. Both the
spec and the architecture test now say why, so the assertion does not get helpfully re-added.

It arrived as an ESLint `no-base-to-string` error about `String(formData.get(...))`. The lint
rule was right for a reason the rule does not know about.

### Auth.js rejects an untrusted host silently

Ten E2E failures that all looked like a bad session cookie. The cookie was fine —
`authjs.session-token`, confirmed by reading `@auth/core` rather than guessing, with the
`__Secure-` prefix appearing only over https.

The cause was `trustHost`, which Auth.js derives from `AUTH_URL`. CI did not set it, so the
runner's host was untrusted and **every session read returned `null`** — indistinguishable from
a cookie that never arrived. `AUTH_URL` and `AUTH_TRUST_HOST` are now set for the E2E job.

Worth remembering because it will recur on any new deployment target: a signed-in flow that
behaves exactly like a signed-out one is a host-trust problem before it is a cookie problem.

### What still needs a person

The Phase 7 migration has been applied to **no Neon branch yet** — it is verified against CI's
empty Postgres, and nothing else. CLAUDE.md §4 requires migrations to be applied deliberately
rather than on deploy, so `npm run db:deploy` against `test` and then `production` remains an
owner action, best done when the link is healthy (§14).

Sign-in also needs two secrets that are not and must never be in this repository:
`AUTH_SECRET`, and `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` from a Google Cloud OAuth client.
Until they are set, `/en/signin` says so plainly rather than offering a button that fails —
and reading the platform continues to work without any of it.

---

## 17. Two Phase 8 findings about testing itself

Neither is a product defect. Both cost CI cycles and both will recur.

### E2E specs that create public content race specs that read it

Phase 8 gave the browser suite the ability to create real routes, and ten assertions in two
files failed at once. Search is newest-first and Playwright runs `fullyParallel`, so
`route-journey.spec.ts` clicking *"the first search result"* started landing on a route
`contribute.spec.ts` had made a second earlier — brand new, no steps, therefore no
"Open this step" link.

**"The first result" was never a good locator; it only looked like one while exactly one route
existed.** The reading journey now names the route it seeded, which is deterministic and a
more honest test: it walks to a known destination rather than to whatever turned up.

The general rule for this suite: **a spec that writes shared knowledge must not assume it is
alone, and a spec that reads shared knowledge must name what it is reading.**

### Playwright's accessible name includes the control's own content

`getByLabel(/^information$/)` matched an empty textarea and stopped matching the moment the
field had a value in it — which is precisely when an UPDATE form is under test. The accessible
name of a control inside a wrapping `<label>` includes the control's content: a prefilled
`<textarea>` contributes its value, and a `<select>` contributes **every option's text**, so
`getByLabel(/^reason$/)` never matched the challenge select at all.

Form controls in this suite are located by `[name="..."]` and scoped to their own form.

Both failures were also, incidentally, evidence the product works. The strict-mode violation
on "attested by the ministry" was the field's paragraph *and* the update form's textarea
holding the same words — the form correctly prefilled with the current value. And a text match
for a newly added step found the SVG's own `<title>`, which is the renderer having drawn it.
The spec now asserts that directly rather than by accident.

---

## 18. Phase 10 — what the guards caught, and one thing they could not

### The privacy guard produced a better design than the one it rejected

The first draft of `followerChangeReport` loaded both sides of the shadow comparison itself,
which meant `src/server/journeys/changes.ts` imported `@/server/revisions/read`. The Phase 7
guard `never imports the revision service from the journey modules` refused it.

The instinct was to narrow the guard to the *write* service, since a read is harmless. That
would have been wrong, and following the rule instead produced the insight the phase needed:
**the comparison is public and only the date is private.** Two versions of a route are public
knowledge anybody can read; what nobody else may see is that this person started following on
the 10th. So the journey module returns `startedAt` and the page asks `shadowSince` in the
public read layer — and a follower and an anonymous reader now run *identical* comparison
code, differing only in which date they pass.

A guard that only ever confirms what you already did is decoration. This one changed the
design.

### A guard fired on a word, correctly, for the wrong reason

`promoteDisruptionToChange` failed the invariant-13 monetisation scan, whose regex includes
`promoted` — as in a promoted listing. The function had nothing to do with money.

Renaming was still right, and not merely to appease the test. BR-08's own wording is "unless
they become structural changes", so `disruptionBecamePermanent` is the domain's word; and
"promote" implied an elevation in standing that does not happen. The false positive found a
bad name.

The general point: when a broad guard fires on a false positive, the cheap fix is to narrow
the guard and the right question is usually whether the name was good.

### Five enum-literal collisions, and why the union types had to be renamed

The Phase 0 single-source guard forbids any `DOMAIN_ENUMS` value appearing as a quoted string
outside `src/domain/enums.ts`. Phase 10's presentation unions collided five times — `archived`,
`structural`, `route_wide`, `in_progress` and `completed` are all values of *other* enums.

They were renamed (`step_archived`, `shape_changed`, `whole_route`, `underway`,
`already_done`) rather than the guard being scoped. Two reasons: the guard is what stops a
hardcoded `=== 'official'` drifting away from the enum, and it is worth more than a naming
preference. And the renames are clearer anyway — `step_archived` says which kind of thing was
archived, which the bare word never did.

A standing note for later phases: **check new string unions against the enum registry before
writing them**, not after. The check is three lines of Node against the `as const` arrays.

### The SVG `<title>` trap, a second time — and why the fix improved the test

Four E2E failures on the first Phase 10 gate run (#42), all one cause. `getByText('APS
certificate')` resolved to `<title>3. APS certificate — Documents and preparation</title>`
inside the road's `<svg>`, which Playwright reports as **hidden**: it is an accessibility
label, not rendered text. Test.md §17 already records this exact trap from Phase 8; the road
is drawn above the comparison rows, so the title is simply first in DOM order.

`.first()` does not help — it selects the wrong element more decisively. The fix is to scope
to the element that actually carries the claim:

```
const addedRow = page.locator('li').filter({ hasText: 'APS certificate' }).first()
await expect(addedRow.getByText(/was not part of the route then/i)).toBeVisible()
await expect(addedRow.getByText(/^added$/i)).toBeVisible()
```

That is a **better assertion than the one it replaced**. Three loose string matches on a page
became one row proving the step, the gap opposite it and the "Added" mark appear *together* —
which is what FR-77's "location of change" actually claims. Same for the disruption card: its
date, location and process scope are now asserted within one card, so they are proved to
belong to each other rather than merely to be somewhere on the page.

**Standing rule for this suite: when route content is under test, scope the assertion to the
row, card or form that carries it.** The road will always match first, and matching the road
is never the thing being tested.

### What the guards cannot prove, and what covers it instead

**That the side-by-side comparison is actually comprehensible.** Tests can assert that both
roads render, that the rows align on a shared ordinal, that an added step has nothing opposite
it and that no second renderer exists. None of that proves a student looking at two columns
understands what changed — which was the entire failure of the Phase 4 overlay, and it was
found by *looking at it*, not by a test.

This remains a judgement call resting on VR-07 and on the Phase 4 finding. The honest status:
the encoding is defensible and the alternative is proven bad, but the design has not been in
front of a reader. Phase 12 should look at it on a real route with a real diff before treating
it as settled.

**Timestamp granularity, in two places.** `loadRouteGraphAt` compares `createdAt <= at`, and
`followerChangeReport` shows changes announced strictly after `startedAt`. Both are correct and
both have a one-millisecond edge.

Run #43 found the second one: a test followed a route with two users and announced a change on
the next line, and in CI the second `followRoute` and the `announceChange` landed in the same
millisecond, so the change fell outside the follower's window and an assertion about its
*stance* received `undefined` instead of `null`.

There is **no product consequence**. A change announced in the same millisecond somebody starts
following is part of the route they chose, not news that arrived under them. But it makes a
test non-deterministic, and the fix was worth more than a pause: the assertion now checks the
property directly — the note exists once and belongs to exactly one journey — which does not
depend on either report being fetched at all. The pause was added as well, with a comment
saying why.

**Standing rule: a test that depends on `announcedAt > startedAt` must space the two writes,
and should prefer asserting the underlying row over the rendered projection where both are
available.** The integration tests insert a 25ms pause before "after" writes for the same
reason.

---

## 19. The Phase 10 review finding: date association was never going to hold

The review asked for one thing Phase 10 had left implicit — a durable link between a change
announcement and the revision state it describes — and it was right to.

**The failure would have been silent.** Matching by date works perfectly on a quiet route with
one change a month, which is exactly the shape of every fixture written so far. It breaks on
the shape this product is *for*: a busy route where several people edit together. Nothing would
have thrown; the shadow comparison would simply have shown the wrong "before" and looked
entirely plausible doing it.

Three properties of the ledger make it unusable, and every one of them is deliberate:

| Property | Where it comes from | What it does to date matching |
|---|---|---|
| Revisions in one transaction share a `createdAt` | Phase 3's write service appends and repoints in one transaction | A cut between two of them is arbitrary |
| `previousRevisionId` is non-unique | Concurrent edits both survive (FR-70, invariant 15) | "Current at time T" has two correct answers |
| Announcements cluster | Contributors edit, then announce | Two changes minutes apart describe edits made together |

Phase 10 had already met the first of these in CI (§18) and treated it as a test-timing
nuisance. It was a design signal.

### Why only the "to" side is stored

The obvious shape is a from/to pair. It is wrong here, because every revision already carries
`previousRevisionId` — immutably, enforced by trigger. Storing a "from" as well would duplicate
a fact the ledger owns, and a duplicate can disagree with the original; the copy would then be
wrong in exactly the cases where somebody was relying on it.

Storing only the "to" also gives one fact for free: a named revision whose `previousRevisionId`
is null means the entity did not exist before. "This change added a step" needs no flag.

### What made the guard non-vacuous

The most valuable assertion in this batch reads the *source* of `shadowForChange` and requires
it to contain no `createdAt`, no `announcedAt`, no `lte`/`gte`, and no `getTime()`. That is
crude, and it is the only form of the claim a test can actually make: any test that fed it data
would pass just as happily on a date-based implementation, because on tidy fixtures the two
agree. The property being defended is *how the answer is obtained*, so the source is what has
to be checked.

The same reasoning produced the two-timestamp integration test, which constructs the ambiguity
on purpose — two announcements written with one `new Date()` — and asserts the premise
(`new Set(...).size === 1`) before asserting the behaviour. Without that assertion the test
would quietly stop testing anything the day timestamps stopped colliding.

### One guard tripped on the schema's own prose

`introduces no snapshot, version number or sequence` failed on comments explaining *why there
is no snapshot table*. `SCHEMA` strips `///` documentation but keeps `//` notes.

Fixed by stripping both comment forms for that assertion — the same rule the enum single-source
guard already follows, for the same reason: prose cannot drift into behaviour, so scanning it
as if it could produces findings that are pure noise. **An absence guard must read code only.**

---

## 20. Production migration and authentication verification (owner, 2026-09-03)

Recorded from the owner's run, not re-verified from this environment. The distinction matters:
everything else in this file is a machine-checked result, and this is a report.

**The procedure that was followed:** rehearse on Neon `test`, verify, then apply to
`production`, verify again. Five migrations — `private_journeys_and_identity`,
`community_signals`, `safety_reports_and_quarantine`,
`change_propagation_and_disruptions`, `change_revision_link`.

| Check | Result |
|---|---|
| `test` migrated (52 users, 359 routes, 713 field revisions present) | ✅ |
| `production` migrated | ✅ |
| Production schema drift (`migrate diff --exit-code`) | ✅ clean |
| `/api/health` reaches the production database | ✅ |
| Google sign-in end to end on the Vercel deployment | ✅ |

**Why the `test` branch was the load-bearing rehearsal.** Production held no rows, so applying
to it could not have exercised the two `ADD COLUMN`s against existing data — `users.email`
(nullable) and `users.role` (`DEFAULT 'member'`). `test` had 52 user rows and did exercise
them. A rehearsal on an empty branch would have proved nothing that production did not already
prove by being empty.

**What this closes.** The deployment had OAuth wired since the redeploy, but the tables Auth.js
writes on sign-in did not exist on production — `users.email`, `accounts` and `sessions` all
arrived in the Phase 7 migration. Anyone completing the Google handshake would have got a 500
at the last step. That gap is now shut, and shut in the order that catches problems: data-
bearing branch first.

---

## 21. Phase 11 — the two rules, and what a guard could not have caught

### Invariant 23 is a type check, not a comment

The distinction §19.1 draws — dormancy for unused new routes, freshness for established ones —
is the kind of rule that survives review and dies in a refactor six months later, because
nothing about the code stops you widening the condition.

So the only branch that can produce `dormant` sits inside `if (current === Lifecycle.experimental)`,
and an architecture test asserts `Lifecycle.dormant` is proposed in exactly one place. An
established route cannot reach that branch at all.

The unit test then attacks it from the other side, with the evidence most likely to trip a
naive rule: **created 3650 days ago, zero followers, zero confirmations, zero edits, nothing
for 3000 days.** Run across every lifecycle state, asserting none but `experimental` is ever
proposed dormant. If somebody later moves the dormancy check outside the guard, that test
fails on nine states at once.

### The guard that made the design better, again

The first draft wrote `prisma.route.update` directly for lifecycle state and the merge pointer.
`model-classification.test.ts` refused it: only `src/server/revisions` may write a revisioned
model.

This is the second phase running where that boundary has forced the right split — Phase 9's
quarantine hit it identically. The resolution is the same both times and is worth stating as a
pattern: **deciding is one module's job, writing is another's.** Authorisation, evidence and the
audit record stay in `src/server/lifecycle`; the single `tx.route.update` lives beside
`archiveStep` and `setFieldQuarantine`, where every write to shared knowledge can be read in
one place.

### A false positive worth keeping

`contribution-loop.test.ts` guards against §25's "competitive points game" with a regex
including a bare `points`. It fired on new UI copy — "It leaves search and **points**
readers at the surviving route" — the English verb, not the noun.

Narrowing the regex was the wrong fix. That guard scans user-facing copy, which is exactly where
"you earned 50 points" would appear, so its breadth is the point. The copy was reworded to
"sends readers to", which reads better anyway. Same conclusion as Phase 10's `promoteDisruption`
rename: **when a broad guard fires on prose, change the prose.**

### The defect only the integration suite could find

The first dormancy rule asked "were any revisions written after the route was created?" It is
the natural way to say "has anything happened since", every unit test passed, and it was
**completely broken**: creating a route writes its steps, edges and fields milliseconds after
the route row, so every route in existence had activity-after-creation from birth. Nothing
could ever have gone dormant. FR-38 would have shipped dead.

The unit tests could not have caught it, and the reason is worth stating plainly: **they set
the count by hand.** A fixture saying `revisionsAfterCreation: 0` describes a route that cannot
exist. Only building a real route through the real service produced the real number, and the
integration run failed on six assertions at once.

The rule is now a date — `lastActivityAt` compared against the same baseline 30 days — which
has no such edge. A route built on day zero and left alone is untouched on day 31; one that
gained a field on day 25 is not. The broken case is kept as a unit test with the fixture that
actually occurs.

**The general lesson: a fixture field that the production code derives is a fixture field that
can describe an impossible world.** Where a value is computed from several tables, the unit
test proves the rule and only the integration test proves the input.

### Fighting the immutability triggers, and stopping

The first fix to the integration fixtures was to backdate `createdAt` on the routes *and their
revisions*, so a 30-day-old route could be tested without waiting 30 days. Postgres refused:
the Phase 2 migration makes every revision row immutable against UPDATE.

That refusal is the ledger working exactly as designed, and the right response was to stop
pushing. `applyProposedLifecycle` already takes `now`, so the tests move the **observer**
instead of the record — `later(DORMANCY_DAYS + 5)` rather than `backdate(35)`. It needs no
privileged write, exercises the same code path production uses, and is a better test for it.

**When a fixture needs a capability the product deliberately refuses, the fixture is wrong.**

### What the tests cannot prove

**That a merge is the right call for any given pair.** Every mechanical property is asserted —
histories intact, followers preserved, progress untouched, reversible, cycle-free. Whether two
routes actually describe the same journey is §40.1's question, it is a human judgement, and the
product's answer is to put it in front of an administrator with both routes linked rather than
to compute it. A test can only confirm that nothing decides it automatically, which it does.

**That "quiet" reads as reassuring rather than as neglect.** The tests assert the absence of a
caution and the absence of alarming words. Whether a student seeing "Quiet. Nothing has changed
on this route recently" concludes "settled" or "abandoned" is a copy question that needs a
reader, not an assertion. Flagged for the Phase 12 pass alongside the shadow comparison (§18).

---

## 22. Phase 12 — four bugs that never failed anything

Every defect this phase found was **silent**. None broke a test, none logged a warning, and
none looked wrong to the person who wrote it. That is worth recording as a category, because
it is the category a phase of tests aimed at behaviour will never find.

| Defect | Why nothing caught it | Now guarded by |
|---|---|---|
| `ROAD_NARROW` existed since Phase 4 and nothing selected it | The desktop road rendered correctly on a phone — inside a scroller. Every test passed; it was just wrong | An E2E assertion that the *painted* road is narrow at 360px and wide at 1280px |
| `ink-500` at 4.28:1, below WCAG AA | Contrast is not something code can notice, and it looked fine to the eye that chose it | A test recomputing every text/background pair, reading the palette out of `globals.css` |
| `bg-canvas` and `bg-brand-50` undefined | Tailwind emits no CSS and no warning for an unknown utility. The elements were simply transparent, on a white page | A test resolving every colour utility in every `className` against the theme |
| `robots: index: false` left on since Phase 0 | A note said "Phase 5 opens this". Phase 5 opened the read path and did not open indexing. Six phases passed | A test asserting the read path is indexable and `/admin` and `/journeys` are not |

The last one is the one to learn from: **a comment recording future work is not a mechanism.**
It was accurate, it was in the right file, and it was read by nobody at the moment it mattered.
The same note as a failing test would have taken one phase to notice instead of six.

### Comment-stripping, the fourth time

`presentation.test.ts` shipped with two guards that reported violations of themselves. The
pinch-zoom guard matched the comment in `layout.tsx` explaining that `maximum-scale` must never
be set; the quiet-wording guard matched the note above `quietExplainer` explaining that
"abandoned" must never appear.

This is now the fourth occurrence — Phase 10's schema prose (§19), Phase 11's "points readers"
copy (§21), and both of these. The rule has earned a permanent place:

> **An absence guard reads code, never comments.** `stripComments(read(file))`, always. The
> documentation of a rule will otherwise be reported as a violation of it, and the more
> carefully the rule is explained the more certainly the guard fails.

### And one guard that had to be tuned rather than stripped

The colour-utility check first reported 21 offenders, all `border-t`, `border-b`, `divide-y`.
Those share a prefix with colour utilities and are not colours.

The exclusion list is where that guard earns or loses its usefulness, and it can fail in two
directions. Too permissive and a broken colour slips through — which is the bug it exists for.
Too strict and it floods with `border-t`, and the next person deletes it. It is written out
explicitly, grouped by *why* each entry is not a colour, so the next person extending it can
tell which direction they are moving in.

### What Phase 12 still cannot prove

**That the shadow comparison is comprehensible**, and **that "quiet" reads as settled rather
than abandoned.** Both were flagged after Phases 10 and 11 as needing a reader, and both were
*acted on* here — arriving and departing steps are now marked on the compared roads, and the
quiet copy leads with agency and points at the last-confirmed date, which is now shown outside
the disclosure for that state.

But acting on a judgement is not the same as validating it. Neither has been in front of a
student, and no assertion in this repository can put one there. They remain the two places
where the product's own reasoning is the only evidence.

---

## 23. Phase 12B–12D — what a guard caught, and what only a real database could

Five defects in the visual phases were caught by a guard before they reached a browser, and
two were not caught by anything until CI ran against a real Postgres. The split is the useful
part: the first five are all *properties of source text*, and the last two are properties of a
running system.

### What the guards caught

| Found by | Defect |
|---|---|
| Contrast guard | `text-hairline` on a breadcrumb separator — a border token at L=0.91, invisible as text to a good many readers |
| Colour-literal guard (new) | Six hex colours still hardcoded in the renderer after the palette moved to tokens. The contrast test reads the CSS, so it would have been certifying values that were not being painted |
| Enum single-source guard | `tone="quiet"` on a panel and `tone="quiet"` on a button, colliding with the `quiet` lifecycle state. Renamed `sunken` and `bare` |
| Gamut test (new) | Three of eighteen category tones written 0.3% outside sRGB, because the chroma fit was rounded **up** afterwards. Invisible — and enough to make every contrast figure a fiction, since the browser clamps and the clamped colour is not the measured one |
| Invariant-13 ordering guard | Caught the `id` tie-break being added to search ordering, which is exactly what it is for. Updated to match the new clause **exactly** rather than loosened to a pattern |

### What only a real database caught (CI run #54)

Both database-backed jobs failed while `lint · typecheck · test · build` was green. Neither
failure was in the product.

**`@db.Char(2)`.** The new pagination test generated a six-character destination code to
isolate itself. Typecheck cannot see a column width, and no unit test touches Postgres, so it
passed everything locally. **A column constraint is not visible to any check that does not
connect to a database** — which is the argument for the integration job existing at all.

**Pagination broke an assumption the E2E suite did not know it was making.** The reading specs
searched unfiltered and picked the seeded route out of the results. `lifecycle.spec.ts` builds
seven BD → DE Master's fixtures and `changes.spec.ts` six, all newer, so at twelve per page the
seeded route moved to page two and the specs stopped finding it.

This is the third appearance of the finding first recorded in §17: **specs that create public
content race specs that read it.** Pagination did not introduce it; it made an existing latent
coupling load-bearing. The fix was to make the fixture reachable — a distinctive intake, and
specs that filter by it — rather than to raise the page size, which would have been tuning the
product to suit the suite, or to assert on whichever ribbon came first, which would have passed
while testing nothing in particular.

**The rule worth carrying forward:** when a read path gains a limit, every test that reads
"the list" has just acquired an assumption about ordering that nothing states. Search for the
readers, not only for the writers.

### Still untested

- **Gate 4 does not exist yet.** Nothing in CI compares a screen to a visual reference; the
  screenshots taken during 12B–12D were reviewed by eye and are not retained or asserted.
  Phase 12G owns this, and until it lands the visual work is verified by inspection only.
- The E2E assertion that a ribbon fills ≥85% of its row is written but had not completed a CI
  run at the time of writing.
