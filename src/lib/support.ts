/**
 * The voluntary support destination — CLAUDE.md §10.1, Phase 12.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **This constant is the entire integration.** There is no client, no SDK, no webhook, no API
 * key and no callback. A reader clicks a link, leaves for Gumroad, and whatever happens there
 * is invisible to this application — permanently, by construction rather than by policy.
 *
 * What §10.1 forbids, and what is therefore absent from the whole codebase:
 *
 *   no Gumroad API integration      nothing here calls Gumroad, and nothing can
 *   no payment table                the schema has no payment, donation or supporter model
 *   no donor profile                `User` has no supporter column to set or read
 *   no supporter status             so no code path could branch on one
 *   no receipts, no verification    the platform never learns that anybody supported it
 *
 * The last point is the load-bearing one. Invariant 13 says trust is never purchasable, and
 * the strongest way to keep that is not a rule about how a supporter flag may be used — it is
 * having no flag. A supporter and a non-supporter are the same row.
 *
 * **Adding any of the above is a new change request**, not a refinement of this one (§10.1).
 *
 * Kept in its own module rather than inlined so `tests/architecture/support-link.test.ts` can
 * assert there is exactly one outbound destination and that nothing else in `src/` reaches
 * for a payment host.
 */
export const SUPPORT_URL = 'https://vindeshi.gumroad.com/l/support'

/**
 * The host a reader is sent to, for the "you are leaving" affordance.
 *
 * Derived from the URL rather than written twice: invariant 10 requires the real destination
 * to be visible before somebody leaves, and a hardcoded label that drifted from the href
 * would be exactly the deception that rule exists to prevent.
 */
export const SUPPORT_HOST = new URL(SUPPORT_URL).host
