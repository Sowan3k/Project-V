import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Read-only browser QA against the separately started, marker-checked test-data server.
// No fixture creation, credentials, forms, migrations or public deployment.
const base = new URL(process.env.RENDERER_APP_URL ?? 'http://localhost:3101')
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Local preview only')
const out = resolve('scripts/renderer/out')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
let failures = 0
try {
  for (const width of [360, 768, 1280, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled: false })
    const page = await context.newPage()
    const route = '/en/routes/bd-de-masters-rwth-direct-v3'
    await page.goto(new URL(route, base).href, { waitUntil: 'load', timeout: 120000 })
    const road = page.locator('svg[data-route-visual="road"]:visible')
    if (await road.count() !== 1) throw new Error('Expected exactly one visible Road')
    const station = road.locator('a[href]').first()
    const href = await station.getAttribute('href')
    if (!href) throw new Error('No interactive station')
    await page.screenshot({ path: resolve(out, `app-route-${width}.png`), fullPage: true })
    await road.screenshot({ path: resolve(out, `app-road-${width}.png`) })
    await station.focus()
    await page.keyboard.press('Enter')
    await page.waitForURL((url) => url.searchParams.has('step'), { timeout: 120000 })
    await page.waitForLoadState('load')
    const selected = page.locator('svg[data-route-visual="road"]:visible a[aria-current="step"]')
    if (await selected.count() !== 1) {
      await page.screenshot({ path: resolve(out, `app-selection-failure-${width}.png`), fullPage: true })
      console.log(`Selection failure at ${width}: visible roads=${await road.count()}, current links=${await selected.count()}, title=${await page.title()}`)
      throw new Error('Station selection was not preserved')
    }
    if (!await page.locator('#route-step-info').isVisible()) throw new Error('Selected detail missing')
    await page.screenshot({ path: resolve(out, `app-selected-${width}.png`), fullPage: true })
    await page.screenshot({ path: resolve(out, `app-detail-${width}.png`) })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    if (overflow) failures++
    console.log(`${width}px: keyboard selection and detail pass without JavaScript; overflow=${overflow}`)
    await page.goto(new URL('/en/routes?from=BD&to=DE', base).href, { waitUntil: 'load', timeout: 120000 })
    if (await page.locator('svg[data-route-visual="ribbon"]:visible').count() < 1) throw new Error('Search did not render its route Ribbons')
    await page.screenshot({ path: resolve(out, `app-search-${width}.png`), fullPage: true })
    const result = page.locator('li').filter({ has: page.locator('svg[data-route-visual="ribbon"]') }).first()
    if (await result.count()) await result.screenshot({ path: resolve(out, `app-ribbon-${width}.png`) })
    const searchOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    if (searchOverflow) failures++
    console.log(`${width}px: search overflow=${searchOverflow}`)
    await context.close()
  }
} finally {
  await browser.close()
}
if (failures) process.exitCode = 1
