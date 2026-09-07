import { prisma } from '@/server/db/client'

/**
 * How much of this record exists, and how much of it is moving — Phase 13C.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * VR-12 carries a band across the bottom of the browse page: *"50K+ Active Students · 200+
 * Destinations · 1.2M+ Steps Followed · 98% Community Verified"*, under the heading "Built by
 * Students. For Students. Vindeshi Express is the largest community platform for Bangladeshi
 * students…".
 *
 * The band is a good idea. **Three of the four figures as drawn are things this product must
 * not say**, and the difference is worth stating precisely, because "just build what the
 * mockup shows" would have shipped all three:
 *
 *   `98% Community Verified`   §8.6 lists this by name as a mockup exception. We are not an
 *                              admission or immigration authority (BR-20, invariant 12), and a
 *                              percentage implies a precision this data does not have (§7.3).
 *   `the largest …`            an unfalsifiable superlative about ourselves.
 *   `50K+`, `1.2M+`            rounded-up marketing shapes. §8.6: every number in the mockups
 *                              is illustrative and none of it is data.
 *
 * What survives is the honest half, and it is still worth having: **counts of things that
 * actually exist, stated exactly.**
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Three rules these follow.**
 *
 * 1. **Exact, never rounded up.** Seven routes is "7", not "5+". A platform that inflates the
 *    one number a reader can check has told them how to read every other number on the site.
 *
 * 2. **They confer nothing.** Invariant 14: raw counts never decide trust, ranking, archival
 *    or standing. Nothing reads this function except the component that displays it — it is a
 *    description of activity, and deliberately not an input to anything.
 *
 * 3. **They are honest at zero**, which is the case that actually matters right now. Production
 *    holds no routes, so this band reads 0/0/0/0 on the day it ships. §45 names the cold start
 *    as a real risk, and the answer is the one the empty states already use: say plainly that
 *    the record is new, rather than hiding the section or padding it. A visitor who sees a
 *    truthful zero and a visitor who sees an invented "50K+" learn opposite things about
 *    whether to believe the rest of the page.
 *
 * **No people are counted here.** Not sign-ups, not visitors, not followers. VR-12's "Active
 * Students" is a user count, and a public tally of accounts is a number nobody reading a route
 * benefits from and that quietly rewards growth over accuracy (§25). `contributors` counts
 * people **who have contributed** — which is a fact about the record, not about the audience —
 * and it counts distinct authors of revisions, so somebody who signed in and never wrote
 * anything is not in it.
 */
export interface PlatformActivity {
  /** Public routes that are not archived. */
  readonly routes: number
  /** Destinations those routes reach — VR-12's one figure that survives unchanged. */
  readonly destinations: number
  /** Distinct people who have written at least one revision. Never a sign-up count. */
  readonly contributors: number
  /** Every revision ever written. Append-only, so this only ever grows. */
  readonly contributions: number
  /** Announced route changes — VR-12's "Recently Updated", as a total. */
  readonly updates: number
  /** The most recent revision, so the band can say when the record last moved. */
  readonly lastActivityAt: Date | null
}

export async function platformActivity(): Promise<PlatformActivity> {
  /*
   * One round trip. This renders on the landing page, which is the first thing a cold visitor
   * loads, and Neon's wake-up is already the slow part — six sequential counts would be six
   * chances to make that worse.
   */
  const [routes, destinations, contributors, fieldRevisions, stepRevisions, updates, latest] =
    await Promise.all([
      prisma.route.count({ where: { archivedAt: null } }),
      prisma.route
        .findMany({
          where: { archivedAt: null },
          distinct: ['destinationCountry'],
          select: { destinationCountry: true },
        })
        .then((rows) => rows.length),

      /*
       * Distinct authors of field revisions. Not `user.count()`: that is how many accounts
       * exist, which is a different claim and one this product has no reason to publish.
       *
       * `authorId: { not: null }` excludes system-authored seed rows, which are real revisions
       * but not a person — counting them would credit the platform for its own scaffolding.
       */
      prisma.fieldRevision
        .findMany({
          where: { authorId: { not: null } },
          distinct: ['authorId'],
          select: { authorId: true },
        })
        .then((rows) => rows.length),

      prisma.fieldRevision.count(),
      prisma.stepRevision.count(),
      prisma.routeChange.count(),
      prisma.fieldRevision.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

  return {
    routes,
    destinations,
    contributors,
    // Field and step revisions together: both are somebody correcting the record, and
    // splitting them would be a distinction only this codebase cares about.
    contributions: fieldRevisions + stepRevisions,
    updates,
    lastActivityAt: latest?.createdAt ?? null,
  }
}
