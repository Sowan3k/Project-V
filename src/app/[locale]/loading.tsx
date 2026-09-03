import { PageCanvas } from '@/components/layout'

/**
 * The shape of a page while its data is on the way — Phase 12.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why this matters more here than on most sites.** Every page on the read path is server
 * rendered against Neon, whose compute scales to zero: a cold first request genuinely takes a
 * few seconds (Test.md §12). Without this, a student on a slow connection gets a blank white
 * screen and no way to tell a slow route from a broken one.
 *
 * **A skeleton, not a spinner.** A spinner says "wait"; a skeleton says "a page is coming and
 * this is roughly its shape", which is the difference between waiting and wondering. The
 * blocks match the real layout — a title, a line of context, then the wide panel the road
 * occupies — so nothing jumps when the content arrives.
 *
 * `aria-busy` and the visually-hidden line carry the same information to a screen reader,
 * which sees none of the shapes. `animate-pulse` is dropped under `prefers-reduced-motion`
 * by the rule in globals.css.
 */
export default function Loading() {
  return (
    <PageCanvas className="py-8">
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading this page</span>

        <div className="h-7 w-2/3 max-w-md animate-pulse rounded-md bg-hairline" />
        <div className="mt-3 h-4 w-1/2 max-w-sm animate-pulse rounded-md bg-hairline" />

        <div className="mt-8 h-56 animate-pulse rounded-xl border border-hairline bg-surface" />

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-xl border border-hairline bg-surface" />
          <div className="h-24 animate-pulse rounded-xl border border-hairline bg-surface" />
        </div>
      </div>
    </PageCanvas>
  )
}
