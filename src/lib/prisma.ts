import { PrismaClient } from '@prisma/client'

/**
 * Prisma client singleton.
 *
 * Standard Node-runtime client against Neon's pooled endpoint — not the edge driver
 * (CLAUDE.md §4, decided 2026-09-02). The global cache keeps Next's dev-server hot reload
 * from opening a new pool on every module reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
