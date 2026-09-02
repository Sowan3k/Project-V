import { test as setup } from '@playwright/test'

import { STORAGE_STATE } from '../playwright.config'

/**
 * Unlocks a protected Vercel deployment before the smoke tests run.
 *
 * Vercel Deployment Protection is on for this project, which is the right default while
 * the repository is private and the shell is unfinished — an unauthenticated request is
 * redirected to Vercel SSO. Rather than turning that protection off, this setup visits a
 * short-lived share URL once, which sets the bypass cookie, and saves the resulting
 * storage state for the browser projects to reuse.
 *
 * Usage:
 *   E2E_BASE_URL=https://<deployment> \
 *   E2E_BYPASS_URL='https://<deployment>/?_vercel_share=<token>' \
 *   npm run test:e2e
 *
 * The share token expires within a day, so this is for ad-hoc verification. Automated CI
 * runs against a protected deployment should use Vercel's Protection Bypass for
 * Automation secret and send it as the `x-vercel-protection-bypass` header instead.
 *
 * When E2E_BYPASS_URL is unset — the local-build default — this writes an empty state and
 * changes nothing.
 */
setup('unlock protected deployment', async ({ page }) => {
  const bypassUrl = process.env.E2E_BYPASS_URL

  if (bypassUrl) {
    await page.goto(bypassUrl)
  }

  await page.context().storageState({ path: STORAGE_STATE })
})
