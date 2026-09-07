import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * The component primitives — Phase 12B.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Why these exist.** Until now every screen assembled itself out of raw utilities, so the
 * same idea — a panel, a chip, a stat, a button — was rewritten slightly differently in each
 * of eleven pages. The result is not a design that went wrong; it is a design that never
 * happened, because nothing was ever decided *once*. These are those decisions, made once.
 *
 * They pair with the token scale in `globals.css`: tokens say how big and what colour, these
 * say what the recurring things are. Neither is much use without the other.
 *
 * **All server components.** Nothing here holds state, and nothing here may — the read path
 * ships one client component in the whole application (the error boundary Next requires to
 * be one) and that is most of why it is fast. A primitive that needed `useState` would put a
 * bundle in front of every page that used it.
 * ═════════════════════════════════════════════════════════════════════════════════════════
 */

/* ── Brand ─────────────────────────────────────────────────────────────────────────────── */

/**
 * The brand mark: the road, matching `src/app/icon.svg`.
 *
 * Deliberately **not** a letterform. The final public name is an open decision (D-32,
 * CLAUDE.md §11) and a mark built from a letter would have to be redrawn if the name
 * changes. A road would not — it is the product's metaphor rather than its spelling.
 *
 * Hand-drawn, which invariant 24 permits without qualification: it is fixed brand furniture,
 * no route data reaches it, and it renders identically for every destination.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="7" fill="var(--color-brand-900)" />
      <path
        d="M8 24 C 8 17, 14 17, 14 12 C 14 8, 19 8, 22 9"
        fill="none"
        stroke="var(--color-surface)"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.92"
      />
      <circle cx="8" cy="24" r="2.6" fill="var(--color-surface)" />
      <circle cx="23" cy="9" r="3.2" fill="var(--color-brand-500)" />
    </svg>
  )
}

/**
 * The full lockup — mark, Bengali wordmark, English name.
 *
 * Bengali identity, English interface (CLAUDE.md §8.5.6): the Bengali is the brand and leads,
 * the English name sits beneath it as the readable name of the thing. `lang="bn"` is not
 * decoration — it tells a screen reader to switch pronunciation, and without it the Bengali
 * is read as though it were English.
 */
export function BrandLockup({
  nameBn,
  nameEn,
  tagline,
  size = 'default',
}: {
  nameBn: string
  nameEn: string
  tagline?: string
  size?: 'default' | 'large'
}) {
  const large = size === 'large'
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={large ? 38 : 30} />
      <span className="flex flex-col leading-none">
        <span
          lang="bn"
          className={`font-bengali font-semibold text-brand-900 ${large ? 'text-section' : 'text-panel'}`}
        >
          {nameBn}
        </span>
        <span className="mt-1 text-micro font-medium tracking-[0.14em] text-ink-500 uppercase">
          {nameEn}
        </span>
        {tagline === undefined ? null : (
          <span className="mt-1 text-micro text-ink-500">{tagline}</span>
        )}
      </span>
    </span>
  )
}

/* ── Panel ─────────────────────────────────────────────────────────────────────────────── */

/**
 * The recurring container: a white surface with a hairline edge and the lightest possible
 * lift. Every mockup is built out of these.
 *
 * `tone="sunken"` sits the panel on the page ground instead of above it, for regions that
 * group content without claiming to be a separate object — the difference between a card and
 * a well. Both exist in the mockups and using one for both is what makes a page read as an
 * undifferentiated field of boxes.
 *
 * Named `sunken` rather than the more natural `quiet` because `quiet` is a route lifecycle
 * state, and the single-source guard (CLAUDE.md §9) reserves every enum literal to
 * `src/domain/enums.ts`. Worth the slightly worse name: two meanings for one word in a
 * codebase where one of them decides how a route is presented is a real trap.
 */
export function Panel({
  children,
  tone = 'raised',
  padded = true,
  className = '',
  as: Component = 'div',
}: {
  children: ReactNode
  tone?: 'raised' | 'sunken'
  padded?: boolean
  className?: string
  as?: 'div' | 'section' | 'article' | 'aside' | 'li'
}) {
  const surface =
    tone === 'raised'
      ? 'border-hairline bg-surface shadow-panel'
      : 'border-hairline bg-surface-muted'
  return (
    <Component className={`rounded-panel border ${surface} ${padded ? 'p-5' : ''} ${className}`}>
      {children}
    </Component>
  )
}

/** A panel's title row, with an optional action pinned to the right (VR-04, VR-05, VR-06). */
export function PanelHeader({
  title,
  action,
  meta,
  className = '',
}: {
  title: ReactNode
  action?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${className}`}>
      <h2 className="text-panel font-semibold text-ink-900">{title}</h2>
      {meta === undefined ? null : <p className="text-meta text-ink-500">{meta}</p>}
      {action === undefined ? null : <div className="ml-auto text-meta">{action}</div>}
    </div>
  )
}

/* ── Buttons ───────────────────────────────────────────────────────────────────────────── */

export type ButtonTone = 'primary' | 'secondary' | 'caution' | 'bare'

/**
 * Shared between `<button>` and `<Link>`, because the mockups use both for things that look
 * identical and a reader should not be able to tell which is which. Exported so a form's own
 * submit button can wear it without importing a component that would wrap it.
 */
/**
 * Two sizes, because the product genuinely has two jobs for a button.
 *
 * `default` is a page's own action — sign in, follow this route, find my route. `compact` is
 * a submit inside a disclosure or a form row, where a full-size button would dominate the
 * field it belongs to; six of those had been hand-written at `px-3 py-1.5 text-xs` before
 * this existed, which is exactly the drift the primitives are for.
 */
export type ButtonSize = 'default' | 'compact'

export function buttonClass(
  tone: ButtonTone = 'primary',
  { size = 'default', className = '' }: { size?: ButtonSize; className?: string } = {},
): string {
  const base = 'inline-flex items-center justify-center gap-2 rounded-control font-medium'
  const sizes: Record<ButtonSize, string> = {
    default: 'px-4 py-2.5 text-sm',
    compact: 'px-3 py-1.5 text-meta',
  }
  /*
   * The three filled tones carry a *surface* from Phase 12M — a vertical gradient, a hairline
   * of light along the top edge, a seated bottom edge, and a sheen that sweeps on hover. The
   * skin lives in `globals.css` under `.vx-btn-*` so the gradient stops can be written in
   * `oklch` directly, out of reach of the arbitrary-value guard; the Tailwind fill beneath each
   * one stays as the flat fallback, and every contrast figure the guards measure is measured
   * against that fill rather than against the gradient.
   */
  const tones: Record<ButtonTone, string> = {
    primary: 'vx-btn vx-btn-primary bg-brand-700 text-white',
    secondary: 'vx-btn vx-btn-secondary border border-hairline bg-surface text-ink-900',
    /**
     * The one tone whose action has a consequence different in kind — Phase 12E.
     *
     * Sending a report, and withholding a field from public view. Both had been hand-written
     * filled buttons in `bg-caution-900`, in two files, because there was no tone for them;
     * a third would have been written the moment a third such action appeared. It is
     * deliberately the *same* attention colour as every other caution in the product (§7.3):
     * one colour meaning "read this", never a palette of severities.
     */
    caution: 'vx-btn vx-btn-caution bg-caution-900 text-white',
    // Sizeless by nature: it is a link wearing a button's affordances, not a filled control.
    bare: 'px-1 py-0.5 text-sm text-brand-700 hover:underline',
  }
  const sizing = tone === 'bare' ? '' : sizes[size]
  return `${base} ${sizing} ${tones[tone]} ${className}`
}

export function Button({
  children,
  tone = 'primary',
  className = '',
  ...rest
}: {
  children: ReactNode
  tone?: ButtonTone
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={buttonClass(tone, { className })} {...rest}>
      {children}
    </button>
  )
}

export function LinkButton({
  children,
  href,
  tone = 'primary',
  className = '',
}: {
  children: ReactNode
  href: string
  tone?: ButtonTone
  className?: string
}) {
  return (
    <Link href={href} className={buttonClass(tone, { className })}>
      {children}
    </Link>
  )
}

/* ── Chip ──────────────────────────────────────────────────────────────────────────────── */

export type ChipTone = 'neutral' | 'brand' | 'caution'

/**
 * A small labelled marker. The mockups use these everywhere, and that is exactly the risk:
 * §7.3 says a badge on everything is a badge on nothing.
 *
 * So the tones map to the **weight system**, not to a palette. `caution` is the one that
 * changes what a reader should conclude and is the only loud one; `neutral` is quiet context;
 * `brand` marks something structural like a selected filter. There is deliberately no
 * `success` tone — a green chip on a route is a safety claim we are not entitled to make
 * (invariant 12, BR-20).
 *
 * `icon` is not optional decoration. Meaning must never rest on colour alone (§10.4), so a
 * caution chip that is only orange is a caution chip that some readers cannot see.
 */
export function Chip({
  children,
  tone = 'neutral',
  icon,
  className = '',
}: {
  children: ReactNode
  tone?: ChipTone
  icon?: ReactNode
  className?: string
}) {
  const tones: Record<ChipTone, string> = {
    neutral: 'border-hairline bg-surface text-ink-700',
    brand: 'border-brand-500 bg-brand-50 text-brand-900',
    caution: 'border-caution-500 bg-caution-50 text-caution-900',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-micro font-medium ${tones[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  )
}

/* ── Stat ──────────────────────────────────────────────────────────────────────────────── */

/**
 * One counted fact: the value, then what it counts (VR-04, VR-14).
 *
 * The value leads because that is what the reader scans for, but the label is the half that
 * has to be exactly right. §26 and invariant 17: "116 users marked this journey completed",
 * never "116 verified visas". This component renders whatever label it is handed — the
 * wording lives in the dictionary, where it can be reviewed as copy.
 *
 * `tone="caution"` is for a count that should change what somebody does — open challenges,
 * fields needing review. Zero is not automatically calm and non-zero is not automatically
 * alarming, so the caller decides, from `src/domain/trust.ts`, and never this component.
 */
export function Stat({
  value,
  label,
  tone = 'neutral',
}: {
  value: ReactNode
  label: ReactNode
  tone?: 'neutral' | 'caution'
}) {
  return (
    <div className="min-w-0">
      <p
        className={`text-section font-semibold ${tone === 'caution' ? 'text-caution-900' : 'text-ink-900'}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-micro leading-snug text-ink-500">{label}</p>
    </div>
  )
}

/** A row of stats that wraps rather than scrolls — VR-14's evidence band. */
export function StatBand({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6 ${className}`}>
      {children}
    </div>
  )
}

/* ── Breadcrumb ────────────────────────────────────────────────────────────────────────── */

export interface Crumb {
  readonly label: string
  /** Absent for the current page, which is a label and not a link. */
  readonly href?: string
}

/**
 * Where you are, and every step back out — VR-05, VR-08, VR-09, VR-11, VR-13.
 *
 * A real `<nav>` with an accessible name, because a screen reader user needs to be able to
 * skip it, and `aria-current="page"` on the last crumb so the current location is announced
 * as such rather than as one more link.
 *
 * The separators are `aria-hidden`: a slash read aloud between every crumb is noise.
 */
export function Breadcrumb({ crumbs, label }: { crumbs: readonly Crumb[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-500">
        {crumbs.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
            {/* Inherits the list's `ink-500`. It was briefly `text-hairline`, which the
                contrast guard rejected and was right to: hairline is a border tone at
                L=0.91, so a separator drawn in it is invisible to a good many readers. */}
            {index === 0 ? null : <span aria-hidden="true">/</span>}
            {crumb.href === undefined ? (
              <span aria-current="page" className="text-ink-700">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="hover:text-ink-900 hover:underline">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Sibling views of one thing, as links — Phase 12M.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * The owner asked whether anywhere still needs a back button. Almost nowhere does: the route
 * screens carry breadcrumbs, and every top-level destination is in the header and the bottom
 * bar. **One pair of pages was genuinely stranded.** `/admin/routes` had nothing anywhere in
 * the application linking to it — the header offers only `/admin/reports` — so route
 * maintenance could be reached solely by an administrator who happened to remember the URL.
 *
 * The fix is not a back button. §7.1 already answers this shape: two sibling views of the same
 * responsibility are **tabs**, each with its own URL. A back button would have returned the
 * administrator to wherever they came from; what they actually need is the other queue.
 *
 * Ordinary links, so they deep-link, open in a new tab, and work with no JavaScript.
 * `aria-current="page"` rather than colour alone, because the selected tab must be announced.
 */
export function TabNav({
  label,
  tabs,
}: {
  label: string
  tabs: readonly {
    readonly href: string
    readonly label: string
    readonly current: boolean
  }[]
}) {
  return (
    <nav aria-label={label} className="mt-4 border-b border-hairline">
      <ul className="-mb-px flex flex-wrap gap-x-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.current ? 'page' : undefined}
              className={
                tab.current
                  ? 'inline-block border-b-2 border-brand-700 px-3 py-2 text-sm font-medium text-ink-900'
                  : 'inline-block border-b-2 border-transparent px-3 py-2 text-sm text-ink-500 hover:border-hairline hover:text-ink-900'
              }
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/* ── Empty state ───────────────────────────────────────────────────────────────────────── */

/**
 * What a screen says when it has nothing to show.
 *
 * This is a product surface, not a fallback. §45 names the cold start as a real risk and the
 * honest answer is to say why a thing is empty — routes are researched and reviewed before
 * they are seeded, so an empty destination means nobody has written it yet, not that the
 * platform is broken. The alternative, filling the space with a plausible sample route, is
 * forbidden outright: Gate 2 requires zero mockup-derived values and a fake route is worse
 * than an empty page because it cannot be told apart from a real one.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <Panel tone="sunken" className="px-6 py-10 text-center">
      <p className="text-panel font-semibold text-ink-900">{title}</p>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-6 text-ink-700">{body}</p>
      {action === undefined ? null : <div className="mt-5 flex justify-center">{action}</div>}
    </Panel>
  )
}

/* ── Rail ──────────────────────────────────────────────────────────────────────────────── */

/**
 * A titled block in a side column — the My Journey, Updates and Shadow Route panels that run
 * down the right of VR-04, VR-05, VR-06 and VR-07.
 *
 * A heading level is required rather than defaulted. These sit inside pages with different
 * outlines, and a component that silently picks `h2` produces a document whose headings skip
 * levels — which is invisible on screen and makes the page much harder to navigate by
 * heading, which is how a screen reader user reads a long page.
 */
export function Rail({
  title,
  level,
  action,
  children,
}: {
  title: string
  level: 2 | 3
  action?: ReactNode
  children: ReactNode
}) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <Panel as="section">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Heading className="text-panel font-semibold text-ink-900">{title}</Heading>
        {action === undefined ? null : <div className="text-meta">{action}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </Panel>
  )
}

/**
 * A contributor's handle, linked to the evidence behind it — Phase 12E, audit F12.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why this is a component rather than a link written five times.**
 *
 * `src/app/[locale]/contributors/[handle]/page.tsx` has existed since Phase 8 and nothing
 * linked to it. Handles rendered as flat grey text in five places — a revision in the route
 * history, a challenge on a field, a change announcement, a lifecycle transition and a
 * duplicate flag — so the one page that answers "who is this person and what have they
 * contributed?" was reachable only by typing its URL.
 *
 * That matters more here than in most products. A reader deciding how much weight to give a
 * claim is told who asserted it, and §25's answer to "how do I know if they are any good?" is
 * deliberately *evidence rather than a score* — no reputation number, no level, no badge. But
 * evidence a reader cannot reach is not evidence, and the alternative they fall back on is the
 * handle itself, which carries no information at all by design (§24.3).
 *
 * One component so the destination, the wording and the styling cannot drift apart across
 * five call sites.
 *
 * `null` renders the fallback rather than a broken link: an author is genuinely absent on a
 * seed revision and on an automatic lifecycle transition, and inventing a person for those
 * would misattribute a system observation as somebody's work.
 */
export function ContributorLink({
  handle,
  locale,
  fallback = '—',
  className = '',
}: {
  handle: string | null
  locale: string
  /** Shown when there is no author. A seeded revision and an automatic transition have none. */
  fallback?: ReactNode
  className?: string
}) {
  if (handle === null || handle === '') return <>{fallback}</>
  return (
    <Link
      href={`/${locale}/contributors/${encodeURIComponent(handle)}`}
      className={`underline decoration-hairline underline-offset-2 hover:text-brand-700 ${className}`}
    >
      {handle}
    </Link>
  )
}

/* ── Forms ─────────────────────────────────────────────────────────────────────────────── */

/**
 * One input style, one label style, one hint style — Phase 12E.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why this is a primitive and not a convention.**
 *
 * Before this existed, `const INPUT = 'mt-1 block w-full rounded-control …'` was written out
 * seven times — in `contribute.tsx`, `safety.tsx`, `structure.tsx`, the changes page, the
 * create-route page and both admin pages — and they had already drifted: some `px-2 py-1.5`,
 * some `px-3 py-2`, some `text-xs` labels and some `text-sm`. That is the same failure the
 * panel and button primitives were introduced to fix, one layer down, and it shows up where
 * it matters most: the contribution forms are the surfaces a contributor looks at longest.
 *
 * `size` makes the same distinction `buttonClass` does. A form that *is* the page — create a
 * route, report something — gets `default`; a form inside a disclosure on a field gets
 * `compact`, so it does not shout down the value it is correcting.
 */
export type FieldSize = 'default' | 'compact'

export function inputClass(size: FieldSize = 'default', className = ''): string {
  const sizing = size === 'compact' ? 'px-2 py-1.5' : 'px-3 py-2'
  return `mt-1 block w-full rounded-control border border-hairline bg-surface ${sizing} text-sm text-ink-900 ${className}`
}

export function labelClass(size: FieldSize = 'default'): string {
  return `block ${size === 'compact' ? 'text-meta' : 'text-sm'} text-ink-700`
}

/**
 * A labelled control with an optional hint beneath it.
 *
 * The hint sits *below* the control rather than above it, because in these forms the hint
 * qualifies an answer the contributor is about to give — "leave everything unticked if you
 * are not sure" is useless above the checkboxes and exactly right below them.
 *
 * Renders a real `<label>` wrapping its control, so the whole thing is a hit target and no
 * `htmlFor`/`id` pair can fall out of sync.
 */
export function FormField({
  label,
  hint,
  size = 'default',
  className = '',
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  size?: FieldSize
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`${labelClass(size)} ${className}`}>
      {label}
      {children}
      {hint === undefined ? null : (
        <span className="mt-1 block text-meta leading-5 text-ink-500">{hint}</span>
      )}
    </label>
  )
}

/** The same, for a group of controls that cannot live inside one `<label>`. */
export function FormFieldset({
  legend,
  hint,
  size = 'default',
  className = '',
  children,
}: {
  legend: ReactNode
  hint?: ReactNode
  size?: FieldSize
  className?: string
  children: ReactNode
}) {
  return (
    <fieldset className={className}>
      <legend className={labelClass(size)}>{legend}</legend>
      {hint === undefined ? null : <p className="mt-1 text-meta leading-5 text-ink-500">{hint}</p>}
      <div className="mt-2">{children}</div>
    </fieldset>
  )
}

/* ── Disclosure ────────────────────────────────────────────────────────────────────────── */

/**
 * A `<details>` with the product's own summary treatment.
 *
 * This is the most repeated shape in the application — every contribution control, every
 * structural edit, the report form and the route index are all one of these — and until now
 * every call site wrote its own summary classes. Three variants were in the tree.
 *
 * `tone="caution"` is for the disclosure that opens a report: it is the one action on a field
 * whose consequence differs in kind, and §7.3 reserves the loud treatment for what changes
 * what a reader should do.
 */
export function Disclosure({
  summary,
  tone = 'neutral',
  open = false,
  className = '',
  children,
}: {
  summary: ReactNode
  tone?: 'neutral' | 'caution'
  open?: boolean
  className?: string
  children: ReactNode
}) {
  const colour = tone === 'caution' ? 'text-caution-900' : 'text-brand-700'
  return (
    <details open={open} className={className}>
      <summary
        className={`group flex cursor-pointer list-none items-center gap-1.5 text-meta font-medium ${colour}`}
      >
        {/* The one affordance `list-none` takes away. A summary styled as a link reads as a
            link, and a reader who does not know it expands never opens it — so the marker is
            drawn back, and rotated by CSS on `[open]` rather than by any script. */}
        <svg
          viewBox="0 0 12 12"
          width="10"
          height="10"
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-90"
        >
          <path
            d="M4 2.5 L8 6 L4 9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="underline decoration-hairline underline-offset-2">{summary}</span>
      </summary>
      {children}
    </details>
  )
}

/* ── Numbered flow ─────────────────────────────────────────────────────────────────────── */

export interface FlowStage {
  readonly title: string
  readonly body?: string
}

/**
 * An ordered sequence of stages, numbered — VR-08's "How it works", VR-09's stage bar and
 * VR-11's "What happens next" are the same shape at two orientations.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **It describes; it does not navigate.** All three mockups draw the flow as a wizard whose
 * stages are pages you click through. None of ours are: creating a route is one form and then
 * the route itself, correcting a field is one form, and reporting is one form. So this is an
 * `<ol>` saying what is about to happen or what happens next — which is the half of the
 * mockup carrying the meaning. A contributor who does not know what a report leads to is the
 * reason VR-11 draws that panel at all.
 *
 * A list rather than a row of links is also the honest rendering for a screen reader: five
 * numbered items read as five numbered items, not as five links that go nowhere. The
 * connectors are `aria-hidden`, like every other decorative mark here.
 */
export function NumberedFlow({
  stages,
  orientation = 'vertical',
  current,
  className = '',
}: {
  stages: readonly FlowStage[]
  orientation?: 'vertical' | 'horizontal'
  /** 1-based. Marks where the reader is now; omit where the flow is purely explanatory. */
  current?: number
  className?: string
}) {
  if (orientation === 'horizontal') {
    return (
      <ol className={`flex flex-wrap items-start gap-x-6 gap-y-4 ${className}`}>
        {stages.map((stage, index) => {
          const here = current === index + 1
          return (
            <li key={stage.title} className="flex min-w-48 flex-1 items-start gap-3">
              <FlowNumber n={index + 1} here={here} />
              <div className="min-w-0">
                <p className={`text-sm ${here ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                  {stage.title}
                </p>
                {stage.body === undefined ? null : (
                  <p className="mt-0.5 text-meta leading-5 text-ink-500">{stage.body}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className={`space-y-4 ${className}`}>
      {stages.map((stage, index) => (
        <li key={stage.title} className="flex items-start gap-3">
          <FlowNumber n={index + 1} here={current === index + 1} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-900">{stage.title}</p>
            {stage.body === undefined ? null : (
              <p className="mt-0.5 text-meta leading-5 text-ink-700">{stage.body}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function FlowNumber({ n, here }: { n: number; here: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-semibold ${
        here ? 'bg-brand-700 text-white' : 'border border-hairline bg-surface-muted text-ink-500'
      }`}
    >
      {n}
    </span>
  )
}

/* ── Guidance list ─────────────────────────────────────────────────────────────────────── */

/**
 * A short list of guidance points — VR-08's "Tips for a good update", VR-09's "Tips for
 * creating a great route", VR-11's "How quarantine works".
 *
 * The marker is a small dot, not a green tick. VR-08 and VR-09 both draw green ticks beside
 * every line, and a green tick means *this is done* or *this is correct* — neither of which
 * is true of advice a contributor has not taken yet. Green also reads as a safety signal on a
 * platform careful never to make one (invariant 12).
 */
export function GuidanceList({
  lines,
  className = '',
}: {
  /**
   * Named `lines` rather than the obvious `points`, because `points` is one of the words the
   * gamification guard forbids anywhere in `src/` — §25 and CLAUDE.md §11 keep contribution
   * from becoming a score, and the guard cannot tell a prop name from a currency. Renaming is
   * cheaper than widening a guard that is doing its job.
   */
  lines: readonly string[]
  className?: string
}) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {lines.map((line) => (
        <li key={line} className="flex items-start gap-2.5 text-meta leading-5 text-ink-700">
          <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}

/* ── Facts ─────────────────────────────────────────────────────────────────────────────── */

export interface Fact {
  readonly label: ReactNode
  readonly value: ReactNode
}

/**
 * Label-and-value rows — VR-08's current-information panel, VR-09's route summary.
 *
 * A real `<dl>`, because that is what it is: a screen reader announces "Source: university
 * websites" as a pair, where two `<p>`s announce two unrelated sentences. `rows` puts the
 * label beside the value for a narrow rail; `stacked` puts it above, for a wider column where
 * the values are long enough to wrap.
 */
export function FactList({
  facts,
  layout = 'rows',
  className = '',
}: {
  facts: readonly Fact[]
  layout?: 'rows' | 'stacked'
  className?: string
}) {
  if (layout === 'stacked') {
    return (
      <dl className={`space-y-3 ${className}`}>
        {facts.map((fact, index) => (
          <div key={index}>
            <dt className="text-micro font-medium tracking-wide text-ink-500 uppercase">
              {fact.label}
            </dt>
            <dd className="mt-0.5 text-sm leading-6 text-ink-900">{fact.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl className={`divide-y divide-hairline ${className}`}>
      {facts.map((fact, index) => (
        <div key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
          <dt className="text-meta text-ink-500">{fact.label}</dt>
          <dd className="text-meta text-ink-900">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ── Choice grid ───────────────────────────────────────────────────────────────────────── */

export interface Choice {
  readonly value: string
  readonly title: ReactNode
  readonly description?: ReactNode
}

/**
 * A grid of radio cards — VR-11's "What would you like to report?".
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **A native radio inside each card, visible, rather than a hidden input and a drawn box.**
 *
 * The usual trick is `sr-only` on the input and `peer-checked` on a hand-drawn circle. It
 * looks the same and behaves worse: the focus ring goes with the hidden input, so a keyboard
 * user loses the one indicator telling them where they are, and Windows high-contrast mode
 * paints the real control rather than the drawn one. The card styling here is additive —
 * `has-checked:` tints the card containing a checked radio — so the native control keeps its
 * focus, its hit area and its high-contrast rendering.
 *
 * What this replaces is eight report reasons as eight one-line `<option>`s, and the
 * difference is not decoration: the descriptions are what stop "this deadline is out of date"
 * being filed as a phishing report (§23.1).
 */
export function ChoiceGrid({
  name,
  choices,
  defaultValue,
  columns = 3,
  required = false,
  className = '',
}: {
  name: string
  choices: readonly Choice[]
  defaultValue?: string
  columns?: 2 | 3
  /**
   * Marks the whole group required, which for radios means putting the attribute on every
   * input in it. Worth doing rather than leaving to the server: the action refuses an
   * unreadable enum outright (audit F9, "a malformed enum is refused rather than defaulted"),
   * and refusal reaches the reader as the error boundary. Catching an empty group in the
   * browser is the difference between a hint and a blank page.
   */
  required?: boolean
  className?: string
}) {
  const cols = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
  return (
    <div className={`grid gap-3 ${cols} ${className}`}>
      {choices.map((choice) => (
        <label
          key={choice.value}
          className="flex cursor-pointer items-start gap-2.5 rounded-control border border-hairline bg-surface p-3 hover:border-brand-500 has-checked:border-brand-700 has-checked:bg-brand-50"
        >
          <input
            type="radio"
            name={name}
            value={choice.value}
            required={required}
            defaultChecked={defaultValue === choice.value}
            className="mt-0.5 shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink-900">{choice.title}</span>
            {choice.description === undefined ? null : (
              <span className="mt-0.5 block text-meta leading-5 text-ink-500">
                {choice.description}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  )
}
