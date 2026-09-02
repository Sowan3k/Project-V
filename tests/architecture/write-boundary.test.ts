import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

import config, { DB_CLIENT_MODULES, WRITE_BOUNDARY_CONFIG_NAME } from '../../eslint.config.mjs'
import { REVISIONED_SHARED_MODELS, PRIVATE_USER_STATE_MODELS } from '../../src/domain/models'
import { checkWrite } from '../../src/server/write-guard'
import { read, walk } from '../support/source-files'

/**
 * Phase 3: "the revision write engine is the only normal application write path for shared
 * community knowledge."
 *
 * Three layers enforce that, and this file tests the two that do not need a database. The
 * third — Postgres triggers — is exercised in tests/db/revision-service.db.test.ts, because
 * only a real database can prove a trigger fires.
 */

type FlatConfigEntry = { name?: string; files?: unknown; ignores?: unknown; rules?: Record<string, unknown> }

const entry = (config as unknown as FlatConfigEntry[]).find(
  (item) => item.name === WRITE_BOUNDARY_CONFIG_NAME,
)

async function lint(code: string, filePath: string): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      { files: ['**/*.ts', '**/*.tsx'], languageOptions: { parser: tseslint.parser } },
      { ...entry, files: ['src/**/*.ts', 'src/**/*.tsx'], ignores: ['src/server/**'] },
    ] as ESLint.Options['overrideConfig'],
  })
  return eslint.lintText(code, { filePath })
}

describe('layer 1 — application code cannot reach a database client', () => {
  it('ships the boundary rule', () => {
    expect(entry, `ESLint entry "${WRITE_BOUNDARY_CONFIG_NAME}" is missing`).toBeDefined()
    expect(entry?.rules?.['no-restricted-imports']).toBeDefined()
  })

  it.each(DB_CLIENT_MODULES)('rejects importing %s from a route handler', async (module) => {
    const [result] = await lint(
      `import { prisma } from '${module}'\nexport const GET = () => prisma\n`,
      'src/app/api/routes/route.ts',
    )
    expect((result?.messages ?? []).map((m) => m.ruleId)).toContain('no-restricted-imports')
  })

  it.each(DB_CLIENT_MODULES)('rejects importing %s from a component', async (module) => {
    const [result] = await lint(
      `import { prisma } from '${module}'\nexport const X = () => prisma\n`,
      'src/components/thing.tsx',
    )
    expect((result?.messages ?? []).map((m) => m.ruleId)).toContain('no-restricted-imports')
  })

  it('allows the server layer, which is where the revision service lives', async () => {
    const [result] = await lint(
      "import { prisma } from '@/server/db/client'\nexport const x = prisma\n",
      'src/server/revisions/service.ts',
    )
    expect(result?.messages ?? []).toEqual([])
  })

  it('explains what to do instead, rather than only refusing', async () => {
    const [result] = await lint(
      "import { prisma } from '@prisma/client'\nexport const x = prisma\n",
      'src/app/page.tsx',
    )
    const message = result?.messages[0]?.message ?? ''
    expect(message).toContain('revision service')
    expect(message).toContain('src/server')
  })

  it('is actually true of the codebase today, not just configured', () => {
    // The rule can only protect files it covers. This checks the real tree: nothing outside
    // src/server imports a client, so there is no pre-existing violation being tolerated.
    const offenders = walk('src', ['.ts', '.tsx'])
      .filter((file) => !file.startsWith('src/server/'))
      .filter((file) => /from '(@prisma\/client|@\/server\/db\/client)'/.test(read(file)))
    expect(offenders).toEqual([])
  })
})

describe('layer 2 — the runtime guard refuses writes made outside the service', () => {
  const inContext = true
  const outside = false

  it.each(REVISIONED_SHARED_MODELS)('refuses %s.create outside the service context', (model) => {
    const verdict = checkWrite(model, 'create', outside)
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toContain('revision service')
  })

  it.each(REVISIONED_SHARED_MODELS)('allows %s.create inside the service context', (model) => {
    expect(checkWrite(model, 'create', inContext).allowed).toBe(true)
  })

  it.each(REVISIONED_SHARED_MODELS)('refuses %s.delete even inside the service', (model) => {
    // There is no sanctioned hard delete. Obsolete content is archived (invariants 1, 4).
    const verdict = checkWrite(model, 'delete', inContext)
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toContain('never hard-deleted')
  })

  it.each(REVISIONED_SHARED_MODELS)('refuses %s.deleteMany even inside the service', (model) => {
    expect(checkWrite(model, 'deleteMany', inContext).allowed).toBe(false)
  })

  it.each(['RouteRevision', 'StepRevision', 'StepEdgeRevision', 'FieldRevision'])(
    'refuses %s.update even inside the service — revisions are immutable',
    (model) => {
      const verdict = checkWrite(model, 'update', inContext)
      expect(verdict.allowed).toBe(false)
      if (!verdict.allowed) expect(verdict.reason).toContain('immutable')
    },
  )

  it.each(['RouteRevision', 'FieldRevision'])('refuses %s.upsert, which can update', (model) => {
    expect(checkWrite(model, 'upsert', inContext).allowed).toBe(false)
  })

  it('allows reads of shared knowledge from anywhere — anonymous access is the point', () => {
    for (const op of ['findMany', 'findUnique', 'findFirst', 'count', 'aggregate', 'groupBy']) {
      expect(checkWrite('Field', op, outside).allowed, `${op} should be readable`).toBe(true)
    }
  })

  it('does not restrict private user state (invariant 5)', () => {
    // A journey note is not a contribution. It must be editable in place, by its owner, and
    // must never travel through the public revision engine.
    for (const model of PRIVATE_USER_STATE_MODELS) {
      for (const op of ['create', 'update', 'delete', 'deleteMany']) {
        expect(checkWrite(model, op, outside).allowed, `${model}.${op}`).toBe(true)
      }
    }
  })

  it('does not restrict supporting models', () => {
    expect(checkWrite('User', 'create', outside).allowed).toBe(true)
    expect(checkWrite('PlatformMeta', 'update', outside).allowed).toBe(true)
  })
})
