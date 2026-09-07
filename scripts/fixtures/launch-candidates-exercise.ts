import { randomUUID } from 'node:crypto'

import { PrismaClient } from '@prisma/client'

import {
  ChallengeReason,
  ChangeSeverity,
  FieldApplicability,
  FieldCategory,
  JourneyStepStatus,
  ReportReason,
  RouteChangeKind,
  SourceClass,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
  RouteMechanism,
} from '../../src/domain/enums'

/**
 * Exercises the community loop over the five owner-supplied routes — 2026-09-07.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Why this is a separate script from the seed.**
 *
 * `launch-candidates.ts` loads route *content*. This loads *activity over* that content:
 * followers with private progress, a confirmation, a challenge, a report, and one controlled
 * later revision so the shadow comparison has something true to compare. Keeping them apart
 * means the content can be reloaded onto a fresh branch without dragging test activity along,
 * and the activity can be re-run without touching a single sourced fact.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The rule this script is built around: no test action alters a sourced fact.**
 *
 * The owner's instruction was explicit, and it is the right one — these five routes are the
 * closest thing to real content this project has, and a test that quietly edited a government
 * figure would leave content nobody could trust afterwards. So:
 *
 *   - **CONFIRM** adds a confirmation. It changes no text, by design (FR-17: nothing to fill
 *     in when nothing changed).
 *   - **CHALLENGE** marks a claim as needing review and leaves the value exactly as it was —
 *     that is what a challenge *is* (FR-18, §16.4).
 *   - **The shadow comparison** is driven by a clearly-labelled TEST-ONLY step added *after*
 *     the seed, not by revising a sourced field. A structural change is what the shadow is
 *     mostly for anyway (FR-77), and it leaves every factual value untouched.
 *   - **REPORT** is filed against a TEST-ONLY field on a **separate** TEST-ONLY route, so no
 *     real route ever carries an abuse report or the quarantine that might follow it.
 *
 * Nothing here can reach production: the load refuses any database that has not declared
 * itself disposable.
 *
 * Run: npm run fixture:exercise
 */

const prisma = new PrismaClient()

async function assertDisposable(): Promise<void> {
  const marker = await prisma.platformMeta.findUnique({ where: { key: 'environment' } })
  if (marker?.value !== 'test') {
    throw new Error('Refusing: the target database is not marked as a test database.')
  }
}

/** A follower. Sessions are not needed — this exercises the services, not the browser. */
async function traveller(handle: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { handle } })
  if (existing) return existing.id
  const user = await prisma.user.create({
    data: { handle, email: `${handle}-${randomUUID()}@example.test` },
  })
  return user.id
}

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

async function main(): Promise<void> {
  if (process.env.DATABASE_URL_UNPOOLED) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED
  }
  await assertDisposable()

  const revisions = await import('../../src/server/revisions/service')
  const journeys = await import('../../src/server/journeys/service')
  const safety = await import('../../src/server/safety/service')
  const changes = await import('../../src/server/changes/service')
  const { getRouteBySlug, getStepFields } = await import('../../src/server/routes/read')

  const out = (line: string) => process.stdout.write(`${line}\n`)

  /* ── 12. Three different followers, on three different routes ──────────────────────── */

  const nabila = await traveller('traveller-nabila-test')
  const rafi = await traveller('traveller-rafi-test')
  const mim = await traveller('traveller-mim-test')

  const germany = await getRouteBySlug('bd-de-masters-2027')
  const malaysia = await getRouteBySlug('bd-my-masters-2027')
  const austria = await getRouteBySlug('bd-at-masters-2027')
  if (!germany || !malaysia || !austria) {
    throw new Error('Seed the five routes first: npm run fixture:launch')
  }

  const followed = await Promise.all([
    journeys.followRoute({ userId: nabila, routeId: germany.id }),
    journeys.followRoute({ userId: rafi, routeId: malaysia.id }),
    journeys.followRoute({ userId: mim, routeId: austria.id }),
  ])
  out(`12. three followers on three routes — journeys ${followed.map((f) => f.journeyId.slice(-6)).join(', ')}`)

  /* ── 13. Realistic private progress ─────────────────────────────────────────────────
     Early stages done, one underway, target dates ahead of it, a private note and a task.
     None of this is visible to anybody but its owner (FR-26, BR-16, invariant 5). */

  const [gJourney, mJourney, aJourney] = followed

  const progress = async (
    userId: string,
    journeyId: string,
    route: NonNullable<Awaited<ReturnType<typeof getRouteBySlug>>>,
    rows: readonly [number, string, string | null, string | null][],
  ) => {
    for (const [index, status, target, note] of rows) {
      const step = route.steps[index]
      if (!step) continue
      await journeys.setStepProgress({
        userId,
        journeyId,
        stepId: step.id,
        status: status as (typeof JourneyStepStatus)[keyof typeof JourneyStepStatus],
        targetDate: target === null ? null : day(target),
        privateNote: note,
      })
    }
  }

  await progress(nabila, gJourney.journeyId, germany, [
    [0, JourneyStepStatus.completed, null, 'Shortlisted TU Darmstadt and RWTH. Both English-taught.'],
    [1, JourneyStepStatus.completed, null, null],
    [2, JourneyStepStatus.completed, null, 'Board attestation took three weeks — start it earlier than you think.'],
    [3, JourneyStepStatus.completed, null, 'IELTS 7.0 overall. Valid until 2028.'],
    [4, JourneyStepStatus.in_progress, '2026-10-15', 'TU Darmstadt uses uni-assist VPD, not direct. Confirmed on their page.'],
    [9, JourneyStepStatus.not_started, '2027-02-01', 'Blocked account — ask about Fintiba vs Expatrio before committing.'],
  ])
  await journeys.addTask({
    userId: nabila,
    journeyId: gJourney.journeyId,
    label: 'Ask the DAAD info session whether the CSP queue applies to scholarship holders',
  })

  await progress(rafi, mJourney.journeyId, malaysia, [
    [0, JourneyStepStatus.completed, null, 'UM and UPM both have the programme. UM deadline is earlier.'],
    [1, JourneyStepStatus.completed, null, null],
    [2, JourneyStepStatus.in_progress, '2026-10-30', 'Waiting on the transcript. Photo must be EMGS spec — the studio got it wrong once already.'],
    [3, JourneyStepStatus.not_started, '2026-11-20', null],
  ])
  await journeys.addTask({
    userId: rafi,
    journeyId: mJourney.journeyId,
    label: 'Email UM international office before touching EMGS — do not repeat the MAYA mistake',
  })

  await progress(mim, aJourney.journeyId, austria, [
    [0, JourneyStepStatus.completed, null, null],
    [1, JourneyStepStatus.completed, null, 'TU Wien Master needs the entrance exam. Conditional admission route it is.'],
    [2, JourneyStepStatus.in_progress, '2026-11-10', null],
    [11, JourneyStepStatus.not_started, '2027-03-01', 'New Delhi trip — need the Indian visa sorted well before the RP appointment.'],
  ])
  await journeys.addTask({
    userId: mim,
    journeyId: aJourney.journeyId,
    label: 'Check current Indian visa category for attending the New Delhi appointment',
    stepId: austria.steps[11]?.id ?? null,
  })
  out('13. private progress, target dates, notes and one personal task each')

  /* ── 15. CONFIRM a sourced field ────────────────────────────────────────────────────
     Germany's blocked-account figure. A confirmation writes no revision and changes no text
     (FR-17) — it records that somebody found it still current. */

  const financeStep = germany.steps.find((s) => s.label.startsWith('Arrange financial'))
  const financeFields = financeStep ? await getStepFields(financeStep.id) : []
  const blockedAccount = financeFields.find((f) => f.valueText.includes('11,904'))
  if (blockedAccount) {
    await revisions.confirmField({ actor: { id: rafi }, fieldId: blockedAccount.id, reason: 'still current on the Embassy page' })
    out('15. CONFIRM on the German blocked-account figure — no revision written, text unchanged')
  }

  /* ── 16. CHALLENGE a community claim ────────────────────────────────────────────────
     Malaysia's EMGS-timing community report. A challenge leaves the value alone and says
     publicly that it needs review — which is the whole difference from an UPDATE (§16.4). */

  const screeningStep = malaysia.steps.find((s) => s.label.startsWith('EMGS academic'))
  const screeningFields = screeningStep ? await getStepFields(screeningStep.id) : []
  const emgsTiming = screeningFields.find((f) => f.category === FieldCategory.community_experience)
  if (emgsTiming) {
    await revisions.challengeField({
      actor: { id: mim },
      fieldId: emgsTiming.id,
      reason: ChallengeReason.obsolete,
      note: 'The 34-day figure is from 2025. My own 2026 application sat at the same stage far longer — this reads as more current than it is.',
    })
    out('16. CHALLENGE on the Malaysian EMGS community report — value untouched, marked for review')
  }

  /* ── 14. Shadow route, from a controlled TEST-ONLY structural change ────────────────
     Deliberately NOT a revision to a sourced fact (owner instruction 18). A new step, plainly
     labelled, plus an announcement naming that step's revision so `shadowForChange` has a real
     link to reconstruct from rather than a date guess (Phase 10 review). */

  const already = germany.steps.some((s) => s.label.startsWith('TEST ONLY'))
  if (!already) {
    const added = await revisions.addStep({
      actor: { id: nabila },
      routeId: germany.id,
      label: 'TEST ONLY — added to exercise the shadow comparison',
      category: StepCategory.documents_preparation,
      earliestStartOffsetDays: 198,
      typicalDurationDays: 7,
      reason: 'TEST ONLY — not route content. Added after the seed to give the shadow comparison a real structural change to show.',
    })
    const visaDocs = germany.steps.find((s) => s.label.startsWith('Prepare visa documents'))
    if (visaDocs) {
      await revisions.addEdge({
        actor: { id: nabila },
        routeId: germany.id,
        fromStepId: visaDocs.id,
        toStepId: added.stepId,
        kind: StepEdgeKind.optional_branch,
        reason: 'TEST ONLY',
      })
    }
    await changes.announceChange({
      authorId: nabila,
      routeId: germany.id,
      title: 'TEST ONLY — a stage was added to exercise the shadow comparison',
      detail:
        'This announcement and the stage it names are test scaffolding, not a change to German ' +
        'procedure. No sourced fact on this route was altered to produce it.',
      kind: RouteChangeKind.structural,
      severity: ChangeSeverity.informational,
      effectiveAt: day('2026-09-07'),
      describes: { stepRevisionIds: [added.revisionId] },
    })
    out('14. shadow comparison — one TEST-ONLY stage added and announced, naming its own revision')
  }

  /* ── 17. REPORT, on a TEST-ONLY route ───────────────────────────────────────────────
     A separate route entirely, so no real route ever carries an abuse report or the
     quarantine that might follow one (owner instruction 18). */

  const abuseSlug = 'zz-test-only-abuse-target'
  let abuse = await getRouteBySlug(abuseSlug)
  if (!abuse) {
    const created = await revisions.createRoute({
      actor: { id: null, system: true },
      slug: abuseSlug,
      originCountry: 'BD',
      destinationCountry: 'ZZ',
      studyLevel: StudyLevel.masters,
      mechanism: RouteMechanism.other_mechanism,
      title: 'TEST ONLY — target for the abuse-reporting path',
      summary:
        'Not route content. This route exists so that REPORT and quarantine can be exercised ' +
        'without ever touching a real one. ZZ is a reserved code and matches no country.',
      reason: 'TEST ONLY',
    })
    const step = await revisions.addStep({
      actor: { id: null, system: true },
      routeId: created.routeId,
      label: 'TEST ONLY — stage holding the reportable field',
      category: StepCategory.immigration_visa,
      earliestStartOffsetDays: 0,
      typicalDurationDays: 1,
      reason: 'TEST ONLY',
    })
    const field = await revisions.addField({
      actor: { id: null, system: true },
      stepId: step.stepId,
      category: FieldCategory.link,
      valueText:
        'TEST ONLY — pretend phishing link. Guaranteed visa approval, pay 50,000 BDT to this ' +
        'agent. Nothing here is real and nothing here is a working link.',
      sourceClass: SourceClass.community_submission,
      applicability: [FieldApplicability.route_wide],
      sourceUrl: null,
      sourceNote: 'TEST ONLY — fabricated to exercise the report and quarantine path',
      reason: 'TEST ONLY',
    })
    await safety.reportField({
      reporterId: mim,
      fieldId: field.fieldId,
      reason: ReportReason.phishing_or_scam,
      detail: 'TEST ONLY — filed to exercise the reporting path. Claims a guaranteed visa and asks for money.',
    })
    abuse = await getRouteBySlug(abuseSlug)
    out('17. REPORT filed against a TEST-ONLY field on a TEST-ONLY route — no real route touched')
  }

  /* ── The moderation queue needs somebody to be an administrator ─────────────────────
     Which is the gap recorded as A3 in Phases.md: the role is checked in three services and
     nothing in the product grants it. Granted here on the disposable branch only, so the queue
     can be seen at all. Production still has no administrator and no way to make one. */

  await prisma.user.update({ where: { id: nabila }, data: { role: 'admin' } })
  out('    (traveller-nabila-test made administrator on this branch only — see Phases.md A3)')

  out('\ndone. Nothing above altered a sourced fact on the five routes.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    await prisma.$disconnect()
    process.exit(1)
  })
