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
 *
 * The result is cached briefly (see PROBE_CACHE_MS). This endpoint is unauthenticated and
 * will be publicly reachable, and Neon's compute scales to zero on a free tier — so an
 * uncached probe lets anyone turn a request flood into database load and compute spend
 * (§28.1 cost philosophy). Caching collapses a flood into one query per window.
 *
 * The cache is per running instance, so N concurrent serverless instances still allow N
 * queries per window rather than one. That is a large reduction, not an absolute cap; a
 * hard cap needs rate limiting at the edge, which belongs with the rest of the abuse
 * controls in Phase 9.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Long enough to blunt a flood, short enough that a real outage surfaces quickly. */
const PROBE_CACHE_MS = 10_000

type Probe = { readonly body: Record<string, unknown>; readonly status: number }

let cached: { at: number; probe: Probe } | null = null

async function probe(): Promise<Probe> {
  if (!isDatabaseConfigured()) {
    return { body: { status: 'degraded', database: 'unconfigured' }, status: 503 }
  }

  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`select 1`
    return {
      body: { status: 'ok', database: 'reachable', latencyMs: Date.now() - startedAt },
      status: 200,
    }
  } catch {
    return { body: { status: 'degraded', database: 'unreachable' }, status: 503 }
  }
}

export async function GET(): Promise<NextResponse> {
  const now = Date.now()

  if (cached && now - cached.at < PROBE_CACHE_MS) {
    return NextResponse.json({ ...cached.probe.body, cached: true }, { status: cached.probe.status })
  }

  const result = await probe()
  cached = { at: now, probe: result }

  // The Neon branch is a local development diagnostic, not something a public endpoint
  // needs to announce. It is omitted wherever NEON_BRANCH is unset, which is every
  // deployed environment.
  const branch = neonBranch()
  const body = branch === null ? result.body : { ...result.body, branch }

  return NextResponse.json(body, { status: result.status })
}
