import type { JourneyStepStatus } from '@/domain/enums'
import { prisma } from '@/server/db/client'

/**
 * Every write to private journey state — Phase 7. FR-23, FR-24, FR-25, FR-26, FR-27, FR-41.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Every exported function in this directory takes `userId` as a required argument, and
 * every query in it filters on that id in its own `where` clause.**
 *
 * Not fetched-then-checked. The difference matters: a fetch followed by an `if` is a rule
 * somebody can forget to write, while `where: { id, userId }` cannot return a row belonging
 * to somebody else no matter what the caller does next. There is no code path here that
 * *could* read or write another user's journey, which is a stronger claim than "we check"
 * (FR-26, BR-16, D-10, invariant 5). `tests/architecture/journey-scoping.test.ts` asserts the
 * signature half of that, and the integration tests assert the behaviour.
 *
 * Public aggregates deliberately live elsewhere — in `src/server/routes/read.ts`, with the
 * rest of the anonymous read path. That keeps the rule in this directory absolute: if it is
 * here, it needs a user id. A function that legitimately has no user is a sign it belongs on
 * the other side of the line.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **This is not revisioned, and must never become so.** A private note is not a contribution.
 * These models are classified `privateUserState` in `src/domain/models.ts`, so the Phase 3
 * write guard lets them through untouched — journeys are edited in place, and nothing here
 * appears in any public history.
 *
 * **There is no upload anywhere in this file, and none may be added.** Marking a step
 * complete never asks for proof (FR-25, BR-06, D-09, invariant 6).
 */

export interface JourneyOwner {
  /** The authenticated user. Never optional, never defaulted, never inferred from a route. */
  readonly userId: string
}

/**
 * Follow a route (FR-23), or resume a journey that was previously unfollowed.
 *
 * Re-following restores rather than restarts. Unfollowing archives the journey and keeps the
 * progress (owner's decision, 2026-09-03), so somebody who steps away for six months and
 * comes back finds their notes where they left them. The `@@unique([userId, routeId])`
 * constraint is what makes that possible: there is exactly one journey per person per route,
 * so "follow again" can only ever mean "the same one".
 */
export async function followRoute({
  userId,
  routeId,
}: JourneyOwner & { routeId: string }): Promise<{ journeyId: string; resumed: boolean }> {
  const existing = await prisma.journey.findUnique({
    where: { userId_routeId: { userId, routeId } },
    select: { id: true, archivedAt: true },
  })

  if (existing) {
    if (existing.archivedAt !== null) {
      await prisma.journey.update({
        where: { id: existing.id, userId },
        data: { archivedAt: null },
      })
      return { journeyId: existing.id, resumed: true }
    }
    return { journeyId: existing.id, resumed: false }
  }

  const created = await prisma.journey.create({ data: { userId, routeId } })
  return { journeyId: created.id, resumed: false }
}

/**
 * Stop following, without losing anything (FR-23).
 *
 * Archiving, not deleting. Months of private notes should not be destroyed by a mis-click,
 * and "I stopped following this route" is not the same statement as "erase my data" — which
 * is why `deleteJourney` exists separately and says so plainly.
 */
export async function unfollowRoute({
  userId,
  journeyId,
}: JourneyOwner & { journeyId: string }): Promise<void> {
  await prisma.journey.update({
    where: { id: journeyId, userId },
    data: { archivedAt: new Date() },
  })
}

/**
 * Erase a journey and everything in it, permanently.
 *
 * The one place in this application where a hard delete is the right answer. Invariant 1
 * protects *shared community knowledge* from deletion, and deliberately not this: a person's
 * private progress, dates and notes are theirs, and being able to remove them is the point of
 * a platform that promises privacy rather than a contradiction of it.
 *
 * Progress rows and tasks go with it by `ON DELETE CASCADE`. No route, step or field is
 * touched — the foreign keys the other way are `RESTRICT`, so this cannot reach them.
 */
export async function deleteJourney({
  userId,
  journeyId,
}: JourneyOwner & { journeyId: string }): Promise<void> {
  await prisma.journey.delete({ where: { id: journeyId, userId } })
}

export interface StepProgressInput {
  readonly status?: JourneyStepStatus
  readonly targetDate?: Date | null
  readonly actualDate?: Date | null
  readonly privateNote?: string | null
}

/**
 * Record private progress against one step (FR-24, §12.1).
 *
 * Two guards, both structural:
 *
 *   The journey is looked up by `{ id, userId }`, so a caller holding somebody else's journey
 *   id gets nothing back and writes nothing.
 *
 *   The step is looked up by `{ id, routeId: journey.routeId }`, so progress cannot be
 *   attached to a step belonging to a different route. Without that, a journey could
 *   accumulate progress rows pointing anywhere in the graph, and the follower's road would
 *   quietly stop matching their own journey.
 *
 * No evidence is asked for and none can be supplied — there is no parameter here that could
 * carry a file (FR-25, invariant 6).
 */
export async function setStepProgress({
  userId,
  journeyId,
  stepId,
  ...values
}: JourneyOwner & { journeyId: string; stepId: string } & StepProgressInput): Promise<void> {
  const journey = await prisma.journey.findFirst({
    where: { id: journeyId, userId },
    select: { id: true, routeId: true },
  })
  if (!journey) throw new JourneyNotFoundError(journeyId)

  const step = await prisma.step.findFirst({
    where: { id: stepId, routeId: journey.routeId },
    select: { id: true },
  })
  if (!step) throw new StepNotOnRouteError(stepId, journey.routeId)

  const data = {
    ...(values.status === undefined ? {} : { status: values.status }),
    ...(values.targetDate === undefined ? {} : { targetDate: values.targetDate }),
    ...(values.actualDate === undefined ? {} : { actualDate: values.actualDate }),
    ...(values.privateNote === undefined ? {} : { privateNote: values.privateNote }),
  }

  await prisma.journeyStepProgress.upsert({
    where: { journeyId_stepId: { journeyId, stepId } },
    create: { journeyId, stepId, ...data },
    update: data,
  })
}

/**
 * Self-mark a journey completed, or take it back (FR-41).
 *
 * Self-reported, and the column name says so. Nobody checks, nobody is asked to prove it, and
 * every public aggregate built from it must read "users marked this completed" — never
 * "verified" (BR-20, invariant 17).
 */
export async function setSelfReportedCompletion({
  userId,
  journeyId,
  completed,
  at = new Date(),
}: JourneyOwner & { journeyId: string; completed: boolean; at?: Date }): Promise<void> {
  await prisma.journey.update({
    where: { id: journeyId, userId },
    data: { selfReportedCompletedAt: completed ? at : null },
  })
}

/**
 * A personal task that does not belong in the public route (§12.1).
 *
 * This exists to give private thoughts somewhere to go that is not a route field. Without it,
 * "ask Rifat which bank he used" ends up in shared knowledge, and the contamination invariant
 * 5 guards against happens through the front door rather than a bug.
 */
export async function addTask({
  userId,
  journeyId,
  label,
  stepId = null,
}: JourneyOwner & { journeyId: string; label: string; stepId?: string | null }): Promise<{
  taskId: string
}> {
  const journey = await prisma.journey.findFirst({
    where: { id: journeyId, userId },
    select: { id: true, routeId: true },
  })
  if (!journey) throw new JourneyNotFoundError(journeyId)

  if (stepId !== null) {
    const step = await prisma.step.findFirst({
      where: { id: stepId, routeId: journey.routeId },
      select: { id: true },
    })
    if (!step) throw new StepNotOnRouteError(stepId, journey.routeId)
  }

  const task = await prisma.journeyTask.create({ data: { journeyId, label, stepId } })
  return { taskId: task.id }
}

export async function setTaskDone({
  userId,
  taskId,
  done,
  at = new Date(),
}: JourneyOwner & { taskId: string; done: boolean; at?: Date }): Promise<void> {
  // Scoped through the relation rather than by a separate ownership check: `updateMany` with
  // a nested filter simply matches nothing when the task is somebody else's.
  await prisma.journeyTask.updateMany({
    where: { id: taskId, journey: { userId } },
    data: { doneAt: done ? at : null },
  })
}

export async function removeTask({
  userId,
  taskId,
}: JourneyOwner & { taskId: string }): Promise<void> {
  await prisma.journeyTask.deleteMany({ where: { id: taskId, journey: { userId } } })
}

export class JourneyNotFoundError extends Error {
  constructor(journeyId: string) {
    // Deliberately identical whether the journey does not exist or belongs to someone else.
    // A distinguishable "not yours" would let a caller enumerate other people's journey ids.
    super(`no journey ${journeyId} for this user`)
    this.name = 'JourneyNotFoundError'
  }
}

export class StepNotOnRouteError extends Error {
  constructor(stepId: string, routeId: string) {
    super(`step ${stepId} does not belong to route ${routeId}`)
    this.name = 'StepNotOnRouteError'
  }
}
