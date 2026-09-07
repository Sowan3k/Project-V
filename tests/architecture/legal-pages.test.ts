import { describe, expect, it } from 'vitest'

import { read, stripComments, walk } from '../support/source-files'

/**
 * Phase 13 — the privacy page has to stay true.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **A privacy policy is the one page in an application that can become a lie without anybody
 * editing it.** Every other page breaks visibly when the code beneath it changes: a renamed
 * field throws, a removed route 404s. This one keeps rendering the same confident sentences
 * about data that is now handled differently, and nothing anywhere goes red.
 *
 * That is the risk this file exists for. It does not check that the prose is good — no test
 * can — it checks that the specific, falsifiable claims still match the code they describe.
 * Each one below names the claim, then the thing in the source that makes it true.
 *
 * **When one of these fails, the page is wrong.** Fix the page, or undo the change; do not
 * relax the test, because the whole value of the assertion is that it fails at the moment
 * somebody makes the page untrue rather than months later when a reader notices.
 */

const SOURCE = walk('src', ['.ts', '.tsx'])
const DICTIONARY = read('src/i18n/dictionaries/en.ts')
const AUTH_CONFIG = stripComments(read('src/server/auth/config.ts'))
const CLOSURE = stripComments(read('src/server/accounts/service.ts'))

describe('the privacy page describes the code that exists', () => {
  it('is reachable — a legal page nobody can find is no better than none', () => {
    const footer = read('src/components/site-footer.tsx')
    expect(footer).toContain('/privacy')
    expect(footer).toContain('/terms')
    expect(SOURCE).toContain('src/app/[locale]/privacy/page.tsx')
    expect(SOURCE).toContain('src/app/[locale]/terms/page.tsx')
  })

  /**
   * **Claim: "No access token, no ID token and no refresh token is stored."**
   *
   * True because `linkAccount` writes exactly four columns and the token columns were removed
   * from the schema (audit F13). If either half comes back, the sentence is false — and it is
   * the most consequential sentence on the page, because OAuth token material is the most
   * sensitive thing this application could hold.
   */
  it('still stores no OAuth token material', () => {
    expect(DICTIONARY).toContain('No access token, no ID token and no refresh token is stored')

    /*
     * Scoped to the `Account` model *body*, and stripped of Prisma's `///` documentation.
     *
     * The fifth time in this project (Test.md §19, §21, §25): the doc comment above the model
     * lists `access_token`, `refresh_token` and `id_token` precisely to explain that they are
     * not stored, and a whole-file `toContain` reported the explanation as the violation. An
     * absence guard reads code, never prose.
     */
    const schema = read('prisma/schema/journey.prisma')
    const accountModel = (/model Account \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? '')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n')
    expect(accountModel, 'Account model not found').not.toBe('')

    for (const column of ['access_token', 'refresh_token', 'id_token', 'expires_at']) {
      expect(accountModel, `Account.${column} would make the privacy page false`).not.toContain(
        column,
      )
    }
    // Not vacuous: the four columns it looks for are the ones Auth.js would have written.
    expect(accountModel).toContain('providerAccountId')
    // And the adapter does not try to write one either.
    expect(AUTH_CONFIG).not.toMatch(/access_token|refresh_token|id_token/)
  })

  /**
   * **Claim: the email "is never put on your session — so no page on this site can render it
   * even by mistake."**
   *
   * True because the session callback overwrites it with an empty string.
   */
  it('still keeps the email off the session', () => {
    expect(DICTIONARY).toContain('never put on your session')
    expect(AUTH_CONFIG).toContain("email: ''")
  })

  /**
   * **Claim: "Your name and profile photo are not stored. There are no columns for them."**
   */
  it('still has no name or image column on the user', () => {
    expect(DICTIONARY).toContain('There are no columns for them')
    const user = /model User \{[\s\S]*?\n\}/.exec(read('prisma/schema/route.prisma'))?.[0] ?? ''
    expect(user, 'User model not found').not.toBe('')
    expect(user).not.toMatch(/^\s*(name|image|avatar|picture)\s/m)
  })

  /**
   * **Claim: "There is no upload anywhere in this product."**
   *
   * Invariant 6 and §24.1 both depend on it, and this is the sentence a student is most
   * likely to be checking — an agency portal would have asked for their passport by now.
   */
  it('still has no upload path anywhere', () => {
    expect(DICTIONARY).toContain('There is no upload anywhere in this product')
    for (const file of SOURCE) {
      const code = stripComments(read(file))
      expect(code, `${file} accepts a file`).not.toMatch(/type=["']file["']/)
      expect(code, `${file} handles multipart`).not.toMatch(/multipart\/form-data/)
    }
  })

  /**
   * **Claim: "No analytics, no tracking pixels, no advertising, no third-party scripts."**
   *
   * The cheapest of all these guarantees to keep and the easiest to lose — one npm install
   * during a future "we should see how many people use this" afternoon.
   */
  it('still loads nothing from anybody else', () => {
    expect(DICTIONARY).toContain('No analytics, no tracking pixels')
    const manifest = read('package.json')
    for (const vendor of ['analytics', 'gtag', 'posthog', 'mixpanel', 'segment', 'hotjar']) {
      expect(manifest.toLowerCase(), `${vendor} would make the privacy page false`).not.toContain(
        vendor,
      )
    }
  })

  /**
   * **Claim: what closing an account destroys.**
   *
   * The page lists email, the Google link, sessions, and every followed route with its
   * progress, dates, notes and tasks. `closeAccount` is the only thing that makes that true,
   * so the four operations are asserted here — `tests/db/account-closure.db.test.ts` proves
   * they actually work against a database; this proves the page is describing them.
   */
  it('describes what closing an account really does', () => {
    expect(DICTIONARY).toContain('erases your email, the link to your Google account')

    expect(CLOSURE).toMatch(/journey\.deleteMany\(\{ where: \{ userId \} \}\)/)
    expect(CLOSURE).toMatch(/account\.deleteMany\(\{ where: \{ userId \} \}\)/)
    expect(CLOSURE).toMatch(/session\.deleteMany\(\{ where: \{ userId \} \}\)/)
    expect(CLOSURE).toMatch(/email: null/)
  })

  /**
   * **Claim: "Your contributions stay, signed with your handle."**
   *
   * The other half, and the one somebody would be most tempted to "fix" into a full delete.
   * `closeAccount` must not touch any revision or attribution — if it ever does, the page is
   * wrong in the direction that damages the public record.
   */
  it('does not touch a single contribution when an account closes', () => {
    expect(DICTIONARY).toContain('Your contributions stay, signed with your handle')
    for (const model of [
      'routeRevision',
      'stepRevision',
      'fieldRevision',
      'stepEdgeRevision',
      'confirmation',
      'challenge',
      'route.update',
      'route.delete',
    ]) {
      expect(CLOSURE, `closeAccount must not write ${model}`).not.toContain(model)
    }
  })

  /**
   * Both pages say plainly that they are not adopted, and neither invents a contact address.
   *
   * B2 in `Phases.md` is the owner's to answer. A placeholder address is worse than a visible
   * gap: a takedown request sent to one disappears silently, which is the failure this page is
   * supposed to prevent.
   */
  it('does not pretend to be adopted, and invents no contact address', () => {
    expect(DICTIONARY).toContain('Draft, not yet adopted')
    expect(DICTIONARY).toContain('No contact address has been set yet')

    const legal = /legal: \{[\s\S]*?\n {2}\},/.exec(DICTIONARY)?.[0] ?? ''
    expect(legal, 'legal dictionary section not found').not.toBe('')
    // No email address, and no telephone number, until a real one is supplied.
    expect(legal).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
  })
})
