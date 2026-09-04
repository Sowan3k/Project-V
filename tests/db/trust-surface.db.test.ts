import { beforeAll, describe, expect, it } from 'vitest'

import {
  FieldApplicability,
  FieldCategory,
  RouteMechanism,
  SourceClass,
  StepCategory,
  StudyLevel,
} from '../../src/domain/enums'
import { classifyLink } from '../../src/domain/links'
import { fieldSignals, routePassport, snapshotCautions } from '../../src/domain/trust'
import {
  addField,
  addStep,
  archiveField,
  confirmField,
  createRoute,
  reviseField,
} from '../../src/server/revisions/service'
import { getRouteBySlug, getStepFields, searchRoutes } from '../../src/server/routes/read'

/**
 * Phase 6 — the trust surface against a real database.
 *
 * `tests/unit/trust.test.ts` proves the rules; this proves the read layer actually hands
 * them the right facts. The two failures it exists to catch are the ones unit tests cannot:
 * a column the projection forgot to carry, and a search page quietly disagreeing with the
 * route page it links to.
 */

const url = process.env.TEST_DATABASE_URL
const actor = { id: null, system: true }
const NOW = new Date()
const DAY = 24 * 60 * 60 * 1000

interface Built {
  readonly slug: string
  readonly routeId: string
  readonly stepId: string
  readonly officialWideId: string
  readonly programmeScopedId: string
  readonly submissionId: string
  readonly forkedId: string
  readonly staleId: string
}

async function buildRoute(): Promise<Built> {
  const slug = `trust-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { routeId } = await createRoute({
    actor,
    slug,
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    intake: '2027 autumn',
    title: 'A route with things worth knowing about it',
  })

  const { stepId } = await addStep({
    actor,
    routeId,
    label: 'Admission',
    category: StepCategory.admission_university,
    earliestStartOffsetDays: 0,
    typicalDurationDays: 90,
  })

  // The Amendment 001 pair: two OFFICIAL facts that source class cannot tell apart.
  const officialWide = await addField({
    actor,
    stepId,
    category: FieldCategory.cost,
    valueText: 'Blocked account with a minimum balance',
    sourceClass: SourceClass.official,
    applicability: [FieldApplicability.origin_specific],
    sourceUrl: 'https://example-mission.test/blocked-account',
  })
  const programmeScoped = await addField({
    actor,
    stepId,
    category: FieldCategory.requirement,
    valueText: 'GRE General Test required',
    sourceClass: SourceClass.official,
    applicability: [FieldApplicability.institution, FieldApplicability.programme],
  })

  // An uncorroborated community link, behind a shortener.
  const submission = await addField({
    actor,
    stepId,
    category: FieldCategory.link,
    valueText: 'A portal someone found useful',
    sourceClass: SourceClass.community_submission,
    sourceUrl: 'https://bit.ly/3example',
  })

  // A field two contributors corrected from the same starting point.
  const forked = await addField({
    actor,
    stepId,
    category: FieldCategory.deadline,
    valueText: 'Applications close 15 July',
    sourceClass: SourceClass.official,
    applicability: [FieldApplicability.route_wide],
  })
  const base = forked.revisionId
  await reviseField({
    actor,
    fieldId: forked.fieldId,
    basedOnRevisionId: base,
    valueText: 'Applications close 1 March for non-EU applicants',
    sourceClass: SourceClass.official,
    applicability: [FieldApplicability.route_wide],
    reason: 'The non-EU deadline is earlier.',
  })
  const second = await reviseField({
    actor,
    fieldId: forked.fieldId,
    basedOnRevisionId: base,
    valueText: 'Applications close 31 May',
    sourceClass: SourceClass.official,
    applicability: [FieldApplicability.route_wide],
    reason: 'Read a different page.',
  })
  expect(second.forked).toBe(true)

  // A confirmed field whose stored review date has already passed.
  const stale = await addField({
    actor,
    stepId,
    category: FieldCategory.procedure,
    valueText: 'Apply through the university portal',
    sourceClass: SourceClass.institutional_public,
    applicability: [FieldApplicability.route_wide],
  })
  await confirmField({
    actor,
    fieldId: stale.fieldId,
    reviewDueAt: new Date(NOW.getTime() - 7 * DAY),
  })

  return {
    slug,
    routeId,
    stepId,
    officialWideId: officialWide.fieldId,
    programmeScopedId: programmeScoped.fieldId,
    submissionId: submission.fieldId,
    forkedId: forked.fieldId,
    staleId: stale.fieldId,
  }
}

/**
 * One route, built once, read many times.
 *
 * The first version of this file called `buildRoute()` inside every test. Each build is
 * roughly fifteen write transactions against a remote database, and ten of them took the
 * suite to 219 seconds and four timeouts — a failure that looked like a connectivity problem
 * and was really a fixture problem. Reads are cheap; builds are not.
 *
 * Only the archival test needs its own route, because it mutates.
 */
let built: Built

beforeAll(async () => {
  if (!url) return
  built = await buildRoute()
}, 120_000)

describe.skipIf(!url)('the read layer carries every fact the trust rules need', () => {
  it('projects applicability, freshness dates, revision timing and fork history', async () => {
    const fields = await getStepFields(built.stepId)
    const by = (id: string) => fields.find((field) => field.id === id)

    const scoped = by(built.programmeScopedId)
    expect(scoped?.applicability).toEqual([FieldApplicability.institution, FieldApplicability.programme])

    const stale = by(built.staleId)
    expect(stale?.lastConfirmedAt).not.toBeNull()
    expect(stale?.reviewDueAt).not.toBeNull()

    const forked = by(built.forkedId)
    expect(forked?.revisionCount).toBe(3)
    expect(forked?.lastRevisedAt).not.toBeNull()
  })

  /**
   * The Germany finding, end to end.
   *
   * Both rows are `official`, so a reader given only source class concludes that both apply
   * to them — that a blocked account and a GRE score are equally required. Applicability is
   * the only thing that separates them, and this asserts it survives the round trip.
   */
  it('separates two official claims of different scope', async () => {
    const fields = await getStepFields(built.stepId)

    const wide = fields.find((field) => field.id === built.officialWideId)
    const scoped = fields.find((field) => field.id === built.programmeScopedId)

    expect(wide?.sourceClass).toBe(SourceClass.official)
    expect(scoped?.sourceClass).toBe(SourceClass.official)
    expect(wide?.applicability).not.toEqual(scoped?.applicability)
  })

  it('detects a forked revision chain and leaves a linear one alone', async () => {
    const fields = await getStepFields(built.stepId)

    expect(fields.find((field) => field.id === built.forkedId)?.hasForkedHistory).toBe(true)
    expect(fields.find((field) => field.id === built.officialWideId)?.hasForkedHistory).toBe(false)
  })
})

describe.skipIf(!url)('field signals over real rows — invariants 9, 11, 15', () => {
  it('raises exactly the cautions the data justifies, and no others', async () => {
    const fields = await getStepFields(built.stepId)

    const cautionsFor = (id: string) => {
      const field = fields.find((f) => f.id === id)
      if (!field) throw new Error(`missing field ${id}`)
      return fieldSignals(
        {
          sourceClass: field.sourceClass,
          applicability: field.applicability,
          lastConfirmedAt: field.lastConfirmedAt,
          reviewDueAt: field.reviewDueAt,
          effectiveFrom: field.effectiveFrom,
          expiresAt: field.expiresAt,
          revisionCount: field.revisionCount,
          lastRevisedAt: field.lastRevisedAt,
          hasForkedHistory: field.hasForkedHistory,
          openChallengeCount: field.openChallenges.length,
          quarantined: field.quarantined,
        },
        NOW,
      )
        .filter((signal) => signal.weight === 'caution')
        .map((signal) => signal.id)
    }

    expect(cautionsFor(built.programmeScopedId)).toContain('narrow_scope')
    expect(cautionsFor(built.submissionId)).toContain('unverified_submission')
    expect(cautionsFor(built.forkedId)).toContain('history_forked')

    // The route-wide, official, freshly confirmed field is the control: if this ever starts
    // raising a caution, every field on the page is raising one and none of them mean
    // anything any more.
    expect(cautionsFor(built.staleId)).toEqual([])
  })

  it('never lets a shortened community link pass as an official process link', async () => {
    const fields = await getStepFields(built.stepId)
    const submission = fields.find((field) => field.id === built.submissionId)

    const link = classifyLink(submission?.sourceUrl ?? '', submission?.linkTrustClass ?? null)
    expect(link.cautions).toContain('known_shortener')
    expect(link.cautions).toContain('not_corroborated')
    expect(link.host).toBe('bit.ly')
  })
})

describe.skipIf(!url)('the route passport over real rows — FR-10, FR-11, FR-62, FR-74', () => {
  it('counts information, confirmations, disputes and review-due items', async () => {
    const route = await getRouteBySlug(built.slug, NOW)
    if (!route) throw new Error('route not found')

    const passport = routePassport(route.trust)

    expect(passport.informationCount).toBe(5)
    expect(passport.confirmedCount).toBe(1)
    expect(passport.needsReviewCount).toBe(1)
    // The forked deadline. A fork is a disagreement, whatever its source class says.
    expect(passport.disputedCount).toBe(1)
    // Exact, not "greater than zero". `routeActivity` is hand-written SQL joining four
    // revision tables, so a broken join would still return a positive number — only an
    // exact count catches it. Nine revisions: 1 route + 1 step + 5 addField + 2 reviseField.
    // `confirmField` deliberately makes none: confirming is not editing (§39.2).
    expect(passport.recentChangeCount).toBe(9)
    expect(passport.lastChangedAt).not.toBeNull()

    // Every write in this fixture is a system write with no author, so nobody has looked at
    // it — which is exactly what a freshly seeded route should report (FR-74).
    expect(passport.contributorCount).toBe(0)
  })

  it('reports a brand-new route honestly rather than flatteringly', async () => {
    const route = await getRouteBySlug(built.slug, NOW)
    if (!route) throw new Error('route not found')

    const passport = routePassport(route.trust)

    // New routes publish as experimental and must not look as mature as established ones
    // (FR-74, §18.1). Every one of these is true of this route and is said out loud.
    expect(passport.cautions).toContain('lifecycle_not_established')
    expect(passport.cautions).toContain('disputed_information')
    expect(passport.cautions).toContain('information_needs_review')
    expect(passport.cautions).toContain('single_contributor')
  })

  it('never changes the stored lifecycle state', async () => {
    const route = await getRouteBySlug(built.slug, NOW)
    if (!route) throw new Error('route not found')

    expect(routePassport(route.trust).lifecycleState).toBe(route.lifecycleState)
  })

  /**
   * Search and the route page must agree.
   *
   * A ribbon that looks calmer than the route behind it is a search result that misleads.
   * Both derive their cautions from `snapshotCautions` over the same numbers, and this
   * asserts the numbers themselves match when they come from two different queries.
   */
  it('gives a ribbon the same standing the route page reports', async () => {
    // Sequential, and generously timed. `searchRoutes` loads the full graph of every
    // matching route, and this branch accumulates a route per fixture build across runs, so
    // the search here scans far more than a real search would. Recorded rather than worked
    // around: the same shape is a genuine performance question for Phase 12 once a
    // destination has many routes (Test.md §14).
    const route = await getRouteBySlug(built.slug, NOW)
    const results = (await searchRoutes({ destinationCountry: 'DE' }, NOW)).routes
    if (!route) throw new Error('route not found')

    const ribbon = results.find((result) => result.slug === built.slug)
    expect(ribbon).toBeDefined()
    if (!ribbon) return

    expect(ribbon.trust).toEqual({
      lifecycleState: route.trust.lifecycleState,
      informationCount: route.trust.informationCount,
      confirmedCount: route.trust.confirmedCount,
      needsReviewCount: route.trust.needsReviewCount,
      disputedCount: route.trust.disputedCount,
      quarantinedCount: route.trust.quarantinedCount,
    })

    for (const caution of snapshotCautions(ribbon.trust)) {
      expect(routePassport(route.trust).cautions).toContain(caution)
    }
  }, 120_000)

  /**
   * Deliberately the LAST test in the file, and it must stay last.
   *
   * It archives a field on the shared route, so every count asserted above it would change.
   * The first version built a second route to stay independent — but a build is ~15 write
   * transactions, and on a slow link that alone exceeded a 120-second timeout (Test.md §14).
   * Ordering is the cheaper guarantee here, and the assertion is a before/after delta rather
   * than an absolute, so it does not silently depend on the fixture's exact size either.
   */
  it('counts only live information, not archived rows', async () => {
    const before = await getRouteBySlug(built.slug, NOW)
    await archiveField({ actor, fieldId: built.submissionId })
    const after = await getRouteBySlug(built.slug, NOW)

    expect(before?.trust.informationCount).toBeGreaterThan(0)
    expect(after?.trust.informationCount).toBe((before?.trust.informationCount ?? 0) - 1)
  }, 120_000)
})
