import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  assertDisposableDatabase,
  NotADisposableDatabaseError,
  TEST_MARKER_KEY,
  TEST_MARKER_VALUE,
} from '../support/disposable-database'

/**
 * The guard that stops a test run writing into a database nobody proved was disposable —
 * audit F2.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why this is a unit test with an injected reader.**
 *
 * The thing worth proving is the *decision*: which answers permit a write and which refuse
 * one. That decision has five branches and four of them refuse, so a test needing a live
 * Postgres could exercise at most one of them — the happy path — and the four that matter
 * would be the untested ones. Injecting the marker read makes every refusal reachable.
 *
 * The wiring is checked separately below, against the Playwright configuration itself, so a
 * correct guard cannot be left unplugged.
 */

const url = 'postgresql://user:pw@localhost:5432/db'
const context = 'test runner'

async function refusal(check: Parameters<typeof assertDisposableDatabase>[0]): Promise<Error> {
  try {
    await assertDisposableDatabase({ ...check, attempts: 2, delayMs: 0 })
  } catch (error) {
    return error as Error
  }
  throw new Error('expected the guard to refuse, but it permitted the write')
}

describe('the disposable-database guard', () => {
  it('permits a database whose marker says it is a test database', async () => {
    await expect(
      assertDisposableDatabase({
        url,
        context,
        readMarker: () => Promise.resolve(TEST_MARKER_VALUE),
      }),
    ).resolves.toBeUndefined()
  })

  it('refuses a database with no marker row — an ordinary database, which production is', async () => {
    const error = await refusal({ url, context, readMarker: () => Promise.resolve(null) })
    expect(error).toBeInstanceOf(NotADisposableDatabaseError)
    expect(error.message).toContain('(no row)')
    expect(error.message).toContain(`${TEST_MARKER_KEY}=${TEST_MARKER_VALUE}`)
  })

  it('refuses a marker that says something else, and does not retry a real answer', async () => {
    let reads = 0
    const error = await refusal({
      url,
      context,
      readMarker: () => {
        reads += 1
        return Promise.resolve('production')
      },
    })
    expect(error).toBeInstanceOf(NotADisposableDatabaseError)
    expect(error.message).toContain('production')
    // A wrong marker is an answer, not a missing one. Retrying it would only delay the refusal.
    expect(reads).toBe(1)
  })

  it('refuses when the marker cannot be read — unknown is not permission', async () => {
    const error = await refusal({
      url,
      context,
      readMarker: () => Promise.reject(new Error('connect ETIMEDOUT')),
    })
    expect(error).toBeInstanceOf(NotADisposableDatabaseError)
    expect(error.message).toContain('unproven')
  })

  it('retries a failing read before refusing, because a sleeping Neon compute is not an answer', async () => {
    let reads = 0
    await expect(
      assertDisposableDatabase({
        url,
        context,
        attempts: 3,
        delayMs: 0,
        readMarker: () => {
          reads += 1
          return reads < 3
            ? Promise.reject(new Error('connect ETIMEDOUT'))
            : Promise.resolve(TEST_MARKER_VALUE)
        },
      }),
    ).resolves.toBeUndefined()
    expect(reads).toBe(3)
  })

  it('refuses when there is no database URL at all', async () => {
    for (const absent of [undefined, '', '   ']) {
      const error = await refusal({
        url: absent,
        context,
        readMarker: () => Promise.resolve(TEST_MARKER_VALUE),
      })
      expect(error).toBeInstanceOf(NotADisposableDatabaseError)
      expect(error.message).toContain('without a database URL')
    }
  })

  it('never infers safety from a filename', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../support/disposable-database.ts', import.meta.url)),
      'utf8',
    )
    // `.env.test.local` is *named* in the failure message, which is help rather than
    // evidence. What must not exist is any way for the verdict to depend on a filename or an
    // environment label: a file called "test" is exactly as easy to paste the wrong URL into
    // as any other, and NODE_ENV is set by whoever runs the command.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toContain('NODE_ENV')
    expect(code).not.toContain('node:fs')
    expect(code).not.toContain('readFile')
    // The only inputs to the decision are the URL and what the database itself answered.
    expect(code).not.toMatch(/process\.env/)
  })
})

describe('the guard is actually wired into the end-to-end run', () => {
  const config = readFileSync(
    fileURLToPath(new URL('../../playwright.config.ts', import.meta.url)),
    'utf8',
  )

  it('runs the guard as its own project that the seeding project depends on', () => {
    // Within one project Playwright runs files in parallel, so a guard sharing a project with
    // the seed it guards would race it. A dependency is an ordering the runner enforces.
    expect(config).toMatch(/name:\s*'guard'/)
    expect(config).toMatch(/testMatch:\s*\/database-guard\\\.setup\\\.ts\//)
    expect(config).toMatch(/name:\s*'setup'[\s\S]{0,200}dependencies:\s*\[\s*'guard'\s*\]/)
  })

  it('does not reuse an unidentified local server by default', () => {
    // `reuseExistingServer: !process.env.CI` attached the suite to whatever was listening on
    // the port and trusted it — during the audit, a stale process serving uncompiled CSS
    // (F23). Reuse is now opt-in and explicit.
    expect(config).not.toContain('reuseExistingServer: !process.env.CI')
    expect(config).toMatch(/E2E_REUSE_SERVER/)
  })

  it('supplies deterministic local Auth.js configuration rather than degrading to signed-out', () => {
    // Without a secret and a trusted host, every session read returns null and the signed-in
    // specs quietly exercise the signed-out product (F23).
    for (const name of ['AUTH_SECRET', 'AUTH_URL', 'AUTH_TRUST_HOST']) {
      expect(config).toContain(`process.env.${name} ??=`)
    }
  })
})
