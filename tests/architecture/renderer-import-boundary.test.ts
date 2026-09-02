import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

import config, {
  RENDERER_BOUNDARY_CONFIG_NAME,
  RENDERER_FORBIDDEN_IMPORT_GROUPS,
} from '../../eslint.config.mjs'

/**
 * Test 24c in Test.md — the dependency boundary behind CLAUDE.md §6 invariant 24:
 *
 *   "The renderer module may not import from seed, content or destination modules —
 *    enforced by an ESLint import-boundary rule, not by convention."
 *
 * The renderer itself does not exist until Phase 4. Phase 0 arms the rule so the boundary
 * is enforced the moment it does, rather than being retrofitted. A rule nobody has proved
 * fires is a rule that quietly does nothing, so this test lints a probe file against the
 * real config entry and asserts both the violation and the control case.
 *
 * The probe is linted in isolation from the type-aware config, because a type-aware parser
 * would reject a path that does not exist on disk. `no-restricted-imports` is a syntactic
 * rule, so linting it without type information tests exactly the rule under test.
 */
type FlatConfigEntry = { name?: string; files?: unknown; rules?: Record<string, unknown> }

const entry = (config as unknown as FlatConfigEntry[]).find(
  (item) => item.name === RENDERER_BOUNDARY_CONFIG_NAME,
)

async function lint(code: string): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: { parser: tseslint.parser },
      },
      { ...entry, files: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx'] },
    ] as ESLint.Options['overrideConfig'],
  })

  return eslint.lintText(code, { filePath: 'src/renderer/probe.ts' })
}

describe('renderer import boundary', () => {
  it('is present in the shipped ESLint config', () => {
    expect(entry, `ESLint config entry "${RENDERER_BOUNDARY_CONFIG_NAME}" is missing`).toBeDefined()
    expect(entry?.rules?.['no-restricted-imports']).toBeDefined()
  })

  it('covers seed, content and destination modules', () => {
    expect(RENDERER_FORBIDDEN_IMPORT_GROUPS).toEqual(['seed', 'content', 'destinations'])
  })

  it.each(RENDERER_FORBIDDEN_IMPORT_GROUPS)(
    'rejects a renderer import from @/%s',
    async (group) => {
      const [result] = await lint(`import { thing } from '@/${group}/anything'\nexport const x = thing\n`)
      const messages = result?.messages ?? []

      expect(
        messages.map((message) => message.ruleId),
        `Importing @/${group} from src/renderer must be an ESLint error (invariant 24)`,
      ).toContain('no-restricted-imports')
    },
  )

  it.each(RENDERER_FORBIDDEN_IMPORT_GROUPS)(
    'rejects a renderer relative import into ../%s',
    async (group) => {
      const [result] = await lint(`import { thing } from '../${group}/anything'\nexport const x = thing\n`)
      expect((result?.messages ?? []).map((message) => message.ruleId)).toContain(
        'no-restricted-imports',
      )
    },
  )

  it('allows the renderer to import route-agnostic domain code', async () => {
    const [result] = await lint(
      "import { FIELD_CATEGORIES } from '@/domain/enums'\nexport const x = FIELD_CATEGORIES\n",
    )
    expect(result?.messages ?? []).toEqual([])
  })

  it('does not restrict files outside src/renderer', async () => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
        { ...entry, files: ['src/renderer/**/*.ts'] },
      ] as ESLint.Options['overrideConfig'],
    })

    const [result] = await eslint.lintText(
      "import { thing } from '@/seed/routes'\nexport const x = thing\n",
      { filePath: 'src/app/page.ts' },
    )

    expect((result?.messages ?? []).map((message) => message.ruleId)).not.toContain(
      'no-restricted-imports',
    )
  })
})
