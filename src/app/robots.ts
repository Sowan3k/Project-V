import type { MetadataRoute } from 'next'

/**
 * What a crawler may read — Phase 12.
 *
 * The read path is public by design (FR-01, D-03): search, ribbons, roads, steps, fields,
 * history and change comparisons are all readable with no account, and a student looking for
 * "Bangladesh to Germany masters visa steps" should be able to find them.
 *
 * Two things are kept out, and neither is a secret:
 *
 *   `/admin`     a moderation queue has no business in a search index. It already answers
 *                404 to anyone who is not an administrator (§23.3), so this is tidiness
 *                rather than protection — but a disallow costs nothing and an indexed
 *                moderation URL invites people to try it.
 *
 *   `/journeys`  a private journey is behind a session. A crawler would index the sign-in
 *                prompt, which is a wrong and slightly alarming search result for a page
 *                whose whole point is that only its owner can see it (invariant 5).
 *
 *   `/account`   the same, and one degree worse: a search result reading "Your account —
 *                Vindeshi Express" against somebody else's site is exactly the shape of a
 *                phishing page, and this product spends a lot of effort teaching readers to
 *                distrust that shape (FR-64, FR-67). The page itself answers 404 to anyone
 *                without a session; the `robots` metadata on it is the second layer.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/en/admin/', '/en/journeys', '/en/account', '/api/'],
    },
  }
}
