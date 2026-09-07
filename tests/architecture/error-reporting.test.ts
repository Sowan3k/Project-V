import { describe, expect, it } from 'vitest'

import { read, stripComments, walk } from '../support/source-files'

/**
 * Phase 13A — the error log must not become the place personal data lives.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * Error logs are where privacy rules quietly stop applying. Nobody decides to store a user id
 * for five years; somebody adds it to a log line during a difficult afternoon, and it is in
 * every retained log from then on. §24.1 and §24.2 do not have an exception for error paths,
 * so this asserts the absence rather than trusting it.
 *
 * The second guard is about the *shape* of the reporting: no third-party service, because the
 * privacy page says "no third-party scripts" and a promise the build enforces is worth more
 * than a dashboard.
 */

const HOOK = stripComments(read('src/instrumentation.ts'))

describe('server error reporting', () => {
  it('exists at all, as Next’s own hook', () => {
    expect(HOOK).toContain('onRequestError')
    // Next only picks the file up at `src/instrumentation.ts` (or the project root).
    expect(walk('src', ['.ts'])).toContain('src/instrumentation.ts')
  })

  /**
   * **Nothing that identifies who hit the error.**
   *
   * The hook receives the full request, so every one of these is one property access away —
   * which is exactly why it is worth a test rather than a comment.
   */
  it('logs nothing that identifies a person', () => {
    for (const forbidden of [
      'userId',
      'user.id',
      'handle',
      'email',
      'sessionToken',
      'cookie',
      'Cookie',
      'headers',
      'body',
      'ip',
      'currentViewer',
    ]) {
      expect(HOOK, `the error log must not carry ${forbidden}`).not.toContain(forbidden)
    }
  })

  /**
   * **The digest is the whole point.** Both error boundaries show it and ask the reader to
   * quote it; without it in the log there is nothing to match a report against.
   */
  it('logs the digest, so a reported error can be found', () => {
    expect(HOOK).toContain('digest')

    for (const boundary of ['src/app/[locale]/error.tsx', 'src/app/global-error.tsx']) {
      expect(stripComments(read(boundary)), `${boundary} should show the digest`).toContain(
        'error.digest',
      )
    }
  })

  /**
   * No error-reporting SDK, anywhere — see the privacy page's "no third-party scripts", which
   * `legal-pages.test.ts` also checks from the other direction.
   */
  it('sends the error nowhere', () => {
    expect(HOOK).not.toMatch(/fetch\(|axios|Sentry|bugsnag|rollbar|datadog/i)

    const manifest = read('package.json').toLowerCase()
    for (const sdk of ['sentry', 'bugsnag', 'rollbar', 'datadog', 'newrelic']) {
      expect(manifest, `${sdk} would put a script on the read path`).not.toContain(sdk)
    }
  })
})
