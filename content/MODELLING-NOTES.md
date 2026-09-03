# Does Route → Step → Field survive contact with a real route?

The Bangladesh → Germany → Master's → Direct admission worksheet is the **first test of the
information model**, not just the first piece of content. The model was designed from the
requirements baseline and proved against synthetic fixtures in Phases 1–4. It has never met a
real end-to-end study route.

**If real research exposes a genuine gap, record it here and raise it. Do not force the
information into the existing structure.** A field that has to be squeezed in as free text
because there is nowhere for it is a modelling failure that will be much more expensive after
seed content exists.

---

## What the model currently offers

| Level | Carries |
|---|---|
| `Route` | Identity: origin, destination, study level, intake, mechanism, lifecycle |
| `Step` | A stage, with a category, and timing (`earliestStartOffsetDays`, `typicalDurationDays`, `hardDeadline`) |
| `StepEdge` | Ordering and branching: `sequential`, `optional_branch`, `alternative`, `rejoin` |
| `Field` | One information element: 11 categories, source class, typed value (text, amount + currency, date, duration), freshness, effective dates |

---

## Questions this route is meant to answer

Each is a real risk, not a formality. A "no" is a finding.

1. **Do the eleven field categories cover a real route?** Or is something being pushed into
   `procedure` because nothing better exists?
2. **Does a step map cleanly to a real stage?** Or does a stage like "degree recognition"
   turn out to be several independent processes that happen to share a name?
3. **Do the four edge kinds express the real dependencies?** In particular: is there a
   dependency that is neither "must happen before" nor "optional" — for example, something
   that can start early but cannot *finish* until something else completes?
4. **Does timing-as-offset-and-duration work** when a real step depends on an external
   appointment date the applicant does not control?
5. **Is a "field" the right granularity** for something like a document checklist with a dozen
   items, each with its own source and issuing office?
6. **Can conditional requirements be expressed?** A rule that applies only to some applicants
   — by degree type, university, or nationality — has no obvious home right now.
7. **Where does an intake actually live?** It is currently one string on `Route`. Germany has
   winter and summer intakes with different deadlines and possibly different steps. Is that
   one route or two?

---

## Findings

From research pass 1, 2026-09-02 (see `routes/bd-de-masters-direct.md`). One genuine model gap,
four findings the model already handles, and one content-discipline finding.

| # | Finding | Model gap? | Proposed response |
|---|---|---|---|
| 1 | **A field cannot say whether it is Germany-wide or programme-specific.** The blocked-account amount applies to every applicant; a programme's language requirement or GRE demand applies to one programme. Both are `Field` rows on a `Step` today, indistinguishable. | **Yes — genuine gap.** | See below. Raised for review, not fixed. |
| 2 | **The same real-world thing has two official values that are both true.** Embassy Dhaka states processing is "approx. 4 weeks" *and* that "current waiting times exceed 27 months". | No — the model handles it. | Two `duration` fields, not one averaged value. The gap between them is the most useful thing on the route and must not be smoothed away. |
| 3 | **Visa language proof and programme admission language requirement are different facts.** The Embassy sets one, the university the other. | No. | Separate steps, separate fields. A naive seed would conflate them; the model does not force that. |
| 4 | **Nationality-specific programme rules exist.** At least one programme requires GRE from Bangladeshi applicants and APS from Vietnamese ones. | Related to gap 1. | Same response. |
| 5 | **Post-arrival formalities may be out of scope.** Anmeldung, residence permit and insurance activation are real parts of the journey, but CLAUDE.md §10 ends V1 at departure and the expected fly window. | No — a scope question, not a model gap. | Decide deliberately. Do not expand V1 silently. |
| 6 | **APS was in the mockups and is not real for Bangladesh.** | No — a content-discipline finding. | Already covered by CLAUDE.md §8.6. Recorded because it is the first time that rule caught something real. |

---

## Gap 1, stated properly for review

**What has nowhere to live:** whether a field is true of the destination country, of the
application channel, or only of one programme.

**Why it matters.** "Blocked account: €11,904" is true for every Bangladeshi applicant to Germany.
"GRE required" is true for one programme. Rendered side by side with no distinction, a reader
cannot tell which facts follow them to a different university. That is not cosmetic: it is the
difference between a route that informs and one that misleads.

**Why the obvious answers are not obviously right:**

- *Make a route per programme.* Honest, but produces hundreds of near-duplicate routes and
  contradicts §40.1 — routes should differ only where the real journey materially differs. It also
  makes the duplicate-and-merge problem worse (§18.4).
- *Add a scope column to `Field`.* Cheap and expressive, but Phase 2's migration is the shape
  everything is built on, and CLAUDE.md is explicit that a schema change is a change request
  (§2, BR-35), not a convenience.
- *Model programme variation as branches.* The graph already supports alternatives that rejoin, so
  "apply via uni-assist" versus "apply direct" fits naturally. Whether a *field* variation fits the
  same mechanism is less clear.

**Cost of leaving it out:** a Bangladesh → Germany route can still be published and would still be
useful, because the country-level facts — financial proof, visa procedure, the 27-month queue,
uni-assist's document list — are the ones that are hardest to find and most often wrong elsewhere.
The gap bites when a route tries to cover several programmes at once.

**Recommendation:** do not change the schema yet. Seed one route whose scope is explicitly
country-and-channel level, see whether the gap actually hurts in practice, and raise it as a formal
change request if it does. Deciding this from one worksheet would be deciding it too early.

---

## Raising a gap

A genuine model gap is a **change request** against the frozen baseline process
(CLAUDE.md §2, BR-35), not a quiet schema edit. Record it here first, then:

1. Describe the real-world information that has nowhere to live.
2. Say what it would cost to leave it out — is it a nuisance, or does it make a route wrong?
3. Only then propose a schema change, and price it: Phase 2's migration is the shape
   everything else is built on, and it is deliberately expensive to alter.


---

## 7. `application_channel` has a real instance now (2026-09-03)

Amendment 001 added `application_channel` to `FieldApplicability` on the strength of a
hypothesis. Research pass 2 found no example of it — every scoped fact was programme-,
institution- or intake-specific — which left one sixth of the enum unvalidated by data.

Research pass 3 found one, and it is a good one: **the uni-assist handling fee of €75 for the
first course plus €30 for each additional course in the same semester is true if you apply
through uni-assist and false if you do not.** RWTH's M.Sc. Data Science uses its own portal, so
a student on that route pays it zero times, while a student applying to three uni-assist
universities pays €135 for the same intake.

Shown without its scope, "application fee €75" is wrong for the first student and misleading
for the second. The dimension earns its place.

**Five of six applicability values now have verified instances** from Bangladesh → Germany:
`route_wide`, `origin_specific` (blocked account, mission procedure), `institution` and
`programme` (RWTH GRE, prerequisites), `intake` (the 1 March deadline), and now
`application_channel`. None has yet turned out to be unnecessary.

## 8. A scope correction: insurance is a departure-stage requirement

The Germany worksheet grouped health insurance with "post-arrival formalities" and asked
whether those fall outside V1, since CLAUDE.md §10 ends the first release at departure and the
expected fly window.

The grouping was wrong. The German Embassy Dhaka checklist requires **travel health insurance
at the visa application** — "valid on arrival in Germany to the date of enrolment at the
University (minimum 3 months)". That is before departure and squarely inside V1.

The statutory German health insurance a student enrols in *after* arriving is a different
requirement at a different stage, and that one does sit outside V1.

**The general lesson for the content model:** a word like "insurance" is not a step. The same
word covers two requirements with different owners, different timing and different scope, and
only one of them is ours. Grouping by topic rather than by stage would have put a post-arrival
task in front of a student who needed the pre-departure one.
