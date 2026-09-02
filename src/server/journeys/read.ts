import type { JourneyStepStatus } from '@/domain/enums'
import { prisma } from '@/server/db/client'

/**
 * Reading private journey state — Phase 7. FR-24, FR-26, FR-27.
 *
 * Same rule as the write side, and for the same reason: **every function takes `userId` and
 * filters on it in the query.** There is no "get journey by id" that a caller could reach
 * with somebody else's id and a hopeful heart.
 *
 * Contrast this with `src/server/routes/read.ts`, which takes no identity at all — that file
 * is public by construction, this one is private by construction, and the two rules are
 * enforced by opposite tests. Neither can drift into the other without a test failing.
 */

export interface JourneyStepView {
  readonly stepId: string
  readonly status: JourneyStepStatus
  readonly targetDate: Date | null
  readonly actualDate: Date | null
  readonly privateNote: string | null
  readonly updatedAt: Date
}

export interface JourneyTaskView {
  readonly id: string
  readonly stepId: string | null
  readonly label: string
  readonly doneAt: Date | null
}

export interface JourneyView {
  readonly id: string
  readonly routeId: string
  readonly routeSlug: string
  readonly routeTitle: string
  readonly startedAt: Date
  readonly selfReportedCompletedAt: Date | null
  readonly archivedAt: Date | null
  readonly progress: readonly JourneyStepView[]
  readonly tasks: readonly JourneyTaskView[]
}

const JOURNEY_INCLUDE = {
  route: { select: { slug: true, currentRevision: { select: { title: true } } } },
  progress: true,
  tasks: { orderBy: { createdAt: 'asc' } },
} as const

/**
 * Every journey this user follows (FR-23).
 *
 * Archived ones are excluded by default: unfollowing should remove a route from the list,
 * even though it keeps the data. `includeArchived` exists for the screen that offers to
 * resume one.
 */
export async function listJourneys(
  userId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<readonly JourneyView[]> {
  const journeys = await prisma.journey.findMany({
    where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
    include: JOURNEY_INCLUDE,
    orderBy: [{ updatedAt: 'desc' }],
  })

  return journeys.map(toView)
}

/**
 * This user's journey on one route, or `null` if they do not follow it.
 *
 * Keyed by route rather than by journey id, because that is the question the route page
 * actually asks — "does the person reading this follow it?" — and because a route id is
 * already public while a journey id is not.
 */
export async function getJourneyForRoute(
  userId: string,
  routeId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<JourneyView | null> {
  const journey = await prisma.journey.findFirst({
    where: { userId, routeId, ...(includeArchived ? {} : { archivedAt: null }) },
    include: JOURNEY_INCLUDE,
  })

  return journey === null ? null : toView(journey)
}

function toView(journey: {
  id: string
  routeId: string
  startedAt: Date
  selfReportedCompletedAt: Date | null
  archivedAt: Date | null
  route: { slug: string; currentRevision: { title: string } | null }
  progress: {
    stepId: string
    status: JourneyStepStatus
    targetDate: Date | null
    actualDate: Date | null
    privateNote: string | null
    updatedAt: Date
  }[]
  tasks: { id: string; stepId: string | null; label: string; doneAt: Date | null }[]
}): JourneyView {
  return {
    id: journey.id,
    routeId: journey.routeId,
    routeSlug: journey.route.slug,
    routeTitle: journey.route.currentRevision?.title ?? journey.route.slug,
    startedAt: journey.startedAt,
    selfReportedCompletedAt: journey.selfReportedCompletedAt,
    archivedAt: journey.archivedAt,
    progress: journey.progress.map((row) => ({
      stepId: row.stepId,
      status: row.status,
      targetDate: row.targetDate,
      actualDate: row.actualDate,
      privateNote: row.privateNote,
      updatedAt: row.updatedAt,
    })),
    tasks: journey.tasks.map((task) => ({
      id: task.id,
      stepId: task.stepId,
      label: task.label,
      doneAt: task.doneAt,
    })),
  }
}
