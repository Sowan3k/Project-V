import { describe, expect, it } from 'vitest'

import { diff } from './diff'
import { Ledger, type Operation } from './model'

/**
 * Spike B — the go/no-go assertions.
 *
 * Headless by design (Phases.md Phase 1): if the ledger needs a UI to demonstrate, the
 * model is wrong.
 */

const T = (n: number): string => `2026-09-0${n}T00:00:00.000Z`

/** A small route with a real alternative branch: docs -> (IELTS | PTE) -> admission -> visa. */
function branchingRoute(): Ledger {
  const ops: Operation[] = [
    { op: 'add_step', at: T(1), actor: 'seed', stepId: 'docs', label: 'Documents' },
    { op: 'add_step', at: T(1), actor: 'seed', stepId: 'ielts', label: 'IELTS' },
    { op: 'add_step', at: T(1), actor: 'seed', stepId: 'adm', label: 'Admission' },
    { op: 'add_step', at: T(1), actor: 'seed', stepId: 'visa', label: 'Visa' },
    { op: 'add_edge', at: T(1), actor: 'seed', edgeId: 'e1', from: 'docs', to: 'ielts', kind: 'sequential' },
    { op: 'add_edge', at: T(1), actor: 'seed', edgeId: 'e2', from: 'ielts', to: 'adm', kind: 'sequential' },
    { op: 'add_edge', at: T(1), actor: 'seed', edgeId: 'e3', from: 'adm', to: 'visa', kind: 'sequential' },
    { op: 'add_field', at: T(1), actor: 'seed', fieldId: 'f-score', stepId: 'ielts', value: 'Overall 6.5' },
    { op: 'add_field', at: T(1), actor: 'seed', fieldId: 'f-fee', stepId: 'visa', value: 'Fee 7500 BDT' },
  ]
  const ledger = new Ledger()
  for (const op of ops) ledger.append(op)
  return ledger
}

describe('spike B — nothing is ever destroyed', () => {
  it('revising a field preserves the prior value and its author (invariant 2)', () => {
    const ledger = branchingRoute()
    ledger.append({
      op: 'revise_field',
      at: T(2),
      actor: 'nadia',
      fieldId: 'f-score',
      value: 'Overall 7.0',
      reason: 'University raised the minimum',
      basedOn: 'f-score@0',
      revisionId: 'f-score@1',
    })

    const field = ledger.project().fields.find((f) => f.fieldId === 'f-score')
    expect(field?.value).toBe('Overall 7.0')

    const history = ledger.fieldHistory('f-score')
    expect(history).toHaveLength(2)
    expect(history[0]?.value).toBe('Overall 6.5')
    expect(history[0]?.actor).toBe('seed')
    expect(history[1]?.actor).toBe('nadia')
    expect(history[1]?.reason).toBe('University raised the minimum')
  })

  it('two contributors revising one field concurrently both survive, and it reads as contested', () => {
    const ledger = branchingRoute()

    // Both edits were made against the same parent revision — neither author saw the other.
    ledger.append({
      op: 'revise_field',
      at: T(2),
      actor: 'nadia',
      fieldId: 'f-fee',
      value: 'Fee 8000 BDT',
      reason: 'Paid this last week',
      basedOn: 'f-fee@0',
      revisionId: 'f-fee@a',
    })
    ledger.append({
      op: 'revise_field',
      at: T(3),
      actor: 'rafi',
      fieldId: 'f-fee',
      value: 'Fee 7900 BDT',
      reason: 'Embassy site says 7900',
      basedOn: 'f-fee@0',
      revisionId: 'f-fee@b',
    })

    const field = ledger.project().fields.find((f) => f.fieldId === 'f-fee')

    // Neither is lost.
    expect(field?.revisions).toHaveLength(3)
    expect(field?.revisions.map((r) => r.value)).toEqual([
      'Fee 7500 BDT',
      'Fee 8000 BDT',
      'Fee 7900 BDT',
    ])

    // The later edit is current, but "current" is not a claim of correctness...
    expect(field?.value).toBe('Fee 7900 BDT')
    // ...and the conflict is visible rather than silently resolved (invariant 15, FR-70).
    expect(field?.contested).toBe(true)
  })

  it('a sequential edit chain is not mistaken for a conflict', () => {
    const ledger = branchingRoute()
    ledger.append({
      op: 'revise_field', at: T(2), actor: 'nadia', fieldId: 'f-fee',
      value: 'Fee 8000 BDT', reason: 'r1', basedOn: 'f-fee@0', revisionId: 'f-fee@1',
    })
    ledger.append({
      op: 'revise_field', at: T(3), actor: 'rafi', fieldId: 'f-fee',
      value: 'Fee 8100 BDT', reason: 'r2', basedOn: 'f-fee@1', revisionId: 'f-fee@2',
    })

    expect(ledger.project().fields.find((f) => f.fieldId === 'f-fee')?.contested).toBe(false)
  })

  it('a user who did not create the route can revise it (invariant 3, FR-44)', () => {
    const ledger = branchingRoute()
    ledger.append({
      op: 'revise_field', at: T(2), actor: 'a-stranger', fieldId: 'f-score',
      value: 'Overall 7.5', reason: 'changed', basedOn: 'f-score@0', revisionId: 'f-score@1',
    })
    // There is no owner concept in the model at all, which is the strongest form of the rule.
    expect(ledger.project().fields.find((f) => f.fieldId === 'f-score')?.value).toBe('Overall 7.5')
  })
})

describe('spike B — archived is not deleted (invariant 4, FR-21, FR-45)', () => {
  it('an archived field leaves the current view but stays in history', () => {
    const ledger = branchingRoute()
    ledger.append({
      op: 'archive_field', at: T(2), actor: 'nadia', fieldId: 'f-fee',
      reason: 'obsolete — fee is now collected at the centre',
    })

    expect(ledger.project().fields.map((f) => f.fieldId)).not.toContain('f-fee')
    expect(ledger.project({ includeArchived: true }).fields.map((f) => f.fieldId)).toContain('f-fee')
    expect(ledger.fieldHistory('f-fee')[0]?.value).toBe('Fee 7500 BDT')
  })

  it('an archived step leaves the current road but the log still explains why', () => {
    const ledger = branchingRoute()
    ledger.append({
      op: 'archive_step', at: T(2), actor: 'nadia', stepId: 'ielts',
      reason: 'replaced by a combined language step',
    })

    expect(ledger.project().steps.map((s) => s.stepId)).not.toContain('ielts')
    expect(ledger.project({ includeArchived: true }).steps.map((s) => s.stepId)).toContain('ielts')

    const archival = ledger.history().find((o) => o.op === 'archive_step')
    expect(archival).toMatchObject({ actor: 'nadia', stepId: 'ielts' })
  })

  it('history is append-only — no operation is ever removed', () => {
    const ledger = branchingRoute()
    const before = ledger.history().length
    ledger.append({ op: 'archive_field', at: T(2), actor: 'x', fieldId: 'f-fee', reason: 'r' })
    ledger.append({ op: 'archive_step', at: T(2), actor: 'x', stepId: 'visa', reason: 'r' })
    expect(ledger.history()).toHaveLength(before + 2)
  })
})

describe('spike B — the diff describes a branch change, not just a field edit (GO/NO-GO)', () => {
  it('adding an alternative branch is reported as a structural change', () => {
    const ledger = branchingRoute()
    const before = ledger.project()

    // A contributor adds PTE as an alternative to IELTS: one new step, and the edges that
    // turn a straight line into a genuine branch that reconverges.
    ledger.append({ op: 'add_step', at: T(2), actor: 'rafi', stepId: 'pte', label: 'PTE' })
    ledger.append({
      op: 'add_edge', at: T(2), actor: 'rafi', edgeId: 'e4',
      from: 'docs', to: 'pte', kind: 'alternative',
    })
    ledger.append({
      op: 'add_edge', at: T(2), actor: 'rafi', edgeId: 'e5',
      from: 'pte', to: 'adm', kind: 'rejoin',
    })

    const after = ledger.project()
    const result = diff(before, after)

    expect(result.stepsAdded).toEqual(['pte'])
    expect(result.structureChanged).toBe(true)

    // The decisive assertion: the diff must name the branch connections, not merely count
    // steps. A shadow route that says "1 step added" while the road silently gained an
    // alternative path would be lying about the shape of the change.
    expect(result.edgesAdded.map((e) => e.kind).sort()).toEqual(['alternative', 'rejoin'])
    expect(result.summary).toContain('2 branch connections')
    expect(result.summary).toContain('1 step added')
  })

  it('removing a branch is reported too', () => {
    const ledger = branchingRoute()
    ledger.append({ op: 'add_step', at: T(2), actor: 'rafi', stepId: 'pte', label: 'PTE' })
    ledger.append({ op: 'add_edge', at: T(2), actor: 'rafi', edgeId: 'e4', from: 'docs', to: 'pte', kind: 'alternative' })
    ledger.append({ op: 'add_edge', at: T(2), actor: 'rafi', edgeId: 'e5', from: 'pte', to: 'adm', kind: 'rejoin' })
    const withBranch = ledger.project()

    ledger.append({ op: 'archive_edge', at: T(3), actor: 'admin', edgeId: 'e4', reason: 'no longer accepted' })
    ledger.append({ op: 'archive_edge', at: T(3), actor: 'admin', edgeId: 'e5', reason: 'no longer accepted' })
    ledger.append({ op: 'archive_step', at: T(3), actor: 'admin', stepId: 'pte', reason: 'no longer accepted' })

    const result = diff(withBranch, ledger.project())
    expect(result.stepsArchived).toEqual(['pte'])
    expect(result.edgesArchived).toHaveLength(2)
    expect(result.structureChanged).toBe(true)
    expect(result.summary).toContain('1 step archived')
  })

  it('separates a content change from a structural one', () => {
    const ledger = branchingRoute()
    const before = ledger.project()
    ledger.append({
      op: 'revise_field', at: T(2), actor: 'nadia', fieldId: 'f-score',
      value: 'Overall 7.0', reason: 'raised', basedOn: 'f-score@0', revisionId: 'f-score@1',
    })

    const result = diff(before, ledger.project())
    expect(result.structureChanged).toBe(false)
    expect(result.fieldsChanged).toEqual([
      { fieldId: 'f-score', from: 'Overall 6.5', to: 'Overall 7.0' },
    ])
    expect(result.summary).toBe('1 field changed')
  })

  it('reports reordering separately from insertion', () => {
    const ledger = branchingRoute()
    const before = ledger.project()

    // Move the language step after admission by rewiring, without adding or removing steps.
    ledger.append({ op: 'archive_edge', at: T(2), actor: 'rafi', edgeId: 'e1', reason: 'resequenced' })
    ledger.append({ op: 'archive_edge', at: T(2), actor: 'rafi', edgeId: 'e2', reason: 'resequenced' })
    ledger.append({ op: 'add_edge', at: T(2), actor: 'rafi', edgeId: 'e6', from: 'docs', to: 'adm', kind: 'sequential' })
    ledger.append({ op: 'add_edge', at: T(2), actor: 'rafi', edgeId: 'e7', from: 'adm', to: 'ielts', kind: 'sequential' })
    ledger.append({ op: 'add_edge', at: T(2), actor: 'rafi', edgeId: 'e8', from: 'ielts', to: 'visa', kind: 'sequential' })
    ledger.append({ op: 'archive_edge', at: T(2), actor: 'rafi', edgeId: 'e3', reason: 'resequenced' })

    const result = diff(before, ledger.project())
    expect(result.stepsAdded).toEqual([])
    expect(result.stepsArchived).toEqual([])
    expect(result.stepsReordered.length).toBeGreaterThan(0)
    expect(result.summary).toContain('reordered')
  })

  it('reports no change when nothing changed', () => {
    const ledger = branchingRoute()
    expect(diff(ledger.project(), ledger.project()).summary).toBe('no change')
  })
})

describe('spike B — time travel, which is what the shadow route needs', () => {
  it('projects the route as it was when a follower started', () => {
    const ledger = branchingRoute()
    ledger.append({ op: 'add_step', at: T(4), actor: 'rafi', stepId: 'pte', label: 'PTE' })
    ledger.append({ op: 'add_edge', at: T(4), actor: 'rafi', edgeId: 'e4', from: 'docs', to: 'pte', kind: 'alternative' })
    ledger.append({
      op: 'revise_field', at: T(4), actor: 'rafi', fieldId: 'f-score',
      value: 'Overall 7.0', reason: 'raised', basedOn: 'f-score@0', revisionId: 'f-score@1',
    })

    const whenTheyStarted = ledger.project({ at: T(2) })
    const now = ledger.project()

    expect(whenTheyStarted.steps.map((s) => s.stepId)).not.toContain('pte')
    expect(whenTheyStarted.fields.find((f) => f.fieldId === 'f-score')?.value).toBe('Overall 6.5')

    const result = diff(whenTheyStarted, now)
    expect(result.stepsAdded).toEqual(['pte'])
    expect(result.fieldsChanged).toHaveLength(1)
    expect(result.summary).toContain('1 step added')
    expect(result.summary).toContain('1 field changed')
  })
})
