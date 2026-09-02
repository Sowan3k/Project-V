# Bangladesh → Germany → Master's → Direct admission

**Worksheet. Not route data. Nothing here is published.**
Read `../README.md` before filling anything in.

| | |
|---|---|
| Origin | BD |
| Destination | DE |
| Study level | `masters` |
| Mechanism | `direct_admission` |
| Intake | *(to be decided — Germany has winter and summer intakes with different deadlines)* |
| Worksheet status | **UNVERIFIED — research not yet carried out** |
| Last reviewed | — |
| Reviewed by | — |
| Community confirmations | **0** — and it stays 0 until real students confirm (§45) |

---

## How to fill this in

Every row needs a source, a source class and a checked date **before** its status can leave
`UNVERIFIED`. Where a value is genuinely unknown, leave `UNVERIFIED` — do not infer, do not
copy from a mockup, and do not carry over a number from a blog because it sounds right.

High-consequence rows — visa requirements, money, deadlines, embassy jurisdiction — should
end at `NEEDS-HUMAN` rather than `SOURCED`, even when a source is clear. Getting those wrong
costs a student an intake.

---

## Steps

The step list below is a **hypothesis about shape**, drawn from the categories in
`src/domain/enums.ts`. It is not researched. Confirming or refuting this shape is part of the
first research pass, and refuting it is a useful result — see `../MODELLING-NOTES.md`.

| # | Step | Category | Runs parallel with | Status |
|---|---|---|---|---|
| 1 | Academic documents and transcripts | `documents_preparation` | 2, 3 | UNVERIFIED |
| 2 | Degree recognition / equivalence check | `documents_preparation` | 1 | UNVERIFIED |
| 3 | Language requirement | `language_testing` | 1, 2 | UNVERIFIED |
| 4 | University shortlisting and application | `admission_university` | — | UNVERIFIED |
| 5 | Admission decision | `admission_university` | — | UNVERIFIED |
| 6 | Financial proof | `funding_scholarship` | 7 | UNVERIFIED |
| 7 | Visa application preparation | `immigration_visa` | 6 | UNVERIFIED |
| 8 | Embassy appointment and biometrics | `immigration_visa` | — | UNVERIFIED |
| 9 | Visa decision | `immigration_visa` | — | UNVERIFIED |
| 10 | Pre-departure and travel | `travel_departure` | — | UNVERIFIED |

**Edges to determine:** which of the above are genuinely `sequential`, which are
`optional_branch`, whether any are `alternative` (e.g. more than one accepted language
qualification), and where branches `rejoin`. Overlap is expressed by timing, not by position
(Phase 2 schema).

---

## Fields

One row per field. Field categories are the eleven in `src/domain/enums.ts`.

| Step | Field category | Value | Source | Source class | Checked | Status |
|---|---|---|---|---|---|---|
| 1 | `document` | UNVERIFIED | — | — | — | UNVERIFIED |
| 2 | `procedure` | UNVERIFIED | — | — | — | UNVERIFIED |
| 2 | `address` | UNVERIFIED | — | — | — | UNVERIFIED |
| 3 | `requirement` | UNVERIFIED | — | — | — | UNVERIFIED |
| 3 | `address` | UNVERIFIED | — | — | — | UNVERIFIED |
| 4 | `deadline` | UNVERIFIED | — | — | — | UNVERIFIED |
| 4 | `link` | UNVERIFIED | — | — | — | UNVERIFIED |
| 6 | `cost` | UNVERIFIED | — | — | — | UNVERIFIED |
| 7 | `document` | UNVERIFIED | — | — | — | UNVERIFIED |
| 8 | `address` | UNVERIFIED | — | — | — | UNVERIFIED |
| 8 | `contact` | UNVERIFIED | — | — | — | UNVERIFIED |
| 9 | `duration` | UNVERIFIED | — | — | — | UNVERIFIED |

---

## Bangladesh-specific context to capture

These are the things that make this a Bangladesh-origin route rather than a generic guide
(FR-48, §27). Each needs its own researched answer.

- Where a Bangladeshi applicant obtains and attests academic documents, and in what order.
- Whether any authentication or legalisation step applies, and where it physically happens.
- Which language tests are actually available in Bangladesh, where, and how often.
- **Embassy jurisdiction for Bangladesh** — including whether applications are handled in
  Dhaka or in another country. This is exactly the kind of thing a generic guide omits and a
  Bangladeshi applicant cannot afford to discover late.
- Where appointments, biometrics and any medical steps take place.
- Realistic local processing and waiting times, as distinct from the official published ones.

---

## Uncertainty and open questions

*(Recorded as research proceeds. An empty section here after research would itself be
suspicious — real processes always have edges.)*

## Conflicting sources

*(Both sides recorded, with sources. Not resolved by preference.)*

## Requires human confirmation before publishing

*(Every `NEEDS-HUMAN` row, gathered here so the review has one list to work through.)*
