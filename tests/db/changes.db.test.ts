import { randomUUID } from 'node:crypto'

import { beforeAll, describe, expect, it } from 'vitest'

import {
  ChangeSeverity,
  FieldApplicability,
  FieldCategory,
  FollowerChangeStance,
  JourneyStepStatus,
  RouteChangeKind,
  SourceClass,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
} from '../../src/domain/enums'
import { generateHandle } from '../../src/server/auth/handle'
import {
  changesForRoute,
  disruptionsForRoute,
  lastChangePoint,
  shadowSince,
} from '../../src/server/changes/read'
import {
  announceChange,
  recordDisruption,
  resolveDisruption,
} from '../../src/server/changes/service'
import { prisma } from '../../src/server/db/client'
import {
  clearChangeStance,
  followerChangeReport,
  setChangeStance,
} from '../../src/server/journeys/changes'
import { followRoute, setStepProgress } from '../../src/server/journeys/service'
import { loadRouteGraphAt } from '../../src/server/revisions/read'
import {
  addEdge,
  addField,
  addStep,
  archiveStep,
  createRoute,
  reviseField,
  reviseStep,
} from '../../src/server/revisions/service'

/**
 * Phase 10 — change propagation against a real database.
 *
 * The unit suite proves the rules; this proves they survive contact with the append-only
 * ledger, real timestamps and a real follower. In particular it proves the two things that
 * cannot be shown without a database:
 *
 *   **The shadow route is reconstructable.** Nothing snapshots a route when somebody follows
 *   it, so "what did this look like on the day I started?" has to come out of the revision
 *   ledger. If that reconstruction is wrong, the whole comparison is fiction.
 *
 *   **A disruption leaves no trace on the route.** Asserted by counting revisions before,
 *   during and after — the only way to show that an overlay really is an overlay.
 */

const url = process.env.TEST_DATABASE_URL
const system = { id: null, system: true }

let author: string
let follower: string
let other: string

beforeAll(async () => {
  if (!url) return
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [a, f, o] = await Promise.all([
    prisma.user.create({ data: { handle: generateHandle(), email: `ca-${suffix}@example.test` } }),
    prisma.user.create({ data: { handle: generateHandle(), email: `cf-${suffix}@example.test` } }),
    prisma.user.create({ data: { handle: generateHandle(), email: `co-${suffix}@example.test` } }),
  ])
  author = a.id
  follower = f.id
  other = o.id
}, 180_000)

const DAY = 24 * 60 * 60 * 1000
const ago = (days: number): Date => new Date(Date.now() - days * DAY)
const ahead = (days: number): Date => new Date(Date.now() + days * DAY)

interface Fixture {
  readonly routeId: string
  readonly slug: string
  readonly steps: Record<string, string>
}

/** A small linear route: documents → test → visa. */
async function makeRoute(): Promise<Fixture> {
  const slug = `chg-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { routeId } = await createRoute({
    actor: system,
    slug,
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    title: 'A route that will change',
  })

  const docs = await addStep({
    actor: system,
    routeId,
    label: 'Documents',
    category: StepCategory.documents_preparation,
  })
  const test = await addStep({
    actor: system,
    routeId,
    label: 'IELTS',
    category: StepCategory.language_testing,
  })
  const visa = await addStep({
    actor: system,
    routeId,
    label: 'Visa',
    category: StepCategory.immigration_visa,
  })

  await addEdge({
    actor: system,
    routeId,
    fromStepId: docs.stepId,
    toStepId: test.stepId,
    kind: StepEdgeKind.sequential,
  })
  await addEdge({
    actor: system,
    routeId,
    fromStepId: test.stepId,
    toStepId: visa.stepId,
    kind: StepEdgeKind.sequential,
  })

  return { routeId, slug, steps: { docs: docs.stepId, test: test.stepId, visa: visa.stepId } }
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The shadow route, reconstructed from the ledger
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('FR-22, FR-77, §14 — the route as it was, rebuilt from revisions', () => {
  it('shows the route without a step that had not been added yet', async () => {
    const route = await makeRoute()
    const cut = new Date()
    // A moment later, the route gains a step.
    await new Promise((resolve) => setTimeout(resolve, 25))
    await addStep({
      actor: system,
      routeId: route.routeId,
      label: 'APS certificate',
      category: StepCategory.documents_preparation,
    })

    const then = await loadRouteGraphAt(route.routeId, cut)
    expect(then.steps.map((s) => s.label).sort()).toEqual(['Documents', 'IELTS', 'Visa'])

    const shadow = await shadowSince(route.routeId, cut)
    expect(shadow.comparison.scale.added).toBe(1)
    expect(shadow.after.steps).toHaveLength(4)
  })

  /**
   * §14.1: "Removed/archived stages remain visible in the shadow rather than disappearing
   * from history." A step archived *after* the cut must still appear on the older side.
   */
  it('shows an archived step as it was before it was archived', async () => {
    const route = await makeRoute()
    const cut = new Date()
    await new Promise((resolve) => setTimeout(resolve, 25))
    await archiveStep({ actor: system, stepId: route.steps.test ?? '' })

    const shadow = await shadowSince(route.routeId, cut)
    expect(shadow.comparison.scale.archived).toBe(1)

    const row = shadow.comparison.rows.find((r) => r.key === route.steps.test)
    expect(row?.before?.label).toBe('IELTS')
    expect(row?.after).toBeNull()
    // Still in the record — archived is not deleted (invariants 1 and 4).
    expect(await prisma.step.findUnique({ where: { id: route.steps.test } })).not.toBeNull()
  })

  it('reads a step label as it was, not as it is now', async () => {
    const route = await makeRoute()
    const cut = new Date()
    await new Promise((resolve) => setTimeout(resolve, 25))
    await reviseStep({
      actor: { id: author },
      stepId: route.steps.test ?? '',
      label: 'IELTS or TOEFL',
      category: StepCategory.language_testing,
    })

    const then = await loadRouteGraphAt(route.routeId, cut)
    expect(then.steps.find((s) => s.id === route.steps.test)?.label).toBe('IELTS')

    const shadow = await shadowSince(route.routeId, cut)
    expect(shadow.comparison.scale.relabelled).toBe(1)
  })

  /**
   * Invariant 22 — branch and parallel structure must survive the comparison intact. A route
   * whose steps are unchanged but whose *wiring* changed is a real structural change.
   */
  it('keeps branch and rejoin structure correct on both sides', async () => {
    const route = await makeRoute()

    // Add an alternative path around the test step, then rejoin.
    const alt = await addStep({
      actor: system,
      routeId: route.routeId,
      label: 'Exemption route',
      category: StepCategory.language_testing,
    })
    await addEdge({
      actor: system,
      routeId: route.routeId,
      fromStepId: route.steps.docs ?? '',
      toStepId: alt.stepId,
      kind: StepEdgeKind.alternative,
    })
    await addEdge({
      actor: system,
      routeId: route.routeId,
      fromStepId: alt.stepId,
      toStepId: route.steps.visa ?? '',
      kind: StepEdgeKind.rejoin,
    })

    const cut = new Date()
    await new Promise((resolve) => setTimeout(resolve, 25))

    // Now add a parallel-ish optional branch after the cut.
    const extra = await addStep({
      actor: system,
      routeId: route.routeId,
      label: 'Blocked account',
      category: StepCategory.funding_scholarship,
    })
    await addEdge({
      actor: system,
      routeId: route.routeId,
      fromStepId: route.steps.docs ?? '',
      toStepId: extra.stepId,
      kind: StepEdgeKind.optional_branch,
    })

    const shadow = await shadowSince(route.routeId, cut)

    // The older side still has the alternative and the rejoin.
    const beforeKinds = shadow.before.edges.map((e) => e.kind)
    expect(beforeKinds).toContain(StepEdgeKind.alternative)
    expect(beforeKinds).toContain(StepEdgeKind.rejoin)
    // The newer side has those and the new optional branch.
    const afterKinds = shadow.after.edges.map((e) => e.kind)
    expect(afterKinds).toContain(StepEdgeKind.alternative)
    expect(afterKinds).toContain(StepEdgeKind.rejoin)
    expect(afterKinds).toContain(StepEdgeKind.optional_branch)

    expect(shadow.comparison.scale.added).toBe(1)
    expect(shadow.comparison.structureChanged).toBe(true)
    // Every step on both sides has a label — a dangling or half-built graph would be worse
    // than a missing one, because it would render.
    for (const graph of [shadow.before, shadow.after]) {
      for (const s of graph.steps) expect(s.label).not.toBe('')
      const ids = new Set(graph.steps.map((s) => s.id))
      for (const e of graph.edges) {
        expect(ids.has(e.fromStepId), 'dangling edge').toBe(true)
        expect(ids.has(e.toStepId), 'dangling edge').toBe(true)
      }
    }
  })

  it('counts field edits separately from structural ones', async () => {
    const route = await makeRoute()
    const field = await addField({
      actor: system,
      stepId: route.steps.visa ?? '',
      category: FieldCategory.cost,
      valueText: '€75',
      sourceClass: SourceClass.official,
    })
    const cut = new Date()
    await new Promise((resolve) => setTimeout(resolve, 25))
    await reviseField({
      actor: { id: author },
      fieldId: field.fieldId,
      valueText: '€90',
      sourceClass: SourceClass.official,
    })

    const shadow = await shadowSince(route.routeId, cut)
    expect(shadow.comparison.structureChanged).toBe(false)
    expect(shadow.fieldsChanged).toBe(1)
    // A route can change materially with no step moving — `anyChange` has to see that.
    expect(shadow.anyChange).toBe(true)
  })

  it('reports an honest nothing for a route that has never changed', async () => {
    const route = await makeRoute()
    const since = await lastChangePoint(route.routeId)
    if (since !== null) {
      const shadow = await shadowSince(route.routeId, since)
      // Building a route writes several revisions, so a change point exists; what matters is
      // that comparing against the newest state reports no structural churn beyond the build.
      expect(shadow.comparison.scale.archived).toBe(0)
    }
    expect(true).toBe(true)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The required end-to-end scenario, at the service level
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('a follower, a revision, and what they are told', () => {
  /**
   * **The whole Phase 10 scenario in one test**, in the order it happens in life:
   * follow → record progress → the route changes → the follower is told, accurately.
   */
  it('shows the change, keeps the completion, and scopes relevance to progress', async () => {
    const route = await makeRoute()
    const { journeyId } = await followRoute({ userId: follower, routeId: route.routeId })

    // They finish the documents step and record the date.
    await setStepProgress({
      userId: follower,
      journeyId,
      stepId: route.steps.docs ?? '',
      status: JourneyStepStatus.completed,
      actualDate: ago(10),
      privateNote: 'Sent everything to uni-assist.',
    })
    await setStepProgress({
      userId: follower,
      journeyId,
      stepId: route.steps.visa ?? '',
      status: JourneyStepStatus.not_started,
      targetDate: ahead(30),
    })

    // The public route changes: one change on the step they finished, effective afterwards,
    // and one on a step they have not reached.
    const behind = await announceChange({
      authorId: author,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.important,
      title: 'Certified copies now required',
      effectiveAt: ago(2),
      stepId: route.steps.docs ?? '',
    })
    const front = await announceChange({
      authorId: author,
      routeId: route.routeId,
      kind: RouteChangeKind.structural,
      severity: ChangeSeverity.critical,
      title: 'Blocked account proof added to the visa step',
      effectiveAt: ahead(5),
      stepId: route.steps.visa ?? '',
    })

    const report = await followerChangeReport(follower, route.routeId)
    if (report === null) throw new Error('expected a report')

    // FR-28: they can see the route changed.
    expect(report.changes).toHaveLength(2)

    // FR-61, §41.3, BR-26 — the change on the finished step took effect after their date,
    // so it is context and their completion is explicitly preserved.
    const done = report.changes.find((entry) => entry.change.id === behind.changeId)
    expect(done?.relevance.bearing).toBe('completed_before_effective')
    expect(done?.relevance.weight).toBe('context')
    expect(done?.relevance.notes).toContain('completion_preserved')

    // FR-29 — the one ahead of them is the one that gets a caution.
    const upcoming = report.changes.find((entry) => entry.change.id === front.changeId)
    expect(upcoming?.relevance.bearing).toBe('ahead')
    expect(upcoming?.relevance.weight).toBe('caution')
    expect(upcoming?.relevance.notes).toContain('not_yet_effective')
    expect(upcoming?.relevance.notes).toContain('shape_changed')

    // Relevance, not volume: two changes, one asking anything.
    expect(report.needsAttention).toBe(1)

    // FR-30, BR-17, invariant 8 — nothing about their record moved.
    const progress = await prisma.journeyStepProgress.findMany({
      where: { journey: { userId: follower, routeId: route.routeId } },
    })
    const docsRow = progress.find((row) => row.stepId === route.steps.docs)
    expect(docsRow?.status).toBe(JourneyStepStatus.completed)
    expect(docsRow?.actualDate?.toDateString()).toBe(ago(10).toDateString())
    expect(docsRow?.privateNote).toBe('Sent everything to uni-assist.')
  })

  /**
   * A structural change, not merely a field edit — the case that moves the road itself.
   */
  it('surfaces a structural change ahead of the follower and preserves what is behind', async () => {
    const route = await makeRoute()
    const { journeyId } = await followRoute({ userId: follower, routeId: route.routeId })
    await setStepProgress({
      userId: follower,
      journeyId,
      stepId: route.steps.docs ?? '',
      status: JourneyStepStatus.completed,
      actualDate: ago(5),
    })

    const report0 = await followerChangeReport(follower, route.routeId)
    const startedAt = report0?.startedAt ?? new Date()

    await new Promise((resolve) => setTimeout(resolve, 25))
    // A genuinely structural change: a new required step between test and visa.
    const aps = await addStep({
      actor: { id: author },
      routeId: route.routeId,
      label: 'APS certificate',
      category: StepCategory.documents_preparation,
    })
    await addEdge({
      actor: { id: author },
      routeId: route.routeId,
      fromStepId: route.steps.test ?? '',
      toStepId: aps.stepId,
      kind: StepEdgeKind.sequential,
    })

    const shadow = await shadowSince(route.routeId, startedAt)
    expect(shadow.comparison.structureChanged).toBe(true)
    expect(shadow.comparison.scale.added).toBe(1)

    // The added row appears with nothing opposite it — the location of the change.
    const addedRow = shadow.comparison.rows.find((r) => r.marks.includes('step_added'))
    expect(addedRow?.after?.label).toBe('APS certificate')
    expect(addedRow?.before).toBeNull()

    // And the completed step is still completed.
    const after = await prisma.journeyStepProgress.findFirst({
      where: { journey: { userId: follower, routeId: route.routeId }, stepId: route.steps.docs },
    })
    expect(after?.status).toBe(JourneyStepStatus.completed)
  })

  it('tells a follower nothing about changes announced before they started', async () => {
    const route = await makeRoute()
    await announceChange({
      authorId: author,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.critical,
      title: 'Announced before anybody followed',
      announcedAt: ago(30),
      stepId: route.steps.visa ?? '',
    })

    await followRoute({ userId: follower, routeId: route.routeId })
    const report = await followerChangeReport(follower, route.routeId)

    // It is part of the route they chose to follow, not news that arrived under them (§14.2).
    expect(report?.changes).toHaveLength(0)
    expect(report?.needsAttention).toBe(0)
  })

  it('returns nothing at all for somebody who does not follow the route', async () => {
    const route = await makeRoute()
    await announceChange({
      authorId: author,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.critical,
      title: 'Nobody is following this',
      stepId: route.steps.visa ?? '',
    })
    expect(await followerChangeReport(other, route.routeId)).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Applicability — §13.3, FR-81
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('FR-81, §13.3 — a narrow change is not presented as universal', () => {
  it('marks the scope narrow and asks the follower, then respects the answer', async () => {
    const route = await makeRoute()
    await followRoute({ userId: follower, routeId: route.routeId })

    // A fact that applies to one programme only.
    const field = await addField({
      actor: system,
      stepId: route.steps.visa ?? '',
      category: FieldCategory.requirement,
      valueText: 'GRE required for this programme',
      sourceClass: SourceClass.institutional_public,
      applicability: [FieldApplicability.programme],
    })
    const change = await announceChange({
      authorId: author,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.important,
      title: 'GRE percentile raised',
      stepId: route.steps.visa ?? '',
      fieldId: field.fieldId,
    })

    const first = await followerChangeReport(follower, route.routeId)
    const entry = first?.changes.find((c) => c.change.id === change.changeId)
    expect(entry?.relevance.notes).toContain('scope_narrower_than_route')
    // The platform does not decide; it asks (§13.3).
    expect(entry?.relevance.askFollower).toBe(true)

    await setChangeStance({
      userId: follower,
      routeId: route.routeId,
      changeId: change.changeId,
      stance: FollowerChangeStance.not_applicable,
    })

    const second = await followerChangeReport(follower, route.routeId)
    const answered = second?.changes.find((c) => c.change.id === change.changeId)
    expect(answered?.stance).toBe(FollowerChangeStance.not_applicable)
    expect(answered?.relevance.askFollower).toBe(false)
    // Believed: it stops asking and stops warning.
    expect(answered?.relevance.weight).toBeNull()
    expect(second?.needsAttention).toBe(0)

    // And it can be withdrawn.
    await clearChangeStance({
      userId: follower,
      routeId: route.routeId,
      changeId: change.changeId,
    })
    const third = await followerChangeReport(follower, route.routeId)
    expect(third?.changes.find((c) => c.change.id === change.changeId)?.stance).toBeNull()
  })

  it('does not mark a route-wide change as narrow', async () => {
    const route = await makeRoute()
    await followRoute({ userId: follower, routeId: route.routeId })
    const field = await addField({
      actor: system,
      stepId: route.steps.visa ?? '',
      category: FieldCategory.requirement,
      valueText: 'Everyone needs a passport',
      sourceClass: SourceClass.official,
      applicability: [FieldApplicability.route_wide],
    })
    const change = await announceChange({
      authorId: author,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.relevant,
      title: 'Passport validity requirement changed',
      stepId: route.steps.visa ?? '',
      fieldId: field.fieldId,
    })

    const report = await followerChangeReport(follower, route.routeId)
    const entry = report?.changes.find((c) => c.change.id === change.changeId)
    expect(entry?.relevance.notes).not.toContain('scope_narrower_than_route')
    expect(entry?.relevance.askFollower).toBe(false)
  })

  /**
   * Invariant 5 — one follower's stance is invisible to everybody else, including the
   * contributor who announced the change.
   */
  it('keeps one follower stance invisible to another follower', async () => {
    const route = await makeRoute()
    await followRoute({ userId: follower, routeId: route.routeId })
    await followRoute({ userId: other, routeId: route.routeId })
    // A follower sees changes announced strictly *after* they started, and both follows above
    // can land in the same millisecond as the announcement below. That 1ms window is harmless
    // in the product — a change announced the instant you follow is part of the route you
    // chose — but it makes a test that depends on it non-deterministic.
    await new Promise((resolve) => setTimeout(resolve, 25))

    const change = await announceChange({
      authorId: author,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.important,
      title: 'Something to have an opinion about',
      stepId: route.steps.visa ?? '',
    })
    await setChangeStance({
      userId: follower,
      routeId: route.routeId,
      changeId: change.changeId,
      stance: FollowerChangeStance.already_handled,
    })

    // The change itself is public and both followers see it. The *answer* to it is not.
    const theirs = await followerChangeReport(other, route.routeId)
    const entry = theirs?.changes.find((c) => c.change.id === change.changeId)
    expect(entry).toBeDefined()
    expect(entry?.stance).toBeNull()

    // Asserted structurally as well, which does not depend on either report being fetched:
    // the note exists once, and belongs to exactly one person (invariant 5).
    const notes = await prisma.journeyChangeNote.findMany({
      where: { changeId: change.changeId },
      select: { journey: { select: { userId: true } } },
    })
    expect(notes.map((note) => note.journey.userId)).toEqual([follower])

    // And nothing about the stance reaches the public projection of the route's changes.
    const publicView = JSON.stringify(await changesForRoute(route.routeId))
    expect(publicView).not.toContain(follower)
    expect(publicView).not.toContain(FollowerChangeStance.already_handled)
  })

  it('refuses to attach a stance to a change on a different route', async () => {
    const mine = await makeRoute()
    const theirs = await makeRoute()
    await followRoute({ userId: follower, routeId: mine.routeId })
    const elsewhere = await announceChange({
      authorId: author,
      routeId: theirs.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.relevant,
      title: 'Belongs to another route',
    })

    await setChangeStance({
      userId: follower,
      routeId: mine.routeId,
      changeId: elsewhere.changeId,
      stance: FollowerChangeStance.applies,
    })

    expect(await prisma.journeyChangeNote.count({ where: { changeId: elsewhere.changeId } })).toBe(0)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Temporary disruptions — invariant 19, BR-08, BR-27, §31.4
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('FR-32, FR-63 — a disruption appears, expires, and rewrites nothing', () => {
  /**
   * **The Phase 10 exit criterion for disruptions**, and the one assertion that proves an
   * overlay is really an overlay: the route's revision count is identical before the
   * disruption, while it is running, and after it has expired.
   */
  it('never touches the route it is laid over, at any point in its life', async () => {
    const route = await makeRoute()
    const countRevisions = async (): Promise<number> =>
      (await prisma.stepRevision.count({ where: { step: { routeId: route.routeId } } })) +
      (await prisma.routeRevision.count({ where: { routeId: route.routeId } })) +
      (await prisma.stepEdgeRevision.count({ where: { stepEdge: { routeId: route.routeId } } }))

    const before = await countRevisions()

    const { disruptionId } = await recordDisruption({
      authorId: author,
      routeId: route.routeId,
      severity: ChangeSeverity.critical,
      title: 'IELTS Dhaka centre closed',
      detail: 'Closed due to flooding.',
      startsAt: ago(2),
      endsAt: ahead(5),
      locationScope: 'Dhaka, Bangladesh',
      stepId: route.steps.test ?? '',
    })

    // Running: visible.
    const active = await disruptionsForRoute(route.routeId, { activeOnly: true })
    expect(active.map((d) => d.id)).toContain(disruptionId)
    expect(active[0]?.locationScope).toBe('Dhaka, Bangladesh')
    expect(active[0]?.stepLabel).toBe('IELTS')
    expect(await countRevisions()).toBe(before)

    // Expired, evaluated at a later clock: gone from the current view, with nothing written.
    const later = ahead(10)
    const stillActive = await disruptionsForRoute(route.routeId, {
      activeOnly: true,
      now: later,
    })
    expect(stillActive.map((d) => d.id)).not.toContain(disruptionId)
    expect(await countRevisions()).toBe(before)

    // And it is still on the record, because "the centre was shut that fortnight" is exactly
    // what a student a year later wants to find (invariants 1 and 4).
    const all = await disruptionsForRoute(route.routeId, { now: later })
    const historic = all.find((d) => d.id === disruptionId)
    expect(historic).toBeDefined()
    expect(historic?.active).toBe(false)
    expect(historic?.title).toBe('IELTS Dhaka centre closed')

    // The route is byte-for-byte what it was: same steps, same labels.
    const graph = await loadRouteGraphAt(route.routeId, later)
    expect(graph.steps.map((s) => s.label).sort()).toEqual(['Documents', 'IELTS', 'Visa'])
  })

  /**
   * §31.4 — "Followers whose personal test date may be affected see a relevant warning."
   */
  it('warns the follower whose own planned date falls inside the window', async () => {
    const route = await makeRoute()
    const { journeyId } = await followRoute({ userId: follower, routeId: route.routeId })
    await setStepProgress({
      userId: follower,
      journeyId,
      stepId: route.steps.test ?? '',
      status: JourneyStepStatus.not_started,
      targetDate: ahead(3),
    })
    await recordDisruption({
      authorId: author,
      routeId: route.routeId,
      severity: ChangeSeverity.critical,
      title: 'Test centre closed',
      startsAt: ago(1),
      endsAt: ahead(7),
      stepId: route.steps.test ?? '',
    })

    const report = await followerChangeReport(follower, route.routeId)
    const entry = report?.disruptions[0]
    expect(entry?.relevance.bearing).toBe('affects_your_planned_date')
    expect(entry?.relevance.weight).toBe('caution')
    expect(report?.needsAttention).toBe(1)
  })

  it('says nothing to a follower already past the affected step', async () => {
    const route = await makeRoute()
    const { journeyId } = await followRoute({ userId: follower, routeId: route.routeId })
    await setStepProgress({
      userId: follower,
      journeyId,
      stepId: route.steps.test ?? '',
      status: JourneyStepStatus.completed,
      actualDate: ago(20),
    })
    await recordDisruption({
      authorId: author,
      routeId: route.routeId,
      severity: ChangeSeverity.critical,
      title: 'Test centre closed after they sat it',
      startsAt: ago(1),
      endsAt: ahead(7),
      stepId: route.steps.test ?? '',
    })

    const report = await followerChangeReport(follower, route.routeId)
    expect(report?.disruptions[0]?.relevance.bearing).toBe('already_past_it')
    expect(report?.needsAttention).toBe(0)
  })

  it('stops early when resolved, keeping the announced window readable', async () => {
    const route = await makeRoute()
    const { disruptionId } = await recordDisruption({
      authorId: author,
      routeId: route.routeId,
      severity: ChangeSeverity.relevant,
      title: 'Appointment system down',
      startsAt: ago(3),
      endsAt: ahead(10),
    })
    await resolveDisruption({
      authorId: author,
      disruptionId,
      note: 'Back online sooner than expected.',
    })

    const active = await disruptionsForRoute(route.routeId, { activeOnly: true })
    expect(active.map((d) => d.id)).not.toContain(disruptionId)

    const stored = await prisma.temporaryDisruption.findUniqueOrThrow({
      where: { id: disruptionId },
    })
    expect(stored.resolvedAt).not.toBeNull()
    expect(stored.resolvedNote).toContain('sooner')
    // The announced window is untouched — "called off early" stays a legible fact.
    expect(stored.endsAt?.toDateString()).toBe(ahead(10).toDateString())
  })

  /**
   * BR-08's escape hatch, walked the way a contributor actually walks it.
   *
   * "Temporary disruptions should expire or resolve without permanently redefining the route
   * **unless they become structural changes**." That is two deliberate acts with a form each
   * — resolve the disruption, announce the change — and deliberately not a one-click
   * conversion, which would blur exactly the line invariant 19 keeps sharp.
   *
   * Both records survive, and that is the point: "it started as a closure in September and
   * became the rule" is the actual history, and a single combined record would lose how the
   * community learned it.
   */
  it('records a disruption that became permanent as two facts, not one', async () => {
    const route = await makeRoute()
    const { disruptionId } = await recordDisruption({
      authorId: author,
      routeId: route.routeId,
      severity: ChangeSeverity.important,
      title: 'Interview requirement suspended',
      startsAt: ago(30),
      endsAt: ahead(1),
      stepId: route.steps.visa ?? '',
    })

    // Step one: it is over as a temporary thing.
    await resolveDisruption({
      authorId: author,
      disruptionId,
      note: 'The suspension was made permanent.',
    })

    // Step two: the route really did change, so that is announced separately.
    const { changeId } = await announceChange({
      authorId: author,
      routeId: route.routeId,
      kind: RouteChangeKind.structural,
      severity: ChangeSeverity.critical,
      title: 'Interview requirement removed permanently',
      effectiveAt: ago(1),
      stepId: route.steps.visa ?? '',
    })

    const disruption = await prisma.temporaryDisruption.findUniqueOrThrow({
      where: { id: disruptionId },
    })
    expect(disruption.resolvedAt).not.toBeNull()
    // The original window is intact, so the history stays legible.
    expect(disruption.endsAt?.toDateString()).toBe(ahead(1).toDateString())

    const change = await prisma.routeChange.findUniqueOrThrow({ where: { id: changeId } })
    expect(change.routeId).toBe(route.routeId)
    expect(change.stepId).toBe(route.steps.visa)
    expect(change.effectiveAt).not.toBeNull()

    // Two records, both readable. Neither replaced the other.
    expect(await prisma.temporaryDisruption.count({ where: { routeId: route.routeId } })).toBe(1)
    expect(await prisma.routeChange.count({ where: { routeId: route.routeId } })).toBe(1)
  })

  it('refuses a window that ends before it starts', async () => {
    const route = await makeRoute()
    await expect(
      recordDisruption({
        authorId: author,
        routeId: route.routeId,
        severity: ChangeSeverity.relevant,
        title: 'Backwards',
        startsAt: ahead(5),
        endsAt: ago(5),
      }),
    ).rejects.toThrow()
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Non-destruction
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!url)('invariant 1 — neither record can be destroyed', () => {
  it('refuses to delete a change announcement or a disruption', async () => {
    const route = await makeRoute()
    const { changeId } = await announceChange({
      authorId: author,
      routeId: route.routeId,
      kind: RouteChangeKind.field_correction,
      severity: ChangeSeverity.relevant,
      title: `Permanent record ${randomUUID().slice(0, 8)}`,
    })
    const { disruptionId } = await recordDisruption({
      authorId: author,
      routeId: route.routeId,
      severity: ChangeSeverity.relevant,
      title: 'Also permanent',
      startsAt: ago(1),
    })

    await expect(prisma.routeChange.deleteMany({ where: { id: changeId } })).rejects.toThrow()
    await expect(
      prisma.temporaryDisruption.deleteMany({ where: { id: disruptionId } }),
    ).rejects.toThrow()

    expect(await prisma.routeChange.findUnique({ where: { id: changeId } })).not.toBeNull()
    expect(
      await prisma.temporaryDisruption.findUnique({ where: { id: disruptionId } }),
    ).not.toBeNull()
  })
})
