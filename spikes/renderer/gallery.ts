import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { ALL_FIXTURES, wrapping15 } from './fixtures'
import { layout, RIBBON, ROAD, ROAD_NARROW } from './layout'
import { renderRibbon, renderRoad } from './svg'

/**
 * Spike A — builds a static page showing every fixture as ribbon and road.
 *
 * Screenshotted at 360 / 768 / 1280 by `spikes/renderer/screenshot.spec.ts` so the go/no-go
 * ("all fixtures render legibly at all three widths with no per-fixture code") is answered
 * by looking, not by asserting.
 *
 * THROWAWAY.
 */
function page(): string {
  const sections = ALL_FIXTURES.map((graph) => {
    const road = layout(graph, ROAD)
    const ribbon = layout(graph, RIBBON)
    const match = road.order.join(',') === ribbon.order.join(',')

    return `
<section>
  <h2>${graph.title}</h2>
  <p class="meta">
    ${road.order.length} steps · ${road.rowCount} row${road.rowCount === 1 ? '' : 's'} ·
    ribbon/road order ${match ? 'match ✓' : 'MISMATCH ✗'}
  </p>
  <div class="ribbon" aria-label="Ribbon — the compressed route">${renderRibbon(graph)}</div>
  <div class="road">${renderRoad(graph, { withShadow: true })}</div>
</section>`
  }).join('\n')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spike A — ribbon and road</title>
<style>
  :root { color-scheme: light }
  * { box-sizing: border-box }
  body { margin:0; padding:16px; background:#f8fafc; color:#0f172a;
         font:14px/1.5 system-ui,-apple-system,sans-serif; }
  h1 { font-size:18px; margin:0 0 4px }
  .lede { color:#475569; margin:0 0 20px; font-size:13px }
  section { background:#fff; border:1px solid #e2e8f0; border-radius:12px;
            padding:14px; margin-bottom:16px; }
  h2 { font-size:14px; margin:0 0 2px }
  .meta { color:#64748b; font-size:12px; margin:0 0 10px }
  /* Wide content scrolls inside its own container; the page never scrolls sideways. */
  .ribbon, .road { overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch }
  .ribbon { border-bottom:1px dashed #e2e8f0; padding-bottom:10px; margin-bottom:10px }
  .ribbon svg, .road svg { display:block; max-width:none }
</style></head>
<body>
  <h1>Spike A — one layout pass, two densities</h1>
  <p class="lede">Every fixture below is drawn by the same <code>layout()</code> call with
  different density constants. Nothing here is route-specific. Throwaway spike code.</p>
  <section id="narrow">
    <h2>Same route, narrow density (one constant changed)</h2>
    <p class="meta">
      ${layout(wrapping15, ROAD_NARROW).order.length} steps ·
      ${layout(wrapping15, ROAD_NARROW).rowCount} rows ·
      ROAD_NARROW differs from ROAD only in columnsPerRow and sizes — no branching
    </p>
    <div class="road">${renderRoad(wrapping15, { density: ROAD_NARROW })}</div>
  </section>
  ${sections}
</body></html>`
}

const outDir = resolve(process.cwd(), 'spikes', 'renderer', 'out')
mkdirSync(outDir, { recursive: true })
const target = resolve(outDir, 'gallery.html')
writeFileSync(target, page(), 'utf8')
process.stdout.write(`gallery: ${target}\n`)
