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

---

## Findings from five real routes — 2026-09-07

Five owner-supplied Bangladesh-origin Master's routes (Malaysia, UK, Japan, Germany, Austria)
loaded to the disposable branch by `scripts/fixtures/launch-candidates.ts`. **89 steps, 5 routes,
no fact changed to fit the schema** — where something did not fit, it is written below instead.

**What held.** The graph model took all five without strain. Every structural case the owner
asked for renders and is labelled by the ordinary renderer, with no route-specific code:

| Route | Structure | Renders as |
|---|---|---|
| Malaysia | institution-managed vs permitted self-submission to EMGS | *Choose one pathway* + *Parallel work* |
| UK | parallel CAS / funds / TB, with ATAS optional | *Parallel work* + *Optional branch* |
| Japan | supervisor-first vs direct application; exam/interview optional | *Choose one pathway* + *Optional branch* |
| Germany | three application channels — direct / uni-assist forward / VPD | *Choose one pathway* + *Parallel work* |
| Austria | entrance-exam vs normal admission; Residence Permit **before** Visa D | *Choose one pathway* + *Parallel work* |

Austria is the strongest evidence: its permit-before-visa ordering is expressed purely as edges,
and nothing in the renderer knows Austria exists (invariant 24).

---

### 1. There is nowhere to record how well a fact has been checked

`content/README.md` defines a research-status vocabulary — `SOURCED`, `NEEDS-HUMAN`,
`UNVERIFIED`, `CONFLICTED` — and **the product has no column for it.** `SourceClass` answers a
different question: *who asserts this*, not *how well has it been checked*.

Carried in `sourceNote` free text as a workaround, which means it is not queryable, not
renderable as a signal, and cannot be filtered or counted. **A field where two credible sources
disagree currently looks identical to one that is fully sourced.**

This matters most for `CONFLICTED`. §7.3's whole weight system is about a signal earning
prominence by changing what a reader should do, and "two official sources disagree" is exactly
such a signal — it is currently invisible.

*Not a blocker for these five: none of them is CONFLICTED. It becomes one the first time a
worksheet is.*

### 2. Step categories stop at the airport, and three of five routes do not

The six `STEP_CATEGORIES` end at `travel_departure`. But:

- **Malaysia:** post-arrival medical screening at an EMGS panel clinic **within 7 working days**
  of arrival — without it, Student Pass endorsement cannot proceed.
- **Japan:** register your address at the municipal office **within 14 days**.
- **Austria:** register your address **within three working days**, then collect the permit.

All three are currently `travel_departure`, which is the closest available and is wrong: they
happen *after* arrival, they carry hard deadlines, and a student who reads the route as ending
at the aeroplane misses them. The category colour reinforces the error — they paint as travel.

**This is the clearest modelling gap the five routes found.** A seventh category —
`arrival_settling`, or similar — would be a schema change and a change request (BR-35), so it is
recorded rather than made.

### 3. A step's duration is one number, and some real durations are bimodal

`typicalDurationDays` is a single value. Japan's visa decision is *"about 7 working days where
documents are complete; incomplete or complex cases can take longer, potentially substantially
longer"* — one number cannot say that, and the number is the one the road draws.

Handled by putting the real statement in a `duration` **field** and the optimistic figure on the
step. It works, but **the road shows the optimistic number** and the qualification is one click
away inside the step. For a route whose whole value is honest timing, that is worth revisiting.

Germany's case was handled better and shows the pattern that works: the 27-month queue and the
4-week processing minimum are **two separate steps**, because they are two separate waits. That
is the right modelling and it needed no schema change.

### 4. A severe, current, route-level disruption has nowhere prominent to live

Germany's *"waiting time is already MORE THAN 27 MONTHS and largely unpredictable"* is the single
most decision-changing fact in all five routes. Today it is a `warning` field on step 14.

- The **route passport** speaks only to maturity — experimental, unconfirmed, one contributor.
  A student scanning search results sees nothing about a 27-month wait.
- **`TemporaryDisruption`** exists and is the right *shape* (date-scoped, expires without
  rewriting the route) but the wrong *claim*: this is not temporary, and filing it there would
  say something false about it.
- So the fact is truthful, correctly sourced, and **two clicks below the fold**.

A student choosing between these five routes on the search page is making exactly the decision
this fact should inform, and the ribbon cannot tell them.

*This is a product gap rather than a schema gap — the data is right, the surfacing is not.*

### 5. Real step labels are longer than fixture labels, and truncate

*"uni-assist evaluates and forwards your application"* and *"Check which application channel your
university uses"* both truncate on the road at 1440px — `uni-assist evaluates and forwards your
appl…`. Every fixture label written by hand so far has been two or three words.

The full label is in the station's `<title>`, so assistive technology gets it; a sighted reader
gets an ellipsis. Not a defect in the renderer, but a real consequence of real content that no
fixture had surfaced.

### 6. What did *not* need changing

- **`origin_specific` carried every Bangladesh-specific fact cleanly** — the Malaysian visa
  requirement, the UK TB list, Japan's VFS routing, Germany's CSP registration, Austria's New
  Delhi jurisdiction. FR-81's applicability set did its job.
- **"visa-stage-specific" needs no new applicability value.** A field lives on a step, so
  visa-stage scoping is already structural. Recorded so nobody adds one.
- **Official and community never blurred.** Every community report is a
  `community_experience` field with `community_submission` provenance, phrased as *"A student
  reported…"*, and the field-group headings put them in a separate labelled region from
  government facts (FR-54, invariant 11).
