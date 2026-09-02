import type { RouteGraph, StepEdge, StepNode } from './types'

/**
 * Spike A — the layout pass.
 *
 * This is the load-bearing claim of CLAUDE.md invariant 25: **ribbon and road are one
 * representation at two densities**. There is exactly one function that turns a route graph
 * into geometry. The ribbon and the road call it with different density constants and
 * nothing else. A step added to a route therefore cannot appear in one and not the other.
 *
 * It is also where invariant 24 is either true or false. Nothing in here may look at a
 * route's id, title or destination — only at graph structure. `layout()` does not even
 * receive the destination.
 *
 * THROWAWAY. Phase 4 rebuilds this properly.
 */

export interface Density {
  /** Ranks per row before wrapping. Infinity keeps everything on one line (ribbon). */
  readonly columnsPerRow: number
  readonly columnWidth: number
  readonly rowHeight: number
  readonly laneGap: number
  readonly nodeWidth: number
  readonly nodeHeight: number
  readonly padding: number
  readonly showLabels: boolean
}

/** The expanded form: wraps across rows, labelled, generous. */
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
 * The road at phone width. Identical to ROAD except for how many ranks fit on a row.
 *
 * This exists to test a claim, not to ship: if adapting to a 360px screen needs only a
 * different constant — no branching, no second code path, no mobile-specific renderer —
 * then the layout really is data-driven (CLAUDE.md invariant 24) and Phase 4 can pick
 * density from a media query.
 */
export const ROAD_NARROW: Density = {
  columnsPerRow: 2,
  columnWidth: 150,
  rowHeight: 132,
  laneGap: 62,
  nodeWidth: 122,
  nodeHeight: 50,
  padding: 24,
  showLabels: true,
}

/** The compressed form: one line, unlabelled, small. Same graph, same order. */
export const RIBBON: Density = {
  columnsPerRow: Number.POSITIVE_INFINITY,
  columnWidth: 30,
  rowHeight: 62,
  // Must exceed nodeHeight, or concurrent steps stack on top of each other and the ribbon
  // silently shows fewer steps than the road.
  laneGap: 27,
  nodeWidth: 22,
  nodeHeight: 22,
  padding: 12,
  showLabels: false,
}

export interface PlacedNode {
  readonly step: StepNode
  /** Longest-path depth from a start node. Shared rank means concurrent. */
  readonly rank: number
  /** Index among the nodes sharing this rank, after deterministic ordering. */
  readonly lane: number
  readonly laneCount: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PlacedEdge {
  readonly edge: StepEdge
  readonly path: string
  /** True when the edge spans a wrap, so it needs a U-turn rather than a straight run. */
  readonly wraps: boolean
}

export interface Layout {
  readonly nodes: readonly PlacedNode[]
  readonly edges: readonly PlacedEdge[]
  readonly width: number
  readonly height: number
  /** Step ids in canonical draw order. Ribbon and road must produce the same list. */
  readonly order: readonly string[]
  readonly rowCount: number
}

export class GraphError extends Error {}

/**
 * Validates the structural promises Phase 2 will enforce in the database: every edge
 * references a real step, the graph is acyclic, and nothing is stranded.
 */
export function validate(graph: RouteGraph): void {
  const ids = new Set(graph.steps.map((s) => s.id))
  if (ids.size !== graph.steps.length) throw new GraphError('duplicate step id')

  for (const edge of graph.edges) {
    if (!ids.has(edge.from)) throw new GraphError(`edge from unknown step "${edge.from}"`)
    if (!ids.has(edge.to)) throw new GraphError(`edge to unknown step "${edge.to}"`)
    if (edge.from === edge.to) throw new GraphError(`self-loop on "${edge.from}"`)
  }

  // Cycle detection by colouring depth-first.
  const outgoing = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.from) ?? []
    list.push(edge.to)
    outgoing.set(edge.from, list)
  }

  const state = new Map<string, 'visiting' | 'done'>()
  const walk = (id: string): void => {
    const seen = state.get(id)
    if (seen === 'done') return
    if (seen === 'visiting') throw new GraphError(`cycle through "${id}"`)
    state.set(id, 'visiting')
    for (const next of outgoing.get(id) ?? []) walk(next)
    state.set(id, 'done')
  }
  for (const step of graph.steps) walk(step.id)

  if (graph.steps.length > 1) {
    const connected = new Set<string>()
    for (const edge of graph.edges) {
      connected.add(edge.from)
      connected.add(edge.to)
    }
    const orphans = graph.steps.filter((s) => !connected.has(s.id)).map((s) => s.id)
    if (orphans.length > 0) throw new GraphError(`orphan step(s): ${orphans.join(', ')}`)
  }
}

/** Longest-path rank. Shared rank is what makes parallel and alternative branches read as concurrent. */
function ranks(graph: RouteGraph): Map<string, number> {
  const incoming = new Map<string, string[]>()
  for (const step of graph.steps) incoming.set(step.id, [])
  for (const edge of graph.edges) incoming.get(edge.to)?.push(edge.from)

  const rank = new Map<string, number>()
  const resolve = (id: string): number => {
    const known = rank.get(id)
    if (known !== undefined) return known
    const parents = incoming.get(id) ?? []
    const value = parents.length === 0 ? 0 : Math.max(...parents.map(resolve)) + 1
    rank.set(id, value)
    return value
  }
  for (const step of graph.steps) resolve(step.id)
  return rank
}

/**
 * Turns a route graph into positioned geometry.
 *
 * Serpentine flow: odd rows run right-to-left so a wrap is a short U-turn rather than a
 * long sweep back across the page. VR-04 shows exactly this — the road wrapping across
 * three rows with curved connectors, not one straight line.
 */
export function layout(graph: RouteGraph, density: Density): Layout {
  validate(graph)

  const rank = ranks(graph)
  const maxRank = Math.max(0, ...[...rank.values()])

  // Deterministic lane assignment: declaration order within a rank. Deterministic ordering
  // is what makes the structural-equivalence test (Test.md 24) meaningful — two graphs with
  // the same shape must place nodes identically.
  const byRank = new Map<number, StepNode[]>()
  for (const step of graph.steps) {
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
    // Serpentine: reverse direction on odd rows.
    const column = row % 2 === 0 ? raw : perRow - 1 - raw
    return { row, column }
  }

  const rowCount = Number.isFinite(perRow) ? Math.floor(maxRank / perRow) + 1 : 1
  const maxLanes = Math.max(1, ...[...byRank.values()].map((l) => l.length))

  // Rows size to their widest rank. Found by the generative test: with enough concurrent
  // steps the lane fan exceeded a fixed row height and pushed nodes to negative y, i.e.
  // clipped off the canvas. A route with nine parallel activities is unusual, not invalid,
  // so the row grows rather than the content being cut.
  const laneSpan = (maxLanes - 1) * density.laneGap
  const rowHeight = Math.max(density.rowHeight, density.nodeHeight + laneSpan + density.padding)

  const nodes: PlacedNode[] = []
  for (const [r, steps] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
    const { row, column } = columnFor(r)
    steps.forEach((step, lane) => {
      const laneOffset = (lane - (steps.length - 1) / 2) * density.laneGap
      nodes.push({
        step,
        rank: r,
        lane,
        laneCount: steps.length,
        x: density.padding + density.nodeWidth / 2 + column * density.columnWidth,
        y: density.padding + row * rowHeight + rowHeight / 2 + laneOffset,
        width: density.nodeWidth,
        height: density.nodeHeight,
      })
    })
  }

  const position = new Map(nodes.map((n) => [n.step.id, n]))

  /**
   * How far a wrap connector may hook outside the column grid. Bounded by the padding so
   * the hook stays on the canvas — an earlier version overshot by a fixed 40px and the
   * U-turns were silently clipped by the viewBox at both edges.
   */
  const hook = Math.min(density.columnWidth * 0.35, density.padding)

  const rowOf = (node: PlacedNode): number => columnFor(node.rank).row
  /** Serpentine reverses direction on odd rows, so exit and entry sides reverse with it. */
  const flowsRight = (node: PlacedNode): boolean => rowOf(node) % 2 === 0
  const exitX = (n: PlacedNode): number => (flowsRight(n) ? n.x + n.width / 2 : n.x - n.width / 2)
  const entryX = (n: PlacedNode): number => (flowsRight(n) ? n.x - n.width / 2 : n.x + n.width / 2)

  const edges: PlacedEdge[] = graph.edges.map((edge) => {
    const from = position.get(edge.from)
    const to = position.get(edge.to)
    if (!from || !to) throw new GraphError(`unplaced edge ${edge.from}->${edge.to}`)

    const wraps = rowOf(from) !== rowOf(to)
    const startX = exitX(from)
    const startY = from.y
    const endX = entryX(to)
    const endY = to.y

    if (wraps) {
      // Serpentine puts the next row's first step directly below the previous row's last,
      // on the same side — so the wrap is a short hook down, not a sweep back across.
      const outward = flowsRight(from) ? hook : -hook
      const outX = startX + outward
      const inX = endX + (flowsRight(to) ? -hook : hook)
      const midY = (startY + endY) / 2
      return {
        edge,
        wraps,
        path: `M ${startX} ${startY} C ${outX} ${startY}, ${outX} ${midY}, ${outX} ${midY} L ${inX} ${midY} C ${inX} ${midY}, ${inX} ${endY}, ${endX} ${endY}`,
      }
    }

    const midX = (startX + endX) / 2
    return {
      edge,
      wraps,
      path: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
    }
  })

  // Node coordinates are centres, so the canvas must allow half a node beyond the first
  // and last column centre — otherwise the leftmost marker is clipped by the viewBox.
  const columns = Number.isFinite(perRow) ? Math.min(perRow, maxRank + 1) : maxRank + 1
  const width = density.padding * 2 + density.nodeWidth + (columns - 1) * density.columnWidth
  const height = density.padding * 2 + rowCount * rowHeight

  return {
    nodes,
    edges,
    width,
    height,
    rowCount,
    // Canonical order: by rank, then lane. Independent of density, which is precisely why
    // ribbon and road cannot disagree about step count or order (invariant 25).
    order: [...nodes]
      .sort((a, b) => a.rank - b.rank || a.lane - b.lane)
      .map((n) => n.step.id),
  }
}
