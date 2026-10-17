import { beforeAll, describe, expect, it } from 'vitest'

import { ChangeSeverity, RouteChangeKind, StepCategory, StudyLevel } from '../../src/domain/enums'
import { RECENT_ACTIVITY_WINDOW_DAYS } from '../../src/domain/trust'
import { generateHandle } from '../../src/server/auth/handle'
import { announceChange } from '../../src/server/changes/service'
import { prisma } from '../../src/server/db/client'
import { followRoute, unfollowRoute } from '../../src/server/journeys/service'
import { addStep, createRoute } from '../../src/server/revisions/service'
import { getRouteBySlug, searchRoutes } from '../../src/server/routes/read'

/**
 * Phase 16, G5: the two facts a ribbon now states. FR-10, VR-03.
 *
 * Followers count people, not journeys ever opened: an unfollowed journey is not a follower.
 * Recent changes count announcements inside the passport's display window, and nothing older.
 * The route page and the ribbon must agree, because they describe the same route.
 */

const url = process.env.TEST_DATABASE_URL
const system = { id: null, system: true }
const DAY = 24 * 60 * 60 * 1000

let people: string[] = []

beforeAll(async () => {
  if (!url) return
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  people = (
    await Promise.all(
      [1, 2, 3].map((n) =>
        prisma.user.create({
          data: { handle: generateHandle(), email: `rs${n}-${suffix}@example.test` },
        }),
      ),
    )
  ).map((user) => user.id)
}, 180_000)

describe.skipIf(!url)('Phase 16 — followers and recent changes on the ribbon', () => {
  it('counts current followers and changes announced inside the window', async () => {
    // A destination nothing else in the suite uses, so search returns only this route.
    const destination = 'NZ'
    const slug = `ribbon-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const { routeId } = await createRoute({
      actor: system,
      slug,
      originCountry: 'BD',
      destinationCountry: destination,
      studyLevel: StudyLevel.phd,
      title: 'A route with followers and changes',
    })
    await addStep({ actor: system, routeId, label: 'Visa', category: StepCategory.immigration_visa })

    const [a, b, c] = people as [string, string, string]
    await followRoute({ userId: a, routeId })
    await followRoute({ userId: b, routeId })
    const { journeyId } = await followRoute({ userId: c, routeId })
    await unfollowRoute({ userId: c, journeyId })

    const announce = (title: string, daysAgo: number) =>
      announceChange({
        authorId: a,
        routeId,
        kind: RouteChangeKind.field_correction,
        severity: ChangeSeverity.informational,
        title,
        announcedAt: new Date(Date.now() - daysAgo * DAY),
      })
    await announce('Last week', 7)
    await announce('Last month', 30)
    await announce('Long ago', RECENT_ACTIVITY_WINDOW_DAYS + 10)

    const { routes } = await searchRoutes({ destinationCountry: destination, studyLevel: StudyLevel.phd })
    const ribbon = routes.find((route) => route.id === routeId)
    expect(ribbon?.signals).toEqual({ followerCount: 2, recentAnnouncedChanges: 2 })

    // The route page carries the same two facts, and its passport's follower count agrees.
    const detail = await getRouteBySlug(slug)
    expect(detail?.signals).toEqual(ribbon?.signals)
    expect(detail?.trust.followerCount).toBe(2)
  })

  it('is zero, not missing, for a route nobody follows', async () => {
    const slug = `ribbon-empty-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await createRoute({
      actor: system,
      slug,
      originCountry: 'BD',
      destinationCountry: 'NZ',
      studyLevel: StudyLevel.bachelors,
      title: 'A route nobody follows yet',
    })
    const { routes } = await searchRoutes({ destinationCountry: 'NZ', studyLevel: StudyLevel.bachelors })
    const ribbon = routes.find((route) => route.slug === slug)
    expect(ribbon?.signals).toEqual({ followerCount: 0, recentAnnouncedChanges: 0 })
  })
})
