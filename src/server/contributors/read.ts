import { prisma } from '@/server/db/client'

/**
 * Contributor history — Phase 8, FR-43, §25.
 *
 * "The platform shall be able to distinguish new contributors from contributors whose past
 * changes have earned community credibility."
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **This returns evidence, not a score, and that is a deliberate refusal.**
 *
 * CLAUDE.md §11 lists "exact contributor reputation labels and weights" as an open decision.
 * Inventing a number here would answer it by accident, and a reputation figure is exactly the
 * kind of thing that looks authoritative and is not. §25 is also explicit that reputation must
 * "reward useful contributions rather than raw volume" and must not turn the platform into "a
 * competitive points game" — so there is no score, no level, no badge tier and no ranking.
 *
 * What is returned is countable and checkable: how much they have contributed, when they
 * started, and **how much of their work other people have since confirmed**. That last one is
 * the only signal here that speaks to usefulness rather than volume, which is precisely what
 * §25 asks for. A reader weighs it themselves.
 *
 * And it decides nothing. No contribution is gated, ranked, hidden or promoted by any of it
 * (FR-71, BR-32, invariant 14).
 *
 * The handle is public, so this takes no viewer id — unlike everything in
 * `src/server/journeys/`, which takes one for exactly the opposite reason.
 */

export interface ContributorHistory {
  readonly handle: string
  readonly firstContributionAt: Date | null
  /** Revisions authored across routes, steps, edges and fields. */
  readonly contributionCount: number
  /** How many of their field revisions are the current value and have since been confirmed. */
  readonly confirmedContributionCount: number
  readonly confirmationsGiven: number
  readonly challengesRaised: number
}

export async function getContributorHistory(handle: string): Promise<ContributorHistory | null> {
  const user = await prisma.user.findUnique({ where: { handle }, select: { id: true } })
  if (!user) return null

  const [
    routeRevisions,
    stepRevisions,
    edgeRevisions,
    fieldRevisions,
    confirmationsGiven,
    challengesRaised,
  ] = await Promise.all([
    prisma.routeRevision.findMany({ where: { authorId: user.id }, select: { createdAt: true } }),
    prisma.stepRevision.findMany({ where: { authorId: user.id }, select: { createdAt: true } }),
    prisma.stepEdgeRevision.findMany({ where: { authorId: user.id }, select: { createdAt: true } }),
    prisma.fieldRevision.findMany({
      where: { authorId: user.id },
      select: { createdAt: true, currentOf: { select: { lastConfirmedAt: true } } },
    }),
    prisma.confirmation.count({ where: { authorId: user.id } }),
    prisma.challenge.count({ where: { authorId: user.id } }),
  ])

  const all = [...routeRevisions, ...stepRevisions, ...edgeRevisions, ...fieldRevisions]

  /**
   * "Since been confirmed" means: this revision is still the field's current value, **and**
   * somebody has confirmed that field. Both halves matter — a revision that was superseded
   * was not endorsed, and a current value nobody vouched for has not been checked.
   *
   * It is a weak signal on purpose. A strong one would need the reputation weights §11 leaves
   * open, and guessing them is how an open decision gets closed by accident.
   */
  const confirmedContributionCount = fieldRevisions.filter(
    (revision) => revision.currentOf !== null && revision.currentOf.lastConfirmedAt !== null,
  ).length

  const firstContributionAt = all.reduce<Date | null>(
    (earliest, row) =>
      earliest === null || row.createdAt.getTime() < earliest.getTime() ? row.createdAt : earliest,
    null,
  )

  return {
    handle,
    firstContributionAt,
    contributionCount: all.length,
    confirmedContributionCount,
    confirmationsGiven,
    challengesRaised,
  }
}
