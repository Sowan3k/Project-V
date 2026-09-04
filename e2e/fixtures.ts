/**
 * Constants shared between the seed setup and the specs that read what it seeded.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **This file exists because Playwright forbids one test file importing another**, and it
 * says so as a hard error rather than a warning: "test file should not import test file".
 * The first attempt put `SEEDED_INTAKE` in `seed-route.setup.ts` and imported it into
 * `route-journey.spec.ts`, which failed the entire end-to-end job — not one spec, the whole
 * run, because the file could not be loaded at all.
 *
 * The rule is reasonable: importing a test file executes its `test()`/`setup()` registrations
 * inside the importing file's project, so a setup would silently re-register itself under
 * every viewport. A plain module has no registrations to leak.
 */

/** The route `e2e/seed-route.setup.ts` creates. Named so specs do not race each other. */
export const SEEDED_ROUTE_TITLE = 'Test route for the reading journey'

export const SEEDED_ROUTE_SLUG = 'e2e-test-route'
