# Change proposal 001 — field applicability

**Status: proposal only. Nothing implemented. Schema unchanged.**
Raised 2026-09-02 from Germany research passes 1 and 2. Follows CLAUDE.md §2 and BR-35: a
materially new concept is a change request, not a quiet schema edit.

---

## The question asked

> Can Route → Step → Field represent both route-wide and programme-specific facts clearly enough
> for a student, **without** introducing a new applicability/scope concept?

## The answer

**Mostly yes — and by more than expected. But not entirely, and the residue is exactly the case
that misleads a student.**

Three existing mechanisms already carry applicability, and it is worth being precise about how much
they cover before proposing anything.

### What Route identity already scopes

`Route` carries origin, destination, study level, intake and mechanism. That makes several
apparently-conditional facts unconditional **on this route**:

| Real-world fact | Conditional on | Collapses because |
|---|---|---|
| GRE required "except EU/EEA citizens" | Applicant nationality | Route origin is BD — every reader is non-EU/EEA |
| Deadline 1 March vs 15 July | Applicant nationality | Same |
| Blocked-account amount | Which German mission | Route origin fixes the mission as Dhaka |
| Winter vs summer deadlines | Intake | `Route.intake` fixes it |

This is a genuinely strong result. The **applicant-status dimension — a seventh level that was not
in the original list — needs no new concept at all**, because the route's own identity determines
it.

### What the graph already scopes

`StepEdge` kinds `alternative` and `rejoin` model a real choice of path. Channel-specific facts
therefore already have a home: a document list that applies only to uni-assist lives on a step
inside the uni-assist branch. Nothing needs to say so; the position says it.

This covers **application-channel** applicability cleanly.

### What steps already scope

Grouping does real work. "Blocked account €11,904" sits on a *financial proof* step in the visa
part of the journey; "GRE ≥75th percentile" sits on a *programme requirements* step. A reader can
already see they belong to different parts of the process.

### What is left, and why it still misleads

Two facts on the same route, both true, both official:

| Field | Value | Survives changing university? |
|---|---|---|
| Financial proof | €11,904 blocked account | **Yes** — every German student visa from Dhaka |
| GRE General Test | Quantitative >75th percentile | **No** — RWTH M.Sc. Data Science only |

Nothing in the model distinguishes them. Both are `official`. Both are on the same route. A student
comparing universities cannot tell which requirement follows them and which does not — and the
consequence is not cosmetic. Someone who abandons a plan because they believe Germany requires GRE
has been misinformed by a page that stated only true things.

The user's illustration was exactly right:

```
Financial proof   €11,904      ← this route, all German universities
IELTS 6.5         ...          ← one university, one programme
GRE               Required     ← one programme
```

Reads as "Germany requires all three."

---

## Why source class does not solve it

`SourceClass` answers **who says this** — official, institutional, community-confirmed, community
submission, disputed.

Applicability answers **who this is true for**.

They are orthogonal, and every combination occurs:

| | Country-wide | Programme-specific |
|---|---|---|
| **official** | Blocked account €11,904 (Embassy Dhaka) | GRE percentiles (RWTH) |
| **community** | "Dhaka appointment slots open around midnight" | "This programme replies in ~3 weeks" |

Both GRE and the blocked account are `official`. Source class cannot separate them, and overloading
it would destroy the distinction it exists to make (FR-54, BR-07, invariant 11).

The same argument rules out `sourceNote`, which describes the source, and `category`, which
describes the kind of information.

---

## Could we avoid the change by splitting routes?

`§40.1` permits routes to coexist where the journey differs materially, and explicitly lists
"institution-specific pathway". So an **RWTH direct-application route** is legitimate — it differs
in channel, portal, deadline and required tests.

That handles institution. It does **not** handle programme: RWTH M.Sc. Data Science and RWTH M.Sc.
Computer Science share the portal, the deadline structure and the visa journey, and differ only in
prerequisites. A route each would be near-duplicates, contradicting §40.1's own warning and making
duplicate-detection and merge (§18.4, FR-40) harder.

Splitting is right for institutions, wrong for programmes.

---

## The smallest concept that closes the gap

**One optional enum column on `Field`.** No new table, no hierarchy, no relations.

```prisma
enum FieldApplicability {
  destination_wide      // true for anyone going to this destination
  origin_and_destination // true for this origin-destination pair (e.g. mission rules)
  application_channel   // true for this channel only
  institution           // true for this university only
  programme             // true for one programme only
}
```

Five values, ordered narrowing. Null means "not yet stated", which is honest for existing rows and
for a contributor who does not know.

### Why `Field`, not `FieldRevision`

`category` is on `Field`, and applicability is the same kind of property: what the information
element *is about*, not what its value currently says. A value can be revised from €11,904 to a new
amount without its applicability changing.

The counter-argument is real: if a contributor mislabels applicability, correcting it should leave a
trace, and only revisions leave traces. But that is equally true of `category` today, and
introducing a second, differently-versioned metadata field would be inconsistent for no gain.
**Recommendation: `Field`, consistent with `category`.** Revisit if mislabelling proves common.

### Why not fewer values

Three (`country`, `institution`, `programme`) would lose the origin-pair distinction — and that is
the one carrying the blocked-account amount, the 27-month queue and the VFS routing, which are the
most valuable facts we have found. Those are not "Germany-wide"; they are Dhaka-specific.

### Why not more

Deliberately no applicant-status value: route identity already fixes it. No free-text scope: an
unbounded field cannot be rendered consistently or filtered.

---

## Impact

| Area | Impact |
|---|---|
| **Schema** | One nullable enum column, one new Postgres enum type. Additive; no data migration; existing rows are null. |
| **Renderer** | **None.** The renderer draws the graph and never reads fields. Invariant 24 is untouched. |
| **Search** | None required. Could later support "show me what is true regardless of university" — not proposed now. |
| **Revision history** | None. The column is on `Field`, not on revisions; existing history is unaffected. |
| **Write engine** | `addField` gains one optional parameter. No change to transactions, locking or the guard. |
| **Seed data** | Improves it: the Germany worksheet already records applicability per row in prose, so seeding would simply carry it into a typed column instead of losing it. |
| **Phase 6 trust UI** | This is where it matters most. Phase 6 renders source class, freshness and maturity. Applicability is the same kind of badge, read at the same moment, and is the difference between "official" meaning *authoritative* and meaning *authoritative for you*. |
| **Phase 8 community editing** | One more optional control on the add-field form. It should be optional — forcing a contributor to classify applicability they are unsure of would produce confident wrong answers. |
| **Enums module** | One more entry in `src/domain/enums.ts`, generated into Prisma automatically. |

### Migration implications

Additive and reversible in practice: a nullable column and a new enum type, no backfill, no
rewriting of history, no `DROP`. It fits the existing migration discipline exactly — rehearse on a
scratch Neon branch, verify, apply to production.

---

## Should it be made before Phase 6?

**Yes — recommended, and this is the main reason to decide now rather than later.**

Phase 6 builds the surface that tells a reader how much to trust a fact: source-class badges,
freshness, maturity, dispute markers. Applicability belongs in exactly that surface and is read in
exactly that moment. Building the trust UI first and adding applicability afterwards means designing
that component twice.

The counter-argument is that Phase 6 could ship without it and the schema change could follow. That
is true, and the cost is one rework of a component that will not yet have much built on it.

**Recommendation:** approve the column before Phase 6 starts, implement it as a small additive
migration, and let Phase 6 render it alongside source class from the beginning.

**If rejected:** the Germany route can still be seeded honestly, but its field values will have to
carry applicability in their own text — "GRE (RWTH M.Sc. Data Science only): quantitative >75th
percentile". That works, is not dishonest, and is what the fixture does today. It is worse in three
ways: it cannot be filtered, it cannot be rendered consistently, and it relies on every future
contributor remembering a convention with nothing enforcing it.
