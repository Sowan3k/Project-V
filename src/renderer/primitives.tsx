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
 * Category presentation — Phase 12B.
 *
 * Colour is never the only carrier of meaning: every marker also carries an **icon**, and at
 * road density a text label as well (CLAUDE.md §7, §10.4, REQUIREMENTS.md §10.4). That is
 * what makes the compressed ribbon readable without colour vision — and it is load-bearing
 * here, because the palette runs green→amber→rose in journey order and those three are
 * exactly the ones deutan and protan vision collapse.
 *
 * **The colours are `var()` references, not literals.** Phase 12B measured and fitted the
 * palette in `globals.css`; repeating the values here would be a second source that can
 * disagree with the first, and the contrast test reads the CSS. SVG `fill` and `stroke`
 * accept custom properties, so the renderer picks up a palette change with no edit at all.
 *
 * The icons are 24×24 stroke paths, drawn here because this is the primitive library and
 * hand-authoring primitives is what invariant 24 explicitly permits. Nothing about them is
 * route-specific: they describe a *category of work*, and a route created at 2am by a
 * contributor gets them by choosing a category, with no developer involved.
 */
export interface CategoryStyle {
  /** Tint behind the marker. */
  readonly fill: string
  /** Label, icon and marker stroke. AA against both `fill` and the page. */
  readonly ink: string
  /** The road segment carrying this step. 3:1 against the page. */
  readonly line: string
  /** 24×24 stroke path. Colour is never the only carrier of meaning (§10.4). */
  readonly icon: string
}

export const CATEGORY_STYLE: Record<StepCategory, CategoryStyle> = {
  // A document with a folded corner and ruled lines.
  documents_preparation: {
    fill: 'var(--color-cat-documents-fill)',
    ink: 'var(--color-cat-documents-ink)',
    line: 'var(--color-cat-documents-line)',
    icon: 'M8 3h6l4 4v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h4M10 13h6M10 17h4',
  },
  // A speech bubble: language and the tests that measure it.
  language_testing: {
    fill: 'var(--color-cat-language-fill)',
    ink: 'var(--color-cat-language-ink)',
    line: 'var(--color-cat-language-line)',
    icon: 'M20 4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3v4l4-4h9a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zM8 10h.01M12 10h.01M16 10h.01',
  },
  // A columned institution.
  admission_university: {
    fill: 'var(--color-cat-admission-fill)',
    ink: 'var(--color-cat-admission-ink)',
    line: 'var(--color-cat-admission-line)',
    icon: 'M12 3 3 8h18zM3 10h18M6 10v7M10 10v7M14 10v7M18 10v7M4 20h16',
  },
  // A banknote — funding, fees and proof of funds.
  funding_scholarship: {
    fill: 'var(--color-cat-funding-fill)',
    ink: 'var(--color-cat-funding-ink)',
    line: 'var(--color-cat-funding-line)',
    icon: 'M2 6h20v12H2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M5 9h.01M19 15h.01',
  },
  // A shield: permission to enter, checked by someone else.
  immigration_visa: {
    fill: 'var(--color-cat-immigration-fill)',
    ink: 'var(--color-cat-immigration-ink)',
    line: 'var(--color-cat-immigration-line)',
    icon: 'M12 3 5 6v6c0 4.2 3 7.4 7 9 4-1.6 7-4.8 7-9V6zM9 12l2 2 4-4',
  },
  // The paper plane, which is also the brand mark. Departure closes the road.
  travel_departure: {
    fill: 'var(--color-cat-travel-fill)',
    ink: 'var(--color-cat-travel-ink)',
    line: 'var(--color-cat-travel-line)',
    icon: 'M22 2 2 9.5l8 3.2M22 2l-7.4 20-3.9-9.3M22 2 10.7 12.7',
  },
}

/**
 * One category icon, scaled from its 24×24 authoring grid to `size` and centred on (cx, cy).
 *
 * `vectorEffect="non-scaling-stroke"` keeps the stroke one weight at every density: without
 * it the ribbon's small icons come out hairline-thin while the road's look heavy, because
 * the same path is being scaled by very different factors.
 */
export function CategoryIcon({
  category,
  cx,
  cy,
  size,
  colour,
}: {
  category: StepCategory
  cx: number
  cy: number
  size: number
  colour?: string
}) {
  const scale = size / 24
  const style = CATEGORY_STYLE[category]
  return (
    <g
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${scale})`}
      fill="none"
      stroke={colour ?? style.ink}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      aria-hidden="true"
    >
      <path d={style.icon} />
    </g>
  )
}

/**
 * Connector styling by edge kind. A branch must not look like plain sequence.
 *
 * Tokenised in Phase 12B for the same reason as the categories: one source, so a palette
 * change is one edit and the contrast test measures what is actually painted.
 */
export const EDGE_STYLE: Record<StepEdgeKind, { stroke: string; dash?: string; width: number }> = {
  sequential: { stroke: 'var(--color-road-surface, #94a3b8)', width: 2.5 },
  optional_branch: { stroke: 'var(--color-road-surface, #94a3b8)', dash: '5 4', width: 2 },
  alternative: { stroke: 'var(--color-cat-language-line, #0e7490)', dash: '2 5', width: 2 },
  rejoin: { stroke: 'var(--color-road-surface, #94a3b8)', width: 2.5 },
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
      stroke="var(--color-shadow-route, #cbd5e1)"
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
      fill="var(--color-shadow-route, #e2e8f0)"
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
        stroke={category.ink}
        strokeWidth={added ? 3 : 1.5}
        {...(archived ? { strokeDasharray: '4 3' } : {})}
      />

      {density.showLabels ? (
        <>
          <CategoryIcon category={node.step.category} cx={x + 15} cy={y + 16} size={13} />
          <text x={x + 26} y={y + 20} fontSize={11} fontWeight={600} fill={category.ink}>
            {node.ordinal}
          </text>
          <text x={x + 9} y={y + 37} fontSize={11.5} fill="var(--color-ink-900, #0f172a)">
            {truncate(node.step.label, 17)}
          </text>
          {state === null ? null : (
            <text
              x={x + node.width - 6}
              y={y - 5}
              fontSize={9}
              textAnchor="end"
              fill="var(--color-ink-500, #64748b)"
            >
              {state}
            </text>
          )}
        </>
      ) : (
        // No room for text at ribbon density, so the icon is the whole of the non-colour
        // signal. It is what keeps the compressed form readable without colour vision, and
        // the `<title>` above carries the same information to a screen reader.
        <CategoryIcon category={node.step.category} cx={node.x} cy={node.y} size={12} />
      )}
    </g>
  )
}

/** Where the journey begins. */
export function StartMarker({ node, label }: { node: PlacedNode; label: string }) {
  return (
    <g>
      <title>{label}</title>
      <circle cx={node.x - node.width / 2 - 12} cy={node.y} r={5} fill="var(--color-ink-900, #0f172a)" />
    </g>
  )
}

/** Where the journey ends — the fly marker (§20.1). */
export function DestinationMarker({ node, label }: { node: PlacedNode; label: string }) {
  const x = node.x + node.width / 2 + 8
  return (
    <g>
      <title>{label}</title>
      <path d={`M ${x} ${node.y - 6} L ${x + 11} ${node.y} L ${x} ${node.y + 6} Z`} fill="var(--color-cat-travel-ink, #7e22ce)" />
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
      <circle cx={cx} cy={cy} r={r} fill="var(--color-caution-500, #d97706)" stroke="var(--color-surface, #fff)" strokeWidth={1.5} />
      {density.showLabels ? (
        <text x={cx} y={cy + 3.5} fontSize={9} textAnchor="middle" fill="var(--color-surface, #fff)">
          !
        </text>
      ) : null}
    </g>
  )
}
