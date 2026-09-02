import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { walk } from '../support/source-files'

/**
 * Phase 0 exit criterion: "Zero `any` in `src/`; lint rule enforces it."
 *
 * `npm run lint` already fails on an explicit `any` in src/. This test asserts the rule is
 * configured as an error there — so the criterion survives someone relaxing the config, not
 * only someone writing `any`.
 */
describe('no explicit any in src/', () => {
  it('configures @typescript-eslint/no-explicit-any as an error for src files', async () => {
    const eslint = new ESLint({})
    const config = (await eslint.calculateConfigForFile('src/lib/prisma.ts')) as {
      rules?: Record<string, unknown[]>
    }

    const severity = config.rules?.['@typescript-eslint/no-explicit-any']?.[0]
    expect(severity, 'no-explicit-any must be an error (2) for src/**').toBe(2)
  })

  it('has no explicit any in the current source tree', () => {
    const eslint = new ESLint({})
    const files = walk('src', ['.ts', '.tsx'])
    expect(files.length).toBeGreaterThan(5)

    return eslint.lintFiles(files).then((results) => {
      const offences = results.flatMap((result) =>
        result.messages
          .filter((message) => message.ruleId === '@typescript-eslint/no-explicit-any')
          .map((message) => `${result.filePath}:${message.line}`),
      )
      expect(offences).toEqual([])
    })
  })
})
