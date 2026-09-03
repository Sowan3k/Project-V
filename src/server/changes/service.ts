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
