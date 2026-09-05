import { test as setup } from '@playwright/test'

import { assertDisposableDatabaseUrl } from '../tests/support/disposable-database'

/**
 * Nothing in this suite writes to a database until this passes.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What this closes.**
 *
 * The end-to-end suite writes real rows: `seed-route.setup.ts` creates a route through the
 * revision service, and `journey`, `contribute`, `changes`, `lifecycle` and `safety` each
 * create users and sessions directly. All of it went through whatever `DATABASE_URL` the
 * Playwright *process* inherited — which nothing set. Only the local webServer command was
 * prefixed with `dotenv -e .env.test.local`, and that prefix applies to the Next server, not
 * to the Node process doing the seeding (audit F2).
 *
 * A shell that had loaded `.env.local` for a `db:*` script would therefore have seeded
 * production, and because shared route knowledge is deliberately undeletable (invariant 1),
 * there would have been no clean way back.
 *
 * This runs as its own Playwright project that every other project depends on, so a failure
 * here stops the run before the first write rather than reporting alongside it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why it is skipped against a deployed target.**
 *
 * With `E2E_BASE_URL` set the suite is read-only by construction: `seed-route.setup.ts`
 * returns immediately and every mutating spec calls `test.skip(!seeded, …)`. There is no
 * local database in that mode and often no `DATABASE_URL` at all, so demanding a marker would
 * fail a run that writes nothing. The condition is the same one the specs themselves use, so
 * the two cannot disagree about which mode this is.
 *
 * That deployment mode is also why audit F24 stays open: skipping the writes is safe, and it
 * is also why the deployed target proves nothing about authenticated behaviour.
 */
setup('the database is disposable, or nothing is written', async () => {
  if (process.env.E2E_BASE_URL) return

  await assertDisposableDatabaseUrl(
    process.env.DATABASE_URL,
    'end-to-end suite (DATABASE_URL — used by the seed setup and by every spec that creates a user)',
  )
})

/**
 * Authenticated specs must be able to authenticate, or say so.
 *
 * `journey`, `contribute`, `changes` and `safety` fabricate a session row and set the cookie
 * Auth.js reads. That only works if Auth.js trusts the host it is running on: without
 * `AUTH_SECRET` and a trusted host, every session read returns null, the pages render their
 * signed-out state, and the specs fail with assertions about missing controls — which reads
 * as a product bug rather than a missing environment variable (audit F23).
 *
 * `playwright.config.ts` now supplies local defaults for all three to the server it starts,
 * so this asserts the arrangement rather than hoping for it. It fails loudly instead of
 * letting a signed-in suite quietly become a signed-out one.
 */
setup('local Auth.js configuration is present, so signed-in specs are really signed in', () => {
  if (process.env.E2E_BASE_URL) return

  const missing = ['AUTH_SECRET', 'AUTH_URL'].filter(
    (name) => (process.env[name] ?? '').trim() === '',
  )

  if (missing.length > 0) {
    throw new Error(
      `end-to-end suite: ${missing.join(' and ')} missing. Without it Auth.js returns null for ` +
        `every session and the signed-in specs silently test the signed-out product. ` +
        `playwright.config.ts supplies local defaults — this failing means they were overridden ` +
        `or the config was bypassed.`,
    )
  }
})
