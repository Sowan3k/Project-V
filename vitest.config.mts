import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      'node_modules/**',
      '.next/**',
      // Playwright specs are driven by `npm run test:e2e`, never by Vitest.
      'e2e/**',
      // Database-backed tests run via `npm run test:db` against TEST_DATABASE_URL. They are
      // excluded rather than left to skip themselves: a suite reporting "7 skipped" reads
      // like coverage that is merely dormant, when in this suite it is simply not in scope.
      'tests/db/**',
      // Throwaway Phase 1 spike code must never gate the build.
      'spikes/**',
    ],
    reporters: ['default'],
  },
})
