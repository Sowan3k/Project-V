'use client'

import Link from 'next/link'

import { PageCanvas } from '@/components/layout'

/**
 * What a reader sees when a page fails — Phase 12.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **This is the application's only client component, and it has to be.** Next requires error
 * boundaries to be client components so they can offer a retry. Everything else is server
 * rendered, which is most of why the read path is fast, and this file existing does not
 * change that: it ships only when something has already gone wrong.
 *
 * **It says nothing about what failed.** A stack trace or a database error message on a public
 * page is an information leak, and to a student trying to read a visa process it is noise. The
 * digest is shown because it is the one thing that lets somebody report a specific failure
 * without it meaning anything to an attacker.
 *
 * **The copy is deliberately not apologetic-and-vague.** It says the two things a reader can
 * act on: nothing they had is lost, and reloading is worth trying. The first matters because
 * this platform holds private journey progress, and a blank error page is exactly when
 * somebody wonders whether they have just lost six months of notes.
 *
 * Strings are inline rather than from the dictionary on purpose. An error boundary that needs
 * an async dictionary load is an error boundary that can fail while reporting a failure.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageCanvas className="py-16">
      <div className="max-w-[68ch]">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          Something went wrong on this page
        </h1>
        <p className="mt-3 text-base leading-7 text-ink-700">
          This is a fault on our side, not something you did. Nothing you have saved has been
          affected — your journey progress, dates and notes are stored separately and are
          untouched by a page failing to load.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
          <Link
            href="/en"
            className="rounded-lg border border-hairline px-4 py-2 text-sm text-ink-900"
          >
            Go to the start
          </Link>
        </div>
        {error.digest === undefined ? null : (
          <p className="mt-6 text-xs text-ink-500">
            If you report this, quote: <code className="font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </PageCanvas>
  )
}
