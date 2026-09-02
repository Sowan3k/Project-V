import { chromium } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

/** Spike A — 360px legibility evidence. THROWAWAY. */
const out = resolve(process.cwd(), 'spikes/renderer/out')
const url = pathToFileURL(resolve(out, 'gallery.html')).href
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 360, height: 780 } })
await page.goto(url)

const sections = await page.locator('section').all()
for (const i of [0]) {
  const s = sections[i]
  if (!s) continue
  const box = await s.boundingBox()
  const title = (await s.locator('h2').innerText()).replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  // Clip to the viewport width so we see exactly what a phone shows, scroll and all.
  await page.screenshot({
    path: resolve(out, `mobile360-${i}-${title}.png`),
    fullPage: true,
    clip: { x: 0, y: box.y, width: 360, height: Math.min(box.height, 760) },
  })
  console.log(`mobile360 ${i}: ${title}`)
}
await browser.close()
