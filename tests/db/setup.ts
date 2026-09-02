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

export async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) return // The suite skips itself; nothing to guard.

  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    const marker = await prisma.platformMeta.findUnique({ where: { key: MARKER_KEY } })
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
