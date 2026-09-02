import type { StepCategory, StepEdgeKind } from '@/domain/enums'

import type { Density, PlacedEdge, PlacedNode } from './layout'

/**
 * The primitive library — Phase 4.
 *
 * These are the ONLY hand-authored visuals in the product. Everything else is produced by
 * feeding route data through the layout pass into these shapes (CLAUDE.md invariant 24).
 *
 * Think LEGO bricks, not illustrations. There is no artwork for any particular route,
 * destination or country, and nothing here reads a route's identity — the components below
 * receive geometry and a category, never an id, slug, title or destination.
 *
 * If a fix ever requires touching one of these to make one specific route look right, the
 * renderer is wrong and the renderer is what should change.
 */

/**
 * Category presentation.
 *
 * Colour is never the only carrier of meaning: every marker also has a glyph, and at road
 * density a text label as well (CLAUDE.md §7, §10.4, REQUIREMENTS.md §10.4). The glyph is
 * what makes the compressed ribbon readable without colour vision.
 *
 * The exact palette is still an open decision (CLAUDE.md §11). These are placeholders chosen
 * to be distinguishable, and they live in one place so replacing them is one edit.
 */
export const CATEGORY_STYLE: Record<StepCategory, { fill: string; stroke: string; glyph: string }> = {
  documents_preparation: { fill: '#eef2ff', stroke: '#4338ca', glyph: '▤' },
  language_testing: { fill: '#ecfeff', stroke: '#0e7490', glyph: '⌥' },
  admission_university: { fill: '#f0fdf4', stroke: '#15803d', glyph: '✦' },
  funding_scholarship: { fill: '#fefce8', stroke: '#a16207', glyph: '◈' },
  immigration_visa: { fill: '#fef2f2', stroke: '#b91c1c', glyph: '⬢' },
  travel_departure: { fill: '#faf5ff', stroke: '#7e22ce', glyph: '➤' },
}

/** Connector styling by edge kind. A branch must not look like plain sequence. */
export const EDGE_STYLE: Record<StepEdgeKind, { stroke: string; dash?: string; width: number }> = {
  sequential: { stroke: '#64748b', width: 2.5 },
  optional_branch: { stroke: '#94a3b8', dash: '5 4', width: 2 },
  alternative: { stroke: '#0e7490', dash: '2 5', width: 2 },
  rejoin: { stroke: '#64748b', width: 2.5 },
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

// ── Connectors ───────────────────────────────────────────────────────────────

/** Road segment, curved segment and junction are all one primitive: a typed connector. */
export function Connector({ placed }: { placed: PlacedEdge }) {
  const style = EDGE_STYLE[placed.edge.kind]
  return (
    <path
      d={placed.path}
      fill="none"
      stroke={style.stroke}
      strokeWidth={style.width}
      strokeLinecap="round"
      {...(style.dash === undefined ? {} : { strokeDasharray: style.dash })}
    />
  )
}

/** The previous version drawn beneath the current one (FR-77, shadow route). */
export function ShadowSegment({ placed }: { placed: PlacedEdge }) {
  return (
    <path
      d={placed.path}
      fill="none"
      stroke="#cbd5e1"
      strokeWidth={6}
      strokeLinecap="round"
      opacity={0.5}
    />
  )
}

export function ShadowMarker({ node }: { node: PlacedNode }) {
  return (
    <rect
      x={node.x - node.width / 2}
      y={node.y - node.height / 2}
      width={node.width}
      height={node.height}
      rx={10}
      fill="#e2e8f0"
      opacity={0.55}
    />
  )
}

// ── Markers ──────────────────────────────────────────────────────────────────

export interface StepMarkerProps {
  readonly node: PlacedNode
  readonly density: Density
  /** Localised category name. Passed in so the renderer holds no strings of its own. */
  readonly categoryLabel: string
  readonly added?: boolean
  /** Passed in, never defaulted: a default would be English living in the renderer. */
  readonly addedLabel: string
  readonly archivedLabel: string
}

/**
 * A step marker. Carries category colour, glyph, ordinal and — where there is room — label.
 *
 * The `<title>` element is not decorative: at ribbon density there is no visible text, so it
 * is what makes the compressed form readable to a screen reader and on hover.
 */
export function StepMarker({
  node,
  density,
  categoryLabel,
  added = false,
  addedLabel,
  archivedLabel,
}: StepMarkerProps) {
  const category = CATEGORY_STYLE[node.step.category]
  const archived = node.step.archived
  const x = node.x - node.width / 2
  const y = node.y - node.height / 2

  const state = archived ? archivedLabel : added ? addedLabel : null
  const description = `${node.ordinal}. ${node.step.label} — ${categoryLabel}${state ? ` (${state})` : ''}`

  return (
    <g opacity={archived ? 0.42 : 1}>
      <title>{description}</title>
      <rect
        x={x}
        y={y}
        width={node.width}
        height={node.height}
        rx={density.showLabels ? 10 : 7}
        fill={category.fill}
        stroke={category.stroke}
        strokeWidth={added ? 3 : 1.5}
        {...(archived ? { strokeDasharray: '4 3' } : {})}
      />

      {density.showLabels ? (
        <>
          <text x={x + 9} y={y + 20} fontSize={11} fill={category.stroke}>
            {category.glyph} {node.ordinal}
          </text>
          <text x={x + 9} y={y + 37} fontSize={11.5} fill="#0f172a">
            {truncate(node.step.label, 17)}
          </text>
          {state === null ? null : (
            <text
              x={x + node.width - 6}
              y={y - 5}
              fontSize={9}
              textAnchor="end"
              fill={archived ? '#64748b' : '#15803d'}
            >
              {state}
            </text>
          )}
        </>
      ) : (
        <text x={node.x} y={node.y + 4} fontSize={10} textAnchor="middle" fill={category.stroke}>
          {category.glyph}
        </text>
      )}
    </g>
  )
}

/** Where the journey begins. */
export function StartMarker({ node, label }: { node: PlacedNode; label: string }) {
  return (
    <g>
      <title>{label}</title>
      <circle cx={node.x - node.width / 2 - 12} cy={node.y} r={5} fill="#0f172a" />
    </g>
  )
}

/** Where the journey ends — the fly marker (§20.1). */
export function DestinationMarker({ node, label }: { node: PlacedNode; label: string }) {
  const x = node.x + node.width / 2 + 8
  return (
    <g>
      <title>{label}</title>
      <path d={`M ${x} ${node.y - 6} L ${x + 11} ${node.y} L ${x} ${node.y + 6} Z`} fill="#7e22ce" />
    </g>
  )
}

/**
 * A time- and place-scoped disruption (FR-32, invariant 19).
 *
 * An overlay, never a revision: it sits on top of a step and expires without altering the
 * route beneath it.
 */
export function DisruptionIndicator({
  node,
  density,
  label,
}: {
  node: PlacedNode
  density: Density
  label: string
}) {
  const cx = node.x + node.width / 2
  const cy = node.y - node.height / 2
  const r = density.showLabels ? 7 : 5
  return (
    <g>
      <title>{label}</title>
      <circle cx={cx} cy={cy} r={r} fill="#d97706" stroke="#fff" strokeWidth={1.5} />
      {density.showLabels ? (
        <text x={cx} y={cy + 3.5} fontSize={9} textAnchor="middle" fill="#fff">
          !
        </text>
      ) : null}
    </g>
  )
}
