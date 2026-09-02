import { chromium } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

/** Spike A — evidence for the go/no-go. THROWAWAY. */
const out = resolve(process.cwd(), 'spikes/renderer/out')
mkdirSync(out, { recursive: true })
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

// Detail captures at 1:1 so legibility can actually be judged.
const detail = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await detail.goto(url)
const wanted = process.argv.slice(2).map(Number)
const sections = await detail.locator('section').all()
for (const i of wanted) {
  const s = sections[i]
  if (!s) continue
  const title = (await s.locator('h2').innerText()).replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  await s.screenshot({ path: resolve(out, `detail-${i}-${title}.png`) })
  console.log(`detail ${i}: ${title}`)
}
await browser.close()
