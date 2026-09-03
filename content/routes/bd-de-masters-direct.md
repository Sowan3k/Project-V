# Bangladesh → Germany → Master's → Direct admission

**Worksheet. Not route data. Nothing here has been published.**
Read `../README.md` before changing anything.

| | |
|---|---|
| Origin | BD |
| Destination | DE |
| Study level | `masters` |
| Mechanism | `direct_admission` |
| Target intake (test) | Winter Semester 2027/28 |
| Worksheet status | **PARTIALLY SOURCED** — country-level facts 2026-09-02; one real programme 2026-09-02; application cost and visa-stage insurance 2026-09-03. Shortlisting, degree-recognition mechanics, admission handling and enrolment remain UNVERIFIED |
| Last reviewed | 2026-09-02 (research pass 1) |
| Reviewed by | — *(no human review yet — nothing may be published on this basis)* |
| Community confirmations | **0** — and it stays 0 until real students confirm |

---

## Research pass 1 — 2026-09-02

Sources used, in the priority order set for this track:

| # | Source | Page date | Used for |
|---|---|---|---|
| S1 | [German Embassy Dhaka — Information regarding Study Visa](https://dhaka.diplo.de/bd-en/service/2685884-2685884) | 04.06.2026 | Financial proof, language, procedure, processing, waiting time |
| S2 | [German Embassy Dhaka — Time line, student visa application](https://dhaka.diplo.de/bd-en/service/2690988-2690988) | 15.04.2025 | Processing time |
| S3 | [Federal Foreign Office — Blocked account (Sperrkonto)](https://www.auswaertiges-amt.de/en/visa-service/visabestimmungen-node/sperrkonto-seite) | 26.07.2024 | Confirms the amount is set per mission, not federally |
| S4 | [uni-assist — country information, Bangladesh](https://www.uni-assist.de/en/tools/info-country-by-country/details-country/country/bd/) | not stated | Bangladesh-specific document requirements |
| S5 | [uni-assist — APS glossary](https://www.uni-assist.de/en/tools/glossary-of-terms/description/term/akademische-pruefstelle-aps/) / [APS India](https://aps-india.de/about-us/) | — | Whether APS applies to Bangladesh |

---

## Verified country-level facts

All `official` source class. All checked **2026-09-02**. None reviewed by a human yet.

| Fact | Value | Source | Scope | Status |
|---|---|---|---|---|
| Blocked account minimum balance | **€11,904** | S1 | Bangladesh (Embassy Dhaka) | SOURCED |
| Blocked account monthly disposal | **€992/month** | S1 | Bangladesh | SOURCED |
| Blocked account amount is set per mission | The federal page states the amount "varies depending on the purpose of your stay" and directs applicants to "the website of the competent mission abroad" | S3 | Germany-wide rule about scope | SOURCED |
| Other accepted financial proof | Parents' income and financial circumstances; declaration of commitment (§§66–68 AufenthG); annually renewable bank guarantee at a German bank | S3 | Germany-wide | SOURCED |
| Official visa processing time | **"The minimum time to process your visa is approx. 4 weeks"** | S1, S2 | Bangladesh | SOURCED |
| **Actual current waiting time** | **"current waiting times exceed 27 months"** | S1 | Bangladesh | **NEEDS-HUMAN** — see uncertainty §1 |
| Master's application intake channel | VFS handles document intake for Master's applicants (since 02.01.2025) | S1 | Bangladesh | SOURCED |
| Bachelor's application intake channel | Documents submitted directly to the Embassy | S1 | Bangladesh | SOURCED |
| Appointment registration | Online registration via the Consular Services Portal required before submitting | S1 | Bangladesh | SOURCED |
| Language proof for **visa**, English-taught programme | TOEFL or IELTS, unless the Bachelor was completed in Australia, the UK or the US | S1 | Bangladesh | SOURCED |
| Language proof for **visa**, German-taught programme | "Zertifikat B1" with a 'good' result or higher is *recommended* | S1 | Bangladesh | SOURCED |
| **APS certificate** | **Does NOT apply to Bangladesh.** APS exists for China (2001), Vietnam (2007) and India (2022). Not listed on the Embassy Dhaka study-visa requirements. | S5, S1 | Bangladesh | SOURCED — negative finding |
| uni-assist: school leaving certificate | Required, "with an overview of subjects and grades (X+II)" | S4 | Bangladesh | SOURCED |
| uni-assist: university diploma | Required where applicable, "including an overview of subjects and grades" | S4 | Bangladesh | SOURCED |
| uni-assist: grading system | Required — "your university's grading system including the minimum passing grade for award of degree" | S4 | Bangladesh | SOURCED |
| uni-assist: minimum CGPA evidence | "We require information on the minimum CGPA for the award of your degree. Please submit an official document issued by your university in case this information is not included in your transcript." A link to the university's website is also accepted. | S4 | Bangladesh | SOURCED |

### The APS finding is worth stating plainly

Early UI mockups showed **APS** as a step on a Bangladesh → Germany route. Research shows it does
not apply: APS offices exist for China, Vietnam and India, and APS appears nowhere in the German
Embassy Dhaka study-visa requirements. Seeding it would have put a fabricated, expensive and
time-consuming step in front of Bangladeshi students.

This is precisely the failure CLAUDE.md §8.6 warns about — mockup content treated as fact — and
it was caught only because the requirement was checked rather than copied.

---

## Uncertainty and conflicting information

### 1. Two official durations that are both true — and the gap between them is the story

The Embassy states **both**:

- "The minimum time to process your visa is approx. **4 weeks**" (S1, S2)
- "current waiting times **exceed 27 months**" (S1)

These do not contradict each other. The four weeks is *processing once the application reaches
the mission*; the 27 months is the *queue before it does*. S1 also notes the processing period
"starts once the application reaches the mission, not VFS", and does not restart until the
application is complete.

**For a Bangladeshi applicant this is the single most consequential fact on the route**, and it is
exactly what a generic "study in Germany" guide omits. A student planning for Winter Semester
2027/28 on the basis of "about 4 weeks" would miss their intake by two years.

It must be modelled as **two separate fields**, not averaged, not summarised, and not merged into
a single reassuring number.

Status **NEEDS-HUMAN**: the 27-month figure is volatile by nature, it is the kind of number that
moves, and getting it wrong in either direction is costly. It should be re-checked immediately
before any publication and carry a short review interval afterwards.

### 2. Visa language proof ≠ programme admission requirement

S1's language requirements are what the **Embassy** needs for the visa. A programme's admission
requirement is set by the university and is frequently stricter or differently expressed. Both are
real; conflating them would misinform.

Not yet researched: any specific programme's admission language requirement.

### 3. "Direct admission" needs defining against reality

The route mechanism is `direct_admission`, but Germany has at least three application channels —
direct to the university, via uni-assist, and uni-assist → VPD → university. Which applies is
**per university and per programme**, not per country.

Not yet researched: which channel applies to any specific programme. Until that is known, the
route cannot honestly claim to describe "direct admission".

### 4. Programme-specific requirements exist and vary by nationality

Search results surfaced at least one German programme requiring **GRE** from applicants from
Bangladesh, Pakistan and Iran, while requiring APS from Vietnamese applicants. Not verified against
a primary university page, so recorded only as evidence that nationality-specific programme rules
exist — not as a fact about any programme.

---

## Requires human confirmation before publishing

- The 27-month waiting time (volatile, high-consequence).
- Everything programme-specific — none of it has been researched.
- Whether the blocked-account amount changes for 2027; the figures verified are current as of the
  04.06.2026 page and blocked-account amounts have historically changed year to year.

---

## Not yet researched

Steps 1, 2, 5, 6, 7, 11, 12 and 13 of the proposed structure remain **UNVERIFIED**. Specifically:
programme shortlisting sources, degree-recognition and anabin/ZAB handling, application channel per
programme, application fees, admission-decision handling, enrolment, insurance, and post-arrival
formalities.

**Post-arrival formalities (Anmeldung, residence permit, insurance activation) may be out of V1
scope** — CLAUDE.md §10 ends the first-release scope at departure and the expected fly window.
Raised in `../MODELLING-NOTES.md` rather than decided here.

---

## Research pass 2 — 2026-09-02 — one real programme

Programme chosen as the programme-specific test case:

**M.Sc. Data Science, RWTH Aachen University** — a direct-application (non-uni-assist) pathway,
which matches this route's `direct_admission` mechanism and lets the channel dimension be tested
honestly.

| # | Source | Used for |
|---|---|---|
| S6 | [RWTH — International Applicants, Master](https://www.rwth-aachen.de/cms/root/studium/vor-dem-studium/bewerbung-um-einen-studienplatz/master-bewerbung/~dqml/bewerbung-master-internationale/?lidx=1) | Channel, deadlines, documents |
| S7 | [RWTH Informatik — M.Sc. Data Science, Application for Admission](https://sc.informatik.rwth-aachen.de/en/studium/master/master-data-science/application-for-admission/) | Programme prerequisites, GRE, language, deadline |

### Verified programme-level facts

All `official`, checked **2026-09-02**, no human review yet.

| Fact | Value | Source | Applies to | Status |
|---|---|---|---|---|
| Application channel | RWTH's own portal, `online.rwth-aachen.de`. **uni-assist is not used.** No physical documents posted. | S6, S7 | RWTH (institution) | SOURCED |
| Admission type | M.Sc. Data Science is **open admission**, not restricted (NC) | S7 | Programme | SOURCED |
| **Winter deadline, non-EU/EEA, open admission** | **1 March** | S6, S7 | Institution × admission type × applicant status | SOURCED |
| Winter deadline, non-EU/EEA, restricted (NC) | 15 July | S6 | Institution × admission type × applicant status | SOURCED |
| Winter deadline, EU/EEA | 15 July for both types | S6 | Institution × applicant status | SOURCED |
| Prerequisite: first degree | "Computer Science, Mathematics, Physics or a closely related area" | S7 | Programme | SOURCED |
| Prerequisite credits (CS profile) | Programming 8 CP, Data Structures and Algorithms 7, Databases 6, Software Engineering 6, Computer Architecture 6, Operating Systems 6, Networks/Security 6, Theory of Computation 12, Logic 6, Discrete Structures 6, Calculus 8, Linear Algebra 6, Stochastics 6 | S7 | Programme | SOURCED |
| Prerequisite credits (Maths profile) | Analysis I–III 24 CP, Linear Algebra I–II 15, Numerical Analysis 9, Stochastics 9 | S7 | Programme | SOURCED |
| Prerequisite credits (Physics profile) | Experimental Physics 26 CP, Theoretical Physics 26, Higher Mathematics 24, Advanced Internship 6 | S7 | Programme | SOURCED |
| **GRE General Test** | Required — quantitative >75th percentile, verbal >15th percentile, analytical writing ≥3.5. **Exempt: EU/EEA citizens, or holders of German secondary education.** Institution code 8504. | S6, S7 | Programme × applicant status | SOURCED |
| English proof | An English certificate proving fluency. **"Medium of instruction (MOI) certificates are in general not accepted."** Submitted **at enrolment**, not at application. | S7 | Programme | SOURCED |
| Documents | Degree diploma and transcript; module descriptions matching admission requirements, with cover sheet; GRE results; CV in list form; certified translation if not in German or English | S6, S7 | Institution × programme | SOURCED |

### Findings that change the picture

**1. The deadline for a Bangladeshi applicant is 1 March, not 15 July.**
Non-EU/EEA applicants to an open-admission Master's apply by 1 March; EU/EEA applicants have until
15 July. A Bangladeshi student reading a generic "apply by 15 July" would miss the intake by a full
year. This is the second time research has produced a difference measured in years.

**2. "MOI certificates are in general not accepted."**
Many Bangladeshi Bachelor's degrees are taught in English, and a Medium of Instruction certificate
is the usual way applicants evidence that. RWTH says it does not generally accept them. Note this
is *narrower* than the Embassy's visa rule, which waives English proof only for degrees completed
in Australia, the UK or the US — so an applicant can satisfy the visa requirement and still fail
the programme requirement, or vice versa. They are different tests by different authorities.

**3. GRE is required here — and this is where the mockups accidentally got close to something real.**
Not APS, which does not exist for Bangladesh; GRE, which this programme requires from exactly the
applicants this route serves. It is programme-specific, not a German requirement.

**4. A seventh applicability level appeared that was not in the original list: applicant status.**
Both the deadline and the GRE requirement turn on non-EU/EEA versus EU/EEA. On *this* route every
reader is Bangladeshi, so the conditionality collapses — but only because the route's own identity
already fixes the origin.

### Uncertainty from pass 2

- Neither RWTH page carries a visible last-updated date. Deadlines and prerequisites are exactly
  the kind of fact that moves between intakes; both need re-checking before publication and a short
  review interval afterwards. Status for every date-sensitive row above: **NEEDS-HUMAN**.
- The stated deadlines were read for a current cycle. Whether they hold for **Winter Semester
  2027/28** specifically is **not verified** and must not be assumed.
- The English requirement is stated qualitatively ("able to speak and write fluently"), with the
  numeric threshold on a separate RWTH language page not yet fetched. **No IELTS or TOEFL number
  should be seeded for this programme until that page is read.**

---

## Research pass 3 — 2026-09-03 — application cost, and what the mission does not say

Filling two of the gaps named under "Not yet researched": **application fees** (step 5/6) and
**insurance** (step 11). Both turned out to matter more than expected, and the second changes a
scope question rather than only answering one.

### Sources added

| # | Source | Retrieved | Used for |
|---|---|---|---|
| S8 | [uni-assist — Handling fees](https://www.uni-assist.de/en/how-to-apply/pay-all-fees/handling-fees/) | 2026-09-03 | Application cost via the uni-assist channel |
| S1 | (re-read) [German Embassy Dhaka — Study Visa](https://dhaka.diplo.de/bd-en/service/2685884-2685884) | 2026-09-03 | Visa fee currency, insurance, admission proof, negative findings |

### Verified facts

| Fact | Value | Source | Applies to | Status |
|---|---|---|---|---|
| uni-assist handling fee, first course | **EUR 75.00** — "Cost for the first chosen course of study: EUR 75.00" | S8 | **Application channel** (uni-assist only) | SOURCED |
| uni-assist handling fee, each additional course | **EUR 30.00** — "For each additional chosen course of study: EUR 30.00" | S8 | Application channel | SOURCED |
| The fee resets every semester | "the fee is again EUR 75.00 for your first chosen study course and EUR 30.00 for each additional" on reapplying for a new semester | S8 | Application channel × intake | SOURCED |
| The fee buys processing, not a place | "The fees cover the processing and evaluation of your documents and educational certificates, **regardless of the result**." | S8 | Application channel | SOURCED |
| Travel health insurance at the **visa** stage | "Travel health insurance valid on arrival in Germany to the date of enrolment at the University (minimum 3 months)" | S1 | Bangladesh (mission) | SOURCED |
| Visa fee currency | "Visa fees are payable in BDT. The fees are fixed in Euro" | S1 | Bangladesh | SOURCED |
| Proof of admission | "Proof of admission to the relevant University or Institution" is on the checklist | S1 | Bangladesh | SOURCED |

### The fee is the first verified `application_channel` fact

Amendment 001 added `application_channel` to `FieldApplicability` on the strength of a
*hypothesis* — that some facts vary by how you apply rather than by who you are or where you
are going. Research pass 2 found no instance of it, only programme-, institution- and
intake-specific facts.

This is the instance. **€75 + €30 is true if you apply through uni-assist and false if you do
not.** RWTH's M.Sc. Data Science uses its own portal and "uni-assist is not used" (S6, S7), so a
student following the RWTH route pays this fee **zero times**, while a student applying to three
uni-assist universities pays €135 for the same semester.

Presented without its scope, "application fee €75" would be wrong for one of those students and
misleading for the other. That is exactly the failure FR-81 exists to prevent, now demonstrated
on a second dimension rather than argued.

### Insurance is a departure-stage requirement, not a post-arrival one

The worksheet previously grouped insurance with "post-arrival formalities" and raised whether
those fall outside V1 (CLAUDE.md §10 ends the first release at departure and the fly window).

That grouping was wrong. **Travel health insurance is required at the visa application**, before
departure, and the mission specifies its coverage window: valid from arrival until enrolment,
minimum three months. It belongs in the visa step, inside V1 scope.

The *statutory* German health insurance a student enrols in afterwards is a different thing and
does sit past departure. Two requirements, two stages, and only the first is ours.

### Three negative findings, recorded because absence is also information

1. **The Embassy Dhaka study-visa page does not mention anabin, ZAB or degree recognition at
   all.** A Bangladeshi applicant's degree recognition is handled by the university at
   admission, not by the mission at the visa stage — at least as far as this page states. Not
   evidence that recognition never matters; evidence that the mission does not ask for it.
2. **The visa fee amount is not published on that page.** It says only that fees are payable in
   BDT and fixed in Euro. **Do not seed an amount.** A fee figure taken from a blog and shown
   next to an official source is precisely the impersonation invariant 11 forbids.
3. **The page does not distinguish conditional from unconditional admission**, nor state how
   many document sets are required. Both are real questions a student has, and neither has an
   answer from this source.

### Still not researched

Programme shortlisting sources, degree recognition mechanics (anabin's `H+`/`H-` institution
status could not be retrieved — the FAQ path returns 404 and needs a different entry point),
admission-decision handling, enrolment, and post-arrival formalities.

**Nothing from this pass has been loaded into production**, and none of it may be until a person
reviews it (content/README.md).
