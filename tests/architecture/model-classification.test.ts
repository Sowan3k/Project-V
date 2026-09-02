import { describe, expect, it } from 'vitest'

import {
  MODEL_CLASSIFICATION,
  PRIVATE_USER_STATE_MODELS,
  REVISIONED_SHARED_MODELS,
  REVISION_MODELS,
  classifyModel,
} from '../../src/domain/models'
import { PRISMA_SCHEMA_DIR } from '../../scripts/paths'
import { read, walk } from '../support/source-files'

/**
 * The boundary between shared community knowledge and private user state.
 *
 * Shared knowledge is revisioned, append-only, and public. Private journey state is edited
 * in place, belongs to one person, and is visible to nobody else (FR-26, BR-16, D-10,
 * invariant 5). Routing private progress through the public revision engine would put a
 * follower's notes into a public history — the single worst privacy failure this product
 * could have.
 *
 * The classification is exhaustive on purpose. A new model fails this test until somebody
 * decides which side it is on, so when Phase 7 adds `Journey` the decision is made rather
 * than inherited from whichever file was copied.
 */

const schema = walk(PRISMA_SCHEMA_DIR, ['.prisma'])
  .map((file) => read(file))
  .join('\n')

const schemaModels = [...schema.matchAll(/\nmodel (\w+) \{/g)].map((m) => m[1] ?? '')

describe('every persisted model is classified', () => {
  it('finds the models in the schema', () => {
    expect(schemaModels.length).toBeGreaterThan(5)
  })

  it.each(schemaModels)('%s is classified', (model) => {
    expect(
      classifyModel(model),
      `${model} exists in the schema but src/domain/models.ts does not classify it. ` +
        `Decide: is it revisioned shared knowledge, private user state, or supporting? ` +
        `Getting this wrong is how a private journey note ends up in a public history.`,
    ).not.toBeNull()
  })

  it('classifies nothing that does not exist, so the registry cannot rot', () => {
    const classified = Object.values(MODEL_CLASSIFICATION).flatMap((m) => [...m])
    const phantom = classified
      // Journey models are declared ahead of Phase 7 on purpose.
      .filter((m) => !(PRIVATE_USER_STATE_MODELS as readonly string[]).includes(m))
      .filter((m) => !schemaModels.includes(m))
    expect(phantom).toEqual([])
  })

  it('puts each model in exactly one class', () => {
    const counts = new Map<string, number>()
    for (const models of Object.values(MODEL_CLASSIFICATION)) {
      for (const model of models) counts.set(model, (counts.get(model) ?? 0) + 1)
    }
    expect([...counts.entries()].filter(([, n]) => n > 1)).toEqual([])
  })
})

describe('private user state never becomes revisioned shared knowledge', () => {
  it('keeps the two sets disjoint', () => {
    const overlap = PRIVATE_USER_STATE_MODELS.filter((m) =>
      (REVISIONED_SHARED_MODELS as readonly string[]).includes(m),
    )
    expect(
      overlap,
      'A private journey model was classified as shared knowledge. Progress, dates and ' +
        'notes are private to one user and must never enter a public revision history ' +
        '(FR-26, BR-16, invariant 5).',
    ).toEqual([])
  })

  it('classifies any Journey model in the schema as private, never as shared', () => {
    // Vacuous until Phase 7, then load-bearing. If Journey lands in the revisioned set, this
    // fails before anything can be written through the wrong path.
    const journeyish = schemaModels.filter((m) => /journey/i.test(m))
    for (const model of journeyish) {
      expect(classifyModel(model), `${model} must be private user state`).toBe('privateUserState')
    }
  })

  it('gives the revision engine no surface for private state', () => {
    for (const model of PRIVATE_USER_STATE_MODELS) {
      expect((REVISION_MODELS as readonly string[]).includes(model)).toBe(false)
    }
  })

  it('names a revision model for each revisable shared entity and nothing else', () => {
    expect([...REVISION_MODELS].sort()).toEqual(
      ['FieldRevision', 'RouteRevision', 'StepEdgeRevision', 'StepRevision'].sort(),
    )
    for (const model of REVISION_MODELS) {
      expect((REVISIONED_SHARED_MODELS as readonly string[]).includes(model)).toBe(true)
    }
  })
})

describe('the revision service is the only module that writes shared knowledge', () => {
  it('confines write calls on revisioned models to src/server/revisions', () => {
    // Belt and braces alongside the ESLint boundary: even inside src/server, only the
    // revision service should be issuing writes to these models.
    const writeCall = /\b(?:tx|prisma)\.(route|routeRevision|step|stepRevision|stepEdge|stepEdgeRevision|field|fieldRevision)\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\b/

    const offenders = walk('src', ['.ts', '.tsx'])
      .filter((file) => !file.startsWith('src/server/revisions/'))
      .filter((file) => writeCall.test(read(file)))

    expect(
      offenders,
      `These files write revisioned models directly. Route the change through ` +
        `src/server/revisions/service.ts so it appends a revision with its author and ` +
        `reason inside one transaction.`,
    ).toEqual([])
  })
})
