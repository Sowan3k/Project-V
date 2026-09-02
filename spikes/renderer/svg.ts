import { layout, RIBBON, ROAD, type Density, type Layout } from './layout'
import type { RouteGraph, StepCategory, StepState } from './types'

/**
 * Spike A — geometry to SVG, from a small primitive library.
 *
 * The primitives are the only hand-authored visuals: a step marker, a connector in four
 * edge styles, start and destination markers, and a shadow segment. There is no artwork for
 * any particular route, and nothing here branches on route id, title or destination
 * (CLAUDE.md invariant 24).
 *
 * THROWAWAY. Phase 4 rebuilds this against the real primitive library.
 */

/**
 * Placeholder palette. The real category colours and maturity labels are open decisions
 * (CLAUDE.md §11) — a spike must not settle them. Colour is never the only signal: every
 * marker also carries a glyph and, at road density, a text label (CLAUDE.md §7).
 */
const CATEGORY: Record<StepCategory, { fill: string; stroke: string; glyph: string }> = {
  documents: { fill: '#eef2ff', stroke: '#4f46e5', glyph: '▤' },
  language: { fill: '#ecfeff', stroke: '#0891b2', glyph: '⌥' },
  admission: { fill: '#f0fdf4', stroke: '#16a34a', glyph: '✦' },
  funding: { fill: '#fefce8', stroke: '#ca8a04', glyph: '◈' },
  immigration: { fill: '#fef2f2', stroke: '#dc2626', glyph: '⬢' },
  travel: { fill: '#faf5ff', stroke: '#9333ea', glyph: '➤' },
}

const EDGE_STYLE: Record<string, { stroke: string; dash: string; width: number }> = {
  sequential: { stroke: '#64748b', dash: '', width: 2.5 },
  optional_branch: { stroke: '#94a3b8', dash: '5 4', width: 2 },
  alternative: { stroke: '#0891b2', dash: '2 5', width: 2 },
  rejoin: { stroke: '#64748b', dash: '', width: 2.5 },
}

const STATE_STYLE: Record<StepState, { opacity: number; extra: string }> = {
  current: { opacity: 1, extra: '' },
  archived: { opacity: 0.42, extra: 'stroke-dasharray="4 3"' },
  added: { opacity: 1, extra: 'stroke-width="3"' },
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

function renderLayout(
  frame: Layout,
  density: Density,
  options: { readonly shadow?: Layout; readonly disrupted?: ReadonlySet<string> } = {},
): string {
  const parts: string[] = []

  // Shadow segment primitive: the previous version drawn beneath (FR-77, CLAUDE.md §7).
  if (options.shadow) {
    for (const edge of options.shadow.edges) {
      parts.push(`<path d="${edge.path}" fill="none" stroke="#cbd5e1" stroke-width="6" opacity="0.5" stroke-linecap="round"/>`)
    }
    for (const node of options.shadow.nodes) {
      parts.push(
        `<rect x="${node.x - node.width / 2}" y="${node.y - node.height / 2}" width="${node.width}" height="${node.height}" rx="10" fill="#e2e8f0" opacity="0.55"/>`,
      )
    }
  }

  for (const placed of frame.edges) {
    const style = EDGE_STYLE[placed.edge.kind] ?? EDGE_STYLE.sequential
    if (!style) continue
    parts.push(
      `<path d="${placed.path}" fill="none" stroke="${style.stroke}" stroke-width="${style.width}" stroke-linecap="round"${style.dash ? ` stroke-dasharray="${style.dash}"` : ''}/>`,
    )
  }

  frame.nodes.forEach((node, index) => {
    const category = CATEGORY[node.step.category]
    const state = STATE_STYLE[node.step.state ?? 'current']
    const x = node.x - node.width / 2
    const y = node.y - node.height / 2

    parts.push(`<g opacity="${state.opacity}">`)
    parts.push(
      `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="${density.showLabels ? 10 : 7}" fill="${category.fill}" stroke="${category.stroke}" ${state.extra || 'stroke-width="1.5"'}/>`,
    )

    if (density.showLabels) {
      parts.push(
        `<text x="${x + 9}" y="${y + 20}" font-size="11" fill="${category.stroke}" font-family="system-ui,sans-serif">${category.glyph} ${index + 1}</text>`,
      )
      parts.push(
        `<text x="${x + 9}" y="${y + 37}" font-size="11.5" fill="#0f172a" font-family="system-ui,sans-serif">${escapeText(truncate(node.step.label, 17))}</text>`,
      )
      if (node.step.state === 'added') {
        parts.push(`<text x="${x + node.width - 6}" y="${y - 4}" font-size="9" text-anchor="end" fill="#16a34a" font-family="system-ui,sans-serif">NEW</text>`)
      }
      if (node.step.state === 'archived') {
        parts.push(`<text x="${x + node.width - 6}" y="${y - 4}" font-size="9" text-anchor="end" fill="#64748b" font-family="system-ui,sans-serif">ARCHIVED</text>`)
      }
    } else {
      // Ribbon density: the glyph alone still distinguishes category without colour.
      parts.push(
        `<text x="${node.x}" y="${node.y + 4}" font-size="10" text-anchor="middle" fill="${category.stroke}" font-family="system-ui,sans-serif">${category.glyph}</text>`,
      )
    }
    parts.push('</g>')

    // Disruption indicator primitive: an overlay, never a revision (invariant 19).
    if (options.disrupted?.has(node.step.id)) {
      parts.push(
        `<circle cx="${x + node.width}" cy="${y}" r="${density.showLabels ? 7 : 5}" fill="#f59e0b" stroke="#fff" stroke-width="1.5"/>`,
      )
      if (density.showLabels) {
        parts.push(`<text x="${x + node.width}" y="${y + 3.5}" font-size="9" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">!</text>`)
      }
    }
  })

  return parts.join('\n')
}

export interface RenderOptions {
  readonly density?: Density
  readonly withShadow?: boolean
}

export function renderRoad(graph: RouteGraph, options: RenderOptions = {}): string {
  const density = options.density ?? ROAD
  const frame = layout(graph, density)
  const shadow =
    options.withShadow && graph.previous ? layout(graph.previous, density) : undefined

  const body = renderLayout(frame, density, {
    ...(shadow ? { shadow } : {}),
    disrupted: new Set(graph.disruptedStepIds ?? []),
  })

  // Natural size, not width="100%". A ribbon stretched to fill the page is no longer the
  // compressed form, and a road scaled down to 360px is unreadable. Wide content scrolls
  // inside its own container instead (CLAUDE.md §7).
  return `<svg viewBox="0 0 ${frame.width} ${frame.height}" width="${frame.width}" height="${frame.height}" role="img" aria-label="${escapeText(graph.title)} — ${frame.order.length} steps" xmlns="http://www.w3.org/2000/svg">${body}</svg>`
}

export function renderRibbon(graph: RouteGraph): string {
  return renderRoad(graph, { density: RIBBON })
}
