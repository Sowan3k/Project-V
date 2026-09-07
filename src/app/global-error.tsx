'use client'

/**
 * The last resort — Phase 12G.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What this catches that `[locale]/error.tsx` does not.**
 *
 * That boundary lives *inside* the locale layout, so it can only catch a failure in a page.
 * A failure in the layout itself — the dictionary load, the locale check, the font setup —
 * happens above it, and until now fell through to Next's built-in error page: a bare
 * "Application error: a client-side exception has occurred" on a white background, with none
 * of this product's identity and, more importantly, none of its reassurance.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why the styling is inline rather than Tailwind.**
 *
 * `global-error` replaces the root layout entirely, which means it renders when the thing that
 * normally sets up the page did not. Depending on the stylesheet at exactly the moment the
 * document's own scaffolding has failed is depending on the thing that may have failed. Every
 * rule here is therefore in the element, and the colours are literal hex rather than tokens
 * for the same reason.
 *
 * It is deliberately plain. This is not a screen to design; it is a screen nobody should ever
 * see, and if they do, the only job is to be legible and to say the true thing.
 *
 * **It says nothing about what failed**, for the same reasons as the page boundary: a stack
 * trace on a public page is an information leak, and to a student reading a visa process it is
 * noise. The digest is the one thing that lets somebody report a specific failure.
 *
 * **And it says progress is safe**, which is the whole reason this file is worth writing.
 * This platform holds private journey notes and dates, and a blank crash page is precisely
 * when somebody wonders whether they have just lost six months of them.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: '#ffffff',
          color: '#25292f',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          lineHeight: 1.6,
        }}
      >
        <main style={{ maxWidth: '38rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
            Vindeshi Express could not load
          </h1>
          <p style={{ marginTop: '1rem', color: '#4a5058' }}>
            This is a fault on our side, not something you did. Nothing you have saved has been
            affected — your journey progress, dates and notes are stored separately and are
            untouched by a page failing to load.
          </p>
          <p style={{ marginTop: '1rem', color: '#4a5058' }}>
            Reloading usually works. If the site has been idle it can take up to half a minute to
            wake up.
          </p>
          <div style={{ marginTop: '1.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                appearance: 'none',
                border: '1px solid #1d3a6b',
                borderRadius: '0.5rem',
                backgroundColor: '#1d3a6b',
                color: '#ffffff',
                font: 'inherit',
                fontWeight: 500,
                padding: '0.625rem 1rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                The rule is right everywhere else. Here the router is part of what may have
                failed, and `next/link` would try a client-side navigation through it; a plain
                anchor forces the full document load that is the recovery being offered. */}
            <a
              href="/en"
              style={{
                border: '1px solid #e3e5e9',
                borderRadius: '0.5rem',
                backgroundColor: '#ffffff',
                color: '#25292f',
                font: 'inherit',
                fontWeight: 500,
                padding: '0.625rem 1rem',
                textDecoration: 'none',
              }}
            >
              Go to the start
            </a>
          </div>
          {error.digest === undefined ? null : (
            <p style={{ marginTop: '1.75rem', fontSize: '0.8125rem', color: '#6c727b' }}>
              If you report this, quote: <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
