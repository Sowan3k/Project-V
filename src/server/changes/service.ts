import type { ChangeSeverity, RouteChangeKind } from '@/domain/enums'
import { prisma } from '@/server/db/client'

/**
 * Announcing changes and recording disruptions — Phase 10.
 *
 * FR-32, FR-59, FR-60, FR-63. §41.1, §41.2, §41.5. BR-08, BR-27. Invariants 3, 19.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why these writes do not go through the revision service.**
 *
 * `src/server/revisions/service.ts` is the only place shared *knowledge* may be written,
 * because knowledge is revisioned and every edit must append (CLAUDE.md §9, invariant 2).
 * Neither model here is knowledge about the route. A change announcement is a statement
 * *about* an edit that already happened; a disruption is an overlay that deliberately leaves
 * the route untouched. Both are classified `communitySignal` in `src/domain/models.ts`, which
 * is what lets the write guard pass them through un-revisioned — and, just as importantly,
 * still refuse to delete them.
 *
 * The line to hold: **nothing in this file may write a Route, Step, StepEdge or Field.** That
 * is what invariant 19 means in practice — a temporary closure must never become a route
 * edit because editing was easier. The write guard would reject it, and an architecture test
 * asserts this module never names those models.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Who may do this: any signed-in contributor.**
 *
 * No approval gate, no ownership, no reputation threshold. A student who learns on Tuesday
 * that the Dhaka centre is shut should be able to say so on Tuesday (FR-16, FR-44, BR-01,
 * invariant 3, §43.1). The community corrects afterwards, as it does everywhere else.
 */

export interface Contributor {
  /** The signed-in user. Announcements are attributable; anonymous ones are not accepted. */
  readonly authorId: string
}

export class ChangeInputError extends Error {}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Announcing a permanent change
   ══════════════════════════════════════════════════════════════════════════════════════════ */

export interface AnnounceChangeInput extends Contributor {
  readonly routeId: string
  readonly kind: RouteChangeKind
  /**
   * Declared, never derived (§41.2). The caller must have obtained this from a person; there
   * is no default and no inference from the size of the underlying diff.
   */
  readonly severity: ChangeSeverity
  readonly title: string
  readonly detail?: string | null
  /** Where known (§41.1, BR-26). Null is a legitimate answer, not a missing value. */
  readonly effectiveAt?: Date | null
  /** Announcement date, defaulting to now. Separable so a change discovered late can say so. */
  readonly announcedAt?: Date
  readonly stepId?: string | null
  readonly fieldId?: string | null
  /**
   * **The revision rows this announcement describes.**
   *
   * The durable alternative to matching history by date. A revision id is unambiguous where a
   * timestamp is not: revisions written in one transaction share a `createdAt`, and a chain
   * may fork, so "the revision current at time T" can have two correct answers while "revision
   * X" always has one.
   *
   * Only the "to" side is given. The state each replaced is that revision's own
   * `previousRevisionId`, which the ledger holds immutably — see `shadowForChange`.
   *
   * Optional, because a contributor may want to say something about a route without pointing
   * at a specific edit. An announcement with no revisions is still shown; it simply cannot
   * offer a precise before/after, and the interface says so rather than guessing one.
   */
  readonly describes?: {
    readonly routeRevisionIds?: readonly string[]
    readonly stepRevisionIds?: readonly string[]
    readonly stepEdgeRevisionIds?: readonly string[]
    readonly fieldRevisionIds?: readonly string[]
  }
}

/**
 * A named revision must belong to the route being announced about.
 *
 * Without this an announcement on one route could name a revision from another, and the
 * shadow reconstruction would then produce a confident, wrong "before" — the exact failure
 * the explicit link exists to prevent. Checked at write time, once, rather than defended
 * against at every read.
 */
async function assertRevisionsBelongToRoute(
  routeId: string,
  describes: NonNullable<AnnounceChangeInput['describes']>,
): Promise<void> {
  const [routeRevs, stepRevs, edgeRevs, fieldRevs] = await Promise.all([
    prisma.routeRevision.count({
      where: { id: { in: [...(describes.routeRevisionIds ?? [])] }, routeId },
    }),
    prisma.stepRevision.count({
      where: { id: { in: [...(describes.stepRevisionIds ?? [])] }, step: { routeId } },
    }),
    prisma.stepEdgeRevision.count({
      where: { id: { in: [...(describes.stepEdgeRevisionIds ?? [])] }, stepEdge: { routeId } },
    }),
    prisma.fieldRevision.count({
      where: { id: { in: [...(describes.fieldRevisionIds ?? [])] }, field: { step: { routeId } } },
    }),
  ])

  const expected =
    (describes.routeRevisionIds?.length ?? 0) +
    (describes.stepRevisionIds?.length ?? 0) +
    (describes.stepEdgeRevisionIds?.length ?? 0) +
    (describes.fieldRevisionIds?.length ?? 0)

  if (routeRevs + stepRevs + edgeRevs + fieldRevs !== expected) {
    throw new ChangeInputError(
      'A change announcement may only name revisions belonging to its own route',
    )
  }
}

/**
 * Record that the public route changed in a way followers should know about — FR-59, FR-60.
 *
 * This does **not** change the route. The edit itself happens through the revision service
 * like any other contribution; this adds the human half — how much it matters and when it
 * starts to — which no diff of the ledger contains.
 */
export async function announceChange(input: AnnounceChangeInput): Promise<{ changeId: string }> {
  const title = input.title.trim()
  if (title.length === 0) throw new ChangeInputError('A change needs a title')

  const describes = input.describes ?? {}
  await assertRevisionsBelongToRoute(input.routeId, describes)

  // One row per named revision, exactly one reference each — a shape the database also
  // enforces with a CHECK constraint, because a link that resolves to nothing would make the
  // shadow reconstruction quietly wrong rather than loudly broken.
  const links = [
    ...(describes.routeRevisionIds ?? []).map((id) => ({ routeRevisionId: id })),
    ...(describes.stepRevisionIds ?? []).map((id) => ({ stepRevisionId: id })),
    ...(describes.stepEdgeRevisionIds ?? []).map((id) => ({ stepEdgeRevisionId: id })),
    ...(describes.fieldRevisionIds ?? []).map((id) => ({ fieldRevisionId: id })),
  ]

  const created = await prisma.routeChange.create({
    data: {
      routeId: input.routeId,
      kind: input.kind,
      severity: input.severity,
      title,
      detail: emptyToNull(input.detail),
      announcedAt: input.announcedAt ?? new Date(),
      effectiveAt: input.effectiveAt ?? null,
      stepId: input.stepId ?? null,
      fieldId: input.fieldId ?? null,
      authorId: input.authorId,
      ...(links.length === 0 ? {} : { revisions: { create: links } }),
    },
    select: { id: true },
  })

  return { changeId: created.id }
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Temporary disruptions — the overlay that never edits the route
   ══════════════════════════════════════════════════════════════════════════════════════════ */

export interface RecordDisruptionInput extends Contributor {
  readonly routeId: string
  readonly severity: ChangeSeverity
  readonly title: string
  readonly detail?: string | null
  /** Date scope. `endsAt` null means open-ended until somebody resolves it. */
  readonly startsAt: Date
  readonly endsAt?: Date | null
  /** Location scope — "Dhaka, Bangladesh". Free text; no closed list would hold it. */
  readonly locationScope?: string | null
  /** Process scope — the step this touches. */
  readonly stepId?: string | null
}

/**
 * Record a temporary disruption — FR-32, FR-63, BR-27, §41.5, §31.4, invariant 19.
 *
 * The IELTS-centre-closed case. Nothing about the route is edited: the step still says what
 * it said, its revision count does not move, and when the window passes the disruption stops
 * matching without anything being written. An integration test asserts exactly that — the
 * route's revision count is identical before the disruption, during it, and after it expires.
 */
export async function recordDisruption(
  input: RecordDisruptionInput,
): Promise<{ disruptionId: string }> {
  const title = input.title.trim()
  if (title.length === 0) throw new ChangeInputError('A disruption needs a title')

  const endsAt = input.endsAt ?? null
  if (endsAt !== null && endsAt.getTime() <= input.startsAt.getTime()) {
    throw new ChangeInputError('A disruption must end after it starts')
  }

  const created = await prisma.temporaryDisruption.create({
    data: {
      routeId: input.routeId,
      severity: input.severity,
      title,
      detail: emptyToNull(input.detail),
      startsAt: input.startsAt,
      endsAt,
      locationScope: emptyToNull(input.locationScope),
      stepId: input.stepId ?? null,
      authorId: input.authorId,
    },
    select: { id: true },
  })

  return { disruptionId: created.id }
}

/**
 * End a disruption early, or record that it turned out not to apply — BR-08.
 *
 * Sets `resolvedAt` rather than moving `endsAt`, so the announced window and what actually
 * happened stay separately legible. Somebody reading later can see that a fortnight's closure
 * was called off after four days, which is a different and more useful fact than a fortnight
 * that was always four days.
 *
 * **A disruption that turns out to be permanent is resolved here and then announced as a
 * change** — two deliberate acts by a person, with a form each. BR-08 allows a disruption to
 * become a structural change; it does not ask for a one-click conversion, and a shortcut that
 * did both at once would blur the line between an overlay and a revision that invariant 19
 * exists to keep sharp. Keeping both records is the point: "it started as a closure in
 * September and became the rule" is the actual history, and one combined record would lose how
 * the community learned it.
 */
export async function resolveDisruption(
  input: Contributor & { readonly disruptionId: string; readonly note?: string | null },
): Promise<void> {
  await prisma.temporaryDisruption.update({
    where: { id: input.disruptionId },
    data: { resolvedAt: new Date(), resolvedNote: emptyToNull(input.note) },
  })
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length === 0 ? null : trimmed
}
