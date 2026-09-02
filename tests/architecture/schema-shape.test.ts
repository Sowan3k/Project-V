import { describe, expect, it } from 'vitest'

import { PRISMA_SCHEMA_DIR } from '../../scripts/paths'
import { read, walk } from '../support/source-files'

/**
 * Phase 2 exit criteria, asserted against the schema itself (Phases.md):
 *
 *   - "A structural test asserts every revisable model has a matching revision model,
 *      edges included."
 *   - "Schema review confirms no ordered step array anywhere."
 *
 * A schema review that happens once, by eye, decays. These run on every commit.
 */

const schema = walk(PRISMA_SCHEMA_DIR, ['.prisma'])
  .map((file) => read(file))
  .join('\n')

function modelBody(name: string): string {
  const match = new RegExp(`\\nmodel ${name} \\{([\\s\\S]*?)\\n\\}`).exec(schema)
  return match?.[1] ?? ''
}

const modelNames = [...schema.matchAll(/\nmodel (\w+) \{/g)].map((m) => m[1] ?? '')

/** Everything a contributor can change, and therefore everything that needs history. */
const REVISABLE_MODELS = ['Route', 'Step', 'StepEdge', 'Field'] as const

describe('every revisable model has a revision model', () => {
  it.each(REVISABLE_MODELS)('%s has a matching %sRevision', (model) => {
    expect(modelNames).toContain(model)
    expect(
      modelNames,
      `${model} is revisable, so ${model}Revision must exist — otherwise its changes are undiffable`,
    ).toContain(`${model}Revision`)
  })

  it('includes StepEdge, so a branch change is diffable', () => {
    // The one most likely to be forgotten. Without versioned edges a route can change shape
    // and the shadow route can only report "some fields changed" (Phase 1, Spike B).
    expect(REVISABLE_MODELS).toContain('StepEdge')
    expect(modelNames).toContain('StepEdgeRevision')
  })

  it.each(REVISABLE_MODELS)('%sRevision chains to a previous revision', (model) => {
    expect(modelBody(`${model}Revision`)).toContain('previousRevisionId')
  })

  it.each(REVISABLE_MODELS)('%sRevision records who made the change and why', (model) => {
    const body = modelBody(`${model}Revision`)
    expect(body).toContain('authorId')
    expect(body).toContain('reason')
  })

  it.each(REVISABLE_MODELS)('%s points at its current revision explicitly', (model) => {
    // "Newest by timestamp" is ambiguous under concurrent edits; a pointer is not.
    expect(modelBody(model)).toContain('currentRevisionId')
  })

  it.each(REVISABLE_MODELS)('%sRevision does not make previousRevisionId unique', (model) => {
    // Two revisions sharing a parent IS a concurrent edit. A unique constraint here would
    // make the database reject the second contributor's work (invariant 2, BR-21).
    const body = modelBody(`${model}Revision`)
    expect(body).not.toMatch(/previousRevisionId\s+String\?\s+@unique/)
  })

  it.each(REVISABLE_MODELS)('%s can be archived rather than deleted', (model) => {
    expect(modelBody(model)).toContain('archivedAt')
  })

  it.each(REVISABLE_MODELS)('%sRevision refuses deletion of the thing it describes', (model) => {
    // onDelete: Restrict makes "history is never destroyed" a database property rather than
    // a convention someone can forget (invariants 1, 2, 4).
    expect(modelBody(`${model}Revision`)).toContain('onDelete: Restrict')
  })
})

describe('ordering lives in edges, never in a position column', () => {
  const FORBIDDEN = [
    'orderIndex',
    'order_index',
    'sortOrder',
    'sort_order',
    'position',
    'sequence',
    'stepNumber',
    'step_number',
    'displayOrder',
  ]

  it.each(FORBIDDEN)('the schema declares no "%s" field', (name) => {
    // Matches a field declaration, not prose: a comment explaining why ordering is not
    // stored must not fail the test that enforces it.
    const declaration = new RegExp(`^\\s+${name}\\s+\\w`, 'm')
    expect(
      declaration.test(schema),
      `"${name}" looks like a stored ordering. Ordering is derived from StepEdge on every read (invariant 22, FR-57).`,
    ).toBe(false)
  })

  it('models step connections as their own table with a typed kind', () => {
    expect(modelNames).toContain('StepEdge')
    const body = modelBody('StepEdge')
    expect(body).toContain('fromStepId')
    expect(body).toContain('toStepId')
    expect(modelBody('StepEdgeRevision')).toContain('kind StepEdgeKind')
  })

  it('expresses overlap through timing, not through position', () => {
    const body = modelBody('StepRevision')
    expect(body).toContain('earliestStartOffsetDays')
    expect(body).toContain('typicalDurationDays')
  })
})

describe('the schema collects no personal documents (invariant 7, §24.1)', () => {
  const FORBIDDEN = [
    'passport',
    'transcript',
    'certificate',
    'bankStatement',
    'bank_statement',
    'visaDocument',
    'admissionLetter',
    'homeAddress',
    'residentialAddress',
    'dateOfBirth',
    'nationalId',
    'attachment',
    'upload',
    'fileUrl',
  ]

  it.each(FORBIDDEN)('the schema declares no "%s" field', (name) => {
    const declaration = new RegExp(`^\\s+${name}\\w*\\s+\\w`, 'im')
    expect(
      declaration.test(schema),
      `"${name}" is data this platform must never collect (CLAUDE.md invariant 7).`,
    ).toBe(false)
  })

  it('has no model whose name suggests file storage', () => {
    for (const name of modelNames) {
      expect(name.toLowerCase()).not.toMatch(/attachment|upload|document_?file|blob/)
    }
  })
})
