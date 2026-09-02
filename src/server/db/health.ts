import { isDatabaseConfigured } from '@/lib/env'
import { prisma } from '@/server/db/client'

/**
 * Database reachability probe.
 *
 * Lives behind the server boundary so the health route does not need to import the Prisma
 * client directly — only `src/server/**` may (eslint.config.mjs). It runs a trivial read,
 * so it never touches the write guard.
 */
export type DatabaseHealth =
  | { readonly status: 'ok'; readonly database: 'reachable'; readonly latencyMs: number }
  | { readonly status: 'degraded'; readonly database: 'unconfigured' | 'unreachable' }

export async function checkDatabase(): Promise<DatabaseHealth> {
  if (!isDatabaseConfigured()) return { status: 'degraded', database: 'unconfigured' }

  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`select 1`
    return { status: 'ok', database: 'reachable', latencyMs: Date.now() - startedAt }
  } catch {
    // The error is discarded deliberately: Prisma quotes the connection string back in its
    // initialisation errors.
    return { status: 'degraded', database: 'unreachable' }
  }
}
