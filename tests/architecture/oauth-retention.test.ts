import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * What a sign-in is allowed to leave behind — audit F13, §24.2, §24.3.
 *
 * The `User` row was minimised from the start: no name, no photograph, no provider id, and a
 * comment explaining that relying on a missing column would be relying on an accident. The
 * `Account` row was not. `PrismaAdapter.linkAccount` is `p.account.create({ data })` with the
 * whole `AdapterAccount`, and the model had somewhere to put every field of it — so Google's
 * access token and id token were stored while the sign-in page said "nothing else".
 *
 * This asserts both halves of the fix, because each covers what the other cannot: the schema
 * stops a future adapter change from storing a token, and the adapter stops a future schema
 * change from making somewhere for one to go.
 */

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')

/** Every field the standard Auth.js account table carries that this product does not need. */
const CREDENTIAL_COLUMNS = [
  'refresh_token',
  'access_token',
  'id_token',
  'expires_at',
  'token_type',
  'scope',
  'session_state',
]

/** What must remain: without these, a returning person is not recognised as themselves. */
const REQUIRED_COLUMNS = ['userId', 'type', 'provider', 'providerAccountId']

function accountModel(): string {
  const schema = read('prisma/schema/journey.prisma')
  const start = schema.indexOf('model Account {')
  expect(start).toBeGreaterThan(-1)
  return schema.slice(start, schema.indexOf('}', start))
}

describe('the Account model holds a link, not a credential', () => {
  const model = accountModel()

  it.each(CREDENTIAL_COLUMNS)('has no %s column', (column) => {
    expect(model).not.toContain(column)
  })

  it.each(REQUIRED_COLUMNS)('keeps %s, which account linking genuinely needs', (column) => {
    expect(model).toContain(column)
  })

  it('still resolves a returning person by provider and provider account id', () => {
    // `getUserByAccount` looks up exactly this pair. Losing the unique constraint would not
    // leak anything, but it would break the one thing the table is for.
    expect(model).toContain('@@unique([provider, providerAccountId])')
  })

  it('is dropped by a migration rather than only removed from the schema', () => {
    const migration = read('prisma/migrations/20260905120000_drop_oauth_token_columns/migration.sql')
    for (const column of CREDENTIAL_COLUMNS) {
      expect(migration).toContain(`DROP COLUMN IF EXISTS "${column}"`)
    }
    // Nothing but `accounts` may be touched: this is a privacy fix, not a cleanup, and a
    // migration that dropped anything else would be destroying knowledge (invariants 1, 4).
    expect(migration.match(/ALTER TABLE "(\w+)"/g)).toEqual(
      CREDENTIAL_COLUMNS.map(() => 'ALTER TABLE "accounts"'),
    )
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/)
  })
})

describe('the adapter declines to write what the schema no longer holds', () => {
  const config = read('src/server/auth/config.ts')

  it('overrides linkAccount rather than inheriting the adapter default', () => {
    // The default spreads the whole AdapterAccount into `create`. Inheriting it is how this
    // happened in the first place.
    expect(config).toMatch(/async linkAccount\(account\)/)
  })

  it('names each stored field explicitly, so nothing arrives by spread', () => {
    const start = config.indexOf('async linkAccount(account)')
    const body = config.slice(start, config.indexOf('\n    },', start))
    for (const column of REQUIRED_COLUMNS) {
      expect(body).toContain(`${column}: account.${column}`)
    }
    expect(body).not.toContain('...account')
    for (const column of CREDENTIAL_COLUMNS) {
      expect(body).not.toContain(column)
    }
  })
})

describe('the sign-in page says exactly what is stored', () => {
  const dictionary = read('src/i18n/dictionaries/en.ts')
  const body = dictionary.slice(
    dictionary.indexOf('whatWeStoreBody:'),
    dictionary.indexOf('yourHandle:'),
  )

  it('no longer makes the closed claim that was untrue', () => {
    // "Nothing else" was a promise the database did not keep. An enumeration can be checked
    // against the schema; a closed claim can only be believed.
    expect(body).not.toContain('Nothing else')
  })

  it('names each stored field in words a reader can check', () => {
    for (const phrase of ['email address', 'account identifier', 'handle', 'date']) {
      expect(body.toLowerCase()).toContain(phrase.toLowerCase())
    }
  })

  it('still says what is not kept, including the tokens that used to be', () => {
    expect(body).toContain('Not your name')
    expect(body).toContain('not your photograph')
    expect(body).toContain('no sign-in tokens')
  })
})
