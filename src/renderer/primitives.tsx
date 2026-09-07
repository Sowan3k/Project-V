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
 * One segment of the compressed ribbon — VR-03.
 *
 * An interlocking chevron rather than a rounded box: the point carries direction, which is
 * what makes a row of them read as *a journey in order* at a glance instead of as a row of
 * swatches. The notch on the left receives the previous segment's point, so the band reads as
 * continuous even though every segment is drawn independently.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Saturated fill, a white icon, and no text — owner decision, 2026-09-06.**
 *
 * This was a pale fill carrying the step's name in category ink, sized for up to three
 * wrapped lines. The owner's verdict on it was exact: *"the ribbon does not look like a
 * ribbon, it looks like a flowchart box"* — and it did, because a box with a sentence in it
 * is a flowchart node whatever shape you cut its edges into. VR-03's ribbon is a **thin
 * saturated band**: one icon per stage, no names, no numbers, the whole route legible as a
 * run of colour in about thirty units of height.
 *
 * This supersedes the "ribbons retain visible names" note of 2026-09-06, on the owner's
 * instruction, and only for the ribbon. Nothing is actually lost by it:
 *
 * - **The name is still there for anyone who cannot see the icon.** Every segment carries a
 *   `<title>` with its ordinal, name and category, and the visual's `aria-label` lists all of
 *   them in order — so a screen reader reads a ribbon as a named sequence, which is more than
 *   a sighted reader gets from the band alone.
 * - **The road one click away carries every name in full**, at every width. The ribbon is the
 *   compressed form of exactly that object (invariant 25); compression that keeps the shape
 *   and drops the words is what makes it a *different density* rather than a second design.
 * - **Meaning still never rests on colour** (§10.4). Each stage carries its category icon,
 *   the shapes are distinct, and the accessible name states the category in words. What is
 *   gone is a text label that was illegible at phone width anyway.
 *
 ─────────────────────────────────────────────────────────────────────────────────────────
 * **The band is painted in `line`, not `ink` — owner instruction, 2026-09-07.**
 *
 * The owner asked for the ribbon to match the mockups exactly. Sampling VR-03 settles what
 * "exactly" means here, and it is not the hues: our six categories already sit on the
 * mockup's spectrum in journey order — blue, teal, green, amber, red, violet. What differed
 * was **tone**. VR-03's segments are bright mid-tones carrying white marks; ours were painted
 * in `ink`, the family's darkest tone at L=0.46, so a ribbon read as a row of heavy navy and
 * maroon slabs where the mockup reads as a bright band.
 *
 * `line` is L=0.62, which is the mockup's brightness, and it already exists — this needed no
 * new token and no re-fit of a palette that §11 settled by measurement.
 *
 * **The contrast bar moves with it, and is still met.** White on `ink` was 6.73–7.67:1;
 * white on `line` is 3.40–3.93:1. The mark inside a segment is a **non-text graphic**, whose
 * bar is 3:1 (WCAG 1.4.11), not the 4.5:1 that text needs — and the ribbon carries no text at
 * all, because `RIBBON.showLabels` is false. `presentation.test.ts` now measures this pairing
 * directly rather than inheriting a guarantee about a tone the band no longer uses.
 *
 * What did **not** change is what colour *means*. VR-03's eight segments are a spectrum
 * across a route's positions; ours are per category, so "documents" is the same blue on every
 * route in the product. §8.5.4 asks for persistent semantic categories, and a positional
 * spectrum would make a stage's colour depend on how many stages happened to precede it.
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
   *
   * ─────────────────────────────────────────────────────────────────────────────────────────
   * **The point overhangs the segment's own width, and that is what makes the band tile.**
   *
   * It used to stop at the right edge: point apex at `x + w`, next segment's notch apex at
   * `x + w + notch`. Two shapes drawn to the same boundary from opposite sides — which leaves
   * a wedge belonging to neither, so at thirteen stages the band showed a row of little gaps
   * and went back to reading as separate shapes. Making the columns abut had fixed the *gap*
   * and not the *geometry*.
   *
   * A right-pointing chevron only tessellates when its point reaches exactly as far past its
   * width as the following notch is cut back: point apex at `x + w + notch`, so the next
   * segment's notch — whose apex is at its own `x + notch`, the same coordinate — receives it
   * precisely. Every internal boundary is then one shared polyline rather than two.
   *
   * The drawn path therefore overhangs its column by `notch` while `node.width` does not, and
   * that is deliberate: `node.width` is the *layout* box the non-overlap guard measures, and
   * two boxes that merely touch are what lets the ink interlock across the seam. The last
   * segment's point overhangs the final column into the padding, which is why the padding must
   * stay wider than a notch.
   */
  const notch = Math.min(h * 0.16, w * 0.07)

  /**
   * The icon fills the band's height rather than sitting at a fixed size.
   *
   * A constant would be wrong at both ends: the same glyph has to work in a wide segment on a
   * two-stage route and in a narrow one on a twenty-stage route, and those differ by an order
   * of magnitude in width while the height stays put. Tying it to height keeps the mark the
   * same visual weight all along the band, and the second term stops it colliding with the
   * notch when a route is long enough for columns to reach their floor.
   */
  const icon = Math.min(h * 0.56, (w - notch * 2) * 0.62)

  const state = archived ? archivedLabel : added ? addedLabel : null
  const description = `${node.ordinal}. ${node.step.label} — ${categoryLabel}${relationship === undefined ? '' : ` — ${relationship}`}${state ? ` (${state})` : ''}`

  return (
    <g data-step-id={node.step.id} opacity={archived ? 0.6 : 1}>
      <title>{description}</title>
      {/*
        **No branch caption painted on the band.**

        It used to be drawn nine units above the segment. That was survivable while the band
        was 82 units tall and lanes were 112 apart; at 30 and 42 the caption lands inside the
        segment above it, and a route with three parallel stages stacked three "Parallel work"
        labels across the chevrons. VR-03's ribbon carries no captions at all.

        The information is not dropped, it moves to where a reader can act on it: the `<title>`
        below states it on hover and to assistive technology, the visual's `aria-label` states
        it for every stage in order, and the road — which has the room — draws it.
      */}
      {/*
        Saturated category fill. A departing stage keeps the shape and loses the colour — it
        is drawn as an outline on the page's own ground, which reads as *absent from the band*
        rather than as one more coloured stage among the live ones.
      */}
      <path
        /*
          The point runs half a unit past where the next notch begins. Two shapes meeting on
          an exact diagonal leave a pale hairline: neither covers the boundary pixels fully,
          so the antialiaser blends both against the page and the seam reappears as a gap —
          the very thing the tessellation is for. The overlap is drawn *under* the following
          segment, which is painted after it in canonical order, so it closes the seam and
          changes nothing else.
        */
        d={`M ${x} ${y} L ${x + w} ${y} L ${x + w + notch + 0.5} ${y + h / 2} L ${x + w} ${y + h} L ${x} ${y + h} L ${x + notch} ${y + h / 2} Z`}
        fill={archived ? 'var(--color-surface)' : style.line}
        stroke={archived ? style.ink : 'none'}
        strokeWidth={archived ? 1 : 0}
        {...(archived ? { strokeDasharray: '4 3' } : {})}
      />
      {/*
        A newly added stage is outlined *inside* its own edge rather than on it. An outline on
        the boundary would be half-covered by the neighbour it interlocks with, since the whole
        point of the band is that the segments meet — so the highlight has to sit within the
        shape to survive being abutted on both sides.
      */}
      {added ? (
        <path
          d={`M ${x + 2} ${y + 2} L ${x + w - 1} ${y + 2} L ${x + w + notch - 3} ${y + h / 2} L ${x + w - 1} ${y + h - 2} L ${x + 2} ${y + h - 2} L ${x + notch + 3} ${y + h / 2} Z`}
          fill="none"
          stroke="var(--color-surface)"
          strokeWidth={1.6}
        />
      ) : null}
      <CategoryIcon
        category={node.step.category}
        cx={x + notch + (w - notch) / 2}
        cy={y + h / 2}
        size={icon}
        // White on category `line`: a non-text graphic, so the bar is 3:1 and the measured
        // worst case is 3.40:1 (`presentation.test.ts`). A departing stage has no fill to sit
        // on, so its mark returns to the category ink.
        colour={archived ? style.ink : 'var(--color-surface)'}
      />
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
