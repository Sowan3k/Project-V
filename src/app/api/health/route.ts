import { NextResponse } from 'next/server'

import { isDatabaseConfigured, neonBranch } from '@/lib/env'
import { prisma } from '@/lib/prisma'

/**
 * Liveness and database-reachability probe.
 *
 * Phase 0's proof that Prisma is genuinely wired to Neon on the Node runtime, and the
 * target of the Playwright smoke test.
 *
 * It distinguishes the two ways this can fail, because they need different fixes and a
 * bare 503 cannot tell them apart:
 *
 *   unconfigured — DATABASE_URL is not set in this environment. A deployment problem.
 *   unreachable  — DATABASE_URL is set but the query failed. A database or network problem.
 *
 * It never returns a connection string, credentials, an error message or user data: the
 * caught error is deliberately discarded because Prisma's initialisation errors quote the
 * connection string back.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now()

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { status: 'degraded', database: 'unconfigured', branch: neonBranch() },
      { status: 503 },
    )
  }

  try {
    await prisma.$queryRaw`select 1`
    return NextResponse.json({
      status: 'ok',
      database: 'reachable',
      branch: neonBranch(),
      latencyMs: Date.now() - startedAt,
    })
  } catch {
    return NextResponse.json(
      { status: 'degraded', database: 'unreachable', branch: neonBranch() },
      { status: 503 },
    )
  }
}
