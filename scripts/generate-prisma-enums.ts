/**
 * Generates `prisma/schema/enums.prisma` from `src/domain/enums.ts`.
 *
 * The TypeScript module is the only place a domain enum literal is written by hand
 * (CLAUDE.md §9). This script projects it into the Prisma schema so the database, the
 * TypeScript types and the UI labels cannot drift apart.
 *
 * Run: npm run prisma:enums
 * tests/architecture/prisma-enums-generated.test.ts fails the build if the checked-in
 * file is stale.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { PRISMA_ENUMS_PATH } from './paths'
import { renderPrismaEnums } from './prisma-enum-source'

const target = resolve(process.cwd(), PRISMA_ENUMS_PATH)
writeFileSync(target, renderPrismaEnums(), 'utf8')
process.stdout.write(`generated ${PRISMA_ENUMS_PATH}\n`)
