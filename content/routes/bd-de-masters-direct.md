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
| Worksheet status | **PARTIALLY SOURCED** — country-level facts researched 2026-09-02; programme-level facts not started |
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
