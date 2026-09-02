import { join } from 'node:path'

import { defineConfig } from 'prisma/config'

/**
 * Prisma configuration.
 *
 * The schema is a folder, not a single file, so the generated enum block
 * (prisma/schema/enums.prisma) stays a separate, clearly-generated artifact from the
 * hand-written schema (CLAUDE.md §9).
 *
 * Note: a Prisma config file does not auto-load .env files. Every database command in
 * package.json is therefore prefixed with `dotenv -e .env.local --`, which is also what
 * keeps migrations pointed at DATABASE_URL_UNPOOLED (CLAUDE.md §4).
 */
export default defineConfig({
  schema: join('prisma', 'schema'),
  migrations: {
    path: join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
})
