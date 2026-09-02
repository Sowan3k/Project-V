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
    // Playwright specs are driven by `npm run test:e2e`, never by Vitest.
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
    reporters: ['default'],
  },
})
