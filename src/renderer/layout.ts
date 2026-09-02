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
  readonly columnWidth: number
  readonly rowHeight: number
  readonly laneGap: number
  readonly nodeWidth: number
  readonly nodeHeight: number
  readonly padding: number
  /** Whether there is room for text inside a marker. */
  readonly showLabels: boolean
}

/** The expanded form: wraps across rows, labelled, generous (VR-04). */
export const ROAD: Density = {
  columnsPerRow: 5,
  columnWidth: 168,
  rowHeight: 150,
  laneGap: 62,
  nodeWidth: 128,
  nodeHeight: 52,
  padding: 44,
  showLabels: true,
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
  rowHeight: 128,
  laneGap: 62,
  nodeWidth: 124,
  nodeHeight: 50,
  padding: 28,
  showLabels: true,
}

/** The compressed form: one line, unlabelled, small. Same graph, same order. */
export const RIBBON: Density = {
  columnsPerRow: Number.POSITIVE_INFINITY,
  columnWidth: 30,
  rowHeight: 62,
  // Must exceed nodeHeight, or concurrent steps stack on top of each other and the ribbon
  // silently shows fewer steps than the road. Spike A shipped that bug for an afternoon.
  laneGap: 27,
  nodeWidth: 22,
  nodeHeight: 22,
  padding: 12,
  showLabels: false,
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
        x: density.padding + density.nodeWidth / 2 + column * density.columnWidth,
        y: density.padding + row * rowHeight + rowHeight / 2 + laneOffset,
        width: density.nodeWidth,
        height: density.nodeHeight,
        ordinal,
      })
    })
  }

  const position = new Map(nodes.map((n) => [n.step.id, n]))

  // How far a wrap connector may hook outside the column grid. Bounded by the padding so it
  // stays on the canvas — an earlier version overshot by a fixed offset and the hooks were
  // silently clipped at both edges.
  const hook = Math.min(density.columnWidth * 0.35, density.padding)
  const rowOf = (node: PlacedNode): number => columnFor(node.rank).row
  const flowsRight = (node: PlacedNode): boolean => rowOf(node) % 2 === 0
  const exitX = (n: PlacedNode): number => (flowsRight(n) ? n.x + n.width / 2 : n.x - n.width / 2)
  const entryX = (n: PlacedNode): number => (flowsRight(n) ? n.x - n.width / 2 : n.x + n.width / 2)

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

  const columns = Number.isFinite(perRow) ? Math.min(perRow, maxRank + 1) : maxRank + 1

  return {
    nodes,
    edges: placedEdges,
    width: density.padding * 2 + density.nodeWidth + (columns - 1) * density.columnWidth,
    height: density.padding * 2 + rowCount * rowHeight,
    rowCount,
    order: nodes.map((n) => n.step.id),
  }
}
