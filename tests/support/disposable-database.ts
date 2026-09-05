import { PrismaClient } from '@prisma/client'

/**
 * The one positive proof that a database is safe to write test data into.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why one shared guard rather than two.**
 *
 * `tests/db/setup.ts` has asserted this marker since Phase 3. The Playwright setup never did:
 * `e2e/seed-route.setup.ts` wrote a route, and `e2e/*.spec.ts` wrote users and sessions,
 * through whatever `DATABASE_URL` the Playwright process happened to inherit. Only the
 * *webServer* command was prefixed with `dotenv -e .env.test.local`; the Node process doing
 * the writing was not. So the strongest safety promise in the project — "seeded test data
 * never reaches production" (content/README.md, Test.md §1) — held for the integration suite
 * and was a convention for the end-to-end suite (audit F2).
 *
 * That asymmetry is why this lives in one module both call. A rule with two homes is a rule
 * that drifts, and this one cannot afford to: shared route knowledge is deliberately
 * undeletable, so a mistaken seed against production is not something an apology undoes.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **It is a positive assertion, and it fails closed.**
 *
 * The check is about the database itself, never about the shape of an environment variable
 * name and never about which file a value came from. `.env.test.local` is a filename, and a
 * filename is not evidence — it is exactly as easy to paste the wrong URL into a file called
 * "test" as into one called anything else.
 *
 * So the target must carry a `platform_meta` row saying it is a test database. Every other
 * outcome refuses to run:
 *
 *   * no connection URL         — nothing to prove anything about
 *   * no marker row             — an ordinary database, which production is
 *   * a marker saying otherwise — a real answer, and the answer is no
 *   * the query cannot complete — unknown, and unknown is not permission
 *
 * `production` has never carried this row and must never be given it.
 *
 * To prepare a new disposable branch:
 *   insert into platform_meta (key, value, "updatedAt")
 *   values ('environment', 'test', now());
 */

export const TEST_MARKER_KEY = 'environment'
export const TEST_MARKER_VALUE = 'test'

/** Reads the marker, or throws. Injected so the decision logic is testable without Postgres. */
export type MarkerReader = () => Promise<string | null>

export class NotADisposableDatabaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotADisposableDatabaseError'
  }
}

/**
 * Retries the read before concluding a database is unreachable.
 *
 * A single connect attempt in a global setup is a canary for network jitter, not a safety
 * check. Two things make one attempt unreliable against Neon: a compute that has scaled to
 * zero takes 25-30s to wake, and connection establishment over a slow link can exceed
 * Prisma's connect timeout on its own — measured at 2.4-8.8s for *successful* connects on
 * 2026-09-03, with failures clustering at ~5.01s (Test.md §12, §14).
 *
 * Retrying changes nothing about what is being verified. A wrong marker fails immediately and
 * is never retried, because that is a real answer rather than a missing one.
 */
async function withRetry<T>(
  read: () => Promise<T>,
  attempts: number,
  delayMs: number,
): Promise<T> {
  let last: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await read()
    } catch (error) {
      last = error
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw last
}

export interface DisposableDatabaseCheck {
  /** The connection string the writes will actually use. Absent is a refusal, not a skip. */
  readonly url: string | undefined
  /** Named in the failure message, so a developer knows which runner stopped and why. */
  readonly context: string
  readonly readMarker: MarkerReader
  readonly attempts?: number
  readonly delayMs?: number
}

/**
 * Throws unless the database behind `url` has declared itself disposable.
 *
 * Every branch throws `NotADisposableDatabaseError` except the one that proves the marker
 * says `test`. There is deliberately no option, flag or environment variable that skips it.
 */
export async function assertDisposableDatabase({
  url,
  context,
  readMarker,
  attempts = 6,
  delayMs = 5000,
}: DisposableDatabaseCheck): Promise<void> {
  if (url === undefined || url.trim() === '') {
    throw new NotADisposableDatabaseError(
      `${context}: refusing to run without a database URL. This runner writes test data, and ` +
        `it must be able to prove where. Point DATABASE_URL at a disposable branch carrying ` +
        `the platform_meta row ${TEST_MARKER_KEY}=${TEST_MARKER_VALUE}. On a workstation that ` +
        `is what \`npm run test:e2e:local\` and \`npm run test:db\` do — both load ` +
        `.env.test.local into this process, which plain \`npm run test:e2e\` does not.`,
    )
  }

  let marker: string | null
  try {
    marker = await withRetry(readMarker, attempts, delayMs)
  } catch (error) {
    // Unknown is not permission. A database we could not ask is one we must not write to.
    throw new NotADisposableDatabaseError(
      `${context}: could not read the disposable-database marker, so this run is refused. ` +
        `An unreachable database is an unproven one, and this check never assumes. ` +
        `Underlying failure: ${error instanceof Error ? error.name : typeof error}.`,
    )
  }

  if (marker !== TEST_MARKER_VALUE) {
    throw new NotADisposableDatabaseError(
      `${context}: the target database is not marked as a test database. Expected a ` +
        `platform_meta row ${TEST_MARKER_KEY}=${TEST_MARKER_VALUE}, found ` +
        `${marker ?? '(no row)'}. If this is genuinely a disposable branch, insert that row ` +
        `(ci/mark-test-database.sql). If it is production, stop — seeded test data must never ` +
        `reach it, and shared route knowledge cannot be deleted afterwards.`,
    )
  }
}

/**
 * The production reader: one short-lived client, closed whatever happens.
 *
 * Deliberately its own client rather than `src/server/db/client`. That module is a singleton
 * carrying the write guard and reading `DATABASE_URL` at import time; a safety check should
 * not depend on the module whose environment it is checking.
 */
export function prismaMarkerReader(url: string): MarkerReader {
  return async () => {
    const client = new PrismaClient({ datasources: { db: { url } } })
    try {
      const row = await client.platformMeta.findUnique({ where: { key: TEST_MARKER_KEY } })
      return row?.value ?? null
    } finally {
      await client.$disconnect()
    }
  }
}

/** The whole check, wired to a real database. Both runners call exactly this. */
export async function assertDisposableDatabaseUrl(
  url: string | undefined,
  context: string,
): Promise<void> {
  await assertDisposableDatabase({
    url,
    context,
    readMarker:
      url === undefined || url.trim() === ''
        ? () => Promise.resolve(null)
        : prismaMarkerReader(url),
  })
}
