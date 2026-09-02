/**
 * Spike B — append-only revision ledger over a branching route graph.
 *
 * The question Phase 2 cannot afford to get wrong: does an append-only ledger over a *graph*
 * (not a list) actually support concurrent edits, structural diffing and archival — or does
 * something only become obvious once you try?
 *
 * Design commitments being tested, each traceable:
 *   - Nothing is ever mutated or deleted. Every change appends (FR-20, BR-03, invariant 2).
 *   - Archive removes from the current view, never from history (FR-21, FR-45, invariant 4).
 *   - Concurrent revisions both survive; neither wins by overwriting (invariant 2, BR-21).
 *   - A contested field is detectable as contested, not silently resolved (invariant 15).
 *   - Structure is versioned too — edges have revisions, or a branch change is undiffable
 *     (Phases.md Phase 2).
 *
 * In-memory only. THROWAWAY: Phase 3 builds the real service layer against Postgres.
 */

export type Actor = string
export type Iso = string

export type EdgeKind = 'sequential' | 'optional_branch' | 'alternative' | 'rejoin'

/** Every mutation is one of these, appended and never edited. */
export type Operation =
  | { op: 'add_step'; at: Iso; actor: Actor; stepId: string; label: string }
  | { op: 'archive_step'; at: Iso; actor: Actor; stepId: string; reason: string }
  | { op: 'add_edge'; at: Iso; actor: Actor; edgeId: string; from: string; to: string; kind: EdgeKind }
  | { op: 'archive_edge'; at: Iso; actor: Actor; edgeId: string; reason: string }
  | { op: 'add_field'; at: Iso; actor: Actor; fieldId: string; stepId: string; value: string }
  | {
      op: 'revise_field'
      at: Iso
      actor: Actor
      fieldId: string
      value: string
      reason: string
      /** The revision this edit was made against. Shared parents mean concurrent edits. */
      basedOn: string
      revisionId: string
    }
  | { op: 'archive_field'; at: Iso; actor: Actor; fieldId: string; reason: string }

export interface FieldRevision {
  readonly revisionId: string
  readonly value: string
  readonly actor: Actor
  readonly at: Iso
  readonly basedOn: string | null
  readonly reason: string | null
}

export interface FieldView {
  readonly fieldId: string
  readonly stepId: string
  /** The newest revision. Newest is not "correct" — it is simply current. */
  readonly value: string
  readonly revisions: readonly FieldRevision[]
  readonly archived: boolean
  /**
   * True when two or more revisions were made against the same parent — a genuine
   * concurrent edit. Surfaced, never auto-resolved (invariant 15, FR-70).
   */
  readonly contested: boolean
}

export interface StepView {
  readonly stepId: string
  readonly label: string
  readonly archived: boolean
}

export interface EdgeView {
  readonly edgeId: string
  readonly from: string
  readonly to: string
  readonly kind: EdgeKind
  readonly archived: boolean
}

export interface Snapshot {
  readonly steps: readonly StepView[]
  readonly edges: readonly EdgeView[]
  readonly fields: readonly FieldView[]
  /** Topological order of non-archived steps — the thing a reordering diff compares. */
  readonly order: readonly string[]
}

export class Ledger {
  private readonly log: Operation[] = []

  append(operation: Operation): this {
    this.log.push(operation)
    return this
  }

  /** The whole history, including everything archived. Never filtered. */
  history(): readonly Operation[] {
    return [...this.log]
  }

  /** Every revision a field has ever had, archived or not (FR-45, invariant 4). */
  fieldHistory(fieldId: string): readonly FieldRevision[] {
    return this.project({ includeArchived: true }).fields.find((f) => f.fieldId === fieldId)
      ?.revisions ?? []
  }

  /**
   * Builds the view at a point in time. This is the only reader; there is no stored
   * "current" state that could drift from the log.
   */
  project(options: { at?: Iso; includeArchived?: boolean } = {}): Snapshot {
    const upTo = options.at
    const relevant = upTo ? this.log.filter((o) => o.at <= upTo) : this.log

    const steps = new Map<string, { label: string; archived: boolean }>()
    const edges = new Map<string, { from: string; to: string; kind: EdgeKind; archived: boolean }>()
    const fields = new Map<
      string,
      { stepId: string; revisions: FieldRevision[]; archived: boolean }
    >()

    for (const op of relevant) {
      switch (op.op) {
        case 'add_step':
          steps.set(op.stepId, { label: op.label, archived: false })
          break
        case 'archive_step': {
          const step = steps.get(op.stepId)
          // Archive flips a flag. The step is never removed from the map — that is the
          // difference between archived and deleted.
          if (step) steps.set(op.stepId, { ...step, archived: true })
          break
        }
        case 'add_edge':
          edges.set(op.edgeId, { from: op.from, to: op.to, kind: op.kind, archived: false })
          break
        case 'archive_edge': {
          const edge = edges.get(op.edgeId)
          if (edge) edges.set(op.edgeId, { ...edge, archived: true })
          break
        }
        case 'add_field':
          fields.set(op.fieldId, {
            stepId: op.stepId,
            archived: false,
            revisions: [
              {
                revisionId: `${op.fieldId}@0`,
                value: op.value,
                actor: op.actor,
                at: op.at,
                basedOn: null,
                reason: null,
              },
            ],
          })
          break
        case 'revise_field': {
          const field = fields.get(op.fieldId)
          if (!field) break
          // Append. The prior value stays readable forever (invariant 2).
          field.revisions.push({
            revisionId: op.revisionId,
            value: op.value,
            actor: op.actor,
            at: op.at,
            basedOn: op.basedOn,
            reason: op.reason,
          })
          break
        }
        case 'archive_field': {
          const field = fields.get(op.fieldId)
          if (field) field.archived = true
          break
        }
      }
    }

    const includeArchived = options.includeArchived ?? false

    const stepViews = [...steps.entries()]
      .map(([stepId, s]) => ({ stepId, label: s.label, archived: s.archived }))
      .filter((s) => includeArchived || !s.archived)

    const edgeViews = [...edges.entries()]
      .map(([edgeId, e]) => ({ edgeId, ...e }))
      .filter((e) => includeArchived || !e.archived)

    const fieldViews = [...fields.entries()]
      .map(([fieldId, f]) => {
        const parents = f.revisions.map((r) => r.basedOn).filter((p): p is string => p !== null)
        const contested = new Set(parents).size !== parents.length
        const latest = f.revisions[f.revisions.length - 1]
        return {
          fieldId,
          stepId: f.stepId,
          value: latest?.value ?? '',
          revisions: f.revisions,
          archived: f.archived,
          contested,
        }
      })
      .filter((f) => includeArchived || !f.archived)

    return {
      steps: stepViews,
      edges: edgeViews,
      fields: fieldViews,
      order: topological(stepViews, edgeViews),
    }
  }
}

/** Deterministic topological order, so "reordered" means something. */
function topological(steps: readonly StepView[], edges: readonly EdgeView[]): string[] {
  const ids = steps.map((s) => s.stepId)
  const live = new Set(ids)
  const incoming = new Map<string, number>(ids.map((id) => [id, 0]))
  const next = new Map<string, string[]>(ids.map((id) => [id, []]))

  for (const edge of edges) {
    if (!live.has(edge.from) || !live.has(edge.to)) continue
    next.get(edge.from)?.push(edge.to)
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1)
  }

  const ready = ids.filter((id) => (incoming.get(id) ?? 0) === 0).sort()
  const out: string[] = []
  while (ready.length > 0) {
    const id = ready.shift()
    if (id === undefined) break
    out.push(id)
    for (const child of (next.get(id) ?? []).sort()) {
      const count = (incoming.get(child) ?? 0) - 1
      incoming.set(child, count)
      if (count === 0) ready.push(child)
    }
    ready.sort()
  }
  return out
}
