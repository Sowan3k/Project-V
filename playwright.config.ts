import { defineConfig, devices } from '@playwright/test'

/**
 * Phase 0 smoke coverage.
 *
 * By default this starts nothing remote: it builds and runs the production build locally,
 * so the smoke suite is meaningful from a clean checkout with no deployment.
 *
 * Point the same specs at a deployed Vercel preview with E2E_BASE_URL — that is the
 * Phase 0 exit criterion "Playwright smoke test loads the deployed preview":
 *
 *   E2E_BASE_URL=https://<deployment> npm run test:e2e
 *
 * If that deployment has Vercel Deployment Protection enabled, also set E2E_BYPASS_URL to
 * a share URL; see e2e/deployment-access.setup.ts.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'
const usingDeployedTarget = Boolean(process.env.E2E_BASE_URL)

/** Where the setup project saves the deployment-protection bypass cookie. */
export const STORAGE_STATE = 'test-results/.deployment-access.json'

const viewports = {
  // 360px is a first-class target, not an afterthought (CLAUDE.md §7).
  'mobile-360': { width: 360, height: 780 },
  'desktop-1280': { width: 1280, height: 800 },
} as const

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // Every page on the read path is server-rendered against a remote database, and Neon's
  // compute scales to zero — a cold first request genuinely takes several seconds. The
  // default 5s assertion timeout produces flakes that look like product bugs.
  expect: { timeout: 15_000 },
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    ...Object.entries(viewports).map(([name, viewport]) => ({
      name,
      use: { ...devices['Desktop Chrome'], viewport, storageState: STORAGE_STATE },
      dependencies: ['setup'],
    })),
  ],
  webServer: usingDeployedTarget
    ? undefined
    : {
        // The local server runs against the TEST database, never production. The route
        // journey spec seeds a route to walk through, and seeded test data must not reach
        // production (content track rules, content/README.md).
        //
        // On a workstation that database is named in `.env.test.local`. In CI there is no
        // such file — the workflow supplies `DATABASE_URL` for a throwaway Postgres service
        // container directly, so prefixing with `dotenv -e` there would fail on a missing
        // file. Same guarantee either way: never production.
        command: process.env.CI
          ? 'npm run build && npm run start -- --port 3100'
          : 'npm run build && dotenv -e .env.test.local -- npm run start -- --port 3100',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
