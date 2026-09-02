# content/ — seed route research

**Status: active from 2026-09-02.** Runs in parallel with engineering and does not belong to
any engineering phase (Phases.md, content track).

This directory holds **research worksheets**, not route data. Nothing here is loaded into any
database by any script. A worksheet becomes a route only after a human has reviewed it and
deliberately seeded it.

---

## Why this exists now

REQUIREMENTS.md §45 lists cold start as the **first** conceptual risk: *"Seed a small number
of high-quality Bangladesh-origin routes before expecting the community to expand coverage."*

Phases.md says the content track runs from Phase 1 because "real route information takes
calendar time to gather and verify, and cannot be compressed at the end." It had not started
by the end of Phase 3. It starts now.

---

## Hard rules

1. **No unreviewed information reaches production.** Worksheets are drafts. Seeding is a
   separate, deliberate, human-reviewed act.
2. **Mockup values are never facts.** Every requirement, fee, duration, score, processing
   time and statistic in `Visual References/` is illustrative and must never be copied here
   (CLAUDE.md §8.6).
3. **Every factual cell carries a source, a source class and a last-checked date.** A cell
   without those is not research, it is a guess. Write `UNVERIFIED` rather than an invented
   value.
4. **Uncertainty is recorded, not smoothed over.** If a procedure is unclear, contradictory
   between sources, or changes by applicant circumstance, that goes in the worksheet as
   uncertainty — it does not get resolved by picking the likelier option.
5. **Community confirmations start at zero and stay at zero.** A well-researched route with
   no confirmations is honest; a fabricated confirmation count is not (Phases.md, content
   track). There is no field for seeding one, by design.
6. **Bangladesh-specific or it does not belong.** Not a generic "study in X" article: where
   a Bangladeshi applicant physically goes, which embassy has jurisdiction, where documents
   are attested, which tests are available locally (FR-48, §27).
7. **We are not an authority.** Nothing seeded from here may claim verification by Vindeshi
   Express (BR-20).

---

## Worksheet status vocabulary

Used in the `Status` column of every worksheet row.

| Status | Meaning |
|---|---|
| `UNVERIFIED` | Not yet researched. The default. Never publishable. |
| `SOURCED` | A source is recorded and the value is copied from it accurately. |
| `NEEDS-HUMAN` | Sourced, but requires a person to confirm — typically because it depends on circumstance, or the source is ambiguous, or it is high-consequence (visa, money, deadlines). |
| `CONFLICTED` | Two credible sources disagree. Both are recorded. Not publishable until resolved. |
| `PUBLISHED` | Reviewed by a human and seeded. Only a person sets this. |

## Source classes

Use the same vocabulary as the product (`src/domain/enums.ts`), so a worksheet maps to fields
without translation:

`official` · `institutional_public` · `community_confirmed` · `community_submission` ·
`disputed_under_review`

For seed content only the first two should appear. Community classes are for what the
community contributes later.

---

## Priority

1. **Germany** — first, and specifically **Bangladesh → Germany → Master's → Direct
   admission**. It is the modelling test case: see `MODELLING-NOTES.md`.
2. Australia
3. USA
4. Malaysia

UK and Canada only if time and reliable sources permit, and after — never instead
(Phases.md, content track).

---

## Files

| File | Purpose |
|---|---|
| `MODELLING-NOTES.md` | Whether the Route → Step → Field model actually holds up against a real route, and any genuine gaps found |
| `routes/bd-de-masters-direct.md` | The first worksheet |
