import type { FieldCategory, RouteMechanism, SourceClass, StudyLevel } from '@/domain/enums'
import { StepCategory, StepEdgeKind } from '@/domain/enums'
import { expectedFlyWindow, type FlyWindow } from '@/domain/fly-window'
import type { RouteGraph } from '@/domain/graph/types'
import { prisma } from '@/server/db/client'

/**
 * The anonymous read path — Phase 5.
 *
 * Every function here is readable with no account. FR-01 and D-03: search, ribbons, roads,
 * steps, fields and history are all open. Nothing in this file takes a session, checks a
 * role, or has any parameter a caller could use to gate access — that is the simplest way to
 * guarantee an anonymous visitor is never blocked.
 *
 * Writes go through src/server/revisions. This file never mutates.
 */

export interface RouteSearchFilters {
  readonly originCountry?: string
  readonly destinationCountry?: string
  readonly studyLevel?: StudyLevel
  readonly intake?: string
  readonly mechanism?: RouteMechanism
}

export interface RouteSummary {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly summary: string | null
  readonly originCountry: string
  readonly destinationCountry: string
  readonly studyLevel: StudyLevel
  readonly intake: string | null
  readonly mechanism: RouteMechanism | null
  readonly lifecycleState: string
  readonly createdAt: Date
  /** The graph, so the ribbon draws from the same data the road will (invariant 25). */
  readonly graph: RouteGraph
  readonly stepCount: number
  readonly flyWindow: FlyWindow | null
}

const toGraph = (
  steps: { id: string; archivedAt: Date | null; currentRevision: { label: string; category: string; earliestStartOffsetDays: number | null; typicalDurationDays: number | null } | null }[],
  edges: { id: string; fromStepId: string; toStepId: string; archivedAt: Date | null; currentRevision: { kind: string } | null }[],
): RouteGraph => ({
  steps: steps.map((s) => ({
    id: s.id,
    label: s.currentRevision?.label ?? '',
    category: (s.currentRevision?.category ?? StepCategory.documents_preparation) as RouteGraph['steps'][number]['category'],
    archived: s.archivedAt !== null,
    earliestStartOffsetDays: s.currentRevision?.earliestStartOffsetDays ?? null,
    typicalDurationDays: s.currentRevision?.typicalDurationDays ?? null,
  })),
  edges: edges.map((e) => ({
    id: e.id,
    fromStepId: e.fromStepId,
    toStepId: e.toStepId,
    kind: (e.currentRevision?.kind ?? StepEdgeKind.sequential) as RouteGraph['edges'][number]['kind'],
    archived: e.archivedAt !== null,
  })),
})

const ROUTE_INCLUDE = {
  currentRevision: true,
  steps: { where: { archivedAt: null }, include: { currentRevision: true }, orderBy: { id: 'asc' } },
  edges: { where: { archivedAt: null }, include: { currentRevision: true }, orderBy: { id: 'asc' } },
} as const

/**
 * Route search — FR-01, FR-02, REQUIREMENTS.md §9.
 *
 * Deliberately few filters: "route discovery should start with a small number of
 * understandable filters" and must not "require a detailed student profile before showing
 * useful information."
 *
 * Removed and archived routes never appear. Everything else does, including experimental
 * ones — a new route is shown, honestly labelled, rather than hidden (FR-74).
 */
export async function searchRoutes(filters: RouteSearchFilters = {}): Promise<readonly RouteSummary[]> {
  const routes = await prisma.route.findMany({
    where: {
      archivedAt: null,
      mergedIntoId: null,
      ...(filters.originCountry ? { originCountry: filters.originCountry } : {}),
      ...(filters.destinationCountry ? { destinationCountry: filters.destinationCountry } : {}),
      ...(filters.studyLevel ? { studyLevel: filters.studyLevel } : {}),
      ...(filters.intake ? { intake: filters.intake } : {}),
      ...(filters.mechanism ? { mechanism: filters.mechanism } : {}),
    },
    include: ROUTE_INCLUDE,
    orderBy: [{ createdAt: 'desc' }],
  })

  return routes.map((route) => {
    const graph = toGraph(route.steps, route.edges)
    return {
      id: route.id,
      slug: route.slug,
      title: route.currentRevision?.title ?? route.slug,
      summary: route.currentRevision?.summary ?? null,
      originCountry: route.originCountry,
      destinationCountry: route.destinationCountry,
      studyLevel: route.studyLevel,
      intake: route.intake,
      mechanism: route.mechanism,
      lifecycleState: route.lifecycleState,
      createdAt: route.createdAt,
      graph,
      stepCount: graph.steps.filter((s) => !s.archived).length,
      flyWindow: expectedFlyWindow(graph),
    }
  })
}

/** The distinct values actually present, so the search form offers only useful options. */
export async function availableFilters(): Promise<{
  origins: readonly string[]
  destinations: readonly string[]
  intakes: readonly string[]
}> {
  const routes = await prisma.route.findMany({
    where: { archivedAt: null, mergedIntoId: null },
    select: { originCountry: true, destinationCountry: true, intake: true },
  })

  return {
    origins: [...new Set(routes.map((r) => r.originCountry))].sort(),
    destinations: [...new Set(routes.map((r) => r.destinationCountry))].sort(),
    intakes: [...new Set(routes.map((r) => r.intake).filter((i): i is string => i !== null))].sort(),
  }
}

export interface FieldView {
  readonly id: string
  readonly category: FieldCategory
  readonly valueText: string
  readonly valueAmount: string | null
  readonly valueCurrency: string | null
  readonly valueDate: Date | null
  readonly valueDurationDays: number | null
  /**
   * Where the value came from. Shown always, never inferred: an official requirement and a
   * community experience are different claim types and must not look alike (FR-54, BR-07,
   * invariant 11). The fuller trust surface — badges, freshness, dispute markers — is
   * Phase 6; this is the honest minimum without which the page would misrepresent its data.
   */
  readonly sourceClass: SourceClass
  readonly sourceUrl: string | null
  readonly sourceNote: string | null
  readonly lastConfirmedAt: Date | null
  readonly revisionCount: number
}

export interface StepView {
  readonly id: string
  readonly label: string
  readonly category: string
  readonly earliestStartOffsetDays: number | null
  readonly typicalDurationDays: number | null
  readonly hardDeadline: Date | null
  readonly fieldCount: number
}

export interface RouteDetail extends RouteSummary {
  readonly steps: readonly StepView[]
}

export async function getRouteBySlug(slug: string): Promise<RouteDetail | null> {
  const route = await prisma.route.findUnique({
    where: { slug },
    include: {
      ...ROUTE_INCLUDE,
      steps: {
        where: { archivedAt: null },
        include: { currentRevision: true, _count: { select: { fields: { where: { archivedAt: null } } } } },
        orderBy: { id: 'asc' },
      },
    },
  })
  if (!route || route.archivedAt !== null) return null

  const graph = toGraph(route.steps, route.edges)

  return {
    id: route.id,
    slug: route.slug,
    title: route.currentRevision?.title ?? route.slug,
    summary: route.currentRevision?.summary ?? null,
    originCountry: route.originCountry,
    destinationCountry: route.destinationCountry,
    studyLevel: route.studyLevel,
    intake: route.intake,
    mechanism: route.mechanism,
    lifecycleState: route.lifecycleState,
    createdAt: route.createdAt,
    graph,
    stepCount: graph.steps.filter((s) => !s.archived).length,
    flyWindow: expectedFlyWindow(graph),
    steps: route.steps.map((s) => ({
      id: s.id,
      label: s.currentRevision?.label ?? '',
      category: s.currentRevision?.category ?? StepCategory.documents_preparation,
      earliestStartOffsetDays: s.currentRevision?.earliestStartOffsetDays ?? null,
      typicalDurationDays: s.currentRevision?.typicalDurationDays ?? null,
      hardDeadline: s.currentRevision?.hardDeadline ?? null,
      fieldCount: s._count.fields,
    })),
  }
}

/** The fields inside one step — the smallest community-maintained unit (FR-51, VR-05). */
export async function getStepFields(stepId: string): Promise<readonly FieldView[]> {
  const fields = await prisma.field.findMany({
    where: { stepId, archivedAt: null },
    include: { currentRevision: true, _count: { select: { revisions: true } } },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  })

  return fields.flatMap((field) => {
    const current = field.currentRevision
    if (!current) return []
    return [
      {
        id: field.id,
        category: field.category,
        valueText: current.valueText,
        valueAmount: current.valueAmount?.toString() ?? null,
        valueCurrency: current.valueCurrency,
        valueDate: current.valueDate,
        valueDurationDays: current.valueDurationDays,
        sourceClass: current.sourceClass,
        sourceUrl: current.sourceUrl,
        sourceNote: current.sourceNote,
        lastConfirmedAt: field.lastConfirmedAt,
        revisionCount: field._count.revisions,
      },
    ]
  })
}

export interface HistoryEntry {
  readonly id: string
  readonly kind: 'route' | 'step' | 'field'
  readonly subject: string
  readonly value: string
  readonly reason: string | null
  readonly authorHandle: string | null
  readonly createdAt: Date
}

/**
 * Route history — FR-08, FR-31.
 *
 * Every revision of the route, its steps and its fields, newest first. Archived content is
 * included: that is the whole point of history, and the difference between archived and
 * deleted (FR-45, invariant 4).
 */
export async function getRouteHistory(routeId: string, limit = 100): Promise<readonly HistoryEntry[]> {
  const [routeRevisions, stepRevisions, fieldRevisions] = await Promise.all([
    prisma.routeRevision.findMany({
      where: { routeId },
      include: { author: { select: { handle: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    }),
    prisma.stepRevision.findMany({
      where: { step: { routeId } },
      include: { author: { select: { handle: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    }),
    prisma.fieldRevision.findMany({
      where: { field: { step: { routeId } } },
      include: { author: { select: { handle: true } }, field: { select: { category: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    }),
  ])

  const entries: HistoryEntry[] = [
    ...routeRevisions.map((r) => ({
      id: r.id,
      kind: 'route' as const,
      subject: r.title,
      value: r.summary ?? r.title,
      reason: r.reason,
      authorHandle: r.author?.handle ?? null,
      createdAt: r.createdAt,
    })),
    ...stepRevisions.map((r) => ({
      id: r.id,
      kind: 'step' as const,
      subject: r.label,
      value: r.label,
      reason: r.reason,
      authorHandle: r.author?.handle ?? null,
      createdAt: r.createdAt,
    })),
    ...fieldRevisions.map((r) => ({
      id: r.id,
      kind: 'field' as const,
      subject: r.field.category,
      value: r.valueText,
      reason: r.reason,
      authorHandle: r.author?.handle ?? null,
      createdAt: r.createdAt,
    })),
  ]

  return entries
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
    .slice(0, limit)
}
