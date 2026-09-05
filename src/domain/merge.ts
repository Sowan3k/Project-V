import type { StudyLevel } from './enums'

/**
 * Which two routes may be declared duplicates of one another — audit F5, FR-40, BR-25, §40.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What was wrong.**
 *
 * `mergeRoutes` refused three things — a route merging into itself, a route already merged,
 * and a merge that would form a cycle — and permitted everything else. The administrator's
 * dropdown offered *every other route* as a canonical successor. So a Bangladesh→Germany
 * Master's route could be declared the superseded duplicate of a Bangladesh→Malaysia
 * Bachelor's route, and every guarantee downstream would hold perfectly while meaning nothing:
 * the histories stay intact, the followers keep their progress, and the readers of a German
 * route are pointed at Malaysia.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What decides compatibility, and why exactly these three.**
 *
 * Origin, destination and study level are the route's *search identity* — the three things a
 * visitor names to find a route at all (FR-01, §9) and the three the schema indexes together.
 * Two routes that disagree on any of them are not two descriptions of one journey; they are
 * two journeys. §40.4 permits combining duplicates "into a stronger canonical route", and a
 * route to a different country is not a duplicate of anything.
 *
 * They are compared as an exact match rather than scored. There is no similarity metric here
 * and there must not be: a threshold would need a number the baseline does not give, and
 * FR-71's objection to opaque derived judgements applies to a merge as much as to trust.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What deliberately does NOT decide it — and the open question.**
 *
 * `mechanism` and `intake` are checked and *reported*, never enforced. §40.1 says mechanism is
 * what makes two routes for the same pair materially different, which reads at first like a
 * fourth hard rule. It is not safe to make one, for a reason the baseline does not resolve:
 *
 *   * `mechanism` is nullable and means "not stated", not "none". The commonest real duplicate
 *     is a route somebody created without stating a mechanism beside the same route with one.
 *     Forbidding that merge would forbid the case merges exist for.
 *   * Two routes both stating a mechanism, and stating *different* ones, are what §40.1
 *     protects — but §40.4 equally permits an administrator to judge that one of them is
 *     simply mislabelled, and nothing in the baseline says which reading wins.
 *
 * The same applies to `intake`, which is free text ("2027 autumn") with no vocabulary.
 *
 * **This is a live modelling question and it is being surfaced rather than answered**
 * (CLAUDE.md §2: a rule that cannot be traced to the baseline is a change request). Until it
 * is decided, a mechanism or intake difference produces a *warning the administrator reads*,
 * which is the honest treatment of a judgement the baseline leaves to a person — and the same
 * shape §7.3 uses everywhere else: caution where a reader would otherwise draw a wrong
 * conclusion, never a silent block and never a silent pass.
 */

/** The parts of a route this decision is allowed to see. */
export interface MergeIdentity {
  readonly originCountry: string
  readonly destinationCountry: string
  readonly studyLevel: StudyLevel
  readonly mechanism: string | null
  readonly intake: string | null
}

/** Why a merge was refused, or what an administrator should look at before confirming one. */
export const MERGE_INCOMPATIBILITIES = [
  'origin',
  'destination',
  'study_level',
] as const
export type MergeIncompatibility = (typeof MERGE_INCOMPATIBILITIES)[number]

export const MERGE_CAUTIONS = ['differing_mechanism', 'differing_intake'] as const
export type MergeCaution = (typeof MERGE_CAUTIONS)[number]

export interface MergeCompatibility {
  /** False when the two routes are not descriptions of one journey. Refused server-side. */
  readonly compatible: boolean
  /** Empty when compatible. Each entry is a dimension on which the two disagree. */
  readonly blocking: readonly MergeIncompatibility[]
  /** Differences a person should weigh. Never blocking — see the note above. */
  readonly cautions: readonly MergeCaution[]
}

/**
 * Compares two routes' identities.
 *
 * Order-independent: which of a compatible pair survives is the administrator's decision, and
 * this answers only whether the pair is one journey.
 */
export function mergeCompatibility(
  duplicate: MergeIdentity,
  canonical: MergeIdentity,
): MergeCompatibility {
  const blocking: MergeIncompatibility[] = []
  if (duplicate.originCountry !== canonical.originCountry) blocking.push('origin')
  if (duplicate.destinationCountry !== canonical.destinationCountry) blocking.push('destination')
  if (duplicate.studyLevel !== canonical.studyLevel) blocking.push('study_level')

  const cautions: MergeCaution[] = []
  // Only when *both* state one. A null is "not stated", and the commonest genuine duplicate is
  // a route created without a mechanism beside the same route with one.
  if (
    duplicate.mechanism !== null &&
    canonical.mechanism !== null &&
    duplicate.mechanism !== canonical.mechanism
  ) {
    cautions.push('differing_mechanism')
  }
  if (duplicate.intake !== null && canonical.intake !== null && duplicate.intake !== canonical.intake) {
    cautions.push('differing_intake')
  }

  return { compatible: blocking.length === 0, blocking, cautions }
}

/** True when this pair may be offered as a merge candidate at all. */
export function isMergeCandidate(duplicate: MergeIdentity, canonical: MergeIdentity): boolean {
  return mergeCompatibility(duplicate, canonical).compatible
}
