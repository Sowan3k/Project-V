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
  /** Whether there is room for text inside a marker. */
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
   * ribbon simply comes out wider than the target, which the viewBox then scales down.
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
   * The fraction is just under 1 so a hairline of page shows between segments and the eye can
   * count them. It is also what keeps the non-overlap guarantee: adjacent markers sit one
   * column apart and are narrower than a column, so they cannot touch.
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
  // Five, not four. At four a five-rank route wrapped onto a second row carrying a single
  // card, and the row still claimed its full height — so the commonest route shape drew a
  // long empty sweep and a band of dead space. VR-04 wraps a nine-step route at four per
  // row, but its cards are wider relative to the canvas than ours.
  columnsPerRow: 5,
  columnWidth: 214,
  rowHeight: 168,
  laneGap: 84,
  // Step *cards* rather than markers — VR-04 puts the number, icon, title and duration on
  // the road itself, and a 128×52 marker has room for a truncated title and nothing else.
  nodeWidth: 176,
  nodeHeight: 74,
  padding: 46,
  showLabels: true,
  carriageway: 30,
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
  columnWidth: 156,
  rowHeight: 132,
  laneGap: 68,
  nodeWidth: 140,
  nodeHeight: 62,
  padding: 22,
  showLabels: true,
  carriageway: 24,
}

/**
 * The compressed form: one line, icon-only, wide. Same graph, same order, same layout pass.
 *
 * `fitWidth` is what makes it a band rather than a thumbnail — see the field's own note.
 * 960 is a target in user units, not pixels: the viewBox scales the result into whatever the
 * container gives it, so the same ribbon is right in a 1360px canvas and on a 360px phone.
 */
export const RIBBON: Density = {
  columnsPerRow: Number.POSITIVE_INFINITY,
  // The floor, not the value: `fillColumns` derives the real width from this. A very long
  // route bottoms out here and the ribbon simply comes out wider than 960, which the viewBox
  // scales back down.
  columnWidth: 46,
  rowHeight: 60,
  // Must exceed nodeHeight, or concurrent steps stack on top of each other and the ribbon
  // silently shows fewer steps than the road. Spike A shipped that bug for an afternoon.
  laneGap: 52,
  // Ignored while `fillColumns` is on — kept as the shape this density would have without it.
  nodeWidth: 42,
  nodeHeight: 42,
  padding: 9,
  showLabels: false,
  fitWidth: 960,
  fillColumns: true,
  carriageway: 0,
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
  const maxLanes = Math.max(1, ...[...byRank.values()].map((l) => l.length))

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
  const gaps = Math.max(1, columnsOnWidestRow - 1)

  /**
   * Marker width as a fraction of its column, when `fillColumns` is on. Just under 1 so a
   * hairline of page shows between segments — and, because it is under 1, adjacent markers
   * are narrower than the distance between them and cannot overlap.
   */
  const FILL = 0.94

  /**
   * Solving `width = 2·padding + nodeWidth + (columns−1)·columnWidth` for `columnWidth`.
   *
   * With `fillColumns` the marker width is itself `FILL · columnWidth`, so the equation
   * becomes `width = 2·padding + columnWidth·(FILL + columns − 1)` — still one unknown, and
   * still solvable directly. Making the marker depend on the column and the column depend on
   * the marker would be circular; this substitutes rather than iterating.
   */
  const columnWidth =
    density.fitWidth === undefined
      ? density.columnWidth
      : Math.max(
          density.columnWidth,
          (density.fitWidth - density.padding * 2) /
            ((density.fillColumns === true ? FILL : density.nodeWidth / density.columnWidth) +
              gaps),
        )

  const nodeWidth = density.fillColumns === true ? columnWidth * FILL : density.nodeWidth

  // Rows size to their widest rank. Found by generative testing in Spike A: with enough
  // concurrent steps a fixed row height let the lane fan push nodes to negative y, where
  // they were silently clipped. A route with nine parallel activities is unusual, not
  // invalid, so the row grows rather than the content being cut.
  const laneSpan = (maxLanes - 1) * density.laneGap
  const rowHeight = Math.max(density.rowHeight, density.nodeHeight + laneSpan + density.padding)

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
        y: density.padding + row * rowHeight + rowHeight / 2 + laneOffset,
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
  const hook = Math.min(columnWidth * 0.35, density.padding)
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
      const outX = startX + (flowsRight(from) ? hook : -hook)
      const inX = endX + (flowsRight(to) ? -hook : hook)
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

  return {
    nodes,
    edges: placedEdges,
    width: density.padding * 2 + nodeWidth + (columns - 1) * columnWidth,
    height: density.padding * 2 + rowCount * rowHeight,
    rowCount,
    order: nodes.map((n) => n.step.id),
  }
}
