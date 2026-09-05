import { assertDisposableDatabaseUrl } from '../support/disposable-database'

/**
 * Refuses to run the integration suite against anything but a database that has explicitly
 * declared itself disposable.
 *
 * The decision logic lives in `tests/support/disposable-database.ts`, shared with the
 * Playwright guard so the two runners cannot drift apart — the asymmetry the audit found
 * (F2) was precisely that only this one checked.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **It guards `DATABASE_URL`, which is the URL the tests actually connect through.**
 *
 * The earlier version read `TEST_DATABASE_URL` and returned early when it was unset, treating
 * that as "the suite skips itself". But every test in `tests/db/**` imports
 * `src/server/db/client`, and that client reads `DATABASE_URL`. So an unset `TEST_DATABASE_URL`
 * did not skip anything — it waved the suite through to whatever `DATABASE_URL` pointed at,
 * which for a shell that had loaded `.env.local` is `production`.
 *
 * Both are checked now, and both must be marked. `TEST_DATABASE_URL` is still verified where
 * it is set, because `vitest.db.config.mts` passes it through and a run that names two
 * different databases should have to prove both.
 */
export async function setup(): Promise<void> {
  await assertDisposableDatabaseUrl(
    process.env.DATABASE_URL,
    'integration suite (DATABASE_URL — the connection tests/db/** actually use)',
  )

  const testUrl = process.env.TEST_DATABASE_URL
  if (testUrl !== undefined && testUrl.trim() !== '' && testUrl !== process.env.DATABASE_URL) {
    await assertDisposableDatabaseUrl(testUrl, 'integration suite (TEST_DATABASE_URL)')
  }
}
