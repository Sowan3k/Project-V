import type { Snapshot } from './model'

/**
 * Spike B — the structural diff.
 *
 * This is the go/no-go: the diff must correctly describe a change involving a **branch**,
 * not merely a field edit. A diff that can only say "3 fields changed" cannot power the
 * shadow route, which has to answer *what* changed, *where*, and *how much* (FR-77,
 * CLAUDE.md §7).
 *
 * THROWAWAY. Phase 3 owns the real diff.
 */

export interface RouteDiff {
  readonly stepsAdded: readonly string[]
  readonly stepsArchived: readonly string[]
  /** Steps present in both, whose position in the topological order moved. */
  readonly stepsReordered: readonly string[]
  readonly edgesAdded: readonly { edgeId: string; from: string; to: string; kind: string }[]
  readonly edgesArchived: readonly { edgeId: string; from: string; to: string; kind: string }[]
  readonly fieldsChanged: readonly { fieldId: string; from: string; to: string }[]
  readonly fieldsArchived: readonly string[]
  /** True when the *shape* of the route changed, not just its content. */
  readonly structureChanged: boolean
  /** Human-facing summary, in the shape CLAUDE.md §7 requires of the shadow route. */
  readonly summary: string
}

export function diff(before: Snapshot, after: Snapshot): RouteDiff {
  const beforeSteps = new Set(before.steps.map((s) => s.stepId))
  const afterSteps = new Set(after.steps.map((s) => s.stepId))

  const stepsAdded = [...afterSteps].filter((id) => !beforeSteps.has(id)).sort()
  const stepsArchived = [...beforeSteps].filter((id) => !afterSteps.has(id)).sort()

  // Reordering is only meaningful for steps that survive in both versions; comparing raw
  // indices would otherwise report every step after an insertion as "moved".
  const survivors = [...beforeSteps].filter((id) => afterSteps.has(id))
  const beforeOrder = before.order.filter((id) => survivors.includes(id))
  const afterOrder = after.order.filter((id) => survivors.includes(id))
  const stepsReordered = survivors
    .filter((id) => beforeOrder.indexOf(id) !== afterOrder.indexOf(id))
    .sort()

  const beforeEdges = new Map(before.edges.map((e) => [e.edgeId, e]))
  const afterEdges = new Map(after.edges.map((e) => [e.edgeId, e]))
  const describe = (e: { edgeId: string; from: string; to: string; kind: string }) => ({
    edgeId: e.edgeId,
    from: e.from,
    to: e.to,
    kind: e.kind,
  })

  const edgesAdded = [...afterEdges.values()]
    .filter((e) => !beforeEdges.has(e.edgeId))
    .map(describe)
  const edgesArchived = [...beforeEdges.values()]
    .filter((e) => !afterEdges.has(e.edgeId))
    .map(describe)

  const beforeFields = new Map(before.fields.map((f) => [f.fieldId, f]))
  const afterFields = new Map(after.fields.map((f) => [f.fieldId, f]))

  const fieldsChanged = [...afterFields.values()]
    .filter((f) => {
      const was = beforeFields.get(f.fieldId)
      return was !== undefined && was.value !== f.value
    })
    .map((f) => ({
      fieldId: f.fieldId,
      from: beforeFields.get(f.fieldId)?.value ?? '',
      to: f.value,
    }))

  const fieldsArchived = [...beforeFields.keys()].filter((id) => !afterFields.has(id)).sort()

  const structureChanged =
    stepsAdded.length > 0 ||
    stepsArchived.length > 0 ||
    stepsReordered.length > 0 ||
    edgesAdded.length > 0 ||
    edgesArchived.length > 0

  const bits: string[] = []
  if (stepsAdded.length) bits.push(`${stepsAdded.length} step${plural(stepsAdded.length)} added`)
  if (stepsArchived.length)
    bits.push(`${stepsArchived.length} step${plural(stepsArchived.length)} archived`)
  if (stepsReordered.length)
    bits.push(`${stepsReordered.length} step${plural(stepsReordered.length)} reordered`)
  if (edgesAdded.length || edgesArchived.length) {
    const branchKinds = [...edgesAdded, ...edgesArchived].filter((e) => e.kind !== 'sequential')
    bits.push(
      branchKinds.length > 0
        ? `route structure changed (${branchKinds.length} branch connection${plural(branchKinds.length)})`
        : 'route structure changed',
    )
  }
  if (fieldsChanged.length)
    bits.push(`${fieldsChanged.length} field${plural(fieldsChanged.length)} changed`)
  if (fieldsArchived.length)
    bits.push(`${fieldsArchived.length} field${plural(fieldsArchived.length)} archived`)

  return {
    stepsAdded,
    stepsArchived,
    stepsReordered,
    edgesAdded,
    edgesArchived,
    fieldsChanged,
    fieldsArchived,
    structureChanged,
    summary: bits.length > 0 ? bits.join(', ') : 'no change',
  }
}

function plural(n: number): string {
  return n === 1 ? '' : 's'
}
