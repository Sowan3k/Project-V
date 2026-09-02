import { PrismaClient } from '@prisma/client'

/**
 * Refuses to run the integration suite against anything but a database that has explicitly
 * declared itself disposable.
 *
 * Test.md §1 says tests never run against `production`. That was a convention, and a
 * convention is not much protection when the suite creates and archives real rows and the
 * only difference between the two databases is which line of an env file was edited last.
 *
 * The check is a positive assertion about the database itself, not about the shape of an
 * environment variable name: the target must carry a `platform_meta` row saying it is a test
 * database. Production does not have that row and will never acquire it by accident.
 *
 * To prepare a new test branch:
 *   insert into platform_meta (key, value, "updatedAt")
 *   values ('environment', 'test', now());
 */
const MARKER_KEY = 'environment'
const MARKER_VALUE = 'test'

/**
 * Retries the marker read before concluding the database is unreachable.
 *
 * A single connect attempt in a global setup is a canary for network jitter, not a safety
 * check. Two things make one attempt unreliable against Neon: a compute that has scaled to
 * zero takes 25-30s to wake, and connection establishment over a slow link can exceed
 * Prisma's connect timeout on its own — measured at 2.4-8.8s for *successful* connects on
 * 2026-09-03, with failures clustering at ~5.01s (Test.md §12, §14).
 *
 * Retrying changes nothing about what is being verified: the marker must still be present
 * and must still say `test`. A wrong marker fails immediately and is never retried, because
 * that is a real answer rather than a missing one.
 */
async function withRetry<T>(read: () => Promise<T>, attempts = 6): Promise<T> {
  let last: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await read()
    } catch (error) {
      last = error
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
  throw last
}

export async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) return // The suite skips itself; nothing to guard.

  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    const marker = await withRetry(() =>
      prisma.platformMeta.findUnique({ where: { key: MARKER_KEY } }),
    )
    if (marker?.value !== MARKER_VALUE) {
      throw new Error(
        `Refusing to run integration tests: the target database is not marked as a test ` +
          `database. Expected a platform_meta row ${MARKER_KEY}=${MARKER_VALUE}, found ` +
          `${marker?.value ?? '(no row)'}. If this is genuinely a disposable branch, insert ` +
          `that row. If it is production, stop.`,
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}
