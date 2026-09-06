# Prompt for the next session

Copy everything below the line into a fresh session.

---

Continue work on Vindeshi Express. Start by reading `Status.md` (session 16 is the most
recent), then `Phases.md`, then `Test.md` §14, §23 and §24, then `CLAUDE.md` — especially §6
(the 25 invariants), §7.2, §7.3, §10.2 and §11.

## Where things stand

`main` is at `54714b1`, working tree clean, **CI run #62 green on all three jobs**. Production
is migrated and live — `/en/routes` renders. 903 unit and architecture tests pass.

Phases 0–12D are complete. **Phase 12E is partly done**: the community surfaces have been
brought onto the design system (panels, radii, headings from the token scale), but they have
**not** been recomposed against their visual references. That is the first job.

## What to do, in order

### 1. Finish Phase 12E — recompose against the mockups

The surfaces are aligned to the system but still laid out roughly. Recompose each against its
reference in `Visual References/`:

- **VR-08 — update a field.** Current value beside proposed value, with route/step/field
  context, applicability, reason and source. **Do not build VR-08's "reviewed by the
  community / goes live when confirmed" staging** — updates go live immediately and a Phase 8
  guard enforces it (§8.6).
- **VR-09 — create a route.** The basics form, then the route itself, with its step strip
  drawn by the renderer.
- **VR-10 — updates and disruptions** for one route: the four severity levels, and the
  permanent-change vs temporary-disruption distinction made visual. **No "Subscribe to
  Alerts", no alert settings, no second Impact axis** (§35, §41.2). A cross-route updates feed
  is out of scope and would be a change request.
- **VR-11 — report and safety.** Category grid, detail form, "what happens next", quarantine
  explanation. **No screenshot upload** (§8.6), **no Safety Leaderboard** (§25), and the
  recently-quarantined list is **not public** (Phase 9 — reports are not a public board).
- The contributor page and the two admin queues.

Every deliberate departure from a mockup goes in writing into `Phases.md`, under the rule at
the top of the 12B–12G section: *an unexplained departure from a mockup is a defect, an
explained one is a decision.*

### 2. Phase 12F — mobile and tablet as their own product

Bottom tab bar (Explore / My Journey / Updates / Profile), route-as-tabs on a phone with the
horizontal step-chip strip, a genuinely two-panel tablet composition. VR-12 and VR-13.

### 3. Phase 12G — visual acceptance

Screenshot suite in CI at 360/768/1280/1440 published as artifacts, a fidelity checklist per
mockup in `Test.md`, then Gate 4.

### 4. Phase 13

Gates 1, 3 and 4 run against hypothetical routes. Gate 2 waits for the owner's researched
content.

## Settled — do not re-litigate

- **No admin "delete route".** Reasoning is in CLAUDE.md §10.2. Test fixtures are removed by
  resetting the disposable Neon `test` branch, never by a delete path in the product.
- **Production is never seeded.** The owner researches and supplies real route content himself
  before launch. Hypothetical routes are fine for testing and must be removed afterwards.
- **Gate ordering:** 12E → 12F → 12G → Gates 1, 3, 4 (fixtures) → owner's content → Gate 2.
- **Both CLAUDE.md §11 palette decisions are closed** (2026-09-04): the six category colours
  are fitted and measured; there is deliberately **no** route-maturity palette, and a test
  fails if a `--color-lifecycle-*` token appears.
- **The read path ships one client component** (the error boundary). Keep it that way — server
  rendering is the performance strategy, and the whole read path must work with JavaScript
  disabled.

## Traps that have already cost time — read Test.md §24

- **A 200 status code does not mean a page works.** A caught error renders through the error
  boundary and still returns 200. Verify by content: grep for the page's own text *and* for the
  error-boundary string.
- **Kill anything on port 3100 before running Playwright locally.** `reuseExistingServer` is
  now opt-in, but a stale server plus `rm -rf .next` produced hours of phantom failures.
- **A full local E2E run is not the test CI runs.** `fullyParallel` against a remote Neon
  branch fails ~25 tests on latency alone; CI uses a local `postgres:18` container. Run single
  specs with `--workers=1` locally, and trust CI for the full suite.
- **Integration tests locally need `--testTimeout=120000`.** Eight of them exceed the 30s
  default against Neon and pass in ~39s. Not defects.
- **An empty result from a fan-out means nothing ran until proven otherwise.** A review
  workflow returned `{"confirmed": []}` after all seven agents died on a session limit. Check
  the journal for `result` lines before believing an all-clear.
- **`.next` is shared between `next dev` and `next build`.** Do not run a production build
  while a dev server is up.

## Owner actions outstanding

- **Accept or reject the ribbon and road direction** against VR-03 and VR-04. This is the one
  unticked exit criterion on both 12C and 12D, and everything after builds on it.

## Working rules

Update `Status.md` at the end of the session, `Test.md` after any test run that finds
something, and mark phase progress in `Phases.md`. Commit messages cite FR/BR/D ids. Split
unrelated work into separate commits — a 42-file commit labelled as a ribbon fix has already
happened once and made the record misleading.
