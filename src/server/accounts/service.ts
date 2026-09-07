// No `server-only` import: nothing else in `src/server` uses one. The ESLint
// import boundary already refuses a database client outside `src/server/**`, and a runtime
// guard here would only break the integration tests that need to call this directly.
import { prisma } from '@/server/db/client'

/**
 * Leaving — Phase 13 (FR-26, BR-16, §24.1, invariant 5).
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **A person could delete one journey but could not leave.** `deleteJourney` has existed since
 * Phase 7 and does the right thing for one followed route. There was no way to close the
 * account itself — which, on a platform that asks somebody to sign in with Google and then
 * keeps their private dates and notes, is the one thing a privacy promise has to include.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why this closes the account instead of deleting the row.**
 *
 * `prisma.user.delete()` was the obvious implementation. It cannot work, and it would be wrong
 * if it could.
 *
 * It cannot work because every attribution in this schema is `onDelete: SetNull` — a revision's
 * `authorId`, a route's `createdById`, a confirmation's author. Setting a revision's `authorId`
 * to null is an **UPDATE on a revision row**, and `vindeshi_revisions_are_immutable` refuses
 * UPDATE on all four revision tables outright. The delete fails with `restrict_violation`. That
 * trigger is one of the three layers holding invariant 2 (FR-20, BR-03) and is not being
 * loosened to make a delete possible.
 *
 * It would be wrong because **the handle was never personal data.** It is generated, never
 * derived from the provider's display name, never an email (§24.3). Erasing it would strip a
 * public knowledge ledger of its authorship in order to remove an identifier that identifies
 * nobody — and the ledger is the thing every reader of this site is relying on.
 *
 * So the rule is: **erase the person, keep the pseudonym.**
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **What is destroyed, and what survives.** This list is the privacy policy's source of truth;
 * if it changes, that page changes with it.
 *
 * Destroyed, irreversibly:
 *
 *   `email`                the only value here that names a real person
 *   `Account`              the OAuth links — provider, provider account id, tokens
 *   `Session`              every session, so the account is signed out everywhere at once
 *   `Journey`              every followed route, and by cascade every `JourneyStepProgress`
 *                          (status, target dates, actual dates, private notes),
 *                          `JourneyTask` and `JourneyChangeNote`
 *
 * Kept:
 *
 *   the `User` row         id, handle, `createdAt`, and `closedAt` set to now
 *   every contribution     revisions, confirmations, challenges, reports, routes created —
 *                          attributed to a handle that from now on identifies nobody
 *
 * **There is no undo, and no route back in.** The email is gone, so the same Google account
 * signing in afterwards is a genuinely new user with a new handle and no history. That is the
 * intended behaviour, not a limitation: leaving means leaving.
 */
export interface AccountClosure {
  /** How many followed routes were destroyed — shown back to the person as confirmation. */
  readonly journeysDeleted: number
}

export async function closeAccount({ userId }: { readonly userId: string }): Promise<AccountClosure> {
  /*
   * One transaction. A partial closure is the worst possible outcome — an account whose
   * journeys are gone but whose email remains is neither closed nor usable, and the person has
   * no way to tell which half succeeded.
   */
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: userId },
      select: { closedAt: true },
    })

    // Idempotent rather than an error. A double-submitted form, or a second tab, should not
    // produce a failure page for somebody who has already left.
    if (existing === null || existing.closedAt !== null) return { journeysDeleted: 0 }

    /*
     * Journeys first, and by `userId` rather than one at a time. `JourneyStepProgress`,
     * `JourneyTask` and `JourneyChangeNote` follow by `ON DELETE CASCADE` — the private notes
     * and dates live there, so this is the line that actually erases what was written.
     */
    const journeys = await tx.journey.deleteMany({ where: { userId } })

    // The OAuth links and every live session. Doing this before the user row means an
    // interrupted transaction can never leave a signed-in session against a closed account.
    await tx.account.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })

    await tx.user.update({
      where: { id: userId },
      data: { email: null, closedAt: new Date() },
    })

    return { journeysDeleted: journeys.count }
  })
}

/**
 * Is this account closed?
 *
 * Read on the contributor page, so a closed contributor's page says so rather than presenting
 * them as somebody a reader might expect an answer from.
 */
export async function isAccountClosed(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { closedAt: true } })
  return user?.closedAt != null
}
