import type { Instrumentation } from 'next'

/**
 * Server-side error reporting — Phase 13A.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Until now a production failure was invisible.** Next writes something to stderr when a
 * server render throws, but nothing connected the digest a reader is shown to the request that
 * produced it — so "I got an error, it said 2164382234" was unanswerable, and a failure nobody
 * reported did not exist at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why there is no Sentry here, and why that is not a compromise.**
 *
 * The obvious move is an error-reporting service. Three reasons this is better for this
 * product, in increasing order of how much they matter:
 *
 * 1. **§28.1's cost philosophy.** Free tiers, and this costs nothing at all.
 * 2. **No client JavaScript.** Every such service ships a browser bundle, and the read path has
 *    had none since Phase 5 — a student in Dhaka on a slow connection is who that is for.
 * 3. **The privacy page says "no third-party scripts", and means it.** Adding one would make
 *    that page false, and `tests/architecture/legal-pages.test.ts` would fail the build for
 *    exactly that reason. A promise the code enforces is worth more than a dashboard.
 *
 * So this is Next's own `onRequestError` hook: structured JSON on stderr, which Vercel captures
 * as runtime logs and makes searchable. Zero dependencies, server only.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What is deliberately not logged.**
 *
 * No user id, no handle, no email, no session token, no cookie, no request body, no IP. §24.1
 * and §24.2 do not stop applying because the code is on an error path — and an error log is
 * exactly where personal data ends up sitting for years without anyone deciding it should.
 *
 * What is logged is enough to find the fault and nothing that identifies who hit it: the
 * digest, the route, the kind of render, the message and the stack. A `?slug=` on the path is
 * route knowledge, which is public.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const shaped = error as Error & { digest?: string }

  /*
   * One JSON object per line, so a log search can filter on a field rather than a substring.
   * `console.error` rather than a logger dependency: on Vercel, stderr *is* the log.
   */
  console.error(
    JSON.stringify({
      at: new Date().toISOString(),
      event: 'request_error',

      /*
       * **The one field that makes a user's report actionable.** Both error boundaries show
       * this digest and ask the reader to quote it; this is the other end of that string. It
       * is a hash of the message, so it carries nothing about who saw it.
       */
      digest: shaped.digest ?? null,

      // Where. `routePath` is the pattern (`/[locale]/routes/[slug]`), `path` the actual URL —
      // both are public route knowledge and neither says anything about the person.
      routePath: context.routePath,
      path: request.path,
      method: request.method,

      // Which kind of render failed: a Server Component, a route handler, a server action.
      // This is usually the difference between "a page is broken" and "a write is broken".
      routerKind: context.routerKind,
      routeType: context.routeType,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,

      message: shaped.message,
      stack: shaped.stack,
    }),
  )
}
