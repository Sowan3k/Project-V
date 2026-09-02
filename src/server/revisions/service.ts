import type { Prisma } from '@prisma/client'

import type {
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

    return {
      revisionId: revision.id,
      previousRevisionId: basedOn,
      forked: basedOn !== field.currentRevisionId,
    }
  })
}

/**
 * Records that a field is still accurate.
 *
 * Confirming is not editing: it refreshes freshness without creating a revision, because no
 * value changed (FR-43, §39.4). Phase 8 adds the confirmation rows and the prompt; this is
 * the freshness half, which belongs with the write engine.
 */
export async function confirmField(input: Change & { fieldId: string; reviewDueAt?: Date | null }): Promise<void> {
  await write(input, async (tx) => {
    await tx.field.update({
      where: { id: input.fieldId },
      data: { lastConfirmedAt: new Date(), reviewDueAt: input.reviewDueAt ?? null },
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
