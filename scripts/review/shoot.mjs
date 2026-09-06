import { chromium } from '@playwright/test'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

import { FIXTURE_SLUG, SCREENS, WIDTHS } from './screens.mjs'

/**
 * The visual-acceptance contact sheet — Phase 12G, and the artifact 12C and 12D are waiting on.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What this is for.** Three phases now carry an unticked exit criterion of the same shape:
 * screenshots at four widths, placed beside their mockup, reviewed and accepted by the owner.
 * None of them can be closed by an assertion — Phases.md is explicit that Gate 4 "is
 * human-judged and cannot be automated away", for the same reason Gate 2's last line is.
 * `SeverityChip` is the standing proof: four labels, two appearances, every test passing.
 *
 * So this script deliberately does **not** try to judge. It produces the pair and the question,
 * and leaves the answer to a person. The one thing it does assert is the thing a person cannot
 * reliably see in a screenshot — horizontal overflow, which is a Phase 12F exit criterion and
 * has been failing since E2E run #53.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Local targets only, and read-only.** It navigates and photographs. It creates no fixture,
 * submits no form, signs nothing in and writes nothing to any database — the route content it
 * photographs is hypothetical content already on the disposable branch (CLAUDE.md §10.2). The
 * host check is the same one `scripts/renderer/check-app.mjs` makes: a review run must never
 * be pointed at a deployment.
 *
 * Usage:
 *   NEXT_DIST_DIR=.next-review dotenv -e .env.test.local -- next build
 *   NEXT_DIST_DIR=.next-review dotenv -e .env.test.local -- next start -p 3101
 *   npm run review:shoot
 */

const base = new URL(process.env.REVIEW_APP_URL ?? 'http://localhost:3101')
if (!['localhost', '127.0.0.1'].includes(base.hostname)) {
  throw new Error(`Local preview only — refusing ${base.hostname}`)
}

const out = resolve('scripts/review/out')
const references = resolve('Visual References')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
/** One row per screen per width: what was captured, and whether the page overflowed. */
const captured = []
const skipped = []
let overflows = 0
/** Discovered once on the road and reused, so every width photographs the same step. */
let stepPath = null

try {
  for (const screen of SCREENS) {
    if (screen.needsSession) {
      skipped.push({ ...screen, why: 'needs an authenticated session' })
      continue
    }
    if (screen.path === null && screen.id !== 'step') {
      skipped.push({ ...screen, why: 'no anonymous route to it' })
      continue
    }

    for (const width of WIDTHS) {
      /*
       * JavaScript stays enabled here, unlike `check-app.mjs`.
       *
       * That script's job is proving the read path works *without* it, which is a different
       * question and already answered. This one photographs what a reader actually sees, and
       * a screenshot taken with scripting off would not be evidence about the delivered page.
       */
      const context = await browser.newContext({ viewport: { width, height: 1000 } })
      const page = await context.newPage()

      let path = screen.path
      if (screen.id === 'step') {
        if (stepPath === null) {
          stepPath = await resolveStepPath(page)
          if (stepPath === null) {
            await context.close()
            skipped.push({ ...screen, why: 'no interactive station found on the road' })
            break
          }
        }
        path = stepPath
      }

      await page.goto(new URL(path, base).href, { waitUntil: 'load', timeout: 120_000 })
      await page.waitForLoadState('networkidle').catch(() => {})

      const file = `${screen.id}-${width}.png`
      await page.screenshot({ path: resolve(out, file), fullPage: true })

      const crops = []
      for (const crop of screen.crops ?? []) {
        const target = page.locator(crop.selector).first()
        if ((await target.count()) === 0) continue
        const cropFile = `${screen.id}-${crop.id}-${width}.png`
        await target.screenshot({ path: resolve(out, cropFile) }).catch(() => {})
        crops.push({ id: crop.id, file: cropFile })
      }

      // The one automated judgement: a page must never scroll sideways (§32, 12F, Gate 4).
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      if (overflow) overflows += 1

      captured.push({ screen: screen.id, width, file, crops, overflow, path })
      console.log(`${screen.id.padEnd(16)} ${String(width).padStart(4)}px  overflow=${overflow ? 'YES' : 'no'}`)
      await context.close()
    }
  }
} finally {
  await browser.close()
}

/**
 * Opens the first station on the road and returns where it went.
 *
 * Route-agnostic on purpose: the suite asks the rendered road which step exists rather than
 * being told, so rebuilding the fixture cannot leave a hard-coded id pointing at nothing.
 */
async function resolveStepPath(page) {
  await page.goto(new URL(`/en/routes/${FIXTURE_SLUG}`, base).href, {
    waitUntil: 'load',
    timeout: 120_000,
  })
  const station = page.locator('svg[data-route-visual="road"]:visible a[href]').first()
  if ((await station.count()) === 0) return null
  const href = await station.getAttribute('href')
  return href === null ? null : new URL(href, base).pathname + new URL(href, base).search
}

/* ── The contact sheet ──────────────────────────────────────────────────────────────────── */

// Copied rather than linked: the sheet has to survive being zipped and sent to somebody who
// does not have the repository, which is the point of publishing it as a build artifact.
const refs = new Map()
for (const screen of SCREENS) {
  if (screen.reference === null || screen.reference === undefined) continue
  if (refs.has(screen.reference)) continue
  const local = `reference-${screen.reference}`
  copyFileSync(resolve(references, screen.reference), resolve(out, local))
  refs.set(screen.reference, local)
}

const escape = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** `**bold**` in the `look` notes, and nothing else — this is a caption, not a document. */
const emphasise = (text) => escape(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

const section = (screen) => {
  const shots = captured.filter((row) => row.screen === screen.id)
  const reference = refs.get(screen.reference)
  const wasSkipped = skipped.find((row) => row.id === screen.id)

  const referenceCell =
    reference === undefined
      ? `<div class="ref none"><p>No mockup exists for this screen.</p></div>`
      : `<div class="ref"><a href="${reference}"><img src="${reference}" alt="${escape(screen.reference)}"></a>
         <p class="cap">${escape(screen.reference)}</p></div>`

  const shotCells = wasSkipped
    ? `<div class="missing"><p><strong>Not captured</strong> — ${escape(wasSkipped.why)}.</p>
       <p>Listed rather than omitted, so the set does not read as though this screen had been reviewed.</p></div>`
    : shots
        .map(
          (row) => `<figure class="shot${row.overflow ? ' overflow' : ''}">
            <a href="${row.file}"><img src="${row.file}" alt="${escape(screen.title)} at ${row.width}px"></a>
            <figcaption>${row.width}px${row.overflow ? ' — <strong>horizontal overflow</strong>' : ''}</figcaption>
            ${row.crops.map((crop) => `<a class="crop" href="${crop.file}">${escape(crop.id)} crop</a>`).join('')}
          </figure>`,
        )
        .join('')

  return `<section id="${screen.id}">
    <h2>${escape(screen.title)} <span class="badge">${escape(screen.criterion)}</span></h2>
    <p class="look">${emphasise(screen.look)}</p>
    <div class="pair">
      <div class="col"><h3>Visual reference</h3>${referenceCell}</div>
      <div class="col"><h3>As built</h3><div class="shots">${shotCells}</div></div>
    </div>
  </section>`
}

const sheet = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vindeshi Express — visual acceptance sheet</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; padding:2rem clamp(1rem,4vw,3rem); background:#fbfbfc; color:#1a1d23;
         font:15px/1.6 ui-sans-serif,system-ui,sans-serif; }
  h1 { font-size:1.6rem; margin:0 0 .25rem; letter-spacing:-.01em; }
  .sub { color:#5b6270; margin:0 0 2rem; max-width:70ch; }
  .summary { border:1px solid #e3e5ea; background:#fff; border-radius:12px; padding:1rem 1.25rem;
             margin-bottom:2.5rem; max-width:70ch; }
  .summary p { margin:.35rem 0; }
  .fail { color:#8a2b20; font-weight:600; }
  .ok { color:#2a6140; font-weight:600; }
  nav.toc { margin-bottom:2.5rem; }
  nav.toc a { display:inline-block; margin:0 .75rem .5rem 0; color:#254a86; }
  section { border-top:1px solid #e3e5ea; padding-top:1.75rem; margin-bottom:2.5rem; }
  h2 { font-size:1.15rem; margin:0 0 .35rem; }
  .badge { font-size:.7rem; font-weight:600; color:#5b6270; background:#eef0f4;
           border-radius:999px; padding:.15rem .55rem; vertical-align:middle; }
  .look { color:#3d434e; max-width:78ch; margin:0 0 1.25rem; }
  .pair { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.35fr); gap:1.5rem; }
  @media (max-width:900px) { .pair { grid-template-columns:1fr; } }
  h3 { font-size:.75rem; text-transform:uppercase; letter-spacing:.08em; color:#6b7280;
       margin:0 0 .6rem; font-weight:600; }
  img { max-width:100%; display:block; border:1px solid #e3e5ea; border-radius:8px; background:#fff; }
  .shots { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:1rem; }
  figure { margin:0; }
  figcaption { font-size:.75rem; color:#6b7280; margin-top:.35rem; }
  .shot.overflow img { border-color:#c0554a; box-shadow:0 0 0 2px #f3d9d5; }
  .crop { font-size:.72rem; color:#254a86; display:inline-block; margin-top:.15rem; margin-right:.5rem; }
  .cap { font-size:.72rem; color:#6b7280; margin:.35rem 0 0; }
  .ref.none, .missing { border:1px dashed #cfd3da; border-radius:8px; padding:1rem;
                        color:#5b6270; background:#fff; }
  .missing p { margin:.35rem 0; }
  footer { border-top:1px solid #e3e5ea; padding-top:1.25rem; color:#6b7280; max-width:78ch; }
</style></head><body>
<h1>Visual acceptance sheet</h1>
<p class="sub">Each screen as built, at ${WIDTHS.join(' / ')} px, beside the mockup it answers to.
This closes nothing on its own: the exit criteria on 12C, 12D and 12E ask for the owner's
acceptance, and Gate 4's real question — <em>would a Bangladeshi student believe this was built
for them, or believe it was a developer's test page?</em> — is not one a script can answer.</p>

<div class="summary">
  <p><strong>Captured:</strong> ${captured.length} screenshots across ${new Set(captured.map((r) => r.screen)).size} screens.</p>
  <p><strong>Horizontal overflow:</strong> ${
    overflows === 0
      ? '<span class="ok">none at any width</span>'
      : `<span class="fail">${overflows} of ${captured.length} captures overflow</span> — outlined in red below`
  }</p>
  <p><strong>Not captured:</strong> ${skipped.length} screens, each stated in place below rather than dropped.</p>
  <p><strong>Route content:</strong> the hypothetical fixture <code>${escape(FIXTURE_SLUG)}</code> on the
  disposable branch. It exercises the mechanism and is not launch content (CLAUDE.md §10.2);
  every requirement, date and figure in it is invented, and none of it is traceable to a mockup.</p>
</div>

<nav class="toc">${SCREENS.map((s) => `<a href="#${s.id}">${escape(s.title)}</a>`).join('')}</nav>

${SCREENS.map(section).join('\n')}

<footer><p>Generated by <code>npm run review:shoot</code> against a local build. Read-only:
no fixture was created, no form submitted and nothing written to any database.</p></footer>
</body></html>`

writeFileSync(resolve(out, 'index.html'), sheet, 'utf8')

console.log(`\ncontact sheet: ${relative(process.cwd(), resolve(out, 'index.html'))}`)
console.log(`captured ${captured.length} screenshots; ${skipped.length} screens not captured`)
if (overflows > 0) {
  console.error(`FAIL: ${overflows} captures scroll horizontally`)
  process.exitCode = 1
}
