import { activeGraph } from '@/domain/graph/validate'
import type { GraphEdge, GraphStep, RouteGraph } from '@/domain/graph/types'

/**
 * The layout pass — Phase 4.
 *
 * One function turns a route graph into positioned geometry. The ribbon and the road call it
 * with different density constants and nothing else, which is what makes CLAUDE.md invariant
 * 25 true by construction rather than by discipline: a step added to a route cannot appear in
 * one density and not the other, because there is only one calculation.
 *
 * It is also where invariant 24 lives. Nothing here may look at a route's id, slug, title or
 * destination — only at graph structure. `layout()` is not even given them: it receives steps
 * and edges, and `RouteGraph` carries no route identity at all.
 *
 * Proven in Phase 1, Spike A. Four defects that spike found are now assertions rather than
 * lucky constants — see Test.md §7.
 */

export interface Density {
  /** Ranks per row before wrapping. Infinity keeps everything on one line (the ribbon). */
  readonly columnsPerRow: number
  /**
   * The **minimum** spacing between ranks. With `fitWidth` set it is a floor rather than the
   * actual value — see `fitWidth`.
   */
  readonly columnWidth: number
  readonly rowHeight: number
  readonly laneGap: number
  readonly nodeWidth: number
  readonly nodeHeight: number
  readonly padding: number
  /** Expanded station detail (Road) rather than a compressed labelled band (Ribbon). */
  readonly showLabels: boolean
  /**
   * Stretch the layout so it naturally comes out this wide — Phase 12C.
   *
   * ───────────────────────────────────────────────────────────────────────────────────────
   * **The defect this fixes.** `RIBBON.columnWidth` was 30px, so an eight-step ribbon drew
   * about 160px wide inside a ~790px search result: a thumbnail, where VR-03 shows a
   * full-width band carrying the route's whole shape. The ribbon is not a picture of the
   * route, it *is* the route compressed (invariant 25, D-33), and at 160px it could not do
   * that job.
   *
   * Scaling the finished SVG up with CSS was the obvious fix and the wrong one: a short route
   * and a long one have different aspect ratios, so stretching each to the same width gives
   * them wildly different heights — a four-step ribbon twice as tall as an eight-step one.
   *
   * So the *spacing* is fitted instead of the picture. The effective column width is whatever
   * makes the layout come out `fitWidth` wide, and `columnWidth` becomes the floor beneath
   * it. The floor is what keeps the existing non-overlap guarantee intact: a twenty-step
   * route whose fitted spacing would be narrower than a marker keeps the minimum and the
   * ribbon simply comes out wider than the target and scrolls locally instead of shrinking.
   *
   * Derived from **structure alone** — the number of ranks — so two routes with the same
   * shape still produce identical geometry and the structural-equivalence proof of invariant
   * 24 is untouched.
   */
  readonly fitWidth?: number
  /**
   * Widen each marker to nearly fill its column, so the row reads as one continuous band.
   *
   * Without this, `fitWidth` stretches the *spacing* and leaves the markers their fixed size,
   * so a five-rank ribbon came out as five small chevrons adrift in 960 units of whitespace —
   * wide, and still not a ribbon. VR-03 shows segments that abut: the band *is* the route, and
   * gaps between them break the one thing it has to convey.
   *
   * **The markers fill their column exactly, and that is the whole point.** An earlier value
   * of 0.94 left a sliver of page between every pair — the intent was "a hairline so the eye
   * can count them", but the effect was a row of separated shapes joined by a visible
   * connector, which is a flowchart. A ribbon is one band divided into segments, not boxes
   * with arrows between them.
   *
   * Filling exactly makes the chevrons **tessellate**: each segment's point reaches its own
   * right edge and each one's notch is cut in from its own left edge, both at the vertical
   * middle and both `notch` deep. Abutting columns therefore interlock perfectly — the point
   * of one occupies precisely the notch of the next — and the seam a reader counts by is the
   * two segments' own outlines meeting, not a gap.
   *
   * The non-overlap guarantee survives: adjacent centres are exactly one `columnWidth` apart
   * and each marker is exactly one `columnWidth` wide, so the test's `|Δx| < (wa + wb) / 2`
   * compares equals and is false. That equality is only exact because `columnWidth` is
   * truncated to whole units — see the note on it below, which is where filling exactly stops
   * being a drawing decision and becomes arithmetic.
   */
  readonly fillColumns?: boolean
  /**
   * Width of the road surface drawn beneath the connectors, in user units. 0 draws none.
   *
   * VR-04 shows an actual carriageway — a band of asphalt with a dashed centre line — rather
   * than markers joined by hairlines. This is that band's width. The ribbon sets 0: at that
   * density the chevrons abut and a road under them would only be visible as grubbiness.
   */
  readonly carriageway: number
}

/** The expanded form: wraps across rows, labelled, generous (VR-04). */
export const ROAD: Density = {
  // The Road normally shares a canvas with route context. Three readable stages fit that
  // panel; five forced the type and icons to shrink into a thumbnail (FR-05, VR-04).
  columnsPerRow: 3,
  columnWidth: 264,
  rowHeight: 212,
  laneGap: 174,
  // Step *cards* rather than markers — VR-04 puts the number, icon, title and duration on
  // the road itself, and a 128×52 marker has room for a truncated title and nothing else.
  nodeWidth: 226,
  nodeHeight: 152,
  padding: 34,
  showLabels: true,
  carriageway: 14,
}

/**
 * Landing-panel Road: the same three-column blocks as ROAD, with adjusted padding and a
 * slightly narrower carriageway. A density constant, not a second renderer (invariant 25).
 */
export const ROAD_COMPACT: Density = {
  ...ROAD,
  carriageway: 12,
}

/**
 * The road at phone width.
 *
 * Differs from ROAD only in how many ranks fit on a row, and in sizing. No branching, no
 * second code path, no mobile renderer — Spike A proved a density constant is enough, so
 * Phase 4 picks a density from a media query instead of writing a second implementation.
 */
export const ROAD_NARROW: Density = {
  columnsPerRow: 2,
  columnWidth: 152,
  rowHeight: 202,
  laneGap: 174,
  nodeWidth: 132,
  nodeHeight: 156,
  padding: 20,
  showLabels: true,
  carriageway: 10,
}

/**
 * The compressed form: one row, one saturated chevron per stage, no text — VR-03.
 *
 * The 680/360 targets are what the band is stretched to fit, so a four-stage route and a
 * fourteen-stage one come out the same height and the same width, differing only in how
 * finely the band is divided. A route long enough to reach the column floor exceeds its
 * target and scrolls inside its container rather than shrinking its stages away.
 *
 * Same graph, same canonical order and the same layout pass as the road (invariant 25).
 */
export const RIBBON: Density = {
  columnsPerRow: Number.POSITIVE_INFINITY,
  /**
   * The floor, not the value: `fillColumns` derives the real width from this. A very long
   * route bottoms out here and scrolls locally rather than shrinking its stages away.
   *
   * **144 until the ribbon carried names; 34 now that it carries an icon.** The old floor was
   * sized to fit up to three wrapped lines of a step name, and with the names gone it was
   * reserving width for nothing — a twenty-stage route was forced to 2,920 units and scrolled
   * for no reason a reader could see. 34 is what a category mark needs to stay legible.
   */
  columnWidth: 34,
  /**
   * Just deep enough to hold the band and let it breathe.
   *
   * 46 while the ribbon still carried the start dot and the fly marker, which are drawn
   * outside the first and last stage and so had to be paid for in every direction. With the
   * terminals now on the road only (see `route-visual.tsx`), the row is the band plus a
   * little, and the drawing stops being mostly margin: the SVG was rendering about 91px tall
   * around a 32px band.
   */
  rowHeight: 38,
  // Must exceed nodeHeight, or concurrent steps stack on top of each other and the ribbon
  // silently shows fewer steps than the road. Spike A shipped that bug for an afternoon.
  laneGap: 42,
  // Ignored while `fillColumns` is on — kept as the shape this density would have without it.
  nodeWidth: 32,
  /**
   * **A band, not a row of cards — owner decision, 2026-09-06.**
   *
   * This was 82: a slab sized for three wrapped lines of a step name, which at the widths
   * `fillColumns` produces meant roughly two fifths of every segment stood empty with its
   * caption in the top-left corner. The owner's verdict was that it read as a flowchart box
   * rather than as a ribbon, and it did.
   *
   * VR-03's ribbon is about thirty units tall and holds one icon per stage. At that height a
   * segment is wider than it is tall at every step count the product supports, which is what
   * makes a row of them read as one band rather than as a queue of shapes. The renderer still
   * knows nothing about *which* route it draws: this is a density constant, identical for
   * every graph (invariant 24).
   */
  nodeHeight: 30,
  padding: 8,
  showLabels: false,
  fitWidth: 680,
  fillColumns: true,
  carriageway: 0,
}

/**
 * The same band on a phone or a narrow column.
 *
 * **300, not 360.** The target has to be the width of the *container*, not of the viewport:
 * a search result at 360px gives the band about 304px once the page gutter and the card's own
 * padding are taken off, so a 360-wide band was pinned wider than the space it had and
 * scrolled sideways on a two-stage route. Measured rather than assumed — see Test.md §20.
 */
export const RIBBON_NARROW: Density = {
  ...RIBBON,
  fitWidth: 300,
}

export interface PlacedNode {
  readonly step: GraphStep
  /** Longest path from a start step. Equal rank means structurally concurrent. */
  readonly rank: number
  readonly lane: number
  readonly laneCount: number
  /** Centre coordinates. */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** 1-based position in canonical order, for the numbered markers in VR-04. */
  readonly ordinal: number
}

export interface PlacedEdge {
  readonly edge: GraphEdge
  readonly path: string
  /** True when the connector spans a wrap and needs a hook rather than a straight run. */
  readonly wraps: boolean
}

export interface Layout {
  readonly nodes: readonly PlacedNode[]
  readonly edges: readonly PlacedEdge[]
  readonly width: number
  readonly height: number
  /** Step ids in canonical draw order. Every density must produce the same list. */
  readonly order: readonly string[]
  readonly rowCount: number
}

/** Longest-path rank. Shared rank is what makes parallel and alternative branches concurrent. */
function ranks(steps: readonly GraphStep[], edges: readonly GraphEdge[]): Map<string, number> {
  const incoming = new Map<string, string[]>(steps.map((s) => [s.id, []]))
  for (const edge of edges) incoming.get(edge.toStepId)?.push(edge.fromStepId)

  const rank = new Map<string, number>()
  const resolving = new Set<string>()

  const resolve = (id: string): number => {
    const known = rank.get(id)
    if (known !== undefined) return known
    // A cycle is a validation error, but the renderer must not hang if it is ever handed one.
    if (resolving.has(id)) return 0
    resolving.add(id)
    const parents = incoming.get(id) ?? []
    const value = parents.length === 0 ? 0 : Math.max(...parents.map(resolve)) + 1
    resolving.delete(id)
    rank.set(id, value)
    return value
  }
  for (const step of steps) resolve(step.id)
  return rank
}

/**
 * Turns a route graph into positioned geometry.
 *
 * Serpentine flow: odd rows run right to left, so a wrap is a short hook rather than a sweep
 * back across the page. VR-04 shows exactly this — a road wrapping across three rows with
 * curved connectors, not one straight line.
 */
export function layout(graph: RouteGraph, density: Density): Layout {
  const { steps, edges } = activeGraph(graph)

  if (steps.length === 0) {
    return {
      nodes: [],
      edges: [],
      width: density.padding * 2,
      height: density.padding * 2,
      order: [],
      rowCount: 0,
    }
  }

  const rank = ranks(steps, edges)
  const maxRank = Math.max(0, ...[...rank.values()])

  // Lanes are assigned in a deterministic order — rank, then step id. Determinism is what
  // makes the structural-equivalence test meaningful: two graphs with the same shape must
  // place their nodes identically, and "same shape" cannot depend on array order.
  const byRank = new Map<number, GraphStep[]>()
  for (const step of [...steps].sort((a, b) => a.id.localeCompare(b.id))) {
    const r = rank.get(step.id) ?? 0
    const list = byRank.get(r) ?? []
    list.push(step)
    byRank.set(r, list)
  }

  const perRow = density.columnsPerRow
  const columnFor = (r: number): { row: number; column: number } => {
    if (!Number.isFinite(perRow)) return { row: 0, column: r }
    const row = Math.floor(r / perRow)
    const raw = r % perRow
    return { row, column: row % 2 === 0 ? raw : perRow - 1 - raw }
  }

  const rowCount = Number.isFinite(perRow) ? Math.floor(maxRank / perRow) + 1 : 1

  /**
   * Rank spacing, stretched to `fitWidth` where one is asked for.
   *
   * `Math.max` against the density's own `columnWidth` is the load-bearing part: it keeps
   * the floor, so a route long enough that the fitted spacing would be narrower than a
   * marker gets the minimum instead and simply comes out wider than the target. Without it
   * a twenty-step ribbon would silently stack its markers on top of one another, which is
   * the exact defect Spike A found and `renderer-layout.test.ts` still guards.
   *
   * A function of rank count alone, so structurally identical routes still lay out
   * identically (invariant 24).
   */
  const columnsOnWidestRow = Number.isFinite(perRow)
    ? Math.min(perRow, maxRank + 1)
    : maxRank + 1
  const gaps = columnsOnWidestRow - 1

  /**
   * Marker width as a fraction of its column, when `fillColumns` is on. Just under 1 so a
   * hairline of page shows between segments — and, because it is under 1, adjacent markers
   * are narrower than the distance between them and cannot overlap.
   */
  const FILL = 1

  /**
   * Solving `width = 2·padding + nodeWidth + (columns−1)·columnWidth` for `columnWidth`.
   *
   * With `fillColumns` the marker width is itself `FILL · columnWidth`, so the equation
   * becomes `width = 2·padding + columnWidth·(FILL + columns − 1)` — still one unknown, and
   * still solvable directly. Making the marker depend on the column and the column depend on
   * the marker would be circular; this substitutes rather than iterating.
   *
   * ───────────────────────────────────────────────────────────────────────────────────────
   * **`gaps` is `columns − 1`, and clamping it to a minimum of 1 was a bug.** The clamp made
   * the denominator `FILL + 1` for a single-rank route while the width formula still added
   * `0 · columnWidth`, so the two disagreed and a one-rank ribbon came out **474 units wide
   * instead of 960** — half width, in a row sized for a full one.
   *
   * It only showed on routes with exactly one rank, which is why it survived: every fixture
   * with two or more was correct, and whether the E2E caught it depended on which route
   * happened to be newest in search. The denominator has to be exactly the coefficient of
   * `columnWidth` in the width formula, and now is. `FILL` is non-zero, so there is no
   * division by zero to guard against.
   */
  /**
   * **Rounded to whole units, and that is load-bearing arithmetic rather than tidiness.**
   *
   * With `fillColumns` a marker is exactly as wide as its column, so two adjacent markers
   * touch and must not overlap by even a fraction — `renderer-layout.test.ts` asserts it, and
   * rightly, because a marker wider than its column is how the ribbon once silently drew
   * fewer steps than the road.
   *
   * Unrounded, that assertion fails on arithmetic alone. A column of 640/3 is not
   * representable in binary, and `x` is built as `padding + nodeWidth / 2 + column ·
   * columnWidth` — so subtracting two neighbours' centres returns 213.33333333333331 where
   * the width is 213.33333333333334, an apparent overlap of 3 × 10⁻¹⁴ units and a failing
   * test for a drawing no eye could fault.
   *
   * Truncating removes the problem rather than tolerating it: whole numbers and halves are
   * both exact in binary, so every centre, width and difference is exact and the neighbours
   * land precisely edge to edge. The guard stays as strict as it was written. It also draws
   * better — segment edges fall on whole user units instead of a third of one.
   *
   * **Down rather than to nearest**, which is the difference between the content finishing
   * just inside the target and just outside it. Rounding 320/3 up gave a band a single unit
   * wider than the width it was asked to fit, and a fitted width that overshoots is not
   * fitted. Undershooting is absorbed by the margin (see `width` at the end of this function);
   * overshooting would have to be absorbed by the page.
   *
   * A no-op for any density without `fitWidth`: those already carry integer columns.
   */
  const columnWidth =
    density.fitWidth === undefined
      ? density.columnWidth
      : Math.floor(
          Math.max(
            density.columnWidth,
            (density.fitWidth - density.padding * 2) /
              ((density.fillColumns === true ? FILL : density.nodeWidth / density.columnWidth) +
                gaps),
          ),
        )

  const nodeWidth = density.fillColumns === true ? columnWidth * FILL : density.nodeWidth

  // Rows size to their widest rank. Found by generative testing in Spike A: with enough
  // concurrent steps a fixed row height let the lane fan push nodes to negative y, where
  // they were silently clipped. A route with nine parallel activities is unusual, not
  // invalid, so the row grows rather than the content being cut.
  // Only the row containing a branch needs its extra height. Applying the largest fan to
  // every row left long empty returns around otherwise linear portions of the route.
  const rowLanes = Array.from({ length: rowCount }, () => 1)
  for (const [r, stepsAtRank] of byRank) {
    const row = columnFor(r).row
    rowLanes[row] = Math.max(rowLanes[row] ?? 1, stepsAtRank.length)
  }
  const rowHeights = rowLanes.map((lanes) => Math.max(
    density.rowHeight,
    density.nodeHeight + (lanes - 1) * density.laneGap + density.padding,
  ))
  const rowStarts: number[] = []
  let rowsHeight = 0
  for (const height of rowHeights) {
    rowStarts.push(rowsHeight)
    rowsHeight += height
  }

  const ordered = [...byRank.entries()].sort((a, b) => a[0] - b[0])
  const nodes: PlacedNode[] = []
  let ordinal = 0

  for (const [r, rankSteps] of ordered) {
    const { row, column } = columnFor(r)
    rankSteps.forEach((step, lane) => {
      ordinal += 1
      const laneOffset = (lane - (rankSteps.length - 1) / 2) * density.laneGap
      nodes.push({
        step,
        rank: r,
        lane,
        laneCount: rankSteps.length,
        // Coordinates are centres, so the first column must sit half a node in from the
        // padding or the leftmost marker overhangs the canvas.
        x: density.padding + nodeWidth / 2 + column * columnWidth,
        y: density.padding + (rowStarts[row] ?? 0) + (rowHeights[row] ?? density.rowHeight) / 2 + laneOffset,
        width: nodeWidth,
        height: density.nodeHeight,
        ordinal,
      })
    })
  }

  const position = new Map(nodes.map((n) => [n.step.id, n]))

  // How far a wrap connector may hook outside the column grid. Bounded by the padding so it
  // stays on the canvas — an earlier version overshot by a fixed offset and the hooks were
  // silently clipped at both edges.
  const hook = Math.min(columnWidth * 0.35, Math.max(0, density.padding - density.carriageway / 2 - 2))
  const rowOf = (node: PlacedNode): number => columnFor(node.rank).row
  const flowsRight = (node: PlacedNode): boolean => rowOf(node) % 2 === 0

  /**
   * Where a connector meets a node — its edge, or its centre.
   *
   * **Centre, wherever there is a carriageway.** VR-04 draws one continuous road with the
   * step cards sitting *on* it, so the asphalt emerges from behind each card. Joining card
   * edge to card edge instead leaves the road visible only in the gaps — at road density
   * that is a 38-unit stub between cards, which reads as a connector between boxes and not
   * as a road at all. The cards are opaque and drawn in a later layer, so the part of the
   * road that passes behind them is simply hidden.
   *
   * Ribbon density keeps edge-to-edge: its chevrons abut, so a connector between centres
   * would have nowhere to show and the branch dashes would start underneath a segment.
   */
  const joinAtCentre = density.carriageway > 0
  const exitX = (n: PlacedNode): number =>
    joinAtCentre ? n.x : flowsRight(n) ? n.x + n.width / 2 : n.x - n.width / 2
  const entryX = (n: PlacedNode): number =>
    joinAtCentre ? n.x : flowsRight(n) ? n.x - n.width / 2 : n.x + n.width / 2

  const placedEdges: PlacedEdge[] = []
  for (const edge of edges) {
    const from = position.get(edge.fromStepId)
    const to = position.get(edge.toStepId)
    if (!from || !to) continue

    const wraps = rowOf(from) !== rowOf(to)
    const startX = exitX(from)
    const startY = from.y
    const endX = entryX(to)
    const endY = to.y

    if (wraps) {
      // Wrap around the outside of the blocks. A hook measured from their centres was
      // hidden beneath the blocks and looked like a severed road at every row return.
      const outX = startX + (flowsRight(from) ? 1 : -1) * (hook + (joinAtCentre ? from.width / 2 : 0))
      const inX = endX + (flowsRight(to) ? -1 : 1) * (hook + (joinAtCentre ? to.width / 2 : 0))
      const midY = (startY + endY) / 2
      placedEdges.push({
        edge,
        wraps,
        path: `M ${startX} ${startY} C ${outX} ${startY}, ${outX} ${midY}, ${outX} ${midY} L ${inX} ${midY} C ${inX} ${midY}, ${inX} ${endY}, ${endX} ${endY}`,
      })
      continue
    }

    const midX = (startX + endX) / 2
    placedEdges.push({
      edge,
      wraps,
      path: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
    })
  }

  const columns = columnsOnWidestRow
  const contentWidth = density.padding * 2 + nodeWidth + (columns - 1) * columnWidth

  return {
    nodes,
    edges: placedEdges,
    /**
     * The canvas keeps the target width; the rounding remainder goes into the right margin.
     *
     * Whole-unit columns cannot always divide a target exactly — three ranks of 640 leaves one
     * unit over — so the drawn content can finish a pixel or two short. Shrinking the canvas
     * to match would make the ribbon's own width depend on whether its step count happened to
     * divide, which is the kind of quiet inconsistency the fitted width exists to remove.
     *
     * `Math.max` is what keeps the other case right: once a route is long enough for columns
     * to bottom out on their readable floor, the content is *wider* than the target and the
     * canvas has to grow with it, so the band scrolls in its container rather than shrinking
     * its stages to fit.
     */
    width: density.fitWidth === undefined ? contentWidth : Math.max(density.fitWidth, contentWidth),
    height: density.padding * 2 + rowsHeight,
    rowCount,
    order: nodes.map((n) => n.step.id),
  }
}
