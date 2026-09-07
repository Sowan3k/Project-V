#!/usr/bin/env node
/**
 * Grant or revoke the administrator role — Phase 13, A3.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Why this is a script and not a page.**
 *
 * The moderation queues have existed since Phase 11. The role they check has existed since
 * Phase 7. There has never been a way to *grant* it — so on the day this launches, a reported
 * phishing link cannot be withheld by anybody, because nobody is an administrator.
 *
 * The obvious fix is an admin screen for managing roles. That is the wrong shape here, for the
 * same reason CLAUDE.md §10.2 gives for refusing an admin "delete route": a capability built
 * for a one-off need outlives the need. A page that grants the safety role is a page that can
 * grant the safety role to anybody, for ever, reachable by whoever holds it that year. This
 * runs once, from a workstation, by somebody holding the production credential — which is the
 * honest description of what the action actually is.
 *
 * §23.3 confines this role to "safety, disputes, abuse, annual maintenance and exceptional
 * cases". It gates quarantine and report handling and nothing else: ordinary contribution is
 * deliberately outside its reach, there is no approval queue, and an administrator cannot
 * delete shared knowledge — the ESLint boundary, the Prisma write guard and the Postgres
 * triggers refuse that to everyone, role or no role.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Usage** — from a workstation, against whichever database the env file names:
 *
 *     npm run admin:list
 *     npm run admin:grant  -- --handle <handle>
 *     npm run admin:revoke -- --handle <handle>
 *
 * It identifies people by **handle**, never by email. The email is the one value in this
 * database that names a real person (§24.2), and a maintenance script is not a reason to put
 * one on a terminal, into shell history, or into a screenshot pasted somewhere. The handle is
 * on the person's own account page, which is where they can read it to you.
 *
 * Every run prints the database host it is about to touch and requires `--yes` to write, so
 * "which database was that?" is answered before the change rather than after.
 */

import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

import { PrismaClient } from '@prisma/client'

const args = process.argv.slice(2)

function flag(name) {
  const index = args.indexOf(`--${name}`)
  if (index === -1) return undefined
  const value = args[index + 1]
  return value !== undefined && !value.startsWith('--') ? value : true
}

const command = args.find((argument) => !argument.startsWith('--'))
const handle = flag('handle')
const assumeYes = flag('yes') === true

/**
 * The host, without the credential.
 *
 * This repository is public (CLAUDE.md §4): never print a connection string, and never print
 * a hostname that identifies a specific Neon endpoint into anything that might be committed.
 * A terminal is not a tracked file, but the habit is the protection — so this prints enough to
 * tell production from test and no more.
 */
function describeTarget() {
  const url = process.env.DATABASE_URL ?? ''
  const match = /@([^/:]+)/.exec(url)
  const host = match?.[1] ?? '(unknown)'
  const branch = process.env.NEON_BRANCH ?? '(branch not named in the environment)'
  return { branch, pooled: host.includes('-pooler') }
}

async function main() {
  if (command === undefined || !['list', 'grant', 'revoke'].includes(command)) {
    console.error('Usage: grant-administrator.mjs <list|grant|revoke> [--handle <handle>] [--yes]')
    process.exitCode = 1
    return
  }

  const prisma = new PrismaClient()
  const target = describeTarget()

  try {
    /*
     * Neon scales to zero and a cold branch takes 25–30 seconds to wake, while Prisma's
     * connect timeout is 10 (CLAUDE.md §4). A script that tried once would report an
     * unreachable database for one that is merely asleep.
     */
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        await prisma.$queryRaw`select 1`
        break
      } catch (error) {
        if (attempt === 4) throw error
        console.log(`database asleep, retrying (${attempt}/3)…`)
      }
    }

    console.log(`branch: ${target.branch}`)
    console.log(`connection: ${target.pooled ? 'pooled' : 'direct'}`)
    console.log('')

    if (command === 'list') {
      const admins = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { handle: true, createdAt: true, closedAt: true },
        orderBy: { createdAt: 'asc' },
      })
      if (admins.length === 0) {
        console.log('No administrators. Nobody can act on a report or a quarantine.')
      } else {
        console.log(`${admins.length} administrator(s):`)
        for (const admin of admins) {
          const closed = admin.closedAt === null ? '' : '  (account closed)'
          console.log(`  ${admin.handle}  since ${admin.createdAt.toISOString().slice(0, 10)}${closed}`)
        }
      }
      return
    }

    if (typeof handle !== 'string' || handle.length === 0) {
      console.error(`${command} needs --handle <handle>`)
      process.exitCode = 1
      return
    }

    const user = await prisma.user.findUnique({
      where: { handle },
      select: { id: true, handle: true, role: true, closedAt: true },
    })

    if (user === null) {
      console.error(`No account with handle "${handle}" on this branch.`)
      process.exitCode = 1
      return
    }

    // A closed account cannot be signed into, so a role on one is unreachable — and granting
    // it would leave a misleading row for whoever reads this list next.
    if (user.closedAt !== null) {
      console.error(`"${handle}" has closed their account. Granting a role to it does nothing.`)
      process.exitCode = 1
      return
    }

    const next = command === 'grant' ? 'admin' : 'member'
    if (user.role === next) {
      console.log(`"${handle}" is already ${next}. Nothing to do.`)
      return
    }

    console.log(`${handle}: ${user.role} → ${next}`)

    if (!assumeYes) {
      const rl = createInterface({ input: stdin, output: stdout })
      const answer = await rl.question('Apply this to the branch above? (yes/no) ')
      rl.close()
      if (answer.trim().toLowerCase() !== 'yes') {
        console.log('Nothing changed.')
        return
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { role: next } })
    console.log(`Done. "${handle}" is now ${next}.`)
    console.log('')
    console.log(
      next === 'admin'
        ? 'They will see a Moderation link in the header on their next page load.'
        : 'The moderation queues now answer 404 to them, as they do to everybody else.',
    )
  } finally {
    await prisma.$disconnect()
  }
}

await main()
