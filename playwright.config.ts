import { defineConfig, devices } from '@playwright/test'

/**
 * Phase 0 smoke coverage.
 *
 * By default this builds nothing and starts nothing remote: it runs the production build
 * locally so the smoke test is meaningful from a clean checkout with no deployment.
 *
 * Set E2E_BASE_URL to point the same specs at a deployed Vercel preview instead — that is
 * the Phase 0 exit criterion "Playwright smoke test loads the deployed preview".
 *
 *   E2E_BASE_URL=https://<preview>.vercel.app npm run test:e2e
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'
const usingDeployedTarget = Boolean(process.env.E2E_BASE_URL)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    // 360px is a first-class target, not an afterthought (CLAUDE.md §7).
    {
      name: 'mobile-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } },
    },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: usingDeployedTarget
    ? undefined
    : {
        command: 'npm run build && npm run start -- --port 3100',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
