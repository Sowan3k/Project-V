/**
 * Renders the Prisma enum block from the single source of truth in `src/domain/enums.ts`.
 *
 * Kept separate from the generator script so the script and the staleness test produce
 * byte-identical output from one function.
 */
import { DOMAIN_ENUMS } from '../src/domain/enums'

export const GENERATED_ENUM_HEADER = [
  '// ---------------------------------------------------------------------------',
  '// GENERATED FILE - DO NOT EDIT.',
  '//',
  '// Source of truth: src/domain/enums.ts',
  '// Regenerate with: npm run prisma:enums',
  '//',
  '// Editing this file by hand breaks the single-source-of-truth rule in CLAUDE.md §9',
  '// and will fail tests/architecture/prisma-enums-generated.test.ts.',
  '// ---------------------------------------------------------------------------',
].join('\n')

export function renderPrismaEnums(): string {
  const blocks = Object.entries(DOMAIN_ENUMS).map(([name, values]) => {
    const lines = values.map((value) => `  ${value}`).join('\n')
    return `enum ${name} {\n${lines}\n}`
  })

  return `${GENERATED_ENUM_HEADER}\n\n${blocks.join('\n\n')}\n`
}
