import { PrismaClient } from '@prisma/client'

import {
  FieldApplicability,
  FieldCategory,
  SourceClass,
  StepCategory,
  StepEdgeKind,
  StudyLevel,
  RouteMechanism,
} from '../../src/domain/enums'

/**
 * Development fixture — Bangladesh → Germany → Master's → direct application (RWTH).
 *
 * **This is a development fixture, not production seed data.** It exists to exercise the graph,
 * the renderer and the revision engine with something that resembles a real journey rather than
 * A → B → C. It refuses to run against any database that has not declared itself disposable.
 *
 * Every value below is either:
 *   - **verified** against an official source on 2026-09-02 and carried here with that source, or
 *   - **explicitly marked UNVERIFIED** in its own text.
 *
 * Nothing was invented to fill a gap. Where research has not happened, the field says so rather
 * than guessing — which is the difference between a fixture built from research and a demo built
 * to look complete.
 *
 * Source rules followed (content/README.md): official sources only, no blogs, no agencies, no
 * mockup values. Community confirmations are zero and there is no code here that could set one.
 *
 * Applicability is a typed set now (FR-81, Amendment 001), not prose. Compare against the
 * previous version of this file: every field began with a shouted scope prefix — "RWTH M.Sc.
 * Data Science ONLY:", "ALL study visas from Bangladesh:" — that a contributor could simply
 * forget, with nothing to catch it. Those prefixes are gone; the scope is data.
 *
 * The application-deadline field carries three dimensions at once (institution, programme,
 * intake), which is precisely why a single-value column would not have been enough.
 *
 * Run: npm run fixture:germany
 */

/**
 * Versioned, not mutated.
 *
 * The database is append-only and refuses deletion, so a fixture cannot be edited in place —
 * an earlier load stays forever. Bump this when the fixture's content changes, exactly as a
 * migration is added rather than rewritten.
 */
const SLUG = 'bd-de-masters-rwth-direct-v3'
const actor = { id: null, system: true }
const CHECKED = 'checked 2026-09-02'

/**
 * Retries a cold connection.
 *
 * Neon's compute scales to zero, so the first query after an idle period can fail outright
 * rather than merely being slow. A fixture that gives up on a suspended database looks like a
 * broken fixture.
 */
async function withRetry<T>(work: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        process.stdout.write(`  database not awake yet (attempt ${attempt}/${attempts}), retrying…
`)
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }
  }
  throw lastError
}

/** Refuses to touch anything that is not an explicitly disposable database. */
async function assertDisposable(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const probe = new PrismaClient({ datasources: { db: { url } } })
  try {
    const marker = await withRetry(() => probe.platformMeta.findUnique({ where: { key: 'environment' } }))
    if (marker?.value !== 'test') {
      throw new Error(
        'Refusing to load this fixture: the target database is not marked as a test database. ' +
          'Development fixtures must never reach production — production seed content is ' +
          'researched, human-reviewed and loaded deliberately (content/README.md).',
      )
    }
  } finally {
    await probe.$disconnect()
  }
}

async function main(): Promise<void> {
  // Admin scripts use the DIRECT endpoint, not the pooler — the same split CLAUDE.md §4 sets
  // for migrations. The application client reads DATABASE_URL, so it is pointed at the direct
  // URL here before the service modules are imported. Discovered the hard way: Neon's pooled
  // endpoints were unreachable while the direct ones were fine, and a fixture that only knows
  // about the pool is stuck for reasons that have nothing to do with it.
  if (process.env.DATABASE_URL_UNPOOLED) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED
  }

  await assertDisposable()

  const { addEdge, addField, addStep, createRoute, reviseField } = await import(
    '../../src/server/revisions/service'
  )
  const { getRouteBySlug } = await import('../../src/server/routes/read')

  // Wake the compute through the client the service will actually use. assertDisposable
  // opened its own connection; this one is separate and can find the branch asleep again.
  await withRetry(() => getRouteBySlug('__warmup__'))

  if (await getRouteBySlug(SLUG)) {
    process.stdout.write(`fixture already present: ${SLUG}\n`)
    return
  }

  const { routeId } = await createRoute({
    actor,
    slug: SLUG,
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    intake: 'Winter Semester 2027/28',
    title: 'Bangladesh to Germany — Master’s by direct university application',
    summary:
      'DEVELOPMENT FIXTURE. Country-level facts are verified against the German Embassy Dhaka, ' +
      'the Federal Foreign Office and uni-assist; programme-level facts against RWTH Aachen. ' +
      'Not human-reviewed and not published content.',
    reason: 'development fixture built from research passes 1 and 2',
  })

  const step = async (
    label: string,
    category: (typeof StepCategory)[keyof typeof StepCategory],
    offset: number | null,
    duration: number | null,
  ): Promise<string> =>
    (
      await addStep({
        actor,
        routeId,
        label,
        category,
        earliestStartOffsetDays: offset,
        typicalDurationDays: duration,
        reason: 'fixture',
      })
    ).stepId

  // ── The road ───────────────────────────────────────────────────────────────
  // Shaped by what research showed, not by the suggested ordering. In particular the
  // application deadline (1 March, non-EU/EEA) sits far earlier than a naive reading of
  // "apply in July" would place it, and the visa queue dominates everything after admission.
  const explore = await step('Shortlist programmes', StepCategory.admission_university, 0, 45)
  const eligibility = await step('Check academic eligibility', StepCategory.documents_preparation, 30, 30)
  const documents = await step('Prepare documents', StepCategory.documents_preparation, 60, 60)
  const language = await step('Meet the language requirement', StepCategory.language_testing, 60, 90)
  const gre = await step('Sit the GRE', StepCategory.admission_university, 60, 60)
  const apply = await step('Apply through the university portal', StepCategory.admission_university, 150, 14)
  const admission = await step('Admission decision', StepCategory.admission_university, 180, 60)
  const finance = await step('Arrange proof of financial means', StepCategory.funding_scholarship, 240, 30)
  const visaPrep = await step('Prepare the student visa application', StepCategory.immigration_visa, 240, 30)
  const visaSubmit = await step('Register, book VFS and submit', StepCategory.immigration_visa, 270, 14)
  // The queue, modelled as its own step because it dominates the timeline and a student
  // planning around "4 weeks processing" would miss the intake entirely.
  const visaWait = await step('Wait for a visa decision', StepCategory.immigration_visa, 285, 820)
  const enrol = await step('Enrol and arrange insurance', StepCategory.travel_departure, 1105, 30)
  const fly = await step('Fly to Germany', StepCategory.travel_departure, 1135, 1)

  const link = async (
    from: string,
    to: string,
    kind: (typeof StepEdgeKind)[keyof typeof StepEdgeKind],
  ): Promise<void> => {
    await addEdge({ actor, routeId, fromStepId: from, toStepId: to, kind, reason: 'fixture' })
  }

  await link(explore, eligibility, StepEdgeKind.sequential)
  // Parallel preparation: documents, language and GRE all run at once after eligibility.
  await link(eligibility, documents, StepEdgeKind.sequential)
  await link(eligibility, language, StepEdgeKind.sequential)
  await link(eligibility, gre, StepEdgeKind.sequential)
  await link(documents, apply, StepEdgeKind.rejoin)
  await link(language, apply, StepEdgeKind.rejoin)
  await link(gre, apply, StepEdgeKind.rejoin)
  await link(apply, admission, StepEdgeKind.sequential)
  // Parallel again after admission: money and visa paperwork proceed together.
  await link(admission, finance, StepEdgeKind.sequential)
  await link(admission, visaPrep, StepEdgeKind.sequential)
  await link(finance, visaSubmit, StepEdgeKind.rejoin)
  await link(visaPrep, visaSubmit, StepEdgeKind.rejoin)
  await link(visaSubmit, visaWait, StepEdgeKind.sequential)
  await link(visaWait, enrol, StepEdgeKind.sequential)
  await link(enrol, fly, StepEdgeKind.sequential)

  const field = async (
    stepId: string,
    category: (typeof FieldCategory)[keyof typeof FieldCategory],
    valueText: string,
    sourceClass: (typeof SourceClass)[keyof typeof SourceClass],
    applicability: readonly (typeof FieldApplicability)[keyof typeof FieldApplicability][],
    sourceUrl: string | null,
    sourceNote: string,
  ): Promise<void> => {
    await addField({
      actor,
      stepId,
      category,
      valueText,
      sourceClass,
      applicability,
      sourceUrl,
      sourceNote: `${sourceNote} — ${CHECKED}`,
      reason: 'fixture',
    })
  }

  // ── Programme-specific facts (RWTH M.Sc. Data Science) ─────────────────────
  await field(
    eligibility,
    FieldCategory.requirement,
    'A first degree in Computer Science, Mathematics, Physics or a closely related area.',
    SourceClass.official,
    [FieldApplicability.institution, FieldApplicability.programme],
    'https://sc.informatik.rwth-aachen.de/en/studium/master/master-data-science/application-for-admission/',
    'RWTH Aachen, Studiencenter Informatik. Programme-specific — other programmes differ',
  )
  await field(
    eligibility,
    FieldCategory.requirement,
    'Computer-science profile: Programming 8 CP, Data Structures and Algorithms 7, Databases 6, Software Engineering 6, Computer Architecture 6, Operating Systems 6, Networks/Security 6, Theory of Computation 12, Logic 6, Discrete Structures 6, Calculus 8, Linear Algebra 6, Stochastics 6. Mathematics and physics profiles differ.',
    SourceClass.official,
    [FieldApplicability.institution, FieldApplicability.programme],
    'https://sc.informatik.rwth-aachen.de/en/studium/master/master-data-science/application-for-admission/',
    'RWTH Aachen. Programme-specific credit prerequisites; mathematics and physics profiles differ',
  )
  await field(
    gre,
    FieldCategory.requirement,
    'GRE General Test required — quantitative above the 75th percentile, verbal above the 15th, analytical writing 3.5 or higher. Institution code 8504. EU/EEA citizens and holders of German secondary education are exempt; a Bangladeshi applicant is not.',
    SourceClass.official,
    [FieldApplicability.institution, FieldApplicability.programme],
    'https://sc.informatik.rwth-aachen.de/en/studium/master/master-data-science/application-for-admission/',
    'RWTH Aachen. Programme-specific. NOT a German or Germany-wide requirement',
  )
  await field(
    language,
    FieldCategory.requirement,
    'An English certificate proving fluency, submitted at ENROLMENT rather than at application. Medium of Instruction (MOI) certificates are in general NOT accepted — relevant because many Bangladeshi degrees are English-medium and evidenced that way. UNVERIFIED: the numeric IELTS/TOEFL threshold is on a separate RWTH language page that has not been read, so no score is stated here.',
    SourceClass.official,
    [FieldApplicability.institution, FieldApplicability.programme],
    'https://sc.informatik.rwth-aachen.de/en/studium/master/master-data-science/application-for-admission/',
    'RWTH Aachen. Programme-specific, and narrower than the visa language rule',
  )
  await field(
    apply,
    FieldCategory.deadline,
    'Open-admission Master’s, non-EU/EEA applicants, winter semester: 1 MARCH. EU/EEA applicants have until 15 July, and restricted-admission (NC) programmes have 15 July. A Bangladeshi applicant therefore applies in March, not July. NEEDS-HUMAN: verified for a current cycle; not verified for Winter Semester 2027/28 specifically.',
    SourceClass.official,
    // Three dimensions at once. This is the case a single-value column could not express.
    [FieldApplicability.institution, FieldApplicability.programme, FieldApplicability.intake],
    'https://www.rwth-aachen.de/cms/root/studium/vor-dem-studium/bewerbung-um-einen-studienplatz/master-bewerbung/~dqml/bewerbung-master-internationale/?lidx=1',
    'RWTH Aachen. Institution × admission type × applicant status',
  )
  await field(
    apply,
    FieldCategory.link,
    'Applications are submitted through RWTH’s own portal at online.rwth-aachen.de. uni-assist is NOT used by RWTH. No physical documents are posted.',
    SourceClass.official,
    [FieldApplicability.institution, FieldApplicability.application_channel],
    'https://www.rwth-aachen.de/cms/root/studium/vor-dem-studium/bewerbung-um-einen-studienplatz/master-bewerbung/~dqml/bewerbung-master-internationale/?lidx=1',
    'RWTH Aachen. Institution-specific — most other German universities use uni-assist',
  )

  // ── Bangladesh-specific facts (German Embassy Dhaka) ───────────────────────
  // ── A real revision, for testing history and the shadow route ──────────────
  // The blocked-account amount is a fact whose official value verifiably changed. Recorded as
  // two revisions so the prior value stays readable, with a source and an effective date on
  // each — which is the whole point of the revision ledger (FR-20, BR-03).
  //
  //   before 01.10.2022  €861/month   = €10,332
  //   from   01.10.2022  €934/month   = €11,208   <- VERSION A below
  //   from   ~01.09.2024 €992/month   = €11,904   <- VERSION B, current
  const blockedAccount = await addField({
    actor,
    stepId: finance,
    category: FieldCategory.cost,
    valueText:
      'Blocked account (Sperrkonto) with a minimum balance of €11,208 and a monthly disposal limit of €934.',
    valueAmount: 11208,
    valueCurrency: 'EUR',
    sourceClass: SourceClass.official,
    applicability: [FieldApplicability.origin_specific],
    sourceUrl: 'https://www.auswaertiges-amt.de/en/sperrkonto-388600',
    sourceNote: `German mission sources: increased to €934/month from 01.10.2022, up from €861/month — ${CHECKED}`,
    effectiveFrom: new Date('2022-10-01T00:00:00.000Z'),
    reason: 'fixture — version A, the amount in force from October 2022',
  })

  await reviseField({
    actor,
    fieldId: blockedAccount.fieldId,
    valueText:
      'Blocked account (Sperrkonto) with a minimum balance of €11,904 and a monthly disposal limit of €992. This applies whichever university you attend.',
    valueAmount: 11904,
    valueCurrency: 'EUR',
    sourceClass: SourceClass.official,
    applicability: [FieldApplicability.origin_specific],
    sourceUrl: 'https://dhaka.diplo.de/bd-en/service/2685884-2685884',
    sourceNote: `German Embassy Dhaka, page dated 04.06.2026 — ${CHECKED}`,
    effectiveFrom: new Date('2024-09-01T00:00:00.000Z'),
    reason:
      'Federal requirement increased to €992/month (€11,904/year); confirmed current on the Embassy Dhaka page',
  })
  await field(
    finance,
    FieldCategory.procedure,
    'Financing may also be shown through parents’ income and circumstances, a declaration of commitment under §§66–68 AufenthG, or an annually renewable bank guarantee at a German bank.',
    SourceClass.official,
    [FieldApplicability.route_wide],
    'https://www.auswaertiges-amt.de/en/visa-service/visabestimmungen-node/sperrkonto-seite',
    'Federal Foreign Office. Germany-wide alternatives to a blocked account',
  )
  await field(
    visaSubmit,
    FieldCategory.procedure,
    'Register for an appointment through the Consular Services Portal first. Master’s applicants submit documents through VFS; Bachelor’s applicants submit directly to the Embassy.',
    SourceClass.official,
    [FieldApplicability.origin_specific],
    'https://dhaka.diplo.de/bd-en/service/2685884-2685884',
    'German Embassy Dhaka. Bangladesh-specific routing, differs by degree level',
  )
  await field(
    visaWait,
    FieldCategory.duration,
    'OFFICIAL PROCESSING GUIDANCE: “The minimum time to process your visa is approx. 4 weeks.” Processing starts when the application reaches the mission, not VFS, and does not start until the application is complete.',
    SourceClass.official,
    [FieldApplicability.origin_specific],
    'https://dhaka.diplo.de/bd-en/service/2690988-2690988',
    'German Embassy Dhaka, page dated 15.04.2025. This is processing time, NOT total waiting time',
  )
  await field(
    visaWait,
    FieldCategory.warning,
    'ACTUAL WAITING TIME: the Embassy states current waiting times “exceed 27 months”. This is the queue BEFORE processing begins, and it is the single most consequential fact on this route — planning around the 4-week processing figure would miss the intake by roughly two years. NEEDS-HUMAN: volatile, re-check before relying on it.',
    SourceClass.official,
    [FieldApplicability.origin_specific],
    'https://dhaka.diplo.de/bd-en/service/2685884-2685884',
    'German Embassy Dhaka, page dated 04.06.2026. Bangladesh-specific',
  )
  await field(
    visaPrep,
    FieldCategory.requirement,
    'English-taught programmes: TOEFL or IELTS, unless the Bachelor’s was completed in Australia, the UK or the US. This is the VISA requirement and is separate from — and sometimes weaker than — the programme’s own admission requirement.',
    SourceClass.official,
    [FieldApplicability.origin_specific],
    'https://dhaka.diplo.de/bd-en/service/2685884-2685884',
    'German Embassy Dhaka. Bangladesh-specific, set by the Embassy not the university',
  )
  await field(
    visaPrep,
    FieldCategory.warning,
    'APS does NOT apply to Bangladeshi applicants. APS offices exist for China, Vietnam and India only, and APS appears nowhere in the German Embassy Dhaka study-visa requirements. If a guide or agency tells you otherwise, check the Embassy page.',
    SourceClass.official,
    [FieldApplicability.origin_specific],
    'https://dhaka.diplo.de/bd-en/service/2685884-2685884',
    'German Embassy Dhaka requirements list; APS scope per uni-assist and APS India',
  )

  // ── Channel-specific facts (uni-assist) ────────────────────────────────────
  // Kept on the documents step and clearly marked, because this route uses the RWTH direct
  // channel — but a Bangladeshi applicant will meet uni-assist at most other universities.
  await field(
    documents,
    FieldCategory.document,
    'Where a university uses uni-assist (RWTH does not): uni-assist requires from Bangladeshi applicants a school leaving certificate with an overview of subjects and grades (X+II); the university diploma with an overview of subjects and grades; and your university’s grading system including the minimum passing grade for award of degree.',
    SourceClass.official,
    [FieldApplicability.application_channel, FieldApplicability.origin_specific],
    'https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/bd/',
    'uni-assist country information for Bangladesh. Channel-specific, not applicable on this route',
  )
  await field(
    documents,
    FieldCategory.document,
    'Where a university uses uni-assist: the minimum CGPA for the award of your degree must be evidenced. If it is not printed on your transcript, submit an official document from your university, or link to a university page stating it.',
    SourceClass.official,
    [FieldApplicability.application_channel, FieldApplicability.origin_specific],
    'https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/bd/',
    'uni-assist. Channel-specific',
  )
  await field(
    documents,
    FieldCategory.document,
    'Degree diploma and transcript; module descriptions matching the admission requirements, with a cover sheet; GRE results; CV in list form; certified translations if documents are not in German or English. Uploaded to the portal — nothing is posted.',
    SourceClass.official,
    [FieldApplicability.institution],
    'https://www.rwth-aachen.de/cms/root/studium/vor-dem-studium/bewerbung-um-einen-studienplatz/master-bewerbung/~dqml/bewerbung-master-internationale/?lidx=1',
    'RWTH Aachen. Institution-specific document list',
  )

  await field(
    explore,
    FieldCategory.warning,
    'UNVERIFIED: programme shortlisting sources, degree-recognition handling (anabin/ZAB), application fees, admission-decision handling and post-arrival formalities have not been researched. This route is a development fixture and is deliberately incomplete rather than filled in with plausible guesses.',
    SourceClass.community_submission,
    [],
    null,
    'Not researched. Recorded as an explicit gap',
  )

  const route = await getRouteBySlug(SLUG)
  process.stdout.write(
    `fixture loaded: ${SLUG}\n  steps: ${route?.steps.length ?? 0}\n` +
      `  fields: ${route?.steps.reduce((n, s) => n + s.fieldCount, 0) ?? 0}\n` +
      `  fly window: ${route?.flyWindow ? `${route.flyWindow.estimatedDays} days modelled` : 'none'}\n`,
  )
}

// Not top-level await: tsx transpiles this file to CJS, where it is unsupported.
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
