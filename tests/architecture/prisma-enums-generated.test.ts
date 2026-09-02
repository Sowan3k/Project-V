import { describe, expect, it } from 'vitest'

import { DOMAIN_ENUMS } from '../../src/domain/enums'
import { PRISMA_ENUMS_PATH, PRISMA_SCHEMA_DIR } from '../../scripts/paths'
import { renderPrismaEnums } from '../../scripts/prisma-enum-source'
import { read, walk } from '../support/source-files'

/**
 * Line endings are normalised before comparing. .gitattributes pins the repository to LF,
 * but an editor or a misconfigured clone can still hand us CRLF, and that is a checkout
 * detail rather than a drifted enum.
 */
const lf = (value: string): string => value.replaceAll('\r\n', '\n')

/**
 * The Prisma half of the single-source rule (CLAUDE.md §9).
 *
 * src/domain/enums.ts is written by hand; prisma/schema/enums.prisma is projected from it
 * by `npm run prisma:enums`. This test fails the build the moment the checked-in Prisma
 * file stops matching the TypeScript source, so the database vocabulary and the application
 * vocabulary cannot silently diverge.
 */
describe('prisma enums are generated from the domain enums', () => {
  it('matches the current generator output byte for byte', () => {
    expect(
      lf(read(PRISMA_ENUMS_PATH)),
      `${PRISMA_ENUMS_PATH} is stale. Run \`npm run prisma:enums\` and commit the result.`,
    ).toBe(lf(renderPrismaEnums()))
  })

  it('is marked as generated so nobody edits it by hand', () => {
    expect(read(PRISMA_ENUMS_PATH)).toContain('GENERATED FILE - DO NOT EDIT')
  })

  it('declares every registered enum in the Prisma schema', () => {
    const contents = lf(read(PRISMA_ENUMS_PATH))
    for (const [enumName, values] of Object.entries(DOMAIN_ENUMS)) {
      expect(contents, `Prisma enum ${enumName} is missing`).toContain(`enum ${enumName} {`)
      for (const value of values) {
        expect(contents, `Prisma enum ${enumName} is missing value ${value}`).toContain(
          `\n  ${value}\n`,
        )
      }
    }
  })

  it('keeps hand-written schema files free of domain enum declarations', () => {
    const handWritten = walk(PRISMA_SCHEMA_DIR, ['.prisma']).filter(
      (file) => file !== PRISMA_ENUMS_PATH,
    )

    expect(handWritten.length).toBeGreaterThan(0)

    for (const file of handWritten) {
      for (const enumName of Object.keys(DOMAIN_ENUMS)) {
        expect(
          read(file),
          `${file} redeclares enum ${enumName}. It belongs in ${PRISMA_ENUMS_PATH}, generated from src/domain/enums.ts.`,
        ).not.toContain(`enum ${enumName}`)
      }
    }
  })
})
