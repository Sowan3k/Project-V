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

*(Empty until research runs. Each finding: what was found, which question it answers, whether
it is a genuine model gap or a content-shaping problem, and the proposed change if any.)*

| # | Finding | Model gap? | Proposed response |
|---|---|---|---|
| — | — | — | — |

---

## Raising a gap

A genuine model gap is a **change request** against the frozen baseline process
(CLAUDE.md §2, BR-35), not a quiet schema edit. Record it here first, then:

1. Describe the real-world information that has nowhere to live.
2. Say what it would cost to leave it out — is it a nuisance, or does it make a route wrong?
3. Only then propose a schema change, and price it: Phase 2's migration is the shape
   everything else is built on, and it is deliberately expensive to alter.
