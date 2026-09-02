import { PrismaClient } from '@prisma/client'

/**
 * Wakes a Neon compute before doing anything that assumes it is awake.
 *
 * Neon scales to zero; a cold branch takes roughly 25-30 seconds to accept connections while
 * Prisma's default connect timeout is 10 seconds. The first one or two attempts therefore fail
 * outright, and a command that tries once reports an unreachable database for one that is
 * merely asleep. This cost an afternoon and one wrong diagnosis (Test.md §12).
 *
 * Usage:
 *   node scripts/db/wake.mjs                 # wakes DATABASE_URL
 *   node scripts/db/wake.mjs --unpooled      # wakes DATABASE_URL_UNPOOLED, for migrations
 */
const unpooled = process.argv.includes('--unpooled')
const url = unpooled ? process.env.DATABASE_URL_UNPOOLED : process.env.DATABASE_URL

if (!url) {
  console.error(`${unpooled ? 'DATABASE_URL_UNPOOLED' : 'DATABASE_URL'} is not set`)
  process.exit(1)
}

const prisma = new PrismaClient({ datasources: { db: { url } } })
const ATTEMPTS = 12

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  try {
    await prisma.$queryRawUnsafe('select 1')
    console.log(`awake (${unpooled ? 'direct' : 'pooled'}) on attempt ${attempt}`)
    await prisma.$disconnect()
    process.exit(0)
  } catch {
    if (attempt === ATTEMPTS) break
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

console.error(`still asleep after ${ATTEMPTS} attempts — this is unusual, check Neon`)
process.exit(1)
