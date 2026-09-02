import { defineConfig } from 'vitest/config'

/**
 * Spike tests run deliberately, never in CI.
 *
 * `npm run test` excludes `spikes/` on purpose: spike code is throwaway and must not gate
 * the build (Phases.md §Phase 1). Run these with `npm run spike:test`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['spikes/**/*.spike.test.ts'],
  },
})
