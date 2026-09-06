import { expect, test, type Page } from '@playwright/test'

/**
 * Presentation, responsiveness and accessibility in a browser — Phase 12.
 *
 * These are the claims a static guard cannot make. Whether the page overflows sideways at
 * 360px, whether the narrow road is the one actually painted, whether a keyboard can reach
 * the content — all of them need a real viewport and a real layout pass.
 *
 * The spec runs under both Playwright projects, so every assertion below is checked at
 * **360px and 1280px**, and the few that differ between them branch on the viewport rather
 * than being written twice.
 */

const seeded = !process.env.E2E_BASE_URL

/** The pages a reader can reach without an account. */
const PUBLIC_PAGES = ['/en', '/en/routes', '/en/signin', '/en/routes/new']

test.describe('presentation and responsiveness', () => {
  /**
   * **The Phase 12 exit criterion.** CLAUDE.md §7.2: wide content scrolls inside its own
   * container; the page itself never scrolls sideways. A page that overflows horizontally on
   * a phone is the single most common way a "responsive" site turns out to be a scaled
   * desktop one.
   *
   * Checked against `documentElement.scrollWidth` rather than by looking, with a pixel of
   * tolerance for sub-pixel rounding in the layout engine.
   */
  test('no page scrolls sideways', async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path)
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement
        return doc.scrollWidth - doc.clientWidth
      })
      expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1)
    }
  })

  test('every page has landmarks and exactly one first-level heading', async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path)
      // Landmarks a screen-reader user navigates by.
      await expect(page.locator('header'), path).toHaveCount(1)
      await expect(page.locator('main#main'), path).toHaveCount(1)
      await expect(page.locator('footer'), path).toHaveCount(1)
      // Exactly one h1: more than one makes the document outline meaningless.
      expect(await page.locator('h1').count(), `${path} h1 count`).toBe(1)
    }
  })

  /**
   * Every page carries its own title. Before Phase 12 they all shared one, which made a
   * browser tab, a history entry and a bookmark equally useless.
   */
  test('page titles are distinct and name their subject', async ({ page }) => {
    const titles = new Map<string, string>()
    for (const path of PUBLIC_PAGES) {
      await page.goto(path)
      titles.set(path, await page.title())
    }
    expect(new Set(titles.values()).size, 'titles must differ').toBe(PUBLIC_PAGES.length)
    for (const [path, title] of titles) {
      expect(title, path).toContain('Vindeshi Express')
    }
  })

  /**
   * The skip link is the first thing a keyboard reaches, and it must actually be visible when
   * focused — an `sr-only` link that never reveals itself is a link only a screen reader
   * benefits from, which is half the point missed.
   */
  test('a keyboard reaches the skip link first, and it becomes visible', async ({ page }) => {
    await page.goto('/en')
    await page.keyboard.press('Tab')

    const focused = page.locator(':focus')
    await expect(focused).toHaveText(/skip to content/i)
    await expect(focused).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.locator('main#main')).toBeVisible()
  })

  test('every interactive control on the search page is keyboard reachable', async ({ page }) => {
    await page.goto('/en/routes')
    // A control that cannot be tabbed to is a control that does not exist for a keyboard.
    const unreachable = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('a[href], button, select, input, textarea')]
      return controls
        .filter((el) => (el as HTMLElement).tabIndex < 0)
        .map((el) => el.tagName.toLowerCase())
    })
    expect(unreachable).toEqual([])
  })
})

test.describe('the road reflows rather than shrinking', () => {
  test.skip(!seeded, 'needs the seeded route; the deployed target is deliberately not seeded')

  /**
   * **The Phase 12 mobile finding, asserted.** `ROAD_NARROW` existed from Phase 4 and nothing
   * selected it, so every phone was served the 5-column desktop road inside a scroller —
   * exactly the "scaled desktop" CLAUDE.md §7 and VR-12 forbid.
   *
   * Both densities are in the markup and CSS chooses; this asserts the *visible* one is the
   * right one for the viewport, which is the part that actually matters to a reader.
   */
  test('a phone gets the narrow road and a desktop gets the wide one', async ({ page }) => {
    await page.goto('/en/routes/e2e-test-route')

    const roads = page.locator('svg[data-route-visual="road"]')
    // Both are rendered — one per density — and exactly one is visible.
    expect(await roads.count()).toBeGreaterThanOrEqual(2)

    /**
     * Read from the **viewBox**, not the `width` attribute.
     *
     * Phase 12C removed `width`/`height` from the SVG: pinning the drawing to a pixel size
     * is what kept the ribbon 160px wide inside a 790px row, so the road now scales to its
     * container through `w-full` and a viewBox. The viewBox is what still says which density
     * produced the drawing, which is what this test is actually about.
     */
    const visible = await page.evaluate(() =>
      [...document.querySelectorAll('svg[data-route-visual="road"]')]
        .filter((el) => (el as SVGElement).getBoundingClientRect().width > 0)
        .map((el) => Number((el.getAttribute('viewBox') ?? '').split(/\s+/)[2])),
    )
    expect(visible.length, 'exactly one road should be painted').toBe(1)

    /**
     * Compared against the geometry the layout pass actually produces for *this* route,
     * rather than a fixed threshold.
     *
     * The first version asserted `> 500` for desktop and failed at 384 — because the seeded
     * route has only two ranks, so even the full-width density is 384px wide. A magic number
     * chosen against an imagined route is a test that fails on the real one.
     */
    const { layout, ROAD, ROAD_NARROW } = await import('../src/renderer')
    const { loadRouteGraph } = await import('../src/server/revisions/read')
    const { prisma } = await import('../src/server/db/client')

    const route = await prisma.route.findUniqueOrThrow({
      where: { slug: 'e2e-test-route' },
      select: { id: true },
    })
    const graph = await loadRouteGraph(route.id)
    const expected =
      (page.viewportSize()?.width ?? 0) < 640
        ? layout(graph, ROAD_NARROW).width
        : layout(graph, ROAD).width

    expect(visible[0], 'the painted road should match this viewport’s density').toBe(expected)
  })

  test('a road station opens its detail by keyboard without leaving the route', async ({ page }) => {
    await page.goto('/en/routes/e2e-test-route')

    // An interactive SVG is a group, not an image: its station links must remain exposed
    // to keyboards and assistive technology (FR-06). CSS exposes only one density.
    const road = page.locator('svg[data-route-visual="road"]:visible')
    await expect(road).toHaveAttribute('role', 'group')
    const station = road.locator('a[href]').first()
    const href = await station.getAttribute('href')
    expect(href).not.toBeNull()
    const target = new URL(href!, page.url())
    expect(target.pathname).toBe('/en/routes/e2e-test-route')
    expect(target.searchParams.get('step')).toBeTruthy()

    await station.focus()
    await expect(station).toBeFocused()
    // A programmatic focus alone also succeeds for tabindex=-1. Traverse to the next
    // station and back so the test proves these are in the actual keyboard tab order.
    await page.keyboard.press('Tab')
    await expect(road.locator('a[href]').nth(1)).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(station).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL((url) =>
      url.pathname === target.pathname && url.searchParams.get('step') === target.searchParams.get('step'),
    )
    await expect(road).toBeVisible()
    await expect(road.locator('a[aria-current="step"]')).toHaveCount(1)
    await expect(page.locator('#route-step-info')).toBeVisible()
  })

  /**
   * **The Phase 12C defect, asserted so it cannot silently return.**
   *
   * `RIBBON.columnWidth` was 30, so an eight-step ribbon drew about 160px inside a ~790px
   * search result — a thumbnail where VR-03 shows a full-width band. The ribbon is not a
   * picture of the route, it *is* the route compressed (invariant 25, D-33), and at a fifth
   * of the row it could not do that job.
   *
   * Measured as a **fraction of the row it sits in**, not against a pixel threshold: the
   * whole point is that it fills whatever space it is given, at every viewport, so a fixed
   * number would only be right at one width.
   */
  test('a ribbon fills the row it sits in, at every viewport', async ({ page }) => {
    await page.goto('/en/routes')

    const ribbon = page.getByRole('img').first()
    await expect(ribbon).toBeVisible()

    const ratio = await page.evaluate(() => {
      /**
       * The **visible** ribbon, not the first one in the DOM.
       *
       * The ribbon became a responsive pair — a narrow density and a wide one, with CSS
       * hiding whichever does not suit the viewport, exactly as `ResponsiveRoad` works. The
       * narrow one is first in source order, so at desktop `querySelector` returned the
       * hidden element and this measured a ratio of 0. The road test above already reads the
       * painted one for the same reason; this had not caught up.
       */
      const svg = [...document.querySelectorAll('main [role="img"]')].find(
        (el) => el.getBoundingClientRect().width > 0,
      )
      if (!svg) return 0
      // The nearest block ancestor is the row the ribbon is laid out in.
      const row = svg.parentElement?.getBoundingClientRect().width ?? 0
      return row === 0 ? 0 : svg.getBoundingClientRect().width / row
    })

    expect(ratio, 'the ribbon should occupy most of its row').toBeGreaterThanOrEqual(0.85)
  })

  test('the road scrolls inside its own container, never the page', async ({ page }) => {
    await page.goto('/en/routes/e2e-test-route')
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(pageOverflow).toBeLessThanOrEqual(1)
  })
})

/**
 * CLAUDE.md §7.2, asserted where it is actually true or false — Phase 12E.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * "One canvas width and one gutter, shared by the header, every page and the footer. That
 * shared edge is what gives the interface a stable vertical axis at every viewport size."
 *
 * There is already an architecture guard for this, and it **missed a page**. It reads each
 * page file for `<PageCanvas`, and `routes/new/page.tsx` has one — in the branch that renders
 * for a signed-in contributor. The anonymous branch returned a bare `ContentColumn`, so the
 * heading sat flush against x=0 while the header and footer were inset: no gutter at all, on
 * the page somebody sees at the moment they decide whether this platform is real.
 *
 * A source-text check cannot see which branch renders. This compares the page's own heading
 * to the header's brand mark in a real browser, which is the property §7.2 states rather than
 * a proxy for it — and it holds however the page is written.
 */
/** The header's own left edge, and the page heading's, in one measurement. */
async function measureEdges(
  page: Page,
): Promise<{ header: number; heading: number } | null> {
  return page.evaluate(() => {
    const header = document.querySelector('header a')
    const heading = document.querySelector('main h1')
    if (!header || !heading) return null
    return {
      header: header.getBoundingClientRect().left,
      heading: heading.getBoundingClientRect().left,
    }
  })
}

test.describe('every page shares one left edge with the header', () => {
  const PAGES = ['/en', '/en/routes', '/en/routes/new', '/en/signin', '/en/journeys']

  /**
   * §7.2 allows one exception, and the 404 is it: "`centred` exists for screens that
   * genuinely contain only reading matter, and should be rare."
   *
   * Encoded rather than excluded. A centred page still has to sit *inside* the canvas — the
   * failure this whole describe block exists to catch is a page with no gutter at all, and
   * that is caught by `left >= header`, which a centred column satisfies and a missing canvas
   * does not.
   */
  const CENTRED = ['/en/routes/definitely-not-a-real-route']

  for (const path of CENTRED) {
    test(`${path} is centred, but still inside the canvas`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status(), `${path} should be a 404, not a failure`).toBe(404)
      // Wait for the heading rather than assuming `goto` implies a painted page. This test
      // read a null DOM once and passed on the retry, which is the signature of a race, not
      // of a fix — every page here queries a database whose compute scales to zero, so a
      // cold first request genuinely takes seconds.
      await expect(page.locator('main h1')).toBeVisible()

      const edges = await measureEdges(page)
      expect(edges, `${path} needs a header link and an h1 to compare`).not.toBeNull()
      if (!edges) return
      expect(edges.heading, `${path} sits outside the canvas`).toBeGreaterThanOrEqual(
        edges.header - 2,
      )
    })
  }

  for (const path of PAGES) {
    test(`${path} is inset like the header`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status(), `${path} should render`).toBeLessThan(500)
      await expect(page.locator('main h1')).toBeVisible()

      const edges = await measureEdges(page)
      expect(edges, `${path} needs a header link and an h1 to compare`).not.toBeNull()
      if (!edges) return

      // Not exact: a heading may sit inside a grid region that starts at the canvas edge, and
      // sub-pixel layout differs between engines. Two pixels is far tighter than the ~20-40px
      // gutter a missing canvas removes, which is the failure this exists to catch.
      expect(
        Math.abs(edges.heading - edges.header),
        `${path}: heading at ${edges.heading}, header at ${edges.header}`,
      ).toBeLessThanOrEqual(2)
    })
  }
})

test.describe('the voluntary support link', () => {
  /**
   * §10.1 and invariant 13. The link is permitted; everything around it is not.
   */
  test('is an unobtrusive outbound link that promises nothing', async ({ page }) => {
    await page.goto('/en')

    const link = page.getByRole('link', { name: /support vindeshi express/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /^https:\/\/[^/]*gumroad\.com\//)
    await expect(link).toHaveAttribute('rel', /external/)

    // It sits in the footer, not in route content or navigation.
    expect(await page.locator('footer').getByRole('link', { name: /support/i }).count()).toBe(1)
    expect(await page.locator('header').getByRole('link', { name: /support/i }).count()).toBe(0)

    // It says outright that it buys nothing (invariant 13, FR-78, BR-13, BR-14).
    await expect(page.getByText(/supporting it affects no route/i)).toBeVisible()

    // And it does not compete with the primary action.
    await expect(page.getByRole('link', { name: /find my route/i }).first()).toBeVisible()

    // Nothing on the page collects a payment detail.
    expect(await page.locator('input[type="password"], input[name*="card" i]').count()).toBe(0)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Phase 12F — the phone and the tablet as their own compositions
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/** The `md` breakpoint, which is where the phone composition ends and the tablet one begins. */
const TABLET_MIN = 768

test.describe('the phone gets a bottom tab bar, and larger screens do not', () => {
  /**
   * **VR-12, VR-13 and VR-14 all draw one, and it is not decoration.**
   *
   * A phone's reachable area is the bottom third of the screen, and this product's two primary
   * destinations — find a route, look at my journey — are places a reader moves between
   * constantly. A header nav on a phone puts both of them where a thumb cannot get to them.
   *
   * Asserted as *visible*, not as present in the markup: the bar is `md:hidden`, so a test that
   * only counted elements would pass at every width and prove nothing about either.
   */
  test('is visible on a phone and hidden from the tablet breakpoint up', async ({ page }) => {
    await page.goto('/en/routes')
    const bar = page.getByRole('navigation', { name: 'Main sections' })
    const phone = (page.viewportSize()?.width ?? 0) < TABLET_MIN

    if (phone) {
      await expect(bar).toBeVisible()
    } else {
      await expect(bar).toBeHidden()
    }
  })

  test('offers three real links, each a comfortable touch target', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= TABLET_MIN, 'phone only')
    await page.goto('/en/routes')

    const links = page.getByRole('navigation', { name: 'Main sections' }).getByRole('link')
    // Three, not VR-12's four: there is no cross-route updates feed to point a fourth at,
    // and a tab that leads nowhere is worse than an absent one.
    await expect(links).toHaveCount(3)

    for (let index = 0; index < 3; index += 1) {
      const link = links.nth(index)
      // A real destination, so the bar works with JavaScript disabled and can be opened in a
      // new tab like any other link.
      expect(await link.getAttribute('href')).toBeTruthy()
      const box = await link.boundingBox()
      // §32 and the Phase 12F exit criterion: 44px is the minimum comfortable target.
      expect(box?.height ?? 0, `tab ${index} height`).toBeGreaterThanOrEqual(44)
    }
  })

  /**
   * The current tab is announced, not merely coloured (§10.4). `aria-current="page"` is what a
   * screen-reader user gets; the bold label is what everybody else gets. Neither is the colour.
   */
  test('marks the tab you are on with aria-current', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= TABLET_MIN, 'phone only')
    await page.goto('/en/routes')

    const bar = page.getByRole('navigation', { name: 'Main sections' })
    await expect(bar.locator('[aria-current="page"]')).toHaveCount(1)
    await expect(bar.locator('[aria-current="page"]')).toHaveText(/Explore/)
  })

  /**
   * The bar is `position: fixed`, so it is out of flow and would sit on top of whatever ends
   * the page. The shell pads for it below `md`; this proves the padding is real rather than
   * intended, by checking the footer's last text is not underneath the bar.
   */
  test('does not cover the end of the page', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= TABLET_MIN, 'phone only')
    await page.goto('/en/routes')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    const footer = await page.locator('footer').boundingBox()
    const bar = await page
      .getByRole('navigation', { name: 'Main sections' })
      .boundingBox()

    expect(footer, 'footer box').not.toBeNull()
    expect(bar, 'tab bar box').not.toBeNull()
    // The footer's bottom edge must clear the bar's top edge once scrolled to the end.
    expect(footer!.y + footer!.height).toBeLessThanOrEqual((bar?.y ?? 0) + 1)
  })

  /**
   * The header must not offer the same two destinations the bar already carries — one
   * destination twice on one small screen is not twice as reachable, it is one more thing to
   * read past. And nothing may become *unreachable*: the auth control stays in the header.
   */
  test('the header stops duplicating the bar on a phone', async ({ page }) => {
    await page.goto('/en/routes')
    const header = page.locator('header')
    const phone = (page.viewportSize()?.width ?? 0) < TABLET_MIN

    const routesLink = header.getByRole('link', { name: 'Routes', exact: true })
    if (phone) {
      await expect(routesLink).toBeHidden()
    } else {
      await expect(routesLink).toBeVisible()
    }

    // At every width, the way in or out of an account is in the header.
    await expect(header.getByRole('link', { name: /Sign in/i })).toBeVisible()
  })
})

test.describe('the tablet is two panels, not a desktop with a hole in it', () => {
  test.skip(!seeded, 'needs the seeded route; the deployed target is deliberately not seeded')

  /**
   * **The Phase 12F composition finding.**
   *
   * `GridRegion`'s default mapping sent both a span-8 body and a span-4 rail to a full tablet
   * row. At 768px that put the body across the row, the rail on the *next* row at half width,
   * and nothing in the other half — which is neither the stacked phone layout nor the
   * two-panel one, but a desktop layout with a hole in it.
   *
   * Asserted geometrically rather than by class name: what matters is that the two regions
   * share a horizontal band at tablet width and stack at phone width, and a class assertion
   * would pass while a later Tailwind change quietly stopped generating the utility.
   */
  test('the route body and its rail sit side by side at 768 and stack below it', async ({
    page,
  }) => {
    await page.goto('/en/routes/e2e-test-route')

    const road = await page.locator('#route-map').boundingBox()
    // The passport panel, by its accessible name — the rail's own first child, and the one
    // element that is unambiguously in the rail rather than the body.
    const passport = await page
      .getByRole('region', { name: 'What is known about this route' })
      .boundingBox()

    expect(road, 'road box').not.toBeNull()
    expect(passport, 'rail box').not.toBeNull()

    const width = page.viewportSize()?.width ?? 0
    // Vertical overlap is the definition of "side by side" that survives either region being
    // the taller one.
    const overlap =
      Math.min(road!.y + road!.height, passport!.y + passport!.height) -
      Math.max(road!.y, passport!.y)

    if (width >= TABLET_MIN) {
      expect(overlap, 'body and rail should share a band at tablet width and up').toBeGreaterThan(0)
      expect(passport!.x, 'the rail sits to the right of the body').toBeGreaterThan(road!.x)
    } else {
      expect(overlap, 'body and rail should stack on a phone').toBeLessThanOrEqual(0)
    }
  })
})
