import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { en } from '../../src/i18n/dictionaries/en'

/**
 * Capabilities are reachable, and privileged ones are not advertised — Phase 12E, audit F12.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **The failure this guards against is unusual, so it is worth naming precisely.**
 *
 * Nothing here was broken. `/admin/reports`, `/admin/routes` and `contributors/[handle]` all
 * worked, were covered by tests, and enforced their own access rules correctly. They were
 * simply not *reachable*: no navigation led to the administrator queues, and a contributor's
 * handle rendered as flat grey text in five places although the page explaining what that
 * person had contributed had existed since Phase 8.
 *
 * That is a real product defect and an invisible one — every test passes, because a test that
 * navigates by URL never discovers that a person could not have. FR-46's annual review is not
 * a capability if the only way to perform it is to know the address.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **The second half is the one that matters more.** Making an administrator surface reachable
 * must not make it *advertised*. §23.3 confines the role to safety, disputes, abuse and annual
 * maintenance; CLAUDE.md §9 says a hidden control is never a permission. So the link is gated
 * on the session role for *display*, and the pages continue to answer `notFound()` — this
 * asserts both, because a link that appeared for everyone would be worse than no link.
 */

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('the administrator queues are reachable, and only by an administrator', () => {
  const header = read('src/components/site-header.tsx')
  const code = stripComments(header)

  it('links to a moderation surface from the header', () => {
    expect(code).toContain('/admin/reports')
  })

  it('shows that link only when the viewer holds the safety role', () => {
    // Not `viewer !== null`, and not a truthiness check on some other field: the condition
    // must be the role itself, read from the enum rather than a string literal.
    expect(code).toMatch(/viewer\.role === UserRole\.admin/)
    // The link must sit inside that condition, not beside it.
    const guardAt = code.indexOf('viewer.role === UserRole.admin')
    const linkAt = code.indexOf('/admin/reports')
    expect(guardAt).toBeGreaterThan(-1)
    expect(linkAt).toBeGreaterThan(guardAt)
  })

  it('calls the surface Moderation rather than Admin', () => {
    // §23.3: the role is not how the platform is run, and ordinary contribution is outside
    // its reach entirely. "Admin" would claim otherwise.
    expect(en.nav.moderation).toBe('Moderation')
  })

  it('does not make the hidden link the protection', () => {
    // Both pages must still refuse on their own. A display gate is a courtesy; this is the
    // rule (CLAUDE.md §9).
    // Each page enforces it its own way — `admin/routes` calls `requireAdministrator`
    // directly, `admin/reports` lets the safety service throw `NotAnAdministratorError` from
    // the query it needs anyway. Both are server-side and both answer 404 rather than 403,
    // because there is no reason to tell somebody a moderation surface exists (§23.3).
    for (const page of [
      'src/app/[locale]/admin/routes/page.tsx',
      'src/app/[locale]/admin/reports/page.tsx',
    ]) {
      const source = read(page)
      expect(source).toMatch(/requireAdministrator|NotAnAdministratorError/)
      expect(source).toContain('notFound()')
    }
  })

  it('keeps the moderation surfaces out of the search index', () => {
    expect(read('src/app/robots.ts')).toContain('/en/admin/')
  })
})

describe('the session carries the role, and costs nothing extra to do it', () => {
  const config = stripComments(read('src/server/auth/config.ts'))

  it('reads the role in the query that already fetched the handle', () => {
    // The header renders on every page. A second query there for a link almost nobody sees
    // would be a database round trip per page view.
    //
    // **Loosened in Phase 13**, from an exact column list to "these two are in the same
    // select". Account closure added `closedAt` to the same query — which is the behaviour
    // this test wants, one query rather than two — and the old regex read as though the
    // column *list* were the rule. It was never the rule; the round trip is.
    const select = /select:\s*\{([^}]*)\}/.exec(config)?.[1] ?? ''
    expect(select, 'handle and role must come from one select').toMatch(/handle:\s*true/)
    expect(select).toMatch(/role:\s*true/)
    // Scoped to the session callback: `updateUser` above has a `findUniqueOrThrow` of its
    // own, and an unanchored count over the file would find that too. The session callback is
    // the last one in the file, so everything after its opening line is its body.
    const sessionCallback = config.slice(config.indexOf('async session('))
    expect(sessionCallback, 'session callback not found').not.toBe(config)
    expect(
      sessionCallback.match(/prisma\.user\.find/g) ?? [],
      'the session callback makes one lookup, not two',
    ).toHaveLength(1)
    expect(config).toContain('role: stored?.role ?? UserRole.member')
  })

  it('defaults to member when the row is missing, never to admin', () => {
    // Fail closed. A missing user row must not confer the safety role.
    expect(config).not.toMatch(/role:\s*stored\?\.role\s*\?\?\s*UserRole\.admin/)
  })

  it('still keeps the email off the session', () => {
    // Widening the session is exactly when this could regress (§24.2).
    expect(config).toContain("email: ''")
  })
})

describe('a contributor handle leads to the evidence behind it', () => {
  const ui = read('src/components/ui.tsx')

  it('has one shared component rather than a link written at each site', () => {
    expect(ui).toContain('export function ContributorLink')
    expect(stripComments(ui)).toContain('/contributors/')
  })

  it('encodes the handle into the URL', () => {
    expect(stripComments(ui)).toContain('encodeURIComponent(handle)')
  })

  it('renders a fallback rather than a broken link when there is no author', () => {
    // A seeded revision and an automatic lifecycle transition genuinely have no author, and
    // inventing one would misattribute a system observation as somebody's work.
    const code = stripComments(ui)
    expect(code).toMatch(/handle === null \|\| handle === ''/)
    expect(code).toContain('fallback')
  })

  const SITES = [
    ['src/components/changes.tsx', 'a change announcement names who announced it'],
    ['src/components/contribute.tsx', 'a challenge names who raised it'],
    ['src/components/lifecycle.tsx', 'a lifecycle transition names who decided it'],
    // The ledger moved out of the page and into a component of its own in Phase 12H, when it
    // stopped being forty bordered cards. The site is wherever the row is rendered, not
    // wherever it used to be — what this guards is that a handle is a link, and it still is.
    ['src/components/route-history.tsx', 'a revision in the history names its author'],
    ['src/app/[locale]/admin/routes/page.tsx', 'a duplicate flag names who flagged it'],
  ] as const

  it.each(SITES)('%s uses the shared link — %s', (path) => {
    const source = read(path)
    expect(source).toContain('ContributorLink')
  })

  it('leaves no handle rendered as bare text at those sites', () => {
    // The specific regression: `{entry.authorHandle}` or `{change.authorHandle}` printed
    // directly, which is what every one of these was before.
    for (const [path] of SITES) {
      const code = stripComments(read(path))
      // Negative lookbehind on `=`, so `handle={change.authorHandle}` — which is the fix —
      // does not read as the defect it replaced.
      expect(code).not.toMatch(/(?<!=)\{\s*(entry|change|challenge|event|flag)\.\w*[Hh]andle\s*\}/)
    }
  })

  it('links the viewer to their own contributor page from the header', () => {
    // There is no separate private profile, because there is nothing private to show — the
    // page a viewer sees about themselves is the page everyone sees (§24.3).
    const code = stripComments(read('src/components/site-header.tsx'))
    expect(code).toContain('/contributors/')
    expect(code).toContain('viewer.handle')
  })
})
