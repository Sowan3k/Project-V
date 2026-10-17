# Prompt for the next session

Copy everything below the line into a fresh session.

---

Continue work on Vindeshi Express. Read `PENDING.md` first, then the latest entry in `Status.md`
(2026-10-17), then `Test.md` §32, then `CLAUDE.md` (kept locally, not in git), especially §6 (the
25 invariants), §7 and §11.

## Where things stand

Phases 0 to 16 are complete, and the half of Phase 18 that needed no owner decision. Gates 1 and
3 have passed. Gate 4 waits only on the owner's review of the contact sheet, which CI now
produces as the `visual-review-sheet` artifact on every push to main. Gate 2 waits on the
owner's researched route content.

CI on main was red from run #75 until 2026-10-17 because five tests had gone stale. All are
fixed. Check the latest run before starting anything.

## What an agent can do now

1. **The ribbon keyboard defect** (Test.md §32, item 5). On a phone a long ribbon scrolls inside
   its search result and the scroll area has no keyboard access. Ask the owner to choose between
   compressing the ribbon on a phone and moving the scroll out of the link, or propose one with a
   screenshot of each. It only shows with a route of 10+ stages, so seed the Germany fixture
   (`npm run fixture:germany`) to see it.
2. **Pagination on the Updates page.** It shows the 50 most recent changes and says so. Real
   volume is low today; this matters once it is not.
3. Anything the owner has approved in `PENDING.md` since 2026-10-17: rate limiting (B3), Phase 17
   (D5), the public quarantine list (D6), contribution items 5 and 6 (FR-80).

## Settled, do not re-litigate

- **No admin "delete route".** CLAUDE.md §10.2.
- **Production is never seeded.** Hypothetical routes live only on a disposable database.
- **No proactive notifications.** The Updates page is the mechanism (§35).
- **Severity filters, it never orders or decides relevance.** The effective date decides.
- **The read path ships one client component** (the error boundary) and works with JavaScript
  disabled. Every new control so far has been a plain form or a native `<details>`.

## Traps that cost time

- **Kill the Playwright server in its own command.** Chained after a failing command with `&&`,
  the kill does not run, the old server keeps serving while `.next` is rebuilt, and every test
  fails for no product reason.
- **In a cloud container, Chromium may not match Playwright's revision.** Use a config outside the
  repo that sets `launchOptions.executablePath`, and `REVIEW_CHROMIUM_PATH` for the review shooter.
- **A dynamic `await import('../src/...')` in a spec fails under Node 22** (the `@/` alias does
  not resolve). CI uses Node 24. Prefer static imports in specs.
- **The shared seed route accumulates across runs and viewports.** Give every test its own route
  or a run-specific token, and never assert on a constant string other runs also write.
- **A 200 status does not mean a page works.** Check the page's own text and the error boundary's.

## Working rules

Update `Status.md` at the end of the session, `Test.md` after any test run that finds something,
`Phases.md` for phase progress, and `PENDING.md` when an owner item is resolved. Commit messages
cite FR/BR/D ids. Split unrelated work into separate commits.
