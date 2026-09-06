import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end coverage.
 *
 * By default this starts nothing remote: it builds and runs the production build locally,
 * so the suite is meaningful from a clean checkout with no deployment.
 *
 * Point the same specs at a deployed Vercel preview with E2E_BASE_URL:
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

/**
 * Local Auth.js configuration, made deterministic — audit F23.
 *
 * Four specs fabricate a session row and set the cookie Auth.js reads. That only works if
 * Auth.js has a secret and trusts the host: without them every session read returns null,
 * the signed-in specs silently exercise the signed-out product, and the failures read as
 * missing UI rather than as missing configuration. `.env.test.local` carries database URLs
 * and nothing else, and it is gitignored, so it could not be relied on to carry these.
 *
 * Assigned onto this process rather than passed only to the server, for two reasons: the
 * spawned server inherits this environment, and `e2e/database-guard.setup.ts` can then assert
 * the arrangement holds instead of hoping it does.
 *
 * The secret is local-only and public by design — it signs cookies for a server this config
 * starts and stops. The deployment's own secret lives in Vercel and never appears here.
 */
if (!usingDeployedTarget) {
  process.env.AUTH_SECRET ??= 'e2e-only-secret-not-used-anywhere-else'
  process.env.AUTH_URL ??= baseURL
  process.env.AUTH_TRUST_HOST ??= 'true'
}

/**
 * Reusing a server is opt-in, and it used to be the default — audit F23.
 *
 * `reuseExistingServer: !CI` meant a local run attached to whatever was already listening on
 * port 3100 and trusted it completely. During the audit that was a stale process serving
 * uncompiled CSS, and the suite reported failures against code nobody was running. A test
 * result about an unidentified binary is not a result.
 *
 * The fix is to own the server rather than to identify it: Playwright builds and starts its
 * own, and if the port is busy the run fails with "port already used", which is a true
 * statement rather than a silent substitution.
 *
 * `E2E_REUSE_SERVER=1` restores the old behaviour for a developer iterating on specs against
 * a server they started themselves and can vouch for. It is never set in CI, and the
 * disposable-database guard still runs either way — that check is about the database, which
 * is the part a wrong answer cannot be undone on.
 */
const reuseExistingServer = process.env.E2E_REUSE_SERVER === '1'

const viewports = {
  // 360px is a first-class target, not an afterthought (CLAUDE.md §7).
  'mobile-360': { width: 360, height: 780 },
  /**
   * Phase 12F's own widths.
   *
   * 390 is the commonest modern phone and is not merely "360 plus a bit": it is the width at
   * which a two-up row of anything starts fitting, so a layout tuned only at 360 can break
   * here and nowhere else. 768 is the `md` breakpoint exactly — the first width at which the
   * tablet composition replaces the phone one, and therefore the width where a two-panel
   * layout either happens or leaves half a row empty.
   */
  'mobile-390': { width: 390, height: 844 },
  'tablet-768': { width: 768, height: 1024 },
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
    /**
     * Runs before anything that writes, and everything else depends on it transitively.
     *
     * Its own project rather than another file in `setup`, because Playwright runs the files
     * within one project in parallel: a guard that raced the seed it exists to guard would be
     * decorative. A dependency is an ordering the runner enforces.
     */
    { name: 'guard', testMatch: /database-guard\.setup\.ts/ },
    {
      name: 'setup',
      testMatch: /(deployment-access|seed-route)\.setup\.ts/,
      dependencies: ['guard'],
    },
    ...Object.entries(viewports).map(([name, viewport]) => ({
      name,
      use: { ...devices['Desktop Chrome'], viewport, storageState: STORAGE_STATE },
      dependencies: ['setup'],
    })),
  ],
  webServer: usingDeployedTarget
    ? undefined
    : {
        // The local server runs against the TEST database, never production. That is now
        // *proved* by `e2e/database-guard.setup.ts` rather than asserted by this comment —
        // the seed and the specs write through the Playwright process, which this prefix
        // never reached (audit F2).
        //
        // On a workstation that database is named in `.env.test.local`. In CI there is no
        // such file — the workflow supplies `DATABASE_URL` for a throwaway Postgres service
        // container directly, so prefixing with `dotenv -e` there would fail on a missing
        // file.
        command: process.env.CI
          ? 'npm run build && npm run start -- --port 3100'
          : 'npm run build && dotenv -e .env.test.local -- npm run start -- --port 3100',
        url: baseURL,
        reuseExistingServer,
        timeout: 180_000,
      },
})
