import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { walk } from '../support/source-files'

/**
 * Phase 0 exit criterion: "Zero `any` in `src/`; lint rule enforces it."
 *
 * `npm run lint` already fails on an explicit `any` in src/. These assertions add the part
 * lint cannot check about itself — that the rule is still configured as an error — so the
 * criterion survives someone relaxing the config, not only someone writing `any`.
 *
 * Both cases run ESLint programmatically with type-aware linting, which takes seconds and
 * scales with the size of src/. The default 5s Vitest timeout is not enough on a loaded
 * machine, so each is given an explicit generous budget: a slow architecture test failing
 * on a timer would be a flake that teaches people to re-run rather than to look.
 */
const LINT_TIMEOUT_MS = 120_000

describe('no explicit any in src/', () => {
  it(
    'configures @typescript-eslint/no-explicit-any as an error for src files',
    async () => {
      const eslint = new ESLint({})
      const config = (await eslint.calculateConfigForFile('src/lib/prisma.ts')) as {
        rules?: Record<string, unknown[]>
      }

      const severity = config.rules?.['@typescript-eslint/no-explicit-any']?.[0]
      expect(severity, 'no-explicit-any must be an error (2) for src/**').toBe(2)
    },
    LINT_TIMEOUT_MS,
  )

  it(
    'has no explicit any in the current source tree',
    async () => {
      const eslint = new ESLint({})
      const files = walk('src', ['.ts', '.tsx'])
      expect(files.length).toBeGreaterThan(5)

      const results = await eslint.lintFiles(files)
      const offences = results.flatMap((result) =>
        result.messages
          .filter((message) => message.ruleId === '@typescript-eslint/no-explicit-any')
          .map((message) => `${result.filePath}:${message.line}`),
      )

      expect(offences).toEqual([])
    },
    LINT_TIMEOUT_MS,
  )
})
