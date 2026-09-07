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
import type * as RevisionService from '../../src/server/revisions/service'

/**
 * Five owner-supplied Bangladesh-origin Master's routes — loaded 2026-09-07.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What this is.** Realistic route content supplied by the owner, drawn from official
 * government and institutional sources plus clearly-labelled community experience. It exists to
 * exercise the *product* — alternatives, optional steps, parallel work, Bangladesh-specific
 * procedure, differing visa architectures, uncertainty, disruption, provenance and post-arrival
 * stages — with something a real applicant would recognise.
 *
 * **It is not published content, and it never reaches production.** The load refuses any
 * database that has not declared itself disposable, exactly as the Germany fixture does. The
 * owner researches and publishes; this is a rehearsal (CLAUDE.md §10.2, content/README.md).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Rules followed, and they are the content rules rather than code rules:**
 *
 *   - **Official and community never blur.** A government fact is `official`; an institution's
 *     own rule is `institutional_public`; a student's report is `community_submission` in a
 *     `community_experience` field, phrased as "A student reported…" and never as "This takes…"
 *     (FR-54, BR-07, invariant 11).
 *   - **Nothing is invented to fill a gap.** Where the owner's material says a figure is
 *     programme-specific or not stated, the field says so. `UNVERIFIED` appears in the text
 *     rather than a plausible number (content/README.md rule 3).
 *   - **Uncertainty is recorded, not smoothed.** Germany's two durations — a 27-month queue and
 *     a 4-week processing minimum — are two separate steps, because averaging them would
 *     destroy the only thing a student planning an intake needs to know.
 *   - **Confirmations start at zero** and there is no code here that could set one.
 *   - **No percentage, score or verification claim** anywhere (BR-20, invariant 12).
 *   - Every field's `sourceNote` carries its research status and the check date, since the
 *     schema has no column for research status — see the modelling notes at the foot of this
 *     file.
 *
 * Run: npm run fixture:launch
 */

const CHECKED = 'checked 2026-09-07'
const INTAKE = '2027 main intake — programme-specific'
const actor = { id: null, system: true }

/** Retries a cold Neon compute, which scales to zero and fails the first query outright. */
async function withRetry<T>(work: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        process.stdout.write(`  database not awake yet (${attempt}/${attempts}), retrying…\n`)
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }
  }
  throw lastError
}

/** Refuses anything that has not declared itself disposable. */
async function assertDisposable(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const probe = new PrismaClient({ datasources: { db: { url } } })
  try {
    const marker = await withRetry(() =>
      probe.platformMeta.findUnique({ where: { key: 'environment' } }),
    )
    if (marker?.value !== 'test') {
      throw new Error(
        'Refusing to load: the target database is not marked as a test database. Route content ' +
          'reaches production only by a deliberate, human-reviewed act (content/README.md).',
      )
    }
  } finally {
    await probe.$disconnect()
  }
}

type Service = typeof RevisionService
type Cat = (typeof StepCategory)[keyof typeof StepCategory]
type Kind = (typeof StepEdgeKind)[keyof typeof StepEdgeKind]
type FCat = (typeof FieldCategory)[keyof typeof FieldCategory]
type Src = (typeof SourceClass)[keyof typeof SourceClass]
type App = (typeof FieldApplicability)[keyof typeof FieldApplicability]

/** A small builder, so each route below reads as its graph rather than as plumbing. */
function builder(service: Service, routeId: string) {
  const step = async (label: string, category: Cat, offset: number | null, duration: number | null) =>
    (
      await service.addStep({
        actor,
        routeId,
        label,
        category,
        earliestStartOffsetDays: offset,
        typicalDurationDays: duration,
        reason: 'owner-supplied route content, 2026-09-07',
      })
    ).stepId

  const link = async (from: string, to: string, kind: Kind = StepEdgeKind.sequential) => {
    await service.addEdge({ actor, routeId, fromStepId: from, toStepId: to, kind, reason: 'route shape' })
  }

  const field = async (
    stepId: string,
    category: FCat,
    valueText: string,
    sourceClass: Src,
    applicability: readonly App[],
    sourceNote: string,
    sourceUrl: string | null = null,
  ) => {
    await service.addField({
      actor,
      stepId,
      category,
      valueText,
      sourceClass,
      applicability,
      sourceUrl,
      sourceNote: `${sourceNote} — ${CHECKED}`,
      reason: 'owner-supplied route content',
    })
  }

  /** A community report. Always this shape: an experience, never a rule. */
  const community = async (stepId: string, valueText: string, sourceNote: string, applicability: readonly App[] = [FieldApplicability.route_wide]) =>
    field(stepId, FieldCategory.community_experience, valueText, SourceClass.community_submission, applicability, `COMMUNITY — ${sourceNote}`)

  return { step, link, field, community }
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   1 — Malaysia
   ══════════════════════════════════════════════════════════════════════════════════════════ */

async function malaysia(service: Service): Promise<void> {
  const { routeId } = await service.createRoute({
    actor,
    slug: 'bd-my-masters-2027',
    originCountry: 'BD',
    destinationCountry: 'MY',
    studyLevel: StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    intake: INTAKE,
    title: 'Study a Master’s in Malaysia from Bangladesh',
    summary:
      'From choosing a Malaysian Master’s programme through university admission, EMGS and ' +
      'Student Pass processing, eVAL, the Single Entry Visa, travel, post-arrival medical ' +
      'screening and Student Pass endorsement.',
    reason: 'owner-supplied route content, 2026-09-07',
  })
  const b = builder(service, routeId)

  const explore = await b.step('Explore Malaysian Master’s programmes', StepCategory.admission_university, 0, 30)
  const eligibility = await b.step('Check programme and university eligibility', StepCategory.admission_university, 30, 21)
  const documents = await b.step('Prepare academic and application documents', StepCategory.documents_preparation, 51, 45)
  const english = await b.step('Meet the English-language requirement', StepCategory.language_testing, 51, 60)
  const apply = await b.step('Apply to the university', StepCategory.admission_university, 111, 21)
  const offer = await b.step('Receive and accept the offer', StepCategory.admission_university, 132, 30)
  const emgsInstitution = await b.step('Institution submits the Student Pass application (EMGS/STARS)', StepCategory.immigration_visa, 162, 21)
  const emgsSelf = await b.step('Submit to EMGS yourself, where the institution permits it', StepCategory.immigration_visa, 162, 21)
  const screening = await b.step('EMGS academic and document screening', StepCategory.immigration_visa, 183, 34)
  const eval_ = await b.step('Immigration consideration and eVAL approval', StepCategory.immigration_visa, 217, 30)
  const visa = await b.step('Obtain the Single Entry Visa', StepCategory.immigration_visa, 247, 14)
  const travelPrep = await b.step('Arrange travel and accommodation', StepCategory.travel_departure, 261, 21)
  const insurance = await b.step('Confirm the required Malaysian medical insurance', StepCategory.travel_departure, 261, 14)
  const travel = await b.step('Travel to Malaysia', StepCategory.travel_departure, 282, 1)
  const medical = await b.step('Post-arrival medical screening', StepCategory.travel_departure, 283, 7)
  const endorsement = await b.step('Student Pass endorsement', StepCategory.immigration_visa, 290, 21)
  const register = await b.step('Complete university registration and begin studies', StepCategory.admission_university, 311, 7)

  await b.link(explore, eligibility)
  await b.link(eligibility, documents)
  await b.link(eligibility, english)
  await b.link(documents, apply, StepEdgeKind.rejoin)
  await b.link(english, apply, StepEdgeKind.rejoin)
  await b.link(apply, offer)
  // The structural point of this route: two genuinely different application channels.
  await b.link(offer, emgsInstitution, StepEdgeKind.alternative)
  await b.link(offer, emgsSelf, StepEdgeKind.alternative)
  await b.link(emgsInstitution, screening, StepEdgeKind.rejoin)
  await b.link(emgsSelf, screening, StepEdgeKind.rejoin)
  await b.link(screening, eval_)
  await b.link(eval_, visa)
  await b.link(visa, travelPrep)
  await b.link(visa, insurance)
  await b.link(travelPrep, travel, StepEdgeKind.rejoin)
  await b.link(insurance, travel, StepEdgeKind.rejoin)
  await b.link(travel, medical)
  await b.link(medical, endorsement)
  await b.link(endorsement, register)

  await b.field(explore, FieldCategory.procedure,
    'Malaysian Master’s programmes are offered at both public and private higher-education institutions. Confirm the programme and the institution’s international-student eligibility before applying.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Immigration Department of Malaysia, Student Pass')
  await b.field(explore, FieldCategory.warning,
    'Do not assume every institution uses an identical admission or visa workflow. They differ, and the difference decides who submits your Student Pass application.',
    SourceClass.official, [FieldApplicability.institution], 'SOURCED — Immigration Department of Malaysia / EMGS')

  await b.field(eligibility, FieldCategory.requirement,
    'Admission criteria are set by the university and the programme: required previous degree and discipline, CGPA or grade, programme language, intake and application deadline.',
    SourceClass.institutional_public, [FieldApplicability.institution, FieldApplicability.programme], 'SOURCED — institution-specific')
  await b.field(eligibility, FieldCategory.requirement,
    'For a private higher-education institution, the programme and institution must meet the Malaysian recognition and approval requirements relevant to international enrolment.',
    SourceClass.official, [FieldApplicability.institution], 'SOURCED — Education Malaysia Global Services')

  await b.field(documents, FieldCategory.document,
    'Typical Student Pass / EMGS documents: passport; a passport photograph meeting the EMGS specification; the academic documents your institution requests; offer and admission documentation; additional institution-specific records.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — EMGS, Required Documents')
  await b.field(documents, FieldCategory.warning,
    'There is no single universal academic-document checklist. University admission documents differ from EMGS documents and from each other.',
    SourceClass.official, [FieldApplicability.institution], 'SOURCED — EMGS')

  await b.field(english, FieldCategory.requirement,
    'English evidence depends on the university and the programme. IELTS is not the only accepted route — check which alternatives your chosen institution accepts. UNVERIFIED here: no single threshold applies across Malaysia.',
    SourceClass.institutional_public, [FieldApplicability.institution, FieldApplicability.programme], 'SOURCED for the rule; UNVERIFIED for any threshold — institution-specific')

  await b.field(apply, FieldCategory.procedure,
    'Apply using the selected university’s own official application procedure. The application channel is university-specific.',
    SourceClass.institutional_public, [FieldApplicability.institution], 'SOURCED — institution-specific')

  await b.field(offer, FieldCategory.requirement,
    'A study offer is required before the Student Pass process can progress. After accepting, follow the institution’s international-office and eVAL instructions carefully.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — EMGS / Immigration Department of Malaysia')

  await b.field(emgsInstitution, FieldCategory.procedure,
    'Most institutions submit and manage the Student Pass application on the student’s behalf through EMGS/STARS.',
    SourceClass.official, [FieldApplicability.institution, FieldApplicability.application_channel], 'SOURCED — EMGS')
  await b.field(emgsSelf, FieldCategory.procedure,
    'Some institutions explicitly permit the student to submit online themselves. Do not assume yours does.',
    SourceClass.official, [FieldApplicability.institution, FieldApplicability.application_channel], 'SOURCED — EMGS')
  await b.community(emgsSelf,
    'A Universiti Malaya Master’s applicant reported in September 2026 that applying directly to EMGS before following UM’s own MAYA/eVAL instructions raised a concern about a duplicate or incorrect workflow. Another international student advised following the university’s own instructions.',
    'r/malaysiauni, September 2026 — institution-specific experience, not a rule',
    [FieldApplicability.institution])

  await b.field(screening, FieldCategory.procedure,
    'EMGS performs an academic and document review. Incomplete or institution-pending documents may delay progress. Status can be tracked through EMGS.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — EMGS')
  await b.community(screening,
    'Students report widely differing stage durations. One 2025 international student reported about 34 days from initial EMGS processing to eVAL; other 2026 students reported being held at particular stages for days or weeks.',
    'r/malaysiauni, EMGS process reference 2025 and 2026 reports — experiences, not a processing guarantee')

  await b.field(eval_, FieldCategory.procedure,
    'Complete eligible applications proceed for Malaysian Immigration consideration. eVAL is the approval required before the visa branch.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Immigration Department of Malaysia')
  await b.field(eval_, FieldCategory.requirement,
    'The applicant should be outside Malaysia during a new Student Pass application, as required by current Malaysian Immigration guidance.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Immigration Department of Malaysia')

  await b.field(visa, FieldCategory.requirement,
    'Bangladesh is currently listed among the nationalities requiring a visa for Malaysia. After eVAL approval, applicants from visa-required countries obtain a Single Entry Visa through the official Malaysian eVISA process where applicable.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — Immigration Department of Malaysia, Visa Requirement by Country')

  await b.field(travelPrep, FieldCategory.document,
    'Carry your passport, offer letter, eVAL, Single Entry Visa and any institution-required arrival documents.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — EMGS / Immigration Department of Malaysia')
  await b.community(travelPrep,
    'International students frequently advise carrying printed copies of the eVAL, the offer and immigration documents, because these may be requested during arrival or university processing.',
    'r/malaysiauni — practical advice from students')

  await b.field(insurance, FieldCategory.requirement,
    'International students must hold compliant Malaysian medical insurance for the duration of study. Insurance is normally arranged through the institution or an approved Malaysian plan.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — EMGS, Insurance')

  await b.field(medical, FieldCategory.deadline,
    'New international students must complete the Malaysian post-arrival medical screening at an EMGS panel clinic within 7 working days of arrival.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — EMGS, Medical Screening')
  await b.field(medical, FieldCategory.warning,
    'Without the required medical process, Student Pass endorsement and support cannot proceed normally.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — EMGS')

  await b.field(endorsement, FieldCategory.procedure,
    'After successful post-arrival medical processing and the relevant EMGS support, the institution and Immigration complete the Student Pass endorsement.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Immigration Department of Malaysia')
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   2 — United Kingdom
   ══════════════════════════════════════════════════════════════════════════════════════════ */

async function unitedKingdom(service: Service): Promise<void> {
  const { routeId } = await service.createRoute({
    actor,
    slug: 'bd-gb-masters-2027',
    originCountry: 'BD',
    destinationCountry: 'GB',
    studyLevel: StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    intake: INTAKE,
    title: 'Study a Master’s in the UK from Bangladesh',
    summary:
      'Course selection at a licensed student sponsor, direct university admission, English ' +
      'assessment, CAS, financial evidence, the Bangladesh TB test, ATAS where a course needs ' +
      'it, the Student visa, biometrics and eVisa, and travel.',
    reason: 'owner-supplied route content, 2026-09-07',
  })
  const b = builder(service, routeId)

  const find = await b.step('Find Master’s programmes at licensed student sponsors', StepCategory.admission_university, 0, 30)
  const eligibility = await b.step('Check academic and course eligibility', StepCategory.admission_university, 30, 21)
  const academic = await b.step('Prepare the academic application', StepCategory.documents_preparation, 51, 30)
  const english = await b.step('Satisfy the English requirement', StepCategory.language_testing, 51, 60)
  const funding = await b.step('Plan tuition and funding', StepCategory.funding_scholarship, 51, 60)
  const apply = await b.step('Apply directly to the university', StepCategory.admission_university, 111, 14)
  const offer = await b.step('Receive a conditional or unconditional offer', StepCategory.admission_university, 125, 45)
  const conditions = await b.step('Satisfy conditions and the university’s CAS requirements', StepCategory.admission_university, 170, 30)
  const cas = await b.step('Obtain the CAS', StepCategory.admission_university, 200, 14)
  const finance = await b.step('Prepare financial evidence', StepCategory.funding_scholarship, 200, 28)
  const tb = await b.step('Complete the Bangladesh TB test', StepCategory.documents_preparation, 200, 14)
  const atas = await b.step('Obtain ATAS, if your course requires it', StepCategory.documents_preparation, 200, 30)
  const submit = await b.step('Submit the Student visa application and pay the IHS', StepCategory.immigration_visa, 230, 3)
  const biometrics = await b.step('Complete the identity or biometric step', StepCategory.immigration_visa, 233, 7)
  const decision = await b.step('Visa decision and eVisa', StepCategory.immigration_visa, 240, 21)
  const travel = await b.step('Travel to the UK', StepCategory.travel_departure, 261, 1)
  const enrol = await b.step('University enrolment and start of studies', StepCategory.admission_university, 262, 7)

  await b.link(find, eligibility)
  await b.link(eligibility, academic)
  await b.link(eligibility, english)
  await b.link(eligibility, funding)
  await b.link(academic, apply, StepEdgeKind.rejoin)
  await b.link(english, apply, StepEdgeKind.rejoin)
  await b.link(funding, apply, StepEdgeKind.rejoin)
  await b.link(apply, offer)
  await b.link(offer, conditions)
  await b.link(conditions, cas)
  await b.link(conditions, finance)
  await b.link(conditions, tb)
  // ATAS is genuinely optional — it applies to some postgraduate courses and not others.
  await b.link(conditions, atas, StepEdgeKind.optional_branch)
  await b.link(cas, submit, StepEdgeKind.rejoin)
  await b.link(finance, submit, StepEdgeKind.rejoin)
  await b.link(tb, submit, StepEdgeKind.rejoin)
  await b.link(atas, submit, StepEdgeKind.rejoin)
  await b.link(submit, biometrics)
  await b.link(biometrics, decision)
  await b.link(decision, travel)
  await b.link(travel, enrol)

  await b.field(find, FieldCategory.requirement,
    'Study on the Student route must be with an eligible licensed student sponsor. Master’s applications are normally made through the university’s own application process, and entry requirements vary by programme.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — GOV.UK, Student visa', 'https://www.gov.uk/student-visa')

  await b.field(eligibility, FieldCategory.requirement,
    'Check the relevant Bachelor’s degree, the university or programme grade requirement, the English requirement, course duration, tuition and any programme-specific requirements.',
    SourceClass.institutional_public, [FieldApplicability.institution, FieldApplicability.programme], 'SOURCED — institution-specific')

  await b.field(english, FieldCategory.requirement,
    'For degree-level study, Student-route English is normally equivalent to CEFR B2. Evidence paths include an approved English-language test, qualifying UK education, a qualifying overseas English-taught degree with the required assessment, or assessment by an eligible higher-education provider at degree level.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — GOV.UK, Knowledge of English', 'https://www.gov.uk/student-visa/knowledge-of-english')
  await b.field(english, FieldCategory.warning,
    'Not every Bangladeshi Master’s applicant must use IELTS. More than one route exists to prove English — check which your sponsor accepts before booking a test.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — GOV.UK, Knowledge of English')

  await b.field(offer, FieldCategory.procedure,
    'An offer can be conditional. You must normally satisfy the university’s conditions before a CAS is issued, and the individual university sets its own deposit and CAS-preparation rules.',
    SourceClass.institutional_public, [FieldApplicability.institution], 'SOURCED — institution-specific')

  await b.field(cas, FieldCategory.requirement,
    'The Student visa requires a Confirmation of Acceptance for Studies (CAS) from your licensed student sponsor.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — GOV.UK, Student visa', 'https://www.gov.uk/student-visa')

  await b.field(finance, FieldCategory.cost,
    'Maintenance: £1,529 per month if studying in London, £1,171 per month outside London, calculated for a maximum of 9 months. Outstanding course fees shown on your CAS are additional.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — GOV.UK, Financial evidence', 'https://www.gov.uk/guidance/financial-evidence-for-student-and-child-student-route-applicants')
  await b.field(finance, FieldCategory.requirement,
    'Acceptable funding may include your own funds, qualifying parent or partner funds, official sponsorship, or a qualifying student loan. Where you rely on bank funds the normal rule is 28 consecutive days, and the most recent evidence must satisfy the current UKVI timing requirement.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — GOV.UK, Financial evidence')
  await b.field(finance, FieldCategory.warning,
    'No universal total can be calculated for you: it depends on London or non-London, the fees outstanding on your CAS, course duration and any dependants.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — GOV.UK, Financial evidence')

  await b.field(tb, FieldCategory.requirement,
    'Bangladesh is on the UK TB-test country list. For an entry-clearance stay that triggers the TB rule, you must use a Home Office-approved clinic and provide a valid certificate where required.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — GOV.UK, Tuberculosis tests for visa applicants', 'https://www.gov.uk/tb-test-visa')

  await b.field(atas, FieldCategory.requirement,
    'Some Master’s and PhD programmes in specified sensitive subjects require Academic Technology Approval Scheme clearance. It is not required for every Master’s student. Affected subject groups can include certain engineering, physics, materials, computing and technology fields. Your university or CAS information should indicate whether ATAS is needed.',
    SourceClass.official, [FieldApplicability.programme], 'SOURCED — GOV.UK, Academic Technology Approval Scheme', 'https://www.gov.uk/guidance/academic-technology-approval-scheme')

  await b.field(submit, FieldCategory.cost,
    'Student visa application fee from outside the UK: £558. Immigration Health Surcharge: £776 per year, calculated according to the length of your visa.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — GOV.UK, Student visa and Immigration Health Surcharge')

  await b.field(biometrics, FieldCategory.procedure,
    'You are told during the application whether your identity is completed through the UK immigration identity system or at a visa application centre. Bangladesh currently has UK visa application facilities including Dhaka and Sylhet, with a premium location in Chittagong.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — GOV.UK, Find a visa application centre')

  await b.field(decision, FieldCategory.duration,
    'General Student-route guidance: an application made outside the UK will usually receive a decision around 3 weeks after the required application, identity and document stages. Individual cases can take longer. This is guidance, not a guarantee.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — GOV.UK, Student visa')
  await b.community(decision,
    'A July 2026 applicant reported that the visa checklist and CAS did not require the many academic records they had expected to provide; they supplied the requested evidence and were approved. Another reported that unnecessary extra evidence contributed to a review and interview in their case. A third reported a standard approval roughly two weeks after biometrics.',
    'r/ukvisa and r/ukstudentvisas, 2026 — follow the current UKVI checklist and the evidence stated on your application and CAS rather than assuming more documents always help')

  await b.field(travel, FieldCategory.requirement,
    'For a course lasting more than 6 months you may normally arrive up to 1 month before the course start, but never before your visa or eVisa permits entry.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — GOV.UK, Student visa')
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   3 — Japan
   ══════════════════════════════════════════════════════════════════════════════════════════ */

async function japan(service: Service): Promise<void> {
  const { routeId } = await service.createRoute({
    actor,
    slug: 'bd-jp-masters-2027',
    originCountry: 'BD',
    destinationCountry: 'JP',
    studyLevel: StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    intake: INTAKE,
    title: 'Study a Master’s in Japan from Bangladesh',
    summary:
      'Programme and language selection, the supervisor-first and direct-application pathways, ' +
      'graduate-school admission, the Certificate of Eligibility, visa submission through VFS in ' +
      'Bangladesh, entry, and post-arrival residence registration.',
    reason: 'owner-supplied route content, 2026-09-07',
  })
  const b = builder(service, routeId)

  const explore = await b.step('Explore Japanese graduate programmes', StepCategory.admission_university, 0, 30)
  const eligibility = await b.step('Check Master’s eligibility and programme language', StepCategory.admission_university, 30, 21)
  const supervisor = await b.step('Contact a prospective supervisor and prepare a research proposal', StepCategory.admission_university, 51, 60)
  const direct = await b.step('Apply directly, where the programme permits it', StepCategory.admission_university, 51, 21)
  const prepare = await b.step('Prepare the graduate-school application', StepCategory.documents_preparation, 111, 30)
  const exam = await b.step('Entrance examination', StepCategory.admission_university, 141, 14)
  const interview = await b.step('Interview', StepCategory.admission_university, 141, 14)
  const assessment = await b.step('Additional programme assessment', StepCategory.admission_university, 141, 14)
  const admission = await b.step('Receive admission', StepCategory.admission_university, 155, 30)
  const coeApply = await b.step('University or proxy applies for the Certificate of Eligibility', StepCategory.immigration_visa, 185, 60)
  const coe = await b.step('Receive a valid COE', StepCategory.immigration_visa, 245, 14)
  const appointment = await b.step('Book the Bangladesh VFS visa appointment', StepCategory.immigration_visa, 259, 30)
  const visaSubmit = await b.step('Submit the Japan Student visa application', StepCategory.immigration_visa, 289, 1)
  const visaDecision = await b.step('Visa decision', StepCategory.immigration_visa, 290, 7)
  const travel = await b.step('Travel to Japan', StepCategory.travel_departure, 297, 1)
  const residenceCard = await b.step('Receive or arrange the Residence Card', StepCategory.travel_departure, 298, 1)
  const address = await b.step('Register your address in Japan', StepCategory.travel_departure, 299, 14)
  const enrol = await b.step('University enrolment and start of studies', StepCategory.admission_university, 313, 7)

  await b.link(explore, eligibility)
  // The structural point of this route: two genuinely different application cultures.
  await b.link(eligibility, supervisor, StepEdgeKind.alternative)
  await b.link(eligibility, direct, StepEdgeKind.alternative)
  await b.link(supervisor, prepare, StepEdgeKind.rejoin)
  await b.link(direct, prepare, StepEdgeKind.rejoin)
  await b.link(prepare, exam, StepEdgeKind.optional_branch)
  await b.link(prepare, interview, StepEdgeKind.optional_branch)
  await b.link(prepare, assessment, StepEdgeKind.optional_branch)
  await b.link(exam, admission, StepEdgeKind.rejoin)
  await b.link(interview, admission, StepEdgeKind.rejoin)
  await b.link(assessment, admission, StepEdgeKind.rejoin)
  await b.link(admission, coeApply)
  await b.link(coeApply, coe)
  await b.link(coe, appointment)
  await b.link(appointment, visaSubmit)
  await b.link(visaSubmit, visaDecision)
  await b.link(visaDecision, travel)
  await b.link(travel, residenceCard)
  await b.link(residenceCard, address)
  await b.link(address, enrol)

  await b.field(explore, FieldCategory.procedure,
    'Japan has Master’s programmes taught in Japanese and programmes taught entirely in English, with April admission and, at some institutions, September or October admission.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Study in Japan Official Website, Graduate Schools')

  await b.field(eligibility, FieldCategory.requirement,
    'Typical Master’s admission eligibility involves completion of a four-year university degree or Bachelor’s qualification, or normally 16 years of formal education, subject to the graduate school’s own eligibility assessment. Programme requirements differ.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Study in Japan Official Website')

  await b.field(supervisor, FieldCategory.procedure,
    'Some Japanese graduate schools expect a prospective Master’s or research applicant to identify and contact a supervisor, and to prepare a research proposal, before formal application.',
    SourceClass.official, [FieldApplicability.institution, FieldApplicability.programme], 'SOURCED — Study in Japan Official Website')
  await b.field(direct, FieldCategory.procedure,
    'Other graduate programmes allow direct programme application without prior supervisor consent. Neither method applies across the whole of Japan.',
    SourceClass.official, [FieldApplicability.institution, FieldApplicability.programme], 'SOURCED — Study in Japan Official Website')

  await b.field(prepare, FieldCategory.document,
    'Typical graduate documents: the graduate-school application form; an undergraduate diploma or evidence of expected graduation; a transcript; recommendation; a research or graduation thesis or abstract where required; a research proposal where required; language evidence; and programme-specific records.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Study in Japan Official Website')

  await b.field(exam, FieldCategory.procedure,
    'Graduate-school selection can combine document assessment, an academic examination, an interview, an essay and an oral examination. Which of these apply is programme-specific.',
    SourceClass.official, [FieldApplicability.programme], 'SOURCED — Study in Japan Official Website')

  await b.field(coeApply, FieldCategory.procedure,
    'For long-term Student status, the student or — commonly — the accepting school or a proxy in Japan applies to a Regional Immigration Services Bureau for a Certificate of Eligibility.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Ministry of Foreign Affairs Japan, General Visa: Student')
  await b.field(coeApply, FieldCategory.warning,
    'A COE makes the subsequent visa and landing process substantially smoother but does not itself guarantee visa issuance.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Ministry of Foreign Affairs Japan, Visa FAQ')
  await b.community(coeApply,
    'Recent students have reported COE timing varying substantially and sometimes compressing the final visa and travel period: in August 2026 some universities had submitted COEs in June while students were still waiting in late August, with some receiving a COE only weeks before their academic start. A student’s university commonly handles or coordinates the COE application, so students often have limited ability to accelerate this stage once it is submitted.',
    'MOVE_TO_JAPAN community, 2026 — do not infer a formal COE processing time from these reports')

  await b.field(coe, FieldCategory.requirement,
    'A valid COE is mandatory for the Bangladesh VFS Student visa workflow as currently published. VFS Bangladesh specifically advises applicants not to book a student visa appointment before receiving the COE.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — VFS Global Bangladesh / Embassy of Japan in Bangladesh')

  await b.field(appointment, FieldCategory.procedure,
    'Japan visa applications in Bangladesh have been handled through VFS Global on behalf of the Embassy of Japan since November 2024, rather than by applicants lodging directly at the Embassy.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — Embassy of Japan in Bangladesh')
  await b.field(appointment, FieldCategory.warning,
    'During busy periods the Embassy says appointment waiting may exceed one month.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — Embassy of Japan in Bangladesh')

  await b.field(visaSubmit, FieldCategory.document,
    'Depending on the applicable checklist: the visa application; a valid passport; a photograph; the COE; the acceptance or admission letter; academic records; evidence of financial capability where requested; and other category-specific evidence.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — Embassy of Japan in Bangladesh, Documents Required')
  await b.field(visaSubmit, FieldCategory.warning,
    'UNVERIFIED: no single universal financial threshold is stated. The available official Bangladesh checklist does not give one amount, so none is stated here.',
    SourceClass.official, [FieldApplicability.origin_specific], 'UNVERIFIED — no figure stated by the source; nothing invented to fill the gap')

  await b.field(visaDecision, FieldCategory.duration,
    'The Embassy of Japan in Bangladesh states that standard examination can result in earliest issuance about 7 working days after submission through VFS where documents are complete. Incomplete or complex cases can take longer, potentially substantially longer.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — Embassy of Japan in Bangladesh')
  await b.field(visaDecision, FieldCategory.cost,
    'Current Embassy information says the Japanese visa fee itself is free for Bangladeshi nationals, though VFS service charges may apply.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — Embassy of Japan in Bangladesh')

  await b.field(residenceCard, FieldCategory.procedure,
    'For a stay of more than 3 months a Residence Card is issued at specified major airports, or arranged after entry depending on the port of arrival.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Ministry of Foreign Affairs Japan')
  await b.field(address, FieldCategory.deadline,
    'After establishing a place to live, you must register your address at the relevant municipal office within 14 days.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Study in Japan Official Website')
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   4 — Germany
   ══════════════════════════════════════════════════════════════════════════════════════════ */

async function germany(service: Service): Promise<string> {
  const { routeId } = await service.createRoute({
    actor,
    slug: 'bd-de-masters-2027',
    originCountry: 'BD',
    destinationCountry: 'DE',
    studyLevel: StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    intake: INTAKE,
    title: 'Study a Master’s in Germany from Bangladesh',
    summary:
      'Programme eligibility, the direct / uni-assist / VPD application alternatives, admission, ' +
      'financing, and the Bangladesh-specific Consular Services Portal queue — which the German ' +
      'Embassy Dhaka currently warns exceeds 27 months for regular applicants.',
    reason: 'owner-supplied route content, 2026-09-07',
  })
  const b = builder(service, routeId)

  const find = await b.step('Find Master’s programmes', StepCategory.admission_university, 0, 30)
  const eligibility = await b.step('Check academic eligibility and degree recognition', StepCategory.admission_university, 30, 21)
  const documents = await b.step('Prepare Bangladesh academic documents', StepCategory.documents_preparation, 51, 45)
  const language = await b.step('Meet the programme language requirement', StepCategory.language_testing, 51, 60)
  const channel = await b.step('Check which application channel your university uses', StepCategory.admission_university, 51, 14)
  const directApply = await b.step('Apply directly to the university', StepCategory.admission_university, 111, 21)
  const uniAssistForward = await b.step('uni-assist evaluates and forwards your application', StepCategory.admission_university, 111, 42)
  const vpd = await b.step('uni-assist issues a VPD, then you apply to the university', StepCategory.admission_university, 111, 42)
  const admission = await b.step('University admission', StepCategory.admission_university, 153, 45)
  const finance = await b.step('Arrange financial proof', StepCategory.funding_scholarship, 198, 30)
  const visaDocs = await b.step('Prepare visa documents', StepCategory.documents_preparation, 198, 30)
  const insurance = await b.step('Arrange the required insurance', StepCategory.documents_preparation, 198, 14)
  const csp = await b.step('Register through the Consular Services Portal', StepCategory.immigration_visa, 228, 7)
  // The queue is its own step. Averaging it with the 4-week processing minimum would destroy
  // the only distinction a student planning an intake actually needs.
  const queue = await b.step('Wait for appointment eligibility', StepCategory.immigration_visa, 235, 820)
  const vfs = await b.step('Submit documents and biometrics at VFS', StepCategory.immigration_visa, 1055, 1)
  const processing = await b.step('Embassy processing', StepCategory.immigration_visa, 1056, 28)
  const decision = await b.step('Visa decision and passport return', StepCategory.immigration_visa, 1084, 7)
  const travel = await b.step('Travel to Germany', StepCategory.travel_departure, 1091, 1)

  await b.link(find, eligibility)
  await b.link(eligibility, documents)
  await b.link(eligibility, language)
  await b.link(eligibility, channel)
  await b.link(documents, channel, StepEdgeKind.rejoin)
  await b.link(language, channel, StepEdgeKind.rejoin)
  // The structural point of this route: three real application channels.
  await b.link(channel, directApply, StepEdgeKind.alternative)
  await b.link(channel, uniAssistForward, StepEdgeKind.alternative)
  await b.link(channel, vpd, StepEdgeKind.alternative)
  await b.link(directApply, admission, StepEdgeKind.rejoin)
  await b.link(uniAssistForward, admission, StepEdgeKind.rejoin)
  await b.link(vpd, admission, StepEdgeKind.rejoin)
  await b.link(admission, finance)
  await b.link(admission, visaDocs)
  await b.link(admission, insurance)
  await b.link(finance, csp, StepEdgeKind.rejoin)
  await b.link(visaDocs, csp, StepEdgeKind.rejoin)
  await b.link(insurance, csp, StepEdgeKind.rejoin)
  await b.link(csp, queue)
  await b.link(queue, vfs)
  await b.link(vfs, processing)
  await b.link(processing, decision)
  await b.link(decision, travel)

  await b.field(find, FieldCategory.procedure,
    'Check the university, programme, teaching language, semester and intake, admission requirements, application channel and deadline before anything else.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — uni-assist / institution-specific')

  await b.field(eligibility, FieldCategory.requirement,
    'Generally requires an undergraduate degree in a related subject that is equivalent or acceptable for the selected German Master’s. Individual university criteria can include degree subject, credit or course prerequisites, minimum grade, language, and work or internship requirements.',
    SourceClass.institutional_public, [FieldApplicability.institution, FieldApplicability.programme], 'SOURCED — uni-assist, Master')

  await b.field(documents, FieldCategory.document,
    'uni-assist currently identifies for Bangladesh: the school-leaving certificate including subjects and grades (X+II); the university diploma including subjects and grades where applicable; and the university grading system including the minimum passing grade for the award of the degree.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — uni-assist, Bangladesh: info country by country')
  await b.field(documents, FieldCategory.warning,
    'There is no APS requirement shown for Bangladesh in the current uni-assist Bangladesh requirements. APS offices exist for other countries; do not add an APS step to a Bangladesh route.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — uni-assist, Bangladesh — negative finding')

  await b.field(language, FieldCategory.requirement,
    'An English-taught programme uses the university-defined English requirement; a German-taught programme uses the university-defined German requirement. For Bangladesh visa documentation the German Embassy Dhaka currently requests English proof for English-language programmes, except for specified prior-degree exceptions.',
    SourceClass.official, [FieldApplicability.origin_specific, FieldApplicability.programme], 'SOURCED — German Embassy Dhaka / institution-specific')

  await b.field(channel, FieldCategory.procedure,
    'Three real pathways exist: apply to the university directly; apply through uni-assist, which evaluates and forwards your application; or obtain a VPD from uni-assist and submit that to the university yourself. uni-assist is not universal — check which your university uses.',
    SourceClass.official, [FieldApplicability.application_channel, FieldApplicability.institution], 'SOURCED — uni-assist')
  await b.field(uniAssistForward, FieldCategory.duration,
    'uni-assist general processing guidance is usually 4–6 weeks overall. Published regional live estimates vary and change.',
    SourceClass.official, [FieldApplicability.application_channel], 'SOURCED — uni-assist, Deadlines & Processing Time')

  await b.field(admission, FieldCategory.requirement,
    'A valid admission letter is now especially important: only applicants holding one can register for the new Bangladesh CSP student-visa process.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — German Embassy Dhaka')

  await b.field(finance, FieldCategory.cost,
    'The German Embassy Dhaka currently accepts a scholarship or stipend, a qualifying formal sponsorship in Germany (Verpflichtungserklärung), or a German blocked account. The current Embassy blocked-account figure is €11,904 in total, with €992 monthly disposal over 12 months.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — German Embassy Dhaka, Information regarding Study Visa, 04.06.2026')

  await b.field(visaDocs, FieldCategory.document,
    'The current Embassy checklist includes: passport; biometric photo; national visa application and declaration; admission; relevant language proof; HSC and board documents; previous university study records; motivation letter; CV; financial evidence; travel health insurance for the arrival and enrolment period; the visa fee; and translations where necessary.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — German Embassy Dhaka')

  await b.field(csp, FieldCategory.procedure,
    'Since January 2025 Germany has moved new Bangladesh student registrations to the Consular Services Portal. New CSP applicants must upload documents before online submission, and the Embassy states that only applicants with a valid admission letter can register. For Master’s applications processed via CSP, VFS handles application intake and biometrics.',
    SourceClass.official, [FieldApplicability.origin_specific, FieldApplicability.application_channel], 'SOURCED — German Embassy Dhaka')

  await b.field(queue, FieldCategory.warning,
    'The German Embassy Dhaka currently warns that for regular Bachelor’s and Master’s applicants without a qualifying German or EU scholarship, the waiting time is already MORE THAN 27 MONTHS and largely unpredictable. The old waiting list is being worked through before new regular CSP registrations.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — German Embassy Dhaka, 04.06.2026')
  await b.field(queue, FieldCategory.duration,
    'This queue is a separate duration from visa processing. Do not average the two: the wait for appointment eligibility is currently warned at more than 27 months, and the minimum processing time after submission is about 4 weeks.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — German Embassy Dhaka')
  await b.community(queue,
    'Bangladeshi applicants in 2026 report considerable confusion about the transition from the old waiting list to the Consular Services Portal, planning around extremely long visa queues, and questioning whether their admission and intake timing remains realistic. These reports are consistent with the Embassy’s own warning.',
    'r/Dhaka and Bangladesh CSP discussions, July 2026 — the 27-month figure comes from the Embassy, not from these reports',
    [FieldApplicability.origin_specific])

  await b.field(vfs, FieldCategory.procedure,
    'The Embassy sends an eligible applicant the relevant appointment process or link; the student attends VFS, submits documents and biometrics, and VFS forwards the application to the Embassy.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — German Embassy Dhaka')

  await b.field(processing, FieldCategory.duration,
    'Official minimum processing is approximately 4 weeks after the application is submitted. This does not include the preceding queue.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — German Embassy Dhaka')

  return routeId
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   5 — Austria
   ══════════════════════════════════════════════════════════════════════════════════════════ */

async function austria(service: Service): Promise<void> {
  const { routeId } = await service.createRoute({
    actor,
    slug: 'bd-at-masters-2027',
    originCountry: 'BD',
    destinationCountry: 'AT',
    studyLevel: StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    intake: INTAKE,
    title: 'Study a Master’s in Austria from Bangladesh',
    summary:
      'Structurally different from the other routes: Austria decides the Residence Permit — ' +
      'Student first, and the Visa D comes after that approval. For Bangladesh the application ' +
      'must be lodged in person at the Austrian Embassy in New Delhi.',
    reason: 'owner-supplied route content, 2026-09-07',
  })
  const b = builder(service, routeId)

  const explore = await b.step('Explore Austrian Master’s programmes', StepCategory.admission_university, 0, 30)
  const criteria = await b.step('Check academic and language admission criteria', StepCategory.admission_university, 30, 21)
  const apply = await b.step('Apply to the Austrian university', StepCategory.admission_university, 51, 30)
  const finalAdmission = await b.step('Final admission, with no entrance examination', StepCategory.admission_university, 81, 30)
  const conditional = await b.step('Conditional admission requiring an entrance examination', StepCategory.admission_university, 81, 30)
  const rpDocs = await b.step('Prepare the Residence Permit — Student documents', StepCategory.documents_preparation, 111, 30)
  const finances = await b.step('Prove financial means', StepCategory.funding_scholarship, 111, 30)
  const accommodation = await b.step('Secure accommodation in Austria', StepCategory.documents_preparation, 111, 30)
  const insurance = await b.step('Arrange qualifying health-insurance evidence', StepCategory.documents_preparation, 111, 21)
  const police = await b.step('Obtain police clearance, legalisation and translations', StepCategory.documents_preparation, 111, 45)
  const delhi = await b.step('Arrange New Delhi submission logistics', StepCategory.travel_departure, 111, 45)
  const lodge = await b.step('Attend the Residence Permit application in person in New Delhi', StepCategory.immigration_visa, 156, 1)
  const forwarded = await b.step('Application forwarded to the competent Austrian authority', StepCategory.immigration_visa, 157, 14)
  const rpDecision = await b.step('Residence Permit decision', StepCategory.immigration_visa, 171, 60)
  const visaD = await b.step('Apply for the Visa D after a positive decision', StepCategory.immigration_visa, 231, 21)
  const travel = await b.step('Travel to Austria', StepCategory.travel_departure, 252, 1)
  const registerAddress = await b.step('Register your Austrian address', StepCategory.travel_departure, 253, 3)
  const collect = await b.step('Final enrolment and collect the Residence Permit', StepCategory.immigration_visa, 256, 14)
  const begin = await b.step('Begin studies', StepCategory.admission_university, 270, 7)

  await b.link(explore, criteria)
  await b.link(criteria, apply)
  // The structural point of this route: entrance exam or not, and both reach the permit.
  await b.link(apply, finalAdmission, StepEdgeKind.alternative)
  await b.link(apply, conditional, StepEdgeKind.alternative)
  await b.link(finalAdmission, rpDocs, StepEdgeKind.rejoin)
  await b.link(conditional, rpDocs, StepEdgeKind.rejoin)
  await b.link(rpDocs, finances)
  await b.link(rpDocs, accommodation)
  await b.link(rpDocs, insurance)
  await b.link(rpDocs, police)
  await b.link(rpDocs, delhi)
  await b.link(finances, lodge, StepEdgeKind.rejoin)
  await b.link(accommodation, lodge, StepEdgeKind.rejoin)
  await b.link(insurance, lodge, StepEdgeKind.rejoin)
  await b.link(police, lodge, StepEdgeKind.rejoin)
  await b.link(delhi, lodge, StepEdgeKind.rejoin)
  await b.link(lodge, forwarded)
  await b.link(forwarded, rpDecision)
  await b.link(rpDecision, visaD)
  await b.link(visaD, travel)
  await b.link(travel, registerAddress)
  await b.link(registerAddress, collect)
  await b.link(collect, begin)

  await b.field(criteria, FieldCategory.requirement,
    'Check the Austrian institution, the Master’s programme, the relevant Bachelor’s requirement, the teaching language, the programme deadline, and whether an entrance examination is required.',
    SourceClass.institutional_public, [FieldApplicability.institution, FieldApplicability.programme], 'SOURCED — institution-specific')

  await b.field(finalAdmission, FieldCategory.procedure,
    'With no entrance examination you obtain normal admission and proceed with the Student residence-permit process.',
    SourceClass.official, [FieldApplicability.institution], 'SOURCED — OeAD')
  await b.field(conditional, FieldCategory.procedure,
    'Where an entrance examination is required the university may issue conditional admission. You can use that conditional admission in the Student residence-permit process and complete the examination and final admission procedure later.',
    SourceClass.official, [FieldApplicability.institution], 'SOURCED — OeAD')

  await b.field(rpDocs, FieldCategory.requirement,
    'For third-country students studying for more than 6 months the key immigration status is generally the Residence Permit — Student (Aufenthaltsbewilligung Student). This is not simply "get a student visa first".',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — OeAD, Residence Permit — Student')

  await b.field(finances, FieldCategory.cost,
    'Current 2026 figures for the normal Student residence permit: €722.58 per month under age 24, or €1,308.39 per month from age 24. Funds are normally shown for 12 months in advance for this route.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — OeAD, 2026 figures')
  await b.field(finances, FieldCategory.requirement,
    'Additional financial proof is required if accommodation costs exceed €386.43 per month, and health-insurance needs must also be covered. Accepted proof can involve your own funds and, depending on documentation, support from parents or sponsors and other legitimate sources. Authorities may require proof of the origin of funds.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — OeAD')

  await b.field(accommodation, FieldCategory.requirement,
    'You normally need evidence of accommodation in Austria for at least 3 months for the initial residence-permit process.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — OeAD')

  await b.field(insurance, FieldCategory.requirement,
    'The residence-permit application requires qualifying health-insurance coverage or all-risk protection. Eligible degree students may later use Austrian student self-insurance after arrival and enrolment where conditions are met; the published 2026 student self-insurance premium is €78.84 per month.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — OeAD')

  await b.field(police, FieldCategory.document,
    'A first-time residence-permit application includes: passport; biometric photograph; admission; proof of funds; accommodation; insurance; a police clearance certificate from your country of residence, generally not older than 3 months at application; and other requested evidence. Foreign civil and public documents can require legalisation and translation, particularly German translation, according to the applicable procedure.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Austrian Embassy New Delhi, How to Apply')

  await b.field(delhi, FieldCategory.warning,
    'Austria’s Embassy in New Delhi is responsible for Bangladesh. For residence permits exceeding 6 months the Embassy states that applications must be made IN PERSON at the Embassy. The Austrian Honorary Consulate in Dhaka is not a replacement submission point, so a Bangladeshi applicant must plan New Delhi appointment and travel logistics.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — Austrian Embassy New Delhi / Austrian Foreign Ministry')
  await b.field(delhi, FieldCategory.requirement,
    'Arrange lawful India entry for the New Delhi residence-permit appointment — verify the current Indian visa category. The Government of India requires foreign nationals entering India to hold the appropriate valid visa or entry authority unless exempt. UNVERIFIED here: no visa category is prescribed, because the correct one depends on your circumstances and current Indian policy.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED for the requirement; UNVERIFIED for the category — nothing invented')

  await b.field(lodge, FieldCategory.procedure,
    'Obtain a residence-permit appointment, appear in person, and submit the application with original and supporting documents. The Embassy recommends applying at least approximately 3 months before intended Austrian entry, because you generally wait outside Austria for the decision.',
    SourceClass.official, [FieldApplicability.origin_specific], 'SOURCED — Austrian Embassy New Delhi')
  await b.field(lodge, FieldCategory.cost,
    'The residence-permit application fee for applications submitted from 1 January 2026 is €218. This does not cover every possible consular, document, translation or Visa D cost.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — OeAD / Austrian Embassy New Delhi')

  await b.field(forwarded, FieldCategory.procedure,
    'The Embassy accepts, checks and forwards the application. The competent Austrian residence authority for the place you will live makes the actual decision.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Austrian Embassy New Delhi')
  await b.field(rpDecision, FieldCategory.duration,
    'Processing time varies. UNVERIFIED: no single national guaranteed duration is published, and none is stated here.',
    SourceClass.official, [FieldApplicability.route_wide], 'UNVERIFIED — no figure published; nothing invented')

  await b.field(visaD, FieldCategory.procedure,
    'The sequence is: Residence Permit approval, then Visa D, then enter Austria, then collect the Residence Permit. Following a positive residence-permit decision, an applicant who needs a visa applies for the Visa D to enter Austria; current guidance says it should be applied for within the specified period after notification.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — Austrian Embassy New Delhi / OeAD')

  await b.field(registerAddress, FieldCategory.deadline,
    'OeAD states that address registration normally needs to be completed within three working days where applicable.',
    SourceClass.official, [FieldApplicability.route_wide], 'SOURCED — OeAD')

  await b.community(rpDecision,
    'Students repeatedly report finding the Austrian sequence confusing because the Residence Permit approval comes before the Visa D. A 2026 Master’s applicant applying through New Delhi described submitting the residence-permit application first and dealing with Austrian district-authority follow-up afterwards. Another student reported a roughly five-week residence-permit decision in their individual case. Students repeatedly stress that financial-source documentation, accommodation evidence and document preparation can require substantial lead time.',
    'AustriaIndianStudents / MoveToEurope, 2026 — individual experiences, not a processing-time promise and not Bangladesh-specific unless stated')
}

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

async function main(): Promise<void> {
  // Admin scripts use the DIRECT endpoint, the same split CLAUDE.md §4 sets for migrations.
  if (process.env.DATABASE_URL_UNPOOLED) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED
  }
  await assertDisposable()

  const service = await import('../../src/server/revisions/service')
  const { getRouteBySlug } = await import('../../src/server/routes/read')
  await withRetry(() => getRouteBySlug('__warmup__'))

  const routes: [string, () => Promise<unknown>][] = [
    ['bd-my-masters-2027', () => malaysia(service)],
    ['bd-gb-masters-2027', () => unitedKingdom(service)],
    ['bd-jp-masters-2027', () => japan(service)],
    ['bd-de-masters-2027', () => germany(service)],
    ['bd-at-masters-2027', () => austria(service)],
  ]

  for (const [slug, load] of routes) {
    if (await getRouteBySlug(slug)) {
      process.stdout.write(`already present: ${slug}\n`)
      continue
    }
    await load()
    const route = await getRouteBySlug(slug)
    process.stdout.write(`loaded ${slug} — ${route?.stepCount ?? 0} steps\n`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exit(1)
  })
