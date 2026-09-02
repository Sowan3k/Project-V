import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Database-backed integration tests.
 *
 * Separate from `npm run test` because they need a live Postgres. They point at
 * TEST_DATABASE_URL — a Neon scratch branch locally, a service container in CI — and never
 * at `production` (Test.md §1).
 */
/**
 * Prisma's default `connect_timeout` is too tight for a remote Neon branch on a slow link.
 *
 * Measured from this workstation on 2026-09-03: *successful* connects to the test branch
 * took 2.4-8.8 seconds, while failures clustered at ~5.01s — the default cliff. Roughly two
 * in five attempts failed against a compute that was demonstrably awake, which turned the
 * integration suite into a coin toss (Test.md §14).
 *
 * This raises the ceiling for the integration suite only. It is not a fix for the same
 * exposure on the deployed read path — that is a real user-facing question (a first visitor
 * after an idle period) and belongs to Phase 12's performance and error-state work, where it
 * is already recorded as OF-6. Widening a timeout here would hide it there; keeping the
 * change scoped to the test runner keeps the product question open and honest.
 */
const CONNECT_TIMEOUT_SECONDS = '20'

function withConnectTimeout(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', CONNECT_TIMEOUT_SECONDS)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

const patchedEnv: Record<string, string> = {}
for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL']) {
  const patched = withConnectTimeout(process.env[key])
  if (patched !== undefined) patchedEnv[key] = patched
}

export default defineConfig({
  // The renderer is React components, so tests that render them need the JSX transform.
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.db.test.ts'],
    // Refuses to run unless the target database has declared itself disposable.
    globalSetup: ['tests/db/setup.ts'],
    // One file at a time: these share a database and would otherwise race.
    fileParallelism: false,
    env: patchedEnv,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
