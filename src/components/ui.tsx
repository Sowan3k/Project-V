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
    <Component
      className={`rounded-panel border ${surface} ${padded ? 'p-5' : ''} ${className}`}
    >
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

export type ButtonTone = 'primary' | 'secondary' | 'bare'

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
  const base =
    'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors'
  const sizes: Record<ButtonSize, string> = {
    default: 'px-4 py-2.5 text-sm',
    compact: 'px-3 py-1.5 text-meta',
  }
  const tones: Record<ButtonTone, string> = {
    primary: 'bg-brand-700 text-white hover:bg-brand-900',
    secondary: 'border border-hairline bg-surface text-ink-900 hover:bg-surface-muted',
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
export function StatBand({ children, className = '' }: { children: ReactNode; className?: string }) {
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
