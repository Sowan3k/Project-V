# Test.md — Vindeshi Express test ledger

Running record of every test written or run, its result, and what remains unverified.
**Update this after every test run.** If a test was skipped, say so — an unrecorded gap
reads as coverage that does not exist.

Read alongside [CLAUDE.md](CLAUDE.md) §6 (the 23 invariants) and [Phases.md](Phases.md).

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
| Vitest (unit/integration) | ⬜ | Installed in Phase 0 |
| Playwright (E2E) | ⬜ | Installed in Phase 0 |
| Test database strategy | ⬜ | Use `neon checkout` scratch branch — never run tests against `production` |
| CI pipeline | ⬜ | Not set up |
| Coverage reporting | ⬜ | Not set up |

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

---

## 4. Feature test coverage

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

None recorded.

> When a test fails, add it here with the failing output and the FR/invariant it guards.
> Remove the row only when it passes — never by deleting the test.

---

## 6. Known gaps and deliberate non-tests

| Gap | Reason | Revisit |
|---|---|---|
| Everything above marked ⬜ | No application code exists yet — repo is pre-Phase 0 | As each phase lands |
| Verification of users' real-world claims | 🚫 Out of scope by design (FR-25, D-09) — the platform never verifies personal progress | Never |
| External link destination safety scanning | 🚫 Not a first-release feature; containment is via reporting + quarantine (§42.5) | Post-launch |

---

## 7. How to update this file

After any test run, in the same session:

1. Flip the state marks that changed.
2. Add a row to the Verification log for anything checked manually.
3. Record any new failure in Open failures with its output.
4. If you chose not to test something, put it in Known gaps with a reason — do not leave it silent.
