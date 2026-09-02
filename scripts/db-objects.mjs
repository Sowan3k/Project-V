/**
 * Prints the current database's user-visible objects: tables, enum types and row counts.
 * Used to evidence "a migration applies with no data loss" (Phases.md, Phase 0).
 *
 * Usage: npm run db:objects            (the linked branch, from .env.local)
 *        DATABASE_URL=... node scripts/db-objects.mjs   (any other branch)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const tables = await prisma.$queryRawUnsafe(
  `select table_schema, table_name from information_schema.tables
   where table_schema not in ('pg_catalog','information_schema')
   order by table_schema, table_name`,
)

const enums = await prisma.$queryRawUnsafe(
  `select t.typname as enum_name, count(e.enumlabel)::int as value_count
   from pg_type t
   join pg_enum e on e.enumtypid = t.oid
   join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public'
   group by t.typname order by t.typname`,
)

const counts = []
for (const table of tables) {
  if (table.table_schema !== 'public') continue
  const [row] = await prisma.$queryRawUnsafe(
    `select count(*)::int as n from "${table.table_schema}"."${table.table_name}"`,
  )
  counts.push(`${table.table_name}=${row.n}`)
}

console.log(JSON.stringify({ tables, enums, counts }, null, 2))
await prisma.$disconnect()
