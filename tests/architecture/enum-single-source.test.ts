import { describe, expect, it } from 'vitest'

import { DOMAIN_ENUMS } from '../../src/domain/enums'
import { ENUM_SOURCE_PATH } from '../../scripts/paths'
import { read, walk } from '../support/source-files'

/**
 * Phase 0 exit criterion (Phases.md):
 *   "A test fails the build if any enum literal appears in more than one source file."
 *
 * Backing rule, CLAUDE.md §9:
 *   "Enums live in one place and are shared by the Prisma schema, TypeScript types and UI
 *    labels. Never duplicate a status string literal across files."
 *
 * The failure mode this guards against is a hardcoded comparison or default drifting away
 * from the enum — `if (field.sourceClass === 'official')` written into a component, then
 * left behind when the enum changes.
 *
 * How the match is scoped, and why:
 *
 *   It matches enum values written as QUOTED STRING LITERALS ('x', "x", `x`). That is the
 *   exact shape of the failure mode above.
 *
 *   It does not match unquoted object keys, which is deliberate and load-bearing. The i18n
 *   label maps in src/i18n/dictionaries/*.ts are typed `satisfies Record<FieldCategory,
 *   string>`, so TypeScript already refuses to compile a dictionary missing a value,
 *   carrying an unknown one, or otherwise drifted. Those maps cannot go stale, so treating
 *   their keys as a rival "source" would be noise. The ESLint rule `quote-props: as-needed`
 *   keeps such keys unquoted, so a literal cannot hide behind quotes in a label map either.
 *
 *   It does not match prose in comments, because prose cannot drift into behaviour.
 */

/** The one file permitted to contain a domain enum literal as a quoted string. */
const SINGLE_SOURCE = ENUM_SOURCE_PATH

const QUOTES = ["'", '"', '`'] as const

const sourceFiles = walk('src', ['.ts', '.tsx'])

function containsQuotedLiteral(contents: string, value: string): boolean {
  return QUOTES.some((quote) => contents.includes(quote + value + quote))
}

const allValues = Object.entries(DOMAIN_ENUMS).flatMap(([enumName, values]) =>
  values.map((value) => ({ enumName, value })),
)

describe('domain enums have a single source', () => {
  it('finds application source files to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(5)
    expect(sourceFiles).toContain(SINGLE_SOURCE)
  })

  it('declares at least one value for every registered enum', () => {
    for (const [enumName, values] of Object.entries(DOMAIN_ENUMS)) {
      expect(values.length, `${enumName} is empty`).toBeGreaterThan(0)
    }
    expect(allValues.length).toBeGreaterThan(0)
  })

  it.each(allValues)('$enumName value "$value" is written in exactly one file', ({ value }) => {
    const offenders = sourceFiles.filter(
      (file) => file !== SINGLE_SOURCE && containsQuotedLiteral(read(file), value),
    )

    expect(
      offenders,
      `Enum literal "${value}" is hardcoded outside ${SINGLE_SOURCE}. ` +
        `Import it from there instead (CLAUDE.md §9). Offending files: ${offenders.join(', ')}`,
    ).toEqual([])
  })

  it('detects a literal that is duplicated, so the check itself is not vacuous', () => {
    const [sample] = allValues
    expect(sample).toBeDefined()
    const value = sample?.value ?? ''

    expect(containsQuotedLiteral(read(SINGLE_SOURCE), value)).toBe(true)
    expect(containsQuotedLiteral(`const x = "${value}"`, value)).toBe(true)
    expect(containsQuotedLiteral(`const x = ${value}`, value)).toBe(false)
    expect(containsQuotedLiteral(`const x = "prefix_${value}_suffix"`, value)).toBe(false)
  })

  it('has no duplicate values inside a single enum', () => {
    for (const [enumName, values] of Object.entries(DOMAIN_ENUMS)) {
      expect(new Set(values).size, `${enumName} has duplicate values`).toBe(values.length)
    }
  })

  it('uses only values that are valid Prisma and Postgres enum identifiers', () => {
    for (const [enumName, values] of Object.entries(DOMAIN_ENUMS)) {
      for (const value of values) {
        expect(value, `${enumName}.${value} is not a valid enum identifier`).toMatch(
          /^[a-z][a-z0-9_]*$/,
        )
      }
    }
  })
})
