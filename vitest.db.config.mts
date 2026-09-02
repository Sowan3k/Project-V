import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Database-backed integration tests.
 *
 * Separate from `npm run test` because they need a live Postgres. They point at
 * TEST_DATABASE_URL — a Neon scratch branch locally, a service container in CI — and never
 * at `production` (Test.md §1).
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.db.test.ts'],
    // Refuses to run unless the target database has declared itself disposable.
    globalSetup: ['tests/db/setup.ts'],
    // One file at a time: these share a database and would otherwise race.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
