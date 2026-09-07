/**
 * Re-applies the disposable marker after a Neon branch reset.
 *
 * `neon branches reset test --parent` copies the parent branch, and the parent is production —
 * which has never carried this row and must never be given it (ci/mark-test-database.sql). So a
 * reset leaves the test branch *unmarked*, and every guard in the project then correctly refuses
 * to write to it. This puts the marker back.
 *
 * Run: npx dotenv -e .env.test.local -- node scripts/mark-test-branch.mjs
 */
import { PrismaClient } from '@prisma/client'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const prisma = new PrismaClient()
const existing = await prisma.route.count()
if (existing > 0) {
  // A branch with routes on it might be production. Refuse rather than guess.
  throw new Error(`Refusing: this database already holds ${existing} routes. Reset it first.`)
}

await prisma.$executeRawUnsafe(
  `insert into platform_meta (key, value, "updatedAt") values ('environment','test',now())
   on conflict (key) do update set value='test', "updatedAt"=now()`,
)
const marker = await prisma.platformMeta.findUnique({ where: { key: 'environment' } })
console.log(`marker: ${marker?.value}`)
await prisma.$disconnect()
