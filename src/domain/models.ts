/**
 * What every persisted model *is*, and therefore which rules apply to it.
 *
 * This registry is the boundary between shared community knowledge and everything else. It
 * exists because the two must never be governed by the same machinery:
 *
 *   - **Shared knowledge is revisioned.** Every change appends, nothing is overwritten, and
 *     writes go only through the revision service (FR-19, FR-20, BR-02, BR-03).
 *   - **Private user state is not.** A follower's progress, target dates and notes are
 *     theirs. They are edited in place, are visible to nobody else, and must never travel
 *     through the public revision engine — a journey note is not a contribution and must
 *     never end up in a public history (FR-26, BR-16, D-10, invariant 5).
 *
 * `tests/architecture/model-classification.test.ts` asserts this registry covers every model
 * in the Prisma schema. A new model therefore fails the build until somebody decides which
 * side of the line it is on. That is deliberate: when Phase 7 adds `Journey`, the decision
 * gets made consciously rather than by whichever pattern was copied.
 */

/**
 * Shared community knowledge. Revisioned, append-only, never hard-deleted by a normal user.
 *
 * Both halves are listed — the entity and its revision table — because both are protected.
 * Rewriting history is as destructive as deleting it.
 */
export const REVISIONED_SHARED_MODELS = [
  'Route',
  'RouteRevision',
  'Step',
  'StepRevision',
  'StepEdge',
  'StepEdgeRevision',
  'Field',
  'FieldRevision',
] as const
export type RevisionedSharedModel = (typeof REVISIONED_SHARED_MODELS)[number]

/**
 * Revision tables specifically. Rows here are immutable once written: the database refuses
 * UPDATE and DELETE on them outright (see the revision-immutability migration).
 */
export const REVISION_MODELS = [
  'RouteRevision',
  'StepRevision',
  'StepEdgeRevision',
  'FieldRevision',
] as const
export type RevisionModel = (typeof REVISION_MODELS)[number]

/**
 * Private per-user state. Scoped to one user, never public, never revisioned.
 *
 * Phase 7 creates these tables. They are named here in advance so the classification test
 * forces the right answer at that moment rather than after the fact.
 */
export const PRIVATE_USER_STATE_MODELS = ['Journey', 'JourneyStepProgress'] as const
export type PrivateUserStateModel = (typeof PRIVATE_USER_STATE_MODELS)[number]

/**
 * Neither shared knowledge nor private progress: identity and operational rows.
 *
 * `User` sits here rather than in shared knowledge because a handle is not a community
 * contribution — it is not revised, confirmed or challenged.
 */
export const SUPPORTING_MODELS = ['User', 'PlatformMeta'] as const
export type SupportingModel = (typeof SUPPORTING_MODELS)[number]

export const MODEL_CLASSIFICATION = {
  revisionedShared: REVISIONED_SHARED_MODELS,
  privateUserState: PRIVATE_USER_STATE_MODELS,
  supporting: SUPPORTING_MODELS,
} as const

export type ModelClass = keyof typeof MODEL_CLASSIFICATION

export function classifyModel(model: string): ModelClass | null {
  for (const [key, models] of Object.entries(MODEL_CLASSIFICATION)) {
    if ((models as readonly string[]).includes(model)) return key as ModelClass
  }
  return null
}

export function isRevisionedShared(model: string): model is RevisionedSharedModel {
  return (REVISIONED_SHARED_MODELS as readonly string[]).includes(model)
}

export function isRevisionModel(model: string): model is RevisionModel {
  return (REVISION_MODELS as readonly string[]).includes(model)
}
