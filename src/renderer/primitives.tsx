import { StepEdgeKind as EdgeKind, type StepCategory, type StepEdgeKind } from '@/domain/enums'

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
  // A passport and globe: immigration paperwork, without a verification/checkmark motif.
  immigration_visa: {
    fill: 'var(--color-cat-immigration-fill)',
    ink: 'var(--color-cat-immigration-ink)',
    line: 'var(--color-cat-immigration-line)',
    icon: 'M5 3h14v18H5zM12 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8M8 10h8M12 6c-2 2-2 6 0 8 2-2 2-6 0-8M9 17h6',
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

/** Bounded word wrapping; the full label is always retained in the accessible name. */
function labelLines(value: string, max: number, count = 3): readonly string[] {
  let rest = value.trim().replace(/\s+/g, ' ')
  const lines: string[] = []
  while (rest && lines.length < count) {
    if (rest.length <= max || lines.length === count - 1) {
      lines.push(truncate(rest, max))
      break
    }
    const at = rest.lastIndexOf(' ', max)
    if (at > 0) {
      lines.push(rest.slice(0, at))
      rest = rest.slice(at + 1)
    } else {
      const next = rest.indexOf(' ')
      lines.push(truncate(next < 0 ? rest : rest.slice(0, next), max))
      rest = next < 0 ? '' : rest.slice(next + 1)
    }
  }
  return lines
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

/**
 * The road surface — Phase 12C, VR-04.
 *
 * Two strokes along the same path: a wide band of asphalt, and a dashed centre line on top.
 * That is the whole trick, and it is what turns a diagram of markers-joined-by-hairlines into
 * something a reader recognises as a road before reading a word of it. The road is the
 * product's primary metaphor (§8.5.3) and until now it was the one thing not being drawn.
 *
 * Rendered beneath every marker, in its own layer, so a wrapped row's curved return reads as
 * the same continuous carriageway rather than as a separate connector.
 *
 * A branch is still not plain sequence: an optional or alternative route gets a *narrower*
 * surface and keeps its dashed centre line, so the hierarchy survives even though both are
 * roads. Kind-based, never identity-based — invariant 24.
 */
export function RoadSegment({ placed, density }: { placed: PlacedEdge; density: Density }) {
  const minor =
    placed.edge.kind === EdgeKind.optional_branch || placed.edge.kind === EdgeKind.alternative
  const width = minor ? density.carriageway * 0.62 : density.carriageway

  return (
    <g>
      <path
        d={placed.path}
        fill="none"
        stroke="var(--color-hairline, #e2e8f0)"
        strokeWidth={width + 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={minor ? 0.55 : 1}
      />
      <path
        d={placed.path}
        fill="none"
        stroke="var(--color-road-surface, #94a3b8)"
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={minor ? 0.55 : 1}
      />
      <path
        d={placed.path}
        fill="none"
        stroke="var(--color-road-line, #fff)"
        strokeWidth={Math.max(1.5, width * 0.07)}
        strokeLinecap="round"
        strokeDasharray={`${width * 0.5} ${width * 0.42}`}
        opacity={0.85}
      />
    </g>
  )
}

/**
 * One segment of the compressed ribbon — Phase 12C, VR-03.
 *
 * An interlocking chevron rather than a rounded box: the point carries direction, which is
 * what makes a row of them read as *a journey in order* at a glance instead of as a row of
 * swatches. The notch on the left receives the previous segment's point, so the band reads as
 * continuous even though every segment is drawn independently.
 *
 * Category ink on a pale fill keeps names readable. The stronger outline and upper stripe
 * carry the segmented band, matching the icon/header treatment on the expanded blocks.
 */
export function RibbonSegment({
  node,
  categoryLabel,
  archived,
  added,
  addedLabel,
  archivedLabel,
  relationship,
}: {
  node: PlacedNode
  categoryLabel: string
  archived: boolean
  added: boolean
  addedLabel: string
  archivedLabel: string
  relationship?: string
}) {
  const style = CATEGORY_STYLE[node.step.category]
  const w = node.width
  const h = node.height
  const x = node.x - w / 2
  const y = node.y - h / 2
  /**
   * The chevron's point, and the matching notch that receives the previous one.
   *
   * Bounded by both dimensions. Purely proportional to height, a wide segment gets a point
   * so shallow it reads as a rectangle and the band loses its direction; purely proportional
   * to width, a two-step route gets a point deeper than the segment is tall and the band
   * turns into a row of arrowheads.
   */
  const notch = Math.min(h * 0.16, w * 0.07)
  const textX = x + notch + 10
  const captions = labelLines(node.step.label, Math.max(8, Math.floor((w - notch * 2 - 20) / 6.4)))

  const state = archived ? archivedLabel : added ? addedLabel : null
  const description = `${node.ordinal}. ${node.step.label} — ${categoryLabel}${state ? ` (${state})` : ''}`

  return (
    <g data-step-id={node.step.id} opacity={archived ? 0.6 : 1}>
      <title>{description}</title>
      {relationship ? <text x={node.x} y={y - 9} textAnchor="middle" fontSize={10} fill="var(--color-ink-700)">{relationship}</text> : null}
      <path
        d={`M ${x} ${y} L ${x + w - notch} ${y} L ${x + w} ${y + h / 2} L ${x + w - notch} ${y + h} L ${x} ${y + h} L ${x + notch} ${y + h / 2} Z`}
        fill={style.fill}
        stroke={added || archived ? style.ink : style.line}
        strokeWidth={added ? 2.5 : 1}
        {...(archived ? { strokeDasharray: '4 3' } : {})}
      />
      <path
        d={`M ${x + notch + 3} ${y + 2} H ${x + w - notch - 3}`}
        stroke={style.line}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <CategoryIcon
        category={node.step.category}
        cx={textX + 8}
        cy={y + 18}
        size={18}
      />
      <text x={x + w - notch - 10} y={y + 22} textAnchor="end" fontSize={10} fill={style.ink}>
        {String(node.ordinal).padStart(2, '0')}
      </text>
        <text
          x={textX}
          y={y + 43}
          fontSize={12.5}
          fontWeight={600}
          fill={style.ink}
        >
          {captions.map((line, index) => (
            <tspan key={index} x={textX} dy={index === 0 ? 0 : 15}>{line}</tspan>
          ))}
        </text>
    </g>
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
  /**
   * Already-formatted duration, e.g. "2–3 weeks". Formatted by the caller for the same
   * reason as every other string here: "weeks" is English, and English does not live in the
   * renderer. Null when the step carries no timing, which is common and not a defect.
   */
  readonly duration: string | null
  readonly added?: boolean
  /** Passed in, never defaulted: a default would be English living in the renderer. */
  readonly addedLabel: string
  readonly archivedLabel: string
  readonly changedLabel: string
  readonly changed?: boolean
  readonly selected?: boolean
  readonly relationship?: string
  readonly progressLabel?: string
  readonly completed?: boolean
  readonly timingUnknown: string
  readonly actionLabel?: string
  readonly startOffset?: string
}

/**
 * A step marker. Carries category colour, glyph, ordinal and — where there is room — label.
 *
 * The full `<title>` supplements abbreviated labels and icon-only segments with an
 * accessible name. Category and duration strings are supplied by the caller.
 */
export function StepMarker({
  node,
  categoryLabel,
  duration,
  added = false,
  addedLabel,
  archivedLabel,
  changedLabel,
  changed = false,
  selected = false,
  relationship,
  progressLabel,
  completed = false,
  timingUnknown,
  actionLabel,
  startOffset,
}: StepMarkerProps) {
  const category = CATEGORY_STYLE[node.step.category]
  const archived = node.step.archived
  const x = node.x - node.width / 2
  const y = node.y - node.height / 2

  const state = archived ? archivedLabel : added ? addedLabel : changed ? changedLabel : null
  const description = `${node.ordinal}. ${node.step.label} — ${categoryLabel}${duration ? ` — ${duration}` : ''}${startOffset ? ` — ${startOffset}` : ''}${state ? ` (${state})` : ''}`

  // A wayfinding block: category and stage number above a readable name, with timing kept
  // subordinate. The geometry is shared by every route and every category (FR-05, FR-57).
  const inset = node.width < 150 ? 12 : 18
  const fontSize = node.width < 150 ? 13 : 17
  const lineHeight = node.width < 150 ? 18 : 22
  const lines = labelLines(node.step.label, Math.floor((node.width - inset * 2) / (fontSize * 0.56)))

  return (
    <g data-step-id={node.step.id} data-selected={selected || undefined} opacity={archived ? 0.6 : 1}>
      <title>{description}</title>
      <rect className="route-station-focus" x={x - 5} y={y - 5} width={node.width + 10} height={node.height + 10} rx={15} fill="none" stroke="var(--color-brand-700)" strokeWidth={2} opacity={0} />
      <rect
        x={x}
        y={y + 3}
        width={node.width}
        height={node.height}
        rx={10}
        fill="var(--color-ink-900, #0f172a)"
        opacity={0.045}
      />
      <rect
        x={x}
        y={y}
        width={node.width}
        height={node.height}
        rx={10}
        fill="var(--color-surface, #fff)"
        stroke={selected ? 'var(--color-brand-700)' : category.line}
        strokeOpacity={selected || added || archived ? 1 : 0.65}
        strokeWidth={selected ? 2.5 : added ? 2 : 1}
        {...(archived ? { strokeDasharray: '4 3' } : {})}
      />
      {/* Category edge and station header share the Ribbon's visual vocabulary. */}
      <path
        d={`M ${x + 10} ${y + 1} H ${x + node.width - 10} Q ${x + node.width - 1} ${y + 1} ${x + node.width - 1} ${y + 10} V ${y + 39} H ${x + 1} V ${y + 10} Q ${x + 1} ${y + 1} ${x + 10} ${y + 1} Z`}
        fill={category.fill}
      />
      <path d={`M ${x + 10} ${y + 1} H ${x + node.width - 10}`} stroke={category.line} strokeWidth={3} />
      <CategoryIcon
        category={node.step.category}
        cx={x + node.width - inset - 11}
        cy={y + 21}
        size={23}
      />
      <text
        x={x + inset}
        y={y + 27}
        fontSize={16}
        fontWeight={600}
        fill={category.ink}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {String(node.ordinal).padStart(2, '0')}
      </text>
      <text x={x + inset} y={y + 62} fontSize={fontSize} fontWeight={600} fill="var(--color-ink-900, #0f172a)">
        {lines.map((line, index) => (
          <tspan key={index} x={x + inset} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>
        ))}
      </text>
      <path d={`M ${x + inset} ${y + node.height - 39} H ${x + node.width - inset}`} stroke="var(--color-hairline)" />
        <text
          x={x + inset}
          y={y + node.height - 22}
          fontSize={11}
          fill="var(--color-ink-700, #334155)"
        >
          {duration ?? timingUnknown}
        </text>
      {progressLabel ? (
        <g fill="var(--color-brand-700)">
          {completed ? <path d={`M ${x + inset} ${y + node.height - 9} l 3 3 6 -7`} fill="none" stroke="currentColor" strokeWidth={1.5} /> : null}
          <text x={x + inset + (completed ? 14 : 0)} y={y + node.height - 7} fontSize={9.5} fontWeight={600}>{progressLabel}</text>
        </g>
      ) : (
        <text x={x + inset} y={y + node.height - 7} fontSize={9.5} fill="var(--color-ink-700)">{startOffset ?? actionLabel}</text>
      )}

      {relationship ? <text x={node.x} y={y - 10} textAnchor="middle" fontSize={node.width < 150 ? 10 : 11} fill="var(--color-ink-700)">{relationship}</text> : null}

      {state === null ? null : (
        <text
          x={x + inset + 30}
          y={y + 26}
          fontSize={10}
          fill={category.ink}
        >
          {state}
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
      <circle cx={node.x - node.width / 2 - 12} cy={node.y} r={5} fill="var(--color-ink-900, #0f172a)" />
    </g>
  )
}

/** Where the journey ends — the fly marker (§20.1). */
export function DestinationMarker({ node, label, reverse = false }: { node: PlacedNode; label: string; reverse?: boolean }) {
  const direction = reverse ? -1 : 1
  const x = node.x + direction * (node.width / 2 + 8)
  return (
    <g>
      <title>{label}</title>
      <path d={`M ${x} ${node.y - 6} L ${x + direction * 11} ${node.y} L ${x} ${node.y + 6} Z`} fill="var(--color-cat-travel-ink, #7e22ce)" />
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
