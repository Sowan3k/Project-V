import type { ReactNode } from 'react'

/**
 * Page layout primitives.
 *
 * Two rules, and the second is the one that was being broken:
 *
 * **1. Centre the application canvas, not every component.** Before this existed, each page
 * picked its own `max-w-*` — 2xl for the landing page, 3xl for search, 4xl for a route, 5xl
 * for the header and footer — and centred it independently. The header and the content it sat
 * above therefore had *different* left edges, so the interface had no stable vertical axis at
 * any viewport width. Wide screens were mostly unused, and a route with a wrapping road had
 * less room than the header above it.
 *
 * **2. A narrower column is a reading measure, not a page width.** Long prose genuinely wants
 * ~65 characters. Search results, ribbons and roads do not, and forcing them through the same
 * container is how a route-oriented product ends up looking like a blog.
 *
 * So: `PageCanvas` establishes the axis — one width, one gutter, used by the header, every
 * page and the footer alike. `ContentColumn` constrains a *region* inside that canvas and
 * aligns it to the canvas gutter rather than re-centring it, so the axis survives.
 *
 * Not a design system. These are the structural primitives that later typography and colour
 * work can build on without first having to undo a narrow generic page.
 */

/** One gutter, everywhere. Changing it moves the whole interface together, which is the point. */
export const PAGE_GUTTER = 'px-5 sm:px-8 lg:px-10'

/** One canvas width, shared by header, content and footer so the vertical axis is stable. */
export const PAGE_CANVAS = 'mx-auto w-full max-w-[1360px]'

/**
 * How wide a region of content should be.
 *
 * Named by what the content *is*, not by a number, so a later change to the measure is one
 * edit rather than a search for every page that happened to use the same magic width.
 */
export type ContentWidth =
  /** Route-oriented screens: roads, comparisons, anything that wants horizontal room. */
  | 'canvas'
  /** Search results, ribbon lists, wide tables. */
  | 'wide'
  /** Forms and general screens. */
  | 'normal'
  /** Long prose. A measure, not a page width. */
  | 'reading'

const WIDTH: Record<ContentWidth, string> = {
  canvas: 'w-full',
  wide: 'w-full max-w-5xl',
  normal: 'w-full max-w-3xl',
  reading: 'w-full max-w-[68ch]',
}

/**
 * The application canvas: the single element that owns page gutters and overall width.
 *
 * Used by the header, the footer and every page, which is what gives the interface one
 * left edge at every breakpoint.
 */
export function PageCanvas({
  children,
  className = '',
  as: Component = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'header' | 'footer' | 'nav' | 'section'
}) {
  return <Component className={`${PAGE_CANVAS} ${PAGE_GUTTER} ${className}`}>{children}</Component>
}

/**
 * A width-constrained region *inside* the canvas.
 *
 * Left-aligned by default: re-centring a narrow column inside a wide canvas is exactly what
 * breaks the axis. `centred` exists for the rare screen that genuinely is only reading matter.
 */
export function ContentColumn({
  children,
  width = 'normal',
  centred = false,
  className = '',
}: {
  children: ReactNode
  width?: ContentWidth
  centred?: boolean
  className?: string
}) {
  return (
    <div className={`${WIDTH[width]} ${centred ? 'mx-auto' : ''} ${className}`}>{children}</div>
  )
}

/**
 * A desktop grid that reflows rather than shrinking.
 *
 * At narrow widths the regions stack in source order; at `lg` they become columns. The point
 * is that a phone gets a different composition, not a squeezed copy of the desktop one.
 */
export function PageGrid({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10 ${className}`}>
      {children}
    </div>
  )
}

/** A region within `PageGrid`. `span` is the desktop column count out of 12. */
export function GridRegion({
  children,
  span,
  className = '',
}: {
  children: ReactNode
  span: 4 | 5 | 6 | 7 | 8 | 12
  className?: string
}) {
  const spans: Record<number, string> = {
    4: 'lg:col-span-4',
    5: 'lg:col-span-5',
    6: 'lg:col-span-6',
    7: 'lg:col-span-7',
    8: 'lg:col-span-8',
    12: 'lg:col-span-12',
  }
  return <div className={`${spans[span] ?? ''} ${className}`}>{children}</div>
}
