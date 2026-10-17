import { beforeAll, describe, expect, it } from 'vitest'

import {
  ChangeSeverity,
  JourneyStepStatus,
  RouteChangeKind,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
} from '../../src/domain/enums'
import { generateHandle } from '../../src/server/auth/handle'
import {
  currentDisruptions,
  disruptionsForRoute,
  recentChanges,
} from '../../src/server/changes/read'
import { announceChange, recordDisruption, resolveDisruption } from '../../src/server/changes/service'
import { prisma } from '../../src/server/db/client'
import { followedRouteReports } from '../../src/server/journeys/changes'
import { followRoute, setStepProgress, unfollowRoute } from '../../src/server/journeys/service'
import { addEdge, addStep, createRoute } from '../../src/server/revisions/service'

/**
 * Phase 14, the Updates page, against a real database. FR-28, FR-29, FR-59, FR-62, FR-63.
 *
 * Three things only a database can show:
 *
 *   **The feed spans routes.** Changes from two routes come back in one list, newest first,
 *   each naming the route it belongs to, and a severity filter narrows without reordering.
 *
 *   **An expired disruption drops out without anything being rewritten** (invariant 19). The
 *   row is still there on the route's own Changes tab; only the comparison against `now` moved.
 *
 *   **Relevance is decided by the effective date, never the announcement date** (invariant 21,
 *   BR-26). Two changes recorded at the same moment, on the same finished step, get different
 *   answers because their effective dates fall either side of the day the follower finished.
 *   If the announcement date decided, they would get the same answer.
 */

const url = process.env.TEST_DATABASE_URL
const system = { id: null, system: true }

let author: string
let follower: string
let stranger: string

beforeAll(async () => {
  if (!url) return
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [a, f, s] = await Promise.all([
    prisma.user.create({ data: { handle: generateHandle(), email: `ua-${suffix}@example.test` } }),
    prisma.user.create({ data: { handle: generateHandle(), email: `uf-${suffix}@example.test` } }),
    prisma.user.create({ data: { handle: generateHandle(), email: `us-${suffix}@example.test` } }),
  ])
  author = a.id
  follower = f.id
  stranger = s.id
}, 180_000)

const DAY = 24 * 60 * 60 * 1000
const ago = (days: number): Date => new Date(Date.now() - days * DAY)
const ahead = (days: number): Date => new Date(Date.now() + days * DAY)
const tick = () => new Promise((resolve) => setTimeout(resolve, 25))

/** Generous, because the test database is shared and other suites announce changes too. */
const WIDE = 1000

interface Fixture {
  readonly routeId: string
  readonly docs: string
  readonly visa: string
}

async function makeRoute(title: string): Promise<Fixture> {
  const slug = `upd-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { routeId } = await createRoute({
    actor: system,
    slug,
    originCountry: 'BD',
    destinationCountry: 'AU',
    studyLevel: StudyLevel.masters,
    title,
  })
  const docs = await addStep({
    actor: system,
    routeId,
    label: 'Documents',
    category: StepCategory.documents_preparation,
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
    toStepId: visa.stepId,
    kind: StepEdgeKind.sequential,
  })
  return { routeId, docs: docs.stepId, visa: visa.stepId }
}

function announce(
  routeId: string,
  title: string,
  extra: { severity?: ChangeSeverity; stepId?: string; effectiveAt?: Date; announcedAt?: Date } = {},
) {
  return announceChange({
    authorId: author,
    routeId,
    kind: RouteChangeKind.field_correction,
    severity: extra.severity ?? ChangeSeverity.relevant,
    title,
    ...(extra.stepId === undefined ? {} : { stepId: extra.stepId }),
    ...(extra.effectiveAt === undefined ? {} : { effectiveAt: extra.effectiveAt }),
    ...(extra.announcedAt === undefined ? {} : { announcedAt: extra.announcedAt }),
  })
}

describe.skipIf(!url)('FR-28, FR-62 — one list across routes', () => {
  it('returns changes from several routes, newest announcement first, each naming its route', async () => {
    const first = await makeRoute('First route on the updates page')
    const second = await makeRoute('Second route on the updates page')

    const older = await announce(first.routeId, 'Older change', { announcedAt: ago(2) })
    const newer = await announce(second.routeId, 'Newer change', { announcedAt: ago(1) })

    const feed = (await recentChanges({ limit: WIDE })).filter((row) =>
      [older.changeId, newer.changeId].includes(row.id),
    )
    expect(feed.map((row) => row.id)).toEqual([newer.changeId, older.changeId])
    expect(feed[0]?.route.id).toBe(second.routeId)
    expect(feed[0]?.route.title).toBe('Second route on the updates page')
    expect(feed[1]?.route.id).toBe(first.routeId)
  })

  it('narrows by level without changing the order of what is left', async () => {
    const route = await makeRoute('Route with changes at several levels')
    const critical = await announce(route.routeId, 'Critical', {
      severity: ChangeSeverity.critical,
      announcedAt: ago(3),
    })
    const informational = await announce(route.routeId, 'Informational', {
      severity: ChangeSeverity.informational,
      announcedAt: ago(2),
    })
    const important = await announce(route.routeId, 'Important', {
      severity: ChangeSeverity.important,
      announcedAt: ago(1),
    })

    const mine = (rows: readonly { id: string }[]) =>
      rows
        .map((row) => row.id)
        .filter((id) => [critical.changeId, informational.changeId, important.changeId].includes(id))

    const filtered = await recentChanges({
      severities: [ChangeSeverity.critical, ChangeSeverity.important],
      limit: WIDE,
    })
    // Still newest first. A critical change does not jump the queue because it is critical
    // (CLAUDE.md §5: severity filters, it never orders).
    expect(mine(filtered)).toEqual([important.changeId, critical.changeId])

    const everything = await recentChanges({ limit: WIDE })
    expect(mine(everything)).toEqual([important.changeId, informational.changeId, critical.changeId])
  })

  it('leaves out the routes it is told to, which is how "everything else" works', async () => {
    const kept = await makeRoute('A route the reader does not follow')
    const left = await makeRoute('A route the reader follows')
    const a = await announce(kept.routeId, 'On the kept route')
    const b = await announce(left.routeId, 'On the left-out route')

    const ids = (await recentChanges({ excludeRouteIds: [left.routeId], limit: WIDE })).map(
      (row) => row.id,
    )
    expect(ids).toContain(a.changeId)
    expect(ids).not.toContain(b.changeId)
  })
})

describe.skipIf(!url)('FR-63, invariant 19 — a disruption that is over drops out, untouched', () => {
  it('shows running and upcoming disruptions and drops ended or resolved ones', async () => {
    const route = await makeRoute('Route with disruptions')
    const running = await recordDisruption({
      authorId: author,
      routeId: route.routeId,
      severity: ChangeSeverity.important,
      title: 'Centre closed this fortnight',
      startsAt: ago(2),
      endsAt: ahead(5),
    })
    const upcoming = await recordDisruption({
      authorId: author,
      routeId: route.routeId,
      severity: ChangeSeverity.relevant,
      title: 'Strike next month',
      startsAt: ahead(20),
      endsAt: ahead(22),
    })
    const ended = await recordDisruption({
      authorId: author,
      routeId: route.routeId,
      severity: ChangeSeverity.relevant,
      title: 'Closed last month',
      startsAt: ago(40),
      endsAt: ago(30),
    })
    const resolved = await recordDisruption({
      authorId: author,
      routeId: route.routeId,
      severity: ChangeSeverity.relevant,
      title: 'Was meant to run all month, reopened early',
      startsAt: ago(3),
      endsAt: ahead(25),
    })
    await resolveDisruption({ authorId: author, disruptionId: resolved.disruptionId })

    const onPage = (await currentDisruptions({ limit: WIDE }))
      .filter((row) => row.route.id === route.routeId)
      .map((row) => row.id)
    expect(onPage).toContain(running.disruptionId)
    expect(onPage).toContain(upcoming.disruptionId)
    expect(onPage).not.toContain(ended.disruptionId)
    expect(onPage).not.toContain(resolved.disruptionId)

    // Nothing was rewritten to make them drop out: all four are still on the route itself.
    const onRoute = (await disruptionsForRoute(route.routeId)).map((row) => row.id)
    expect(onRoute).toHaveLength(4)
  })
})

describe.skipIf(!url)('FR-28, FR-29, invariant 5 — the reader’s own followed routes', () => {
  it('reports every route this person follows, and nobody else’s', async () => {
    const one = await makeRoute('Followed route one')
    const two = await makeRoute('Followed route two')
    const theirs = await makeRoute('A route only the stranger follows')

    await followRoute({ userId: follower, routeId: one.routeId })
    await followRoute({ userId: follower, routeId: two.routeId })
    await followRoute({ userId: stranger, routeId: theirs.routeId })
    await tick()
    const a = await announce(one.routeId, 'Change on route one', { stepId: one.visa })
    const b = await announce(two.routeId, 'Change on route two', { stepId: two.visa })

    const reports = await followedRouteReports(follower)
    const routeIds = reports.map((entry) => entry.route.id)
    expect(routeIds).toContain(one.routeId)
    expect(routeIds).toContain(two.routeId)
    expect(routeIds).not.toContain(theirs.routeId)

    const changeIds = reports.flatMap((entry) => entry.report.changes.map((c) => c.change.id))
    expect(changeIds).toContain(a.changeId)
    expect(changeIds).toContain(b.changeId)

    // Both changes are on a step the follower has not started: ahead of them, so a caution.
    const relevance = reports
      .flatMap((entry) => entry.report.changes)
      .filter((entry) => [a.changeId, b.changeId].includes(entry.change.id))
      .map((entry) => entry.relevance)
    expect(relevance.every((r) => r.bearing === 'ahead' && r.weight === 'caution')).toBe(true)
  })

  it('drops a route once it is unfollowed', async () => {
    const route = await makeRoute('Followed, then not')
    const { journeyId } = await followRoute({ userId: stranger, routeId: route.routeId })
    expect((await followedRouteReports(stranger)).map((e) => e.route.id)).toContain(route.routeId)

    await unfollowRoute({ userId: stranger, journeyId })
    expect((await followedRouteReports(stranger)).map((e) => e.route.id)).not.toContain(
      route.routeId,
    )
  })
})

describe.skipIf(!url)('invariant 21, BR-26 — the effective date decides, never the announcement date', () => {
  it('gives two changes announced together different answers when their effective dates differ', async () => {
    const route = await makeRoute('Route where dates matter')
    const { journeyId } = await followRoute({ userId: follower, routeId: route.routeId })
    // The follower finished the documents step ten days ago.
    await setStepProgress({
      userId: follower,
      journeyId,
      stepId: route.docs,
      status: JourneyStepStatus.completed,
      actualDate: ago(10),
    })
    await tick()

    // Recorded at the same instant, both well after the follower finished. Only the effective
    // dates differ: one rule started before they finished, one started after.
    const announcedAt = new Date()
    const before = await announce(route.routeId, 'Rule in force before you finished', {
      stepId: route.docs,
      effectiveAt: ago(30),
      announcedAt,
    })
    const after = await announce(route.routeId, 'Rule in force after you finished', {
      stepId: route.docs,
      effectiveAt: ago(5),
      announcedAt,
    })

    const entries = (await followedRouteReports(follower))
      .flatMap((entry) => entry.report.changes)
      .filter((entry) => [before.changeId, after.changeId].includes(entry.change.id))
    const byId = new Map(entries.map((entry) => [entry.change.id, entry.relevance]))

    expect(byId.get(after.changeId)?.bearing).toBe('completed_before_effective')
    expect(byId.get(after.changeId)?.notes).toContain('effective_after_your_date')
    // Had the announcement date decided, this one would read the same as the other, because it
    // too was announced after the follower finished. It does not.
    expect(byId.get(before.changeId)?.bearing).toBe('already_done')
    expect(byId.get(before.changeId)?.notes).not.toContain('effective_after_your_date')

    // Neither lands ahead of them, so neither belongs on "Affecting my journey", and the
    // completion stands either way (FR-30, invariant 8).
    for (const relevance of byId.values()) {
      expect(relevance.weight).not.toBe('caution')
      expect(relevance.notes).toContain('completion_preserved')
    }
  })

  it('treats a change announced today about a step ahead as ahead, whatever its dates', async () => {
    const route = await makeRoute('Route with a change ahead')
    await followRoute({ userId: follower, routeId: route.routeId })
    await tick()
    const pending = await announce(route.routeId, 'Starts next month', {
      stepId: route.visa,
      effectiveAt: ahead(30),
    })

    const entry = (await followedRouteReports(follower))
      .flatMap((e) => e.report.changes)
      .find((e) => e.change.id === pending.changeId)
    expect(entry?.relevance.bearing).toBe('ahead')
    expect(entry?.relevance.weight).toBe('caution')
    expect(entry?.relevance.notes).toContain('not_yet_effective')
  })
})
