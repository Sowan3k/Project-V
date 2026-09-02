import { chromium } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

/** Screenshots the renderer gallery at the three target widths. Development tooling. */
const out = resolve(process.cwd(), 'scripts/renderer/out')
const url = pathToFileURL(resolve(out, 'gallery.html')).href
const browser = await chromium.launch()

for (const width of [360, 768, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  console.log(`${width}px  page-wide horizontal overflow: ${overflow ? 'YES (FAIL)' : 'no'}`)
  await page.screenshot({ path: resolve(out, `gallery-${width}.png`), fullPage: true })
  await page.close()
}

const detail = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await detail.goto(url)
const sections = await detail.locator('section').all()
for (const [i, section] of sections.entries()) {
  await section.screenshot({ path: resolve(out, `detail-${i}.png`) })
}
console.log(`detail shots: ${sections.length}`)
await browser.close()
