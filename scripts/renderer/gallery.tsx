import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { renderToStaticMarkup } from 'react-dom/server'

import { JourneyStepStatus, StepCategory, StepEdgeKind } from '../../src/domain/enums'
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
  changed: en.route.stepChanged,
  previous: en.route.previousRoute,
  selected: en.route.selectedStep,
  openStep: en.route.openStep,
  timingUnknown: en.route.timingUnknown,
  relationships: en.route.routeRelationships,
  progress: en.journeyStepStatus,
  duration: en.route.durationShort,
  startsAfter: en.route.startsAfterShort,
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
  readonly selectedStepId?: string
}

const fixtures: readonly Fixture[] = [
  {
    name: 'Route blocks — illustrative six-stage journey',
    graph: {
      steps: CATEGORIES.map((category, i) => step(`demo-${i}`, {
        category,
        label: ['Prepare documents', 'Language requirements', 'University application', 'Financial proof', 'Visa application', 'Prepare to travel'][i],
        typicalDurationDays: i === 0 ? 21 : null,
      })),
      edges: CATEGORIES.slice(1).map((_, i) => edge(`demo-edge-${i}`, `demo-${i}`, `demo-${i + 1}`)),
    },
  },
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

const reviewFixtures: readonly Fixture[] = [
  ...fixtures,
  {
    name: 'My Journey — illustrative private, self-reported progress',
    graph: fixtures[0]!.graph,
    selectedStepId: 'demo-2',
    annotations: {
      progressByStep: {
        'demo-0': JourneyStepStatus.completed,
        'demo-1': JourneyStepStatus.in_progress,
        'demo-2': JourneyStepStatus.in_progress,
        'demo-3': JourneyStepStatus.not_started,
        'demo-4': JourneyStepStatus.not_started,
        'demo-5': JourneyStepStatus.not_started,
      },
    },
  },
]

const sections = reviewFixtures
  .map(({ name, graph, annotations, selectedStepId }) => {
    const frame = layout(graph, ROAD)
    const ribbon = renderToStaticMarkup(
      <Ribbon graph={graph} strings={strings} annotations={annotations} />,
    )
    const wide = renderToStaticMarkup(
      <Road graph={graph} strings={strings} annotations={annotations} selectedStepId={selectedStepId} />,
    )
    const narrow = renderToStaticMarkup(
      <Road graph={graph} strings={strings} annotations={annotations} density={ROAD_NARROW} selectedStepId={selectedStepId} />,
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

// Read the actual palette rather than judging unstyled SVGs whose var() fills disappear.
const theme = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
  .match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vindeshi Express — route block design review</title>
<style>
  :root{${theme}}
  *{box-sizing:border-box}
  body{margin:0;padding:40px max(20px,calc((100vw - 1200px)/2));background:var(--color-surface-muted);color:var(--color-ink-900);font:14px/1.5 system-ui,-apple-system,sans-serif}
  h1{font-size:30px;letter-spacing:-.03em;margin:0 0 8px}
  .lede{color:var(--color-ink-700);font-size:15px;margin:0 0 32px;max-width:65ch}
  section{background:var(--color-surface);border:1px solid var(--color-hairline);border-radius:14px;padding:24px;margin-bottom:24px}
  h2{font-size:18px;margin:0 0 4px}
  .meta{color:#64748b;font-size:12px;margin:0 0 10px}
  .ribbon,.road{overflow-x:auto;overflow-y:hidden}
  .ribbon{border-bottom:1px solid var(--color-hairline);padding-bottom:16px;margin-bottom:16px}
  .ribbon svg,.road svg{display:block;width:100%;height:auto}
  .road svg{margin-inline:auto}
  .narrow,.hidden{display:none}
  .ribbon .sm\\:hidden{display:none}
  .ribbon .sm\\:block{display:block}
  /* The whole mobile strategy: pick a density, not a second renderer. */
  @media (max-width:639px){
    body{padding:24px 16px} section{padding:12px} h1{font-size:24px}
    .wide,.ribbon .sm\\:block{display:none} .narrow,.ribbon .sm\\:hidden{display:block}
  }
</style></head>
<body>
  <h1>Every stage has a place.</h1>
  <p class="lede">Vindeshi Express · Route block design review. Illustrative fixtures only — these are not real study-abroad requirements or timing guidance.</p>
  ${sections}
</body></html>`

const out = resolve(process.cwd(), 'scripts/renderer/out')
mkdirSync(out, { recursive: true })
writeFileSync(resolve(out, 'gallery.html'), page, 'utf8')
process.stdout.write('gallery written to scripts/renderer/out/gallery.html\n')
