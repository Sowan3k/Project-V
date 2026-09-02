import { PrismaClient } from '@prisma/client'

import { writeGuardExtension } from '@/server/write-guard'

/**
 * Prisma client singleton.
 *
 * Standard Node-runtime client against Neon's pooled endpoint — not the edge driver
 * (CLAUDE.md §4). The global cache keeps Next's dev-server hot reload from opening a new
 * pool on every module reload.
 *
 * Every client carries the write guard, so shared route knowledge cannot be written except
 * through the revision service (src/server/revisions). Importing this module is itself
 * restricted to `src/server/**` by an ESLint boundary — see eslint.config.mjs.
 */
const base = (): PrismaClient =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

/** The guarded client type, preserved so callers keep full model typing. */
export type GuardedPrismaClient = ReturnType<typeof guarded>

function guarded(client: PrismaClient) {
  return client.$extends(writeGuardExtension)
}

const globalForPrisma = globalThis as unknown as { prisma?: GuardedPrismaClient }

export const prisma: GuardedPrismaClient = globalForPrisma.prisma ?? guarded(base())

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
