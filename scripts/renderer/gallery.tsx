import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { renderToStaticMarkup } from 'react-dom/server'

import { StepCategory, StepEdgeKind } from '../../src/domain/enums'
import type { GraphEdge, GraphStep, RouteGraph } from '../../src/domain/graph/types'
import { en } from '../../src/i18n/dictionaries/en'
import { ROAD, ROAD_NARROW, layout } from '../../src/renderer/layout'
import {
  Ribbon,
  Road,
  type RouteAnnotations,
  type RouteVisualStrings,
} from '../../src/renderer/route-visual'

/**
 * Renders the stress fixtures to a static page so Phase 4's responsive criterion is answered
 * by looking, not only by asserting. Screenshotted by scripts/renderer/shoot.mjs.
 *
 * Development tooling. Not part of the application and never deployed.
 */
const strings: RouteVisualStrings = {
  categories: en.stepCategory,
  start: en.route.start,
  destination: en.route.destination,
  added: en.route.stepAdded,
  archived: en.route.stepArchived,
  disrupted: en.route.stepDisrupted,
  duration: en.route.durationShort,
  summary: (n) => `Route with ${n} steps`,
}

const CATEGORIES = [
  StepCategory.documents_preparation,
  StepCategory.language_testing,
  StepCategory.admission_university,
  StepCategory.funding_scholarship,
  StepCategory.immigration_visa,
  StepCategory.travel_departure,
] as const

const step = (id: string, over: Partial<GraphStep> = {}): GraphStep => ({
  id,
  label: `Stage ${id}`,
  category: StepCategory.documents_preparation,
  archived: false,
  earliestStartOffsetDays: null,
  typicalDurationDays: null,
  ...over,
})

const edge = (id: string, from: string, to: string, over: Partial<GraphEdge> = {}): GraphEdge => ({
  id,
  fromStepId: from,
  toStepId: to,
  kind: StepEdgeKind.sequential,
  archived: false,
  ...over,
})

interface Fixture {
  readonly name: string
  readonly graph: RouteGraph
  readonly annotations?: RouteAnnotations
}

const fixtures: readonly Fixture[] = [
  {
    name: 'Alternative branch (IELTS or PTE)',
    graph: {
      steps: [
        step('a', { label: 'Documents' }),
        step('ielts', { label: 'IELTS', category: StepCategory.language_testing }),
        step('pte', { label: 'PTE', category: StepCategory.language_testing }),
        step('b', { label: 'Admission', category: StepCategory.admission_university }),
        step('c', { label: 'Visa', category: StepCategory.immigration_visa }),
      ],
      edges: [
        edge('e1', 'a', 'ielts', { kind: StepEdgeKind.alternative }),
        edge('e2', 'a', 'pte', { kind: StepEdgeKind.alternative }),
        edge('e3', 'ielts', 'b', { kind: StepEdgeKind.rejoin }),
        edge('e4', 'pte', 'b', { kind: StepEdgeKind.rejoin }),
        edge('e5', 'b', 'c'),
      ],
    },
  },
  {
    name: 'Parallel activities',
    graph: {
      steps: [
        step('a', { label: 'Decide destination' }),
        step('p1', { label: 'Language prep', category: StepCategory.language_testing }),
        step('p2', { label: 'Document collection' }),
        step('p3', { label: 'Financial planning', category: StepCategory.funding_scholarship }),
        step('b', { label: 'Apply', category: StepCategory.admission_university }),
        step('c', { label: 'Fly', category: StepCategory.travel_departure }),
      ],
      edges: [
        edge('e1', 'a', 'p1'),
        edge('e2', 'a', 'p2'),
        edge('e3', 'a', 'p3'),
        edge('e4', 'p1', 'b', { kind: StepEdgeKind.rejoin }),
        edge('e5', 'p2', 'b', { kind: StepEdgeKind.rejoin }),
        edge('e6', 'p3', 'b', { kind: StepEdgeKind.rejoin }),
        edge('e7', 'b', 'c'),
      ],
    },
  },
  {
    name: 'Archived, added, shadow and disruption',
    graph: {
      steps: [
        step('a', { label: 'Documents' }),
        step('lang', { label: 'Language test', category: StepCategory.language_testing }),
        step('old', {
          label: 'Retired step',
          category: StepCategory.immigration_visa,
          archived: true,
        }),
        step('new', { label: 'New biometrics', category: StepCategory.immigration_visa }),
        step('b', { label: 'Admission', category: StepCategory.admission_university }),
        step('c', { label: 'Fly', category: StepCategory.travel_departure }),
      ],
      edges: [
        edge('e1', 'a', 'lang'),
        edge('e2', 'lang', 'b'),
        edge('e3', 'b', 'old', { archived: true }),
        edge('e4', 'b', 'new'),
        edge('e5', 'new', 'c'),
      ],
    },
    annotations: {
      addedStepIds: ['new'],
      disruptedStepIds: ['lang'],
      shadow: {
        steps: [step('a'), step('lang'), step('old'), step('b'), step('c')],
        edges: [
          edge('s1', 'a', 'lang'),
          edge('s2', 'lang', 'b'),
          edge('s3', 'b', 'old'),
          edge('s4', 'old', 'c'),
        ],
      },
    },
  },
  {
    name: 'Wrapping, 15 steps',
    graph: {
      steps: Array.from({ length: 15 }, (_, i) =>
        step(`s${String(i + 1).padStart(2, '0')}`, {
          label: `Stage ${i + 1}`,
          category: CATEGORIES[i % 6],
        }),
      ),
      edges: Array.from({ length: 14 }, (_, i) =>
        edge(`e${i}`, `s${String(i + 1).padStart(2, '0')}`, `s${String(i + 2).padStart(2, '0')}`),
      ),
    },
  },
  {
    name: 'Maximum, 20 steps',
    graph: {
      steps: Array.from({ length: 20 }, (_, i) =>
        step(`n${String(i + 1).padStart(2, '0')}`, {
          label: `Stage ${i + 1}`,
          category: CATEGORIES[i % 6],
        }),
      ),
      edges: Array.from({ length: 19 }, (_, i) =>
        edge(`e${i}`, `n${String(i + 1).padStart(2, '0')}`, `n${String(i + 2).padStart(2, '0')}`),
      ),
    },
  },
]

const sections = fixtures
  .map(({ name, graph, annotations }) => {
    const frame = layout(graph, ROAD)
    const ribbon = renderToStaticMarkup(
      <Ribbon graph={graph} strings={strings} annotations={annotations} />,
    )
    const wide = renderToStaticMarkup(
      <Road graph={graph} strings={strings} annotations={annotations} />,
    )
    const narrow = renderToStaticMarkup(
      <Road graph={graph} strings={strings} annotations={annotations} density={ROAD_NARROW} />,
    )

    return `<section>
  <h2>${name}</h2>
  <p class="meta">${frame.order.length} steps · ${frame.rowCount} rows</p>
  <div class="ribbon">${ribbon}</div>
  <div class="road wide">${wide}</div>
  <div class="road narrow">${narrow}</div>
</section>`
  })
  .join('\n')

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phase 4 — route renderer</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:16px;background:#f8fafc;color:#0f172a;font:14px/1.5 system-ui,-apple-system,sans-serif}
  h1{font-size:18px;margin:0 0 4px}
  .lede{color:#475569;font-size:13px;margin:0 0 20px}
  section{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px}
  h2{font-size:14px;margin:0 0 2px}
  .meta{color:#64748b;font-size:12px;margin:0 0 10px}
  .ribbon,.road{overflow-x:auto;overflow-y:hidden}
  .ribbon{border-bottom:1px dashed #e2e8f0;padding-bottom:10px;margin-bottom:10px}
  .ribbon svg,.road svg{display:block;max-width:none}
  .narrow{display:none}
  /* The whole mobile strategy: pick a density, not a second renderer. */
  @media (max-width:700px){ .wide{display:none} .narrow{display:block} }
</style></head>
<body>
  <h1>Phase 4 — one layout pass, three densities</h1>
  <p class="lede">Ribbon, road and narrow road are the same component with different constants.</p>
  ${sections}
</body></html>`

const out = resolve(process.cwd(), 'scripts/renderer/out')
mkdirSync(out, { recursive: true })
writeFileSync(resolve(out, 'gallery.html'), page, 'utf8')
process.stdout.write('gallery written to scripts/renderer/out/gallery.html\n')
