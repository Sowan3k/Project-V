import type { Prisma } from '@prisma/client'

import type {
  ChallengeReason as ChallengeReasonT,
  FieldApplicability as FieldApplicabilityT,
  FieldCategory as FieldCategoryT,
  RouteMechanism as RouteMechanismT,
  SourceClass as SourceClassT,
  StepCategory as StepCategoryT,
  StepEdgeKind as StepEdgeKindT,
  StudyLevel as StudyLevelT,
} from '@/domain/enums'
import { prisma } from '@/server/db/client'
import { runInRevisionWrite } from '@/server/write-guard'

/**
 * The revision write engine — Phase 3.
 *
 * Every change to shared route knowledge happens here and nowhere else. Not by agreement:
 * an ESLint boundary stops other code importing the Prisma client, a runtime guard refuses
 * writes made outside this module's context, and database triggers refuse UPDATE and DELETE
 * on revision tables.
 *
 * Three rules hold for every function below:
 *
 *   1. **Append, never overwrite.** A correction creates a new revision; the previous one
 *      stays readable with its author, timestamp and reason (FR-20, BR-03, invariant 2).
 *   2. **One transaction.** The revision row and the current-state pointer move together,
 *      so there is no window in which a route points at a revision that does not exist, or
 *      a revision exists that nothing points at.
 *   3. **Concurrency preserves both.** `basedOnRevisionId` records what the author was
 *      looking at. Two contributors editing the same value produce two revisions sharing a
 *      parent — a fork, kept and detectable, never a silent last-write-wins (invariant 15).
 *
 * Archiving is the only removal. Nothing here deletes.
 */

export interface Actor {
  /** Null only for system and seed writes, which must say so explicitly. */
  readonly id: string | null
  readonly system?: boolean
}

export interface Change {
  readonly actor: Actor
  /** Why this change is being made, in the contributor's words. */
  readonly reason?: string | null
}

export class RevisionConflictError extends Error {
  constructor(
    message: string,
    readonly currentRevisionId: string | null,
    readonly basedOnRevisionId: string | null,
  ) {
    super(message)
    this.name = 'RevisionConflictError'
  }
}

type Tx = Prisma.TransactionClient

/**
 * Runs a unit of work inside the sanctioned write context and one database transaction.
 *
 * Both matter and for different reasons: the context is what the runtime guard checks, and
 * the transaction is what keeps a revision and its pointer from separating.
 */
/**
 * Transaction budget.
 *
 * Prisma's defaults are 2s to acquire a connection and 5s to finish. Both are too tight
 * here, and the stress test proved it: writes to one field serialise on that row's lock, so
 * a queue of contributors each wait for the ones ahead. Against a remote database the fifth
 * in line exceeded 5s and Prisma aborted its transaction — a lost contribution, which is
 * exactly what this engine exists to prevent.
 *
 * These are deliberately generous rather than tuned. Contention on a single field is rare;
 * quietly dropping someone's correction when it happens is not an acceptable trade.
 */
const TRANSACTION_TIMEOUT_MS = 20_000
const TRANSACTION_MAX_WAIT_MS = 10_000

function write<T>(change: Change, work: (tx: Tx) => Promise<T>): Promise<T> {
  return runInRevisionWrite(
    {
      actorId: change.actor.id,
      reason: change.reason ?? null,
      system: change.actor.system ?? false,
    },
    () =>
      prisma.$transaction((tx) => work(tx as Tx), {
        timeout: TRANSACTION_TIMEOUT_MS,
        maxWait: TRANSACTION_MAX_WAIT_MS,
      }),
  )
}

const attribution = (change: Change) => ({
  authorId: change.actor.id,
  reason: change.reason ?? null,
})

/**
 * Takes the row lock before anything else in the transaction.
 *
 * Found by the concurrency integration test, which deadlocked: inserting a revision takes a
 * share lock on the parent row for the foreign-key check, and moving the current pointer
 * then needs an exclusive lock on that same row. Two contributors revising the same field at
 * the same moment each held what the other needed — Postgres killed one transaction, and a
 * contribution was lost.
 *
 * Locking the parent row first makes both transactions queue on the same resource in the
 * same order, so the second simply waits and then proceeds. Both contributions land, which
 * is the entire promise of this engine (invariant 2).
 *
 * The lock is per row, so edits to different fields still run in parallel. Table names are
 * literals in the tagged template — never interpolated — so there is no injection surface.
 */
async function lockField(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "fields" WHERE id = ${id} FOR UPDATE`
}
async function lockStep(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "steps" WHERE id = ${id} FOR UPDATE`
}
async function lockEdge(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "step_edges" WHERE id = ${id} FOR UPDATE`
}
async function lockRoute(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "routes" WHERE id = ${id} FOR UPDATE`
}

// ── Route ────────────────────────────────────────────────────────────────────

export interface CreateRouteInput extends Change {
  readonly slug: string
  readonly originCountry: string
  readonly destinationCountry: string
  readonly studyLevel: StudyLevelT
  readonly intake?: string | null
  readonly mechanism?: RouteMechanismT | null
  readonly title: string
  readonly summary?: string | null
}

/**
 * Creates a route and its first revision.
 *
 * The creator is recorded for attribution but gains no ownership: there is no owner column,
 * and every revise function below is callable by anyone (FR-44, BR-01, D-18, invariant 3).
 * New routes start `experimental` by schema default — they must not look as mature as
 * established ones (FR-74, §18.1).
 */
export async function createRoute(input: CreateRouteInput): Promise<{ routeId: string; revisionId: string }> {
  return write(input, async (tx) => {
    const route = await tx.route.create({
      data: {
        slug: input.slug,
        originCountry: input.originCountry,
        destinationCountry: input.destinationCountry,
        studyLevel: input.studyLevel,
        intake: input.intake ?? null,
        mechanism: input.mechanism ?? null,
        createdById: input.actor.id,
      },
    })

    const revision = await tx.routeRevision.create({
      data: {
        routeId: route.id,
        title: input.title,
        summary: input.summary ?? null,
        ...attribution(input),
      },
    })

    await tx.route.update({ where: { id: route.id }, data: { currentRevisionId: revision.id } })
    return { routeId: route.id, revisionId: revision.id }
  })
}

export interface ReviseRouteInput extends Change {
  readonly routeId: string
  readonly title: string
  readonly summary?: string | null
  /** The revision the author was looking at. Omitting it is allowed but loses fork detection. */
  readonly basedOnRevisionId?: string | null
}

export async function reviseRoute(input: ReviseRouteInput): Promise<{ revisionId: string; forked: boolean }> {
  return write(input, async (tx) => {
    await lockRoute(tx, input.routeId)
    const route = await tx.route.findUniqueOrThrow({
      where: { id: input.routeId },
      select: { currentRevisionId: true },
    })
    const basedOn = input.basedOnRevisionId ?? route.currentRevisionId

    const revision = await tx.routeRevision.create({
      data: {
        routeId: input.routeId,
        title: input.title,
        summary: input.summary ?? null,
        previousRevisionId: basedOn,
        ...attribution(input),
      },
    })

    await tx.route.update({ where: { id: input.routeId }, data: { currentRevisionId: revision.id } })
    return { revisionId: revision.id, forked: basedOn !== route.currentRevisionId }
  })
}

// ── Step ─────────────────────────────────────────────────────────────────────

export interface AddStepInput extends Change {
  readonly routeId: string
  readonly label: string
  readonly category: StepCategoryT
  readonly earliestStartOffsetDays?: number | null
  readonly typicalDurationDays?: number | null
}

export async function addStep(input: AddStepInput): Promise<{ stepId: string; revisionId: string }> {
  return write(input, async (tx) => {
    const step = await tx.step.create({ data: { routeId: input.routeId } })
    const revision = await tx.stepRevision.create({
      data: {
        stepId: step.id,
        label: input.label,
        category: input.category,
        earliestStartOffsetDays: input.earliestStartOffsetDays ?? null,
        typicalDurationDays: input.typicalDurationDays ?? null,
        ...attribution(input),
      },
    })
    await tx.step.update({ where: { id: step.id }, data: { currentRevisionId: revision.id } })
    return { stepId: step.id, revisionId: revision.id }
  })
}

export interface ReviseStepInput extends Change {
  readonly stepId: string
  readonly label: string
  readonly category: StepCategoryT
  readonly earliestStartOffsetDays?: number | null
  readonly typicalDurationDays?: number | null
  readonly basedOnRevisionId?: string | null
}

export async function reviseStep(input: ReviseStepInput): Promise<{ revisionId: string; forked: boolean }> {
  return write(input, async (tx) => {
    await lockStep(tx, input.stepId)
    const step = await tx.step.findUniqueOrThrow({
      where: { id: input.stepId },
      select: { currentRevisionId: true },
    })
    const basedOn = input.basedOnRevisionId ?? step.currentRevisionId

    const revision = await tx.stepRevision.create({
      data: {
        stepId: input.stepId,
        label: input.label,
        category: input.category,
        earliestStartOffsetDays: input.earliestStartOffsetDays ?? null,
        typicalDurationDays: input.typicalDurationDays ?? null,
        previousRevisionId: basedOn,
        ...attribution(input),
      },
    })
    await tx.step.update({ where: { id: input.stepId }, data: { currentRevisionId: revision.id } })
    return { revisionId: revision.id, forked: basedOn !== step.currentRevisionId }
  })
}

// ── Edge ─────────────────────────────────────────────────────────────────────

export interface AddEdgeInput extends Change {
  readonly routeId: string
  readonly fromStepId: string
  readonly toStepId: string
  readonly kind: StepEdgeKindT
}

export async function addEdge(input: AddEdgeInput): Promise<{ edgeId: string; revisionId: string }> {
  return write(input, async (tx) => {
    const edge = await tx.stepEdge.create({
      data: { routeId: input.routeId, fromStepId: input.fromStepId, toStepId: input.toStepId },
    })
    const revision = await tx.stepEdgeRevision.create({
      data: { stepEdgeId: edge.id, kind: input.kind, ...attribution(input) },
    })
    await tx.stepEdge.update({ where: { id: edge.id }, data: { currentRevisionId: revision.id } })
    return { edgeId: edge.id, revisionId: revision.id }
  })
}

export interface ReviseEdgeInput extends Change {
  readonly edgeId: string
  readonly kind: StepEdgeKindT
  readonly basedOnRevisionId?: string | null
}

/** Only the kind is revisable. Repointing an edge is archiving one and adding another. */
export async function reviseEdge(input: ReviseEdgeInput): Promise<{ revisionId: string; forked: boolean }> {
  return write(input, async (tx) => {
    await lockEdge(tx, input.edgeId)
    const edge = await tx.stepEdge.findUniqueOrThrow({
      where: { id: input.edgeId },
      select: { currentRevisionId: true },
    })
    const basedOn = input.basedOnRevisionId ?? edge.currentRevisionId

    const revision = await tx.stepEdgeRevision.create({
      data: {
        stepEdgeId: input.edgeId,
        kind: input.kind,
        previousRevisionId: basedOn,
        ...attribution(input),
      },
    })
    await tx.stepEdge.update({ where: { id: input.edgeId }, data: { currentRevisionId: revision.id } })
    return { revisionId: revision.id, forked: basedOn !== edge.currentRevisionId }
  })
}

// ── Field ────────────────────────────────────────────────────────────────────

export interface FieldValue {
  readonly valueText: string
  readonly valueAmount?: Prisma.Decimal | number | null
  readonly valueCurrency?: string | null
  readonly valueDate?: Date | null
  readonly valueDurationDays?: number | null
  readonly sourceClass: SourceClassT
  /**
   * How widely this claim applies (FR-81, D-47). A set, because a claim can vary along more
   * than one dimension — programme AND intake is a real case, not a hypothetical.
   *
   * Optional, and omitting it means "not stated" rather than "applies everywhere". Forcing a
   * contributor to classify a scope they are unsure of would produce confident wrong answers.
   */
  readonly applicability?: readonly FieldApplicabilityT[]
  readonly sourceUrl?: string | null
  readonly sourceNote?: string | null
  readonly effectiveFrom?: Date | null
  readonly expiresAt?: Date | null
}

export interface AddFieldInput extends Change, FieldValue {
  readonly stepId: string
  readonly category: FieldCategoryT
}

const valueColumns = (v: FieldValue) => ({
  valueText: v.valueText,
  valueAmount: v.valueAmount ?? null,
  valueCurrency: v.valueCurrency ?? null,
  valueDate: v.valueDate ?? null,
  valueDurationDays: v.valueDurationDays ?? null,
  sourceClass: v.sourceClass,
  applicability: [...(v.applicability ?? [])],
  sourceUrl: v.sourceUrl ?? null,
  sourceNote: v.sourceNote ?? null,
  effectiveFrom: v.effectiveFrom ?? null,
  expiresAt: v.expiresAt ?? null,
})

export async function addField(input: AddFieldInput): Promise<{ fieldId: string; revisionId: string }> {
  return write(input, async (tx) => {
    const field = await tx.field.create({
      data: { stepId: input.stepId, category: input.category },
    })
    const revision = await tx.fieldRevision.create({
      data: { fieldId: field.id, ...valueColumns(input), ...attribution(input) },
    })
    await tx.field.update({ where: { id: field.id }, data: { currentRevisionId: revision.id } })
    return { fieldId: field.id, revisionId: revision.id }
  })
}

export interface ReviseFieldInput extends Change, FieldValue {
  readonly fieldId: string
  /**
   * The revision the contributor was correcting.
   *
   * When it is not the field's current revision, somebody else revised in the meantime and
   * this is a fork. Both revisions are kept — the caller is told, and the community decides
   * (FR-70, invariant 15). Nothing is silently discarded either way.
   */
  readonly basedOnRevisionId?: string | null
}

export interface ReviseFieldResult {
  readonly revisionId: string
  readonly previousRevisionId: string | null
  /** True when another revision landed on the same parent first. */
  readonly forked: boolean
}

export async function reviseField(input: ReviseFieldInput): Promise<ReviseFieldResult> {
  return write(input, async (tx) => {
    await lockField(tx, input.fieldId)
    const field = await tx.field.findUniqueOrThrow({
      where: { id: input.fieldId },
      select: { currentRevisionId: true, archivedAt: true },
    })
    if (field.archivedAt !== null) {
      throw new RevisionConflictError(
        'this field is archived; restore it before revising',
        field.currentRevisionId,
        input.basedOnRevisionId ?? null,
      )
    }

    const basedOn = input.basedOnRevisionId ?? field.currentRevisionId

    const revision = await tx.fieldRevision.create({
      data: {
        fieldId: input.fieldId,
        previousRevisionId: basedOn,
        ...valueColumns(input),
        ...attribution(input),
      },
    })

    // The pointer moves to the newest revision. "Current" is not a claim of correctness —
    // a forked field renders as contested, and the community resolves it (FR-53, FR-70).
    await tx.field.update({ where: { id: input.fieldId }, data: { currentRevisionId: revision.id } })

    /**
     * A revision answers the open challenges on this field — Phase 8, FR-18, FR-49.
     *
     * This is the whole resolution mechanism, and it is deliberately not a moderator. A
     * challenge says "this may be wrong"; the answer to that is somebody changing the value,
     * so the revision that changes it is what closes the challenge. Both rows survive: the
     * challenge keeps its reason and author, and now points at the revision that addressed
     * it, so the disagreement stays readable rather than disappearing (§17.5).
     *
     * A *confirmation* deliberately does not do this. Somebody vouching that a field is fine
     * is a competing signal, not an answer, and letting it clear a challenge is exactly how
     * a dispute gets buried under reassurance (FR-70).
     */
    await tx.challenge.updateMany({
      where: { fieldId: input.fieldId, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedByRevisionId: revision.id },
    })

    return {
      revisionId: revision.id,
      previousRevisionId: basedOn,
      forked: basedOn !== field.currentRevisionId,
    }
  })
}

/**
 * CONFIRM — records that a field is still accurate (FR-17, FR-55, §16.3).
 *
 * Confirming is not editing: no value changed, so **no revision is created** (§39.4). What it
 * writes is a `Confirmation` row plus the field's freshness date.
 *
 * The row matters as much as the date. A timestamp alone cannot distinguish fifty people
 * agreeing from one person clicking fifty times, and a confirmation count that cannot tell
 * those apart is not a signal (invariant 14, BR-32). One row per person per field, refreshed
 * when they confirm again.
 *
 * Note what this does **not** do: it does not resolve an open challenge. See `reviseField`.
 */
export async function confirmField(
  input: Change & { fieldId: string; reviewDueAt?: Date | null },
): Promise<void> {
  await write(input, async (tx) => {
    const now = new Date()

    if (input.actor.id === null) {
      // A seed or system confirmation. Nobody vouched for it, so no row is written — a
      // confirmation count must never include the platform confirming its own content.
      await tx.field.update({
        where: { id: input.fieldId },
        data: { lastConfirmedAt: now, reviewDueAt: input.reviewDueAt ?? null },
      })
      return
    }

    await tx.confirmation.upsert({
      where: { fieldId_authorId: { fieldId: input.fieldId, authorId: input.actor.id } },
      create: { fieldId: input.fieldId, authorId: input.actor.id },
      update: { createdAt: now },
    })
    await tx.field.update({
      where: { id: input.fieldId },
      data: { lastConfirmedAt: now, reviewDueAt: input.reviewDueAt ?? null },
    })
  })
}

/**
 * CONFIRM, for every live field in a step at once — FR-42, §16.5.
 *
 * The "Was this step still accurate?" prompt, which appears after a follower marks a step
 * complete because that is when their knowledge is freshest. Confirming a step is confirming
 * the claims inside it; there is no separate contribution type for this, and there must not
 * be — the prompt is a moment, not a new kind of action.
 *
 * Returns how many fields were confirmed, so the interface can say so plainly rather than
 * implying more happened than did.
 */
export async function confirmStepFields(
  input: Change & { stepId: string },
): Promise<{ confirmed: number }> {
  const fields = await prisma.field.findMany({
    where: { stepId: input.stepId, archivedAt: null },
    select: { id: true },
  })

  for (const field of fields) {
    await confirmField({ actor: input.actor, reason: input.reason, fieldId: field.id })
  }

  return { confirmed: fields.length }
}

/**
 * CHALLENGE — "this may be wrong" (FR-18, §16.4).
 *
 * Distinct from CONFIRM, from UPDATE, and from REPORT. A challenge carries a **reason**,
 * because §16.4 is explicit that it must not act as a generic dislike button — but the note
 * is optional, because FR-50 asks for minimal unnecessary form filling and a required essay
 * is how a concern goes unraised.
 *
 * It changes nothing about the field. The value stays, the source class stays, and the field
 * renders with an open challenge against it (FR-49, FR-70) until a revision answers it.
 * Nothing is hidden, nothing is queued for approval, and no moderator is involved.
 *
 * REPORT — "this may be dangerous" — is a different action with different consequences and
 * is deliberately not here. It is Phase 9 (CLAUDE.md §5).
 */
export async function challengeField(
  input: Change & { fieldId: string; reason: ChallengeReasonT; note?: string | null },
): Promise<{ challengeId: string }> {
  return write(input, async (tx) => {
    const challenge = await tx.challenge.create({
      data: {
        fieldId: input.fieldId,
        reason: input.reason,
        note: input.note ?? null,
        authorId: input.actor.id,
      },
    })
    return { challengeId: challenge.id }
  })
}

/**
 * Set or lift a field's quarantine — FR-36, §23.2. Phase 9.
 *
 * Lives here, with `confirmField` and `archiveField`, because `Field` is a revisioned model
 * and the Phase 3 boundary is absolute: only `src/server/revisions` writes those. Authorising
 * the action is `src/server/safety`'s job; performing it is this module's. The first draft put
 * both in the safety service and the architecture test caught it, which is the boundary
 * working rather than an inconvenience.
 *
 * **This creates no revision, and must not.** Quarantine is a safety state of the field, not a
 * change to what the field says — exactly like `lastConfirmedAt`. Writing a revision would put
 * a moderation action into the contribution history and misattribute it as an edit.
 *
 * **It deletes nothing.** The value, every revision and the whole history are untouched;
 * `src/server/routes/read.ts` simply stops returning the value while this is set. Lifting it
 * is `quarantinedAt: null` (FR-45, BR-15, invariants 1 and 4).
 */
export async function setFieldQuarantine(input: {
  fieldId: string
  quarantinedById: string | null
  note?: string | null
  quarantined: boolean
}): Promise<void> {
  await write({ actor: { id: input.quarantinedById } }, async (tx) => {
    await tx.field.update({
      where: { id: input.fieldId },
      data: input.quarantined
        ? {
            quarantinedAt: new Date(),
            quarantinedById: input.quarantinedById,
            quarantineNote: input.note ?? null,
          }
        : { quarantinedAt: null, quarantinedById: null, quarantineNote: null },
    })
  })
}

// ── Archival ─────────────────────────────────────────────────────────────────

/**
 * Archiving is the only removal available.
 *
 * The row stays, its revisions stay, and history queries still return it. It simply leaves
 * current views (FR-21, FR-45, BR-15, invariant 4). There is no delete counterpart to any
 * of these functions, and the runtime guard refuses `delete` on these models outright.
 */
export async function archiveField(input: Change & { fieldId: string }): Promise<void> {
  await write(input, async (tx) => {
    await tx.field.update({ where: { id: input.fieldId }, data: { archivedAt: new Date() } })
  })
}

export async function archiveStep(input: Change & { stepId: string }): Promise<void> {
  await write(input, async (tx) => {
    await tx.step.update({ where: { id: input.stepId }, data: { archivedAt: new Date() } })
  })
}

export async function archiveEdge(input: Change & { edgeId: string }): Promise<void> {
  await write(input, async (tx) => {
    await tx.stepEdge.update({ where: { id: input.edgeId }, data: { archivedAt: new Date() } })
  })
}

/** Restores archived content to current views. Archival is reversible; deletion would not be. */
export async function restoreField(input: Change & { fieldId: string }): Promise<void> {
  await write(input, async (tx) => {
    await tx.field.update({ where: { id: input.fieldId }, data: { archivedAt: null } })
  })
}
