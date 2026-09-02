import { NextResponse } from 'next/server'

import { neonBranch } from '@/lib/env'
import { prisma } from '@/lib/prisma'

/**
 * Liveness and database-reachability probe.
 *
 * Phase 0's proof that Prisma is genuinely wired to Neon on the Node runtime, and the
 * target of the Playwright smoke test. It exposes no connection string, no credentials
 * and no user data.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now()

  try {
    await prisma.$queryRaw`select 1`
    return NextResponse.json({
      status: 'ok',
      database: 'reachable',
      branch: neonBranch(),
      latencyMs: Date.now() - startedAt,
    })
  } catch {
    // The error itself is not returned: it can contain the connection string.
    return NextResponse.json(
      { status: 'degraded', database: 'unreachable', branch: neonBranch() },
      { status: 503 },
    )
  }
}
