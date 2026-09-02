import { describe, expect, it } from 'vitest'

import { PRIVATE_USER_STATE_MODELS } from '../../src/domain/models'
import { read, stripComments, walk } from '../support/source-files'

/**
 * Phase 7 — the privacy guarantees, enforced structurally.
 *
 * Invariant tests 5 (the signature half), 6 and part of 7. These are about the *absence* of a
 * capability, which is not something an integration test can prove: no amount of "user A
 * could not read user B's journey" demonstrates that no such function exists. These do.
 *
 * Each guard carries a planted-violation check. A guard nobody has watched fail is decoration.
 */

const SOURCE_FILES = walk('src', ['.ts', '.tsx'])
const CODE = SOURCE_FILES.map((file) => ({ file, code: stripComments(read(file)) }))

describe('invariant 5 — a journey cannot be reached without a user id', () => {
  const JOURNEY_MODULES = SOURCE_FILES.filter((file) => file.startsWith('src/server/journeys/'))

  it('has journey modules at all — this file is not testing an empty set', () => {
    expect(JOURNEY_MODULES.length).toBeGreaterThan(0)
  })

  /**
   * The rule, in the strongest form available to static analysis: **every exported function
   * in `src/server/journeys/` names `userId` in its signature.**
   *
   * CLAUDE.md §9: "Journey queries always take the session user id as a required argument —
   * make it impossible to construct one without it." A function that forgot would be a
   * function some future caller could reach with somebody else's journey id, and the
   * integration suite would only catch it if somebody thought to write that particular test.
   *
   * Public aggregates deliberately live in `src/server/routes/read.ts` instead, so this rule
   * needs no exceptions. An exception list is where a rule like this goes to die.
   */
  it('names userId in every exported function signature', () => {
    const offenders: string[] = []

    for (const file of JOURNEY_MODULES) {
      const code = stripComments(read(file))
      const exports = [...code.matchAll(/export (?:async )?function (\w+)\s*\(([\s\S]*?)\)\s*:/g)]
      expect(exports.length).toBeGreaterThan(0)

      for (const [, name, signature] of exports) {
        if (!/\buserId\b/.test(signature ?? '')) offenders.push(`${file}#${name ?? '?'}`)
      }
    }

    expect(offenders).toEqual([])
  })

  /**
   * And every query against a private model carries the scope.
   *
   * A signature that takes `userId` and then ignores it would pass the check above.
   *
   * The rule is stated per model rather than as a blanket "every query mentions userId",
   * because the blanket version is wrong here in a way that matters. `setStepProgress` looks
   * up the *step* to confirm it belongs to the journey's route — that is a read of public
   * route data, it has no owner, and demanding a `userId` on it would be cargo cult. Forcing
   * the blanket rule would have meant adding an exception list, and an exception list is where
   * a rule like this goes to die.
   *
   *   `journey`                            the ownership root. Must name `userId`.
   *   `journeyStepProgress`, `journeyTask` hang off a journey. Must name `userId`, or the
   *                                        `journeyId` whose owner the function just checked.
   *   anything else                        public data, not this test's business.
   *
   * Static analysis can show the shape; it cannot prove a `journeyId` in scope was verified.
   * `tests/db/journeys.db.test.ts` proves the behaviour, by actually trying to write into
   * another user's journey and asserting nothing moves. The two halves are the guarantee.
   */
  const OWNERSHIP_ROOT = 'journey'
  const JOURNEY_OWNED = ['journeyStepProgress', 'journeyTask']

  it('scopes every query it makes against a private model', () => {
    const offenders: string[] = []
    let inspected = 0

    for (const file of JOURNEY_MODULES) {
      const code = stripComments(read(file))
      for (const match of code.matchAll(/prisma\.(\w+)\.(\w+)\(([\s\S]*?)\n\s*\}?\)/g)) {
        const model = match[1]
        const args = match[3] ?? ''
        if (model === undefined) continue

        if (model === OWNERSHIP_ROOT) {
          inspected += 1
          if (!/\buserId\b/.test(args)) offenders.push(`${file}: ${model}.${match[2] ?? ''}`)
        } else if (JOURNEY_OWNED.includes(model)) {
          inspected += 1
          if (!/\b(userId|journeyId)\b/.test(args)) {
            offenders.push(`${file}: ${model}.${match[2] ?? ''}`)
          }
        }
      }
    }

    expect(offenders).toEqual([])
    // Not vacuous: it really did inspect the queries.
    expect(inspected).toBeGreaterThanOrEqual(8)
  })

  it('would catch a query that dropped the scope', () => {
    expect(/\buserId\b/.test('where: { id: journeyId },')).toBe(false)
  })
})

describe('invariant 6 / test 6 — there is no upload path in the journey flow', () => {
  /**
   * FR-25, BR-06, D-09: "The platform shall not require documentary proof merely to update
   * personal journey progress." CLAUDE.md invariant 6 goes further — *no file upload path
   * exists in the journey flow at all* — and that is the version worth enforcing, because a
   * path that exists will eventually be required by somebody.
   *
   * Scanned across all of `src/`, not just the journey directory: an upload endpoint anywhere
   * is an upload endpoint the journey flow could start using.
   */
  const UPLOAD = /type=["']file["']|multipart\/form-data|formidable|busboy|\.arrayBuffer\(\)|new FormData\(\).*File|put_?object|uploadthing|s3\.|blob\.put/i

  it('has no file input, multipart parser or blob store anywhere in src/', () => {
    const hits = CODE.filter(({ code }) => UPLOAD.test(code)).map(({ file }) => file)
    expect(hits).toEqual([])
  })

  it('would catch a planted violation', () => {
    for (const planted of [
      '<input type="file" name="proof" />',
      "enctype='multipart/form-data'",
      'const body = await request.arrayBuffer()',
      'await blob.put(key, file)',
    ]) {
      expect(UPLOAD.test(planted)).toBe(true)
    }
  })

  /**
   * The boundary refuses one too, rather than only lacking one.
   *
   * `FormData` entries are `string | File`. The journey actions read them through a helper
   * that throws on a file, so a hand-crafted multipart POST is answered with an error instead
   * of a coerced `"[object Object]"`.
   */
  it('refuses a file at the journey action boundary', () => {
    const actions = read('src/app/[locale]/routes/[slug]/journey/actions.ts')
    expect(actions).toMatch(/class UploadRefusedError/)
    expect(actions).toMatch(/if \(typeof value !== 'string'\) throw new UploadRefusedError/)
    // And nothing in there reaches a raw entry, which is how a file would sneak past.
    expect(stripComments(actions)).not.toMatch(/String\(formData\.get/)
  })
})

describe('invariant 7 — nothing here stores a document or a real identity', () => {
  /**
   * §24.1 lists what the platform must never hold: passport scans, transcripts, test
   * certificates, bank statements, visa documents, admission letters, private addresses.
   * Phase 2 asserted that against the route schema; this asserts it against the private
   * journey schema, which is where the temptation actually lives — a personal tracker is
   * exactly the place somebody would "helpfully" add a document slot.
   *
   * The real-name half matters as much: §24.3 says a contributor need not expose a real
   * identity, so `User` has no name or image column and the auth adapter drops both.
   */
  const journeySchema = read('prisma/schema/journey.prisma')
  const routeSchema = read('prisma/schema/route.prisma')

  it('has no column for a document of any kind', () => {
    const FORBIDDEN =
      /passport|transcript|certificate|bankStatement|proofOfFunds|visaDocument|admissionLetter|residentialAddress|attachment|upload|fileUrl|documentUrl/i
    const stripped = stripComments(journeySchema).replace(/^\s*\/\/\/.*$/gm, '')
    expect(stripped).not.toMatch(FORBIDDEN)
    expect(FORBIDDEN.test('attachmentUrl String?')).toBe(true)
  })

  it('stores no real name or profile photograph for a user', () => {
    const userModel = routeSchema.slice(
      routeSchema.indexOf('model User {'),
      routeSchema.indexOf('@@map("users")'),
    )
    const stripped = userModel.replace(/^\s*\/\/\/.*$/gm, '')
    expect(stripped).not.toMatch(/^\s*(name|image|avatar|givenName|familyName|picture)\s/m)
    // Not vacuous: it does hold the two things it is supposed to.
    expect(stripped).toMatch(/handle\s+String\s+@unique/)
    expect(stripped).toMatch(/email\s+String\?\s+@unique/)
  })

  it('never puts the email on the session', () => {
    // The session is what every component reads. Keeping the email off it means a component
    // cannot render one by accident (§24.2).
    const config = stripComments(read('src/server/auth/config.ts'))
    expect(config).toMatch(/handle: stored\?\.handle \?\? ''/)
    expect(config).toMatch(/email: ''/)
  })
})

describe('private state stays out of the public revision engine', () => {
  /**
   * A journey note is not a contribution. If private state ever went through the revision
   * service it would acquire a public history, which is invariant 5 broken in the least
   * recoverable way — the leak would be in the ledger, and the ledger is append-only.
   */
  it('classifies every journey model as private user state', () => {
    for (const model of ['Journey', 'JourneyStepProgress', 'JourneyTask']) {
      expect(PRIVATE_USER_STATE_MODELS).toContain(model)
    }
  })

  it('never imports the revision service from the journey modules', () => {
    for (const file of SOURCE_FILES.filter((f) => f.startsWith('src/server/journeys/'))) {
      expect(stripComments(read(file))).not.toMatch(/from '@\/server\/revisions/)
    }
  })

  it('never imports journey state into the public read path', () => {
    // src/server/routes/read.ts counts journeys for public aggregates, which is fine — a
    // count is not a journey. What it must never do is import the private read module.
    const publicRead = stripComments(read('src/server/routes/read.ts'))
    expect(publicRead).not.toMatch(/from '\.\.\/journeys|from '@\/server\/journeys/)
  })
})

describe('invariant 17 — aggregates say who said so', () => {
  it('words completions as self-reported, and never as verified', () => {
    // Comments stripped: the dictionary's own note quotes §26's counter-example — "never
    // '116 verified visas'" — in order to forbid it. Prose cannot drift into behaviour.
    const dictionary = stripComments(read('src/i18n/dictionaries/en.ts'))
    expect(dictionary).toMatch(/users marked this journey completed/)
    expect(dictionary).toMatch(/selfReportedNote: '[^']*Nobody checked/)
    // The Phase 6 guard already forbids `verified` across src/; this pins the positive form.
    expect(dictionary).not.toMatch(/verified visas?/i)
  })
})
