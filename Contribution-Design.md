# Contribution UX and contributor incentives — a design proposal

**Status: proposal. Nothing here is built. 2026-09-07.**

A design for how Vindeshi Express gets real students, applicants and alumni to keep a public
record of study-abroad journeys accurate — and why they would bother.

> **The one-sentence finding.** Vindeshi Express already has most of a serious contribution
> system and does not know it. What it lacks is not mechanism — the revision ledger, provenance,
> applicability, challenges, confirmations and dated claims are all built — but **an answer to
> "why me, why now, and what do I get."** The largest single lever is a thing no comparable
> platform can do: **this product knows exactly who is standing in the visa queue this week, and
> which step they just finished.**

---

## 1. Current-state analysis

### 1.1 What contribution functionality already exists

Four actions, all live, all writing through one service (`src/server/revisions/service.ts`):

| Action | Entry point | What it writes |
|---|---|---|
| **ADD** | `AddFieldForm`, `AddStepForm` in `src/components/contribute.tsx` | A new `Field` / `Step` and its first revision |
| **UPDATE** | `reviseField`, `reviseStep`, `reviseRoute` | A **new revision**; the previous value stays readable |
| **CONFIRM** | `FieldActions`, and `confirmStepFields` after a journey step is completed | A `Confirmation` row, unique per (field, person) |
| **CHALLENGE** | `FieldActions` → `challengeField` | A `Challenge` with a reason from a fixed vocabulary and an optional note |

Plus **REPORT** (`src/server/safety/service.ts`), which is deliberately a different thing:
*challenge* means "this may be wrong", *report* means "this may be dangerous".

**Already built and directly reusable — this is the part that matters:**

- **`confirmStepFields`** (`service.ts:761`) confirms every live field in a step at once, and it
  is already wired to the moment a follower marks a step complete
  (`journey/page.tsx:410`, `journey/actions.ts:140`). This is FR-42's "contribute at the moment
  of fresh knowledge" and it is **the seed of the entire incentive design in Part 5.**
- **`ContributorHistory`** (`src/server/contributors/read.ts`) already returns
  `contributionCount`, **`confirmedContributionCount`**, `confirmationsGiven`,
  `challengesRaised`, `firstContributionAt`. The second of those — *how much of your work other
  people have since confirmed* — is a working usefulness signal, and it already refuses to be a
  score.
- **`distinctReporters` + `firstReportedAt`/`lastReportedAt`** (`safety/service.ts:281`) already
  computes burst shape: twelve reports in four minutes from one cluster reads differently from
  twelve over a month. That primitive generalises to every signal in Part 6.

### 1.2 Relevant data models

`FieldRevision` (`prisma/schema/route.prisma:361`) is unusually well-equipped for this problem
and is the reason little new schema is needed:

```
valueText                     always present
valueAmount / valueCurrency   typed money
valueDate / valueDurationDays typed time — so fly windows are computed, not parsed from prose
applicability[]               FR-81: route_wide | origin_specific | application_channel |
                              institution | programme | intake  — a SET, not one value
sourceClass                   official | institutional_public | community_confirmed |
                              community_submission | disputed_under_review
sourceUrl / sourceNote        a link, or a named office
effectiveFrom / expiresAt     when the rule starts and stops being true
authorId / reason             who, and why they changed it
previousRevisionId            a chain that may FORK — two people revising the same parent
```

`Confirmation` — `@@unique([fieldId, authorId])`. One per person per field, no un-confirm.

`Challenge` — carries a `reason` enum and resolves via **`resolvedByRevisionId`**. Note what
that encodes: *a challenge is answered by a revision, never by a moderator*, and a confirmation
explicitly **cannot** clear one. There is no approval queue anywhere in the schema.

`Route` → `Step` → `Field`, with `StepEdge` making the road a graph rather than a list.
`Journey` → `JourneyStepProgress` (status, target date, actual date, private note) and
`JourneyTask`. `RouteChange` + `RouteChangeRevision` announce a change and point at exact
revision rows. `TemporaryDisruption` is date- and location-scoped and expires without editing
the route.

### 1.3 Identity and authentication

Auth.js with Google, **database sessions** (`src/server/auth/config.ts:149`). The adapter is
deliberately narrowed: `createUser` stores an email and nothing else; `linkAccount` writes four
columns and **no OAuth tokens**. There is no `name` and no `image` column, by design.

**Every contributor is a generated pseudonym** — `generateHandle()`, never derived from the
Google profile (§24.3). The email never reaches the session (`email: ''`).

This shapes the incentive design more than anything else: **recognition cannot be social.** There
are no faces, no real names, no follower graph. Whatever reward exists has to attach to a
pseudonymous handle and to the work itself.

Roles: `member` and `admin`, and admin is a **safety** role only (§23.3) — quarantine and reports.
It gates nothing editorial. There is no reviewer role and nothing for one to do.

### 1.4 UI patterns available for reuse

`src/components/ui.tsx` — `Disclosure` (progressive disclosure, CSS-only), `FormField`,
`FormFieldset`, `inputClass`, `ChoiceGrid` (native radio + `has-checked:`), `NumberedFlow`,
`GuidanceList`, `FactList`, `Chip`, `Callout`/`Caution`, `TabNav`, `Breadcrumb`, `EmptyState`.

`src/components/trust.tsx` — the §7.3 three-weight system (caution / context / nothing) and the
route passport. `src/components/step-fields.tsx` — fields **grouped by provenance**, so the
official/community separation is positional rather than a chip you have to read.

**Contribution forms are already server-rendered `<form action={serverAction}>` with no client
JavaScript.** That is a hard constraint and an asset: a contributor on a slow phone in Dhaka can
correct a deadline.

### 1.5 Architectural constraints the design must respect

These are not preferences; they are enforced by ESLint, a Prisma client extension, Postgres
triggers, and ~919 tests.

1. **Nothing shared is ever hard-deleted** (invariant 1). No design may resolve a dispute by
   removing a claim.
2. **Every update writes a revision** (invariant 2). Revision rows refuse UPDATE and DELETE at
   the database.
3. **Creators do not own routes** (invariant 3). No design may give a contributor rights over
   what they wrote.
4. **Community experience never overwrites an official requirement** (invariant 11) — they are
   different claim types and never share a field.
5. **Raw counts never automatically decide trust** (invariant 14). No score may gate, rank,
   promote or hide anything.
6. **Conflict is shown, not hidden** (invariant 15).
7. **No approval gate.** §8.6 lists "Update goes live when confirmed by the community" as a
   mockup exception: *do not build an approval queue.* Updates are visible; the community
   corrects afterwards.
8. **No competitive points game** (§25) — enforced by a vocabulary guard that fails the build.
9. **The read path ships no required JavaScript.**
10. **FR-80** — a materially new feature is a requirements change, raised not assumed.

Constraint 7 is the one that most distinguishes this from every "submit → moderator approves"
design, and Part 7 works within it rather than around it.

---

## 2. Contribution UX architecture

### 2.1 The organising idea: contribution is a by-product of using the product

The generic answer is a "Contribute" section. That is where contribution goes to die: it asks
somebody to arrive with the intention of editing, which almost nobody has.

**Vindeshi Express has something better and should lean on it entirely.** A private journey knows:

- which route you are following,
- which step you are on,
- **which step you just marked complete, and on what date**,
- which fields that step contains, and when each was last confirmed.

That is a targeted, timed, high-signal prompt no encyclopaedia can produce. Wikipedia cannot know
who filed a German student visa last Tuesday. **This product does.**

So the architecture is: **three entry points that already have context, and one that does not.**

| Entry point | When | Why it works |
|---|---|---|
| **1. After a journey step is completed** *(exists, under-used)* | The follower marks "Submit documents at VFS" done on 12 March | They have just done the thing. The prompt can name the exact fields and ask a closed question. **Highest signal per unit of friction in the entire product.** |
| **2. Beside the claim itself** *(exists)* | Reading a field that looks wrong | Zero navigation, and the contribution arrives already attached to its subject |
| **3. From the change/updates surface** *(Phase 14)* | "This changed and it does not match what I was told" | The reader is already in a comparing frame of mind |
| **4. Route missing entirely** *(exists)* | Search returns nothing | The only case where a blank-page contribution is right |

**A dedicated "Contribute" hub should not be built.** It would be a fifth door into the same four
actions, with less context than any of them, and §8.6 already notes that nav items pointing at
sections which do not exist are worse than absent ones. What *should* exist is Phase 15's
"reaching what needs help" — a route saying *these three fields need review* — which is a
worklist, not a hub.

### 2.2 The asymmetry that makes this cheap

Not all contributions cost the same:

```
CONFIRM         one tap, no typing         ~90% of contributions should be this
CHALLENGE       one tap + a reason          the "something is wrong" signal, no expertise needed
EXPERIENCE      a short dated observation   what only the person who was there can give
UPDATE          a new value + a source      the expensive one, and the rarest
ADD             a whole new field or step   rarest of all
```

The design goal is to make the cheap ones nearly free and to **route people into the cheapest
action that captures what they know.** Somebody who noticed a fee was wrong should not be forced
into an UPDATE form asking for the correct fee — they may not know it. A CHALLENGE with reason
`incorrect` captures the whole of what they have.

---

## 3. Contribution types — what should and should not exist

### Should exist

| Type | Status | Notes |
|---|---|---|
| **Confirm still accurate** | exists | The volume action. One tap. |
| **Challenge** (obsolete / incorrect / broken link / wrong contact / duplicate / unsafe) | exists | Reason vocabulary already matches the baseline |
| **Update a value** | exists | Writes a revision; prior value preserved |
| **Add a field / step / route** | exists | |
| **Report** (danger, not error) | exists | Kept separate — different consequence, different queue |
| **Share a dated experience** | **partly — needs work** | `community_experience` is a field category and `community_submission` a source class, but nothing captures *when you were there*. See §3.1. |
| **Narrow the scope of a claim** | **new, and the most valuable addition** | "This is true for TU Munich, not for Germany." Uses `applicability` — see Part 3. |
| **Attach a source to an existing claim** | **new, cheap** | Somebody who cannot fix a claim can still evidence it. Writes a revision that changes only `sourceUrl`/`sourceClass`. |

### Should NOT exist

- **Free-text discussion / comments on a claim.** VR-14 draws "2 comments" on a challenge. A
  challenge carries a reason and is answered by a revision; a thread turns a knowledge base into
  a forum and §33 excludes operating as a social feed.
- **Voting on which version is right.** Invariant 14, and see Part 3 — the answer to disagreement
  here is scoping and evidence, not a poll.
- **An approval queue.** §8.6, explicitly.
- **Direct edit of another person's experience.** An experience is an observation by a named
  pseudonym on a date; correcting it is not possible, only contradicting it with another.
- **Upvotes / downvotes on contributors.** §25.

### 3.1 The missing primitive: the dated observation

Today a community experience is text with a source class. It should carry **when the contributor
encountered it**, and that single field does an enormous amount of work:

- it separates "I was told this in January 2026" from "someone says"
- it makes two conflicting reports **resolvable by date** rather than by argument
- it is the backbone of the anti-AI strategy in Part 6
- it is checkable against other people's dated observations

`FieldRevision.effectiveFrom` almost carries this but means something else — when the *rule*
starts applying, not when the *person* saw it. This needs one new column (Part 14).

---

## 4. The contribution form

### 4.1 Principle: ask only what the person is standing in front of

Context the form already knows and must never ask for: route, step, field, contributor identity,
timestamp. VR-08's mockup asks for route/step/field context in the form; that is wasted typing.

### 4.2 The confirm prompt (the volume path)

After marking a step complete. **No form at all.**

```
┌─────────────────────────────────────────────────────────────┐
│  You marked "Submit documents and biometrics at VFS" done.  │
│  You were there on 12 March 2026.                           │
│                                                             │
│  Was what this step says still accurate?                    │
│                                                             │
│  [ Yes, all of it ]   [ Something was different ]   [ Skip ]│
└─────────────────────────────────────────────────────────────┘
```

- **Yes** → `confirmStepFields`. One click, N confirmations, done. *This already exists.*
- **Skip** → nothing, and never asked again for that step.
- **Something was different** → the three fields of that step, each with the same three buttons.
  Still no typing unless they choose to.

The date is taken from `JourneyStepProgress.actualDate`, which they already entered. **They are
never asked a question the product can answer itself.**

### 4.3 "Something was different" on one field

```
  Field:  "Appointment wait currently exceeds 27 months"
          Official · German Embassy Dhaka · checked 2026-09-07

  What was different?
  ( ) It is out of date          → challenge, reason: obsolete
  ( ) It was wrong               → challenge, reason: incorrect
  ( ) It was right for me, but only because…   → applicability narrowing
  ( ) I know the correct value   → update

  ┌──────────────────────────────────────────────┐
  │ (optional) What were you told?               │
  └──────────────────────────────────────────────┘
                                    [ Send this ]
```

Three of the four branches need **no further form**. Only the fourth opens the update fields.

### 4.4 The update form — the expensive path, kept short

```
  Current   "Appointment wait currently exceeds 27 months"
  New       [                                            ]

  Where does this come from?
  ( ) An official source     → sourceClass: official        [ URL or office name ]
  ( ) A university/institution page → institutional_public  [ URL ]
  ( ) My own experience      → community_submission         [ when: __/__/____ ]

  Does this apply to the whole route?
  [x] The whole route
  [ ] Only this university   [ ] Only this programme
  [ ] Only this intake       [ ] Only this application channel

  (optional) Anything a reader should know    [                    ]
                                                        [ Publish ]
```

Five questions, three of which are one click. Note what is **not** asked: route/step/field
(known), who you are (known), today's date (known), how confident you are (a self-assessed
confidence score is exactly the invented precision §7.3 forbids).

**"Publish", not "Submit for review"** — there is no review, and the button must not imply one.

---

## 5. Evidence, provenance and conflict

### 5.1 The three classes, and what each means on screen

`sourceClass` already has five values. They map to §7.3's three weights:

| Class | Means | Rendered as |
|---|---|---|
| `official` | A government, embassy or immigration authority says so | Grouped under *From official and institutional sources*, with source and checked date. **No badge** — this is the ordinary case. |
| `institutional_public` | A university's own published page | Same group, source named |
| `community_confirmed` | A community claim several independent people have since confirmed | Community group, with the confirmation count stated |
| `community_submission` | One person's report | Community group, **with a caution**: "not corroborated by anyone else" |
| `disputed_under_review` | Contested | Caution, and shown *as* contested (invariant 15) |

This is built and working — the step-fields screenshot in the README shows exactly it.

### 5.2 The key insight: most conflicts are not conflicts

**The single most valuable idea in this proposal.** Two claims that contradict each other are
very often both true at different scopes:

> *"The application fee is €75."*  ·  *"I paid nothing."*

Not a contradiction: one is `institution`-specific, the other applies to a different university.

> *"The wait is 27 months."*  ·  *"I got an appointment in 6 weeks."*

Not a contradiction: one is for regular applicants, the other for scholarship holders —
`application_channel`.

`FieldApplicability` already exists as a **set** on the revision, precisely because a claim can
vary along more than one dimension (FR-81, D-47). So the first move on any disagreement should
not be "who is right" but **"do these two claims have the same scope?"**

That reframing is the honest answer to *"do not solve disagreement by deleting one side"* — and
it produces better information than either side had, because the result names the condition under
which each is true.

### 5.3 When they genuinely conflict

Both claims stay. The field renders as contested, and the display is ordered by **evidence, then
recency**, never by vote count or contributor standing:

```
  ⚠ This information is contested

  Official · German Embassy Dhaka · effective from 2026-06-04
    "Waiting time exceeds 27 months for regular applicants"
    Confirmed by 4 people since June

  Community · reported by three people, most recently 2026-08-30
    "Scholarship holders are being seen in 4–8 weeks"
    Applies to: application channel

  These do not necessarily disagree — the second names a narrower group.
  [ I have information about this ]
```

The revision chain already **forks** when two people revise the same parent (`previousRevisionId`
is non-unique, deliberately — FR-70, invariant 15). A fork *is* the conflict, recorded.

### 5.4 Outdated information

Never deleted. Three mechanisms, all existing:

1. **`expiresAt`** on a revision — a stored date, so nothing has to invent a staleness threshold
   (§11 leaves those open on purpose).
2. **Superseded by a new revision** — the old value stays readable in history.
3. **Challenged as `obsolete`** — visible as contested until a revision answers it.

### 5.5 Does any of this need moderation?

**Almost none of it.** See Part 7 — the only thing requiring a human is danger, not error.

---

## 6. Contributor reputation

### 6.1 What the codebase already decided

`src/server/contributors/read.ts` returns evidence and refuses to compute a score, citing §25
("reward useful contributions rather than raw volume") and §11 (labels and weights are an open
decision). **That refusal is right and should survive.**

### 6.2 The signal that already exists and does the work

**`confirmedContributionCount` — how much of your work other people have since confirmed.**

This is spam-proof by construction. Ten thousand trivial edits that nobody confirms move it by
zero. It cannot be self-dealt: `Confirmation` is `@@unique([fieldId, authorId])`, so you can
confirm a field once, and confirming your own contribution should be refused outright (Part 6,
anti-gaming).

### 6.3 The proposed model: standing is a description, never a number

Four **facts**, each countable and checkable, shown on the contributor page and nowhere else:

| Signal | Why it resists gaming |
|---|---|
| **Contributions others later confirmed** | Requires independent people to agree; volume alone does nothing |
| **Contributions that survived** (not superseded or successfully challenged within N days) | Rewards being right, not being first |
| **Challenges that led to a change** | Rewards noticing real problems; a wrong challenge is answered by a revision that keeps the old value, and simply does not count |
| **Where they contribute** — destination and step category | Derivable from the routes they have touched; produces "has contributed to German visa steps" without any self-declaration |

**Deliberately not counted:** total edits, days active, streaks, confirmations *given* (cheap and
farmable), or anything that could be arranged into a ranking.

### 6.4 Expressed as words, not tiers

```
    kestrel-114
    Contributing since March 2026
    Has worked on German and Austrian visa steps
    31 contributions · 24 later confirmed by other people
    Raised 6 challenges; 5 led to a correction
```

Not "Level 4". Not "Gold". A reader weighs it. Per §11 the *labels* remain an open decision —
this proposal deliberately proposes no label vocabulary and recommends shipping without one.

**Constraint that must hold: reputation gates nothing.** No trusted-user fast path, no
auto-approval, no weighting of one person's challenge over another's. Invariant 14 and FR-71.
Standing is information for readers, not authority in the system.

---

## 7. Incentives — why a real student contributes

This is the part where generic answers fail hardest, so start from who this person actually is.

**They are a student who has just been through something difficult, alone, using bad information.**
They are not a hobbyist encyclopaedist. They will not return out of duty. The window in which they
care is short — weeks after they fly, at most.

### 7.1 The four honest reasons, in order of strength

**1. It costs almost nothing at the exact moment they are already here.**

The strongest incentive is not a reward, it is the **absence of friction**. Someone who has just
marked "Submitted at VFS" complete is already in the product, already thinking about that step,
and one tap away from confirming three fields. The cheapest contribution is the one they were
almost making anyway.

*This is why Part 2 puts the journey prompt first and why it deserves more design attention than
anything else in this document.*

**2. It makes their own journey better, immediately and visibly.**

Utility, not altruism. Two mechanisms available now:

- **Confirming a step updates its freshness for them too.** Their own route stops warning them
  about information they have personally verified. The caution disappears because they cleared it.
- **A challenge they raise appears on their own route** as an open question, and when it is
  answered they see the correction. The loop closes where they can see it.

**3. Somebody comes after them, and they know exactly who.**

The product's own line — *people ahead on the journey leave the route clearer for the people
coming behind them* — is not sentimental here, it is concrete and demonstrable:

> *"14 people are following this route and have not reached this step yet."*

A real number, from `Journey` rows, of people who will hit the thing you just learned. **No other
platform can say this**, because no other platform knows who is partway along. This is the single
most motivating sentence available, and it is one query.

**4. Credit that survives.** Attribution on every revision, permanently, to a handle that is
theirs. Given the pseudonymity constraint this is quieter than a social product's reward — but it
is durable and it is honest.

### 7.2 What to build now, at zero budget

| Incentive | Cost | Why it works |
|---|---|---|
| **The journey-completion prompt, properly designed** | Small — the mechanism exists | Highest-signal moment in the product |
| **"N people are following this route and have not reached this step"** shown at the moment of contributing | One query | Makes the abstract beneficiary concrete |
| **Freshness clears for the contributor** | Exists | Immediate, visible, self-interested benefit |
| **Contributor page with the four facts** | Small | Durable credit, no ranking |
| **"This route is now clearer because of you"** after a confirmation — naming the fields | Copy only | Closes the loop; costs nothing |
| **A route's contributors named on the route** | Exists as counts | Recognition where it is earned |

### 7.3 What becomes possible later, and what to refuse

**Later, with users (Phase 2):**
- **Destination or step maintainers** — §35 lists volunteer maintainers as a future possibility.
  Real status, real usefulness, no points.
- **A contribution record a person can point at** — a stable public URL showing what they
  maintained. For a student applying for a scholarship or a job, that is a genuine artifact.

**Later, with partners (Phase 3):**
- **Certificates of contribution** — plausible, cheap, and meaningful in a Bangladeshi academic
  context. Requires the brand to be real first.
- **University or alumni-association partnerships.**

**Refuse permanently, and the codebase already refuses them:**
- Points, leaderboards, streaks, tiers (§25, and a build-failing guard)
- Paid contributions or any money-for-standing (invariant 13 — there is no supporter flag for
  anything to read)
- Anything that makes contributing *feel* like a game rather than like leaving a note for the
  next person

**One realistic warning about "unlock functionality by contributing":** it conflicts with FR-01
and D-03 — search, routes, steps, fields, sources and history are readable with no account at
all, deliberately. Gating any *reading* behind contribution would break the product's central
promise. The only defensible "unlock" is the one already true: contributing improves the accuracy
of the route you are personally following.

---

## 8. Anti-gaming and abuse

Assume popularity. The threat model, and lightweight answers.

| Attack | Answer | Cost |
|---|---|---|
| **Spam volume** | Nothing counts volume. `confirmedContributionCount` requires other people. Standing gates nothing anyway. | Free — already true |
| **Self-confirmation** | Refuse a confirmation whose author wrote the revision. One check. | Trivial |
| **Coordinated confirmation** (a group vouching for each other) | Reuse the `distinctReporters` + burst-shape primitive from `safety/service.ts`: count *distinct* authors and look at the time distribution. Twelve confirmations in four minutes is not twelve confirmations. **Never auto-punish** — surface it. | Small |
| **Fake experiences** | Dated, scoped observations are checkable against each other. A lone dated claim stays `community_submission` with an explicit "not corroborated" caution — which is already what the UI says. | Free |
| **Copying official text wholesale** | Not an attack — it is often correct. It carries a source or it does not. | n/a |
| **Manipulating a requirement to harm** (e.g. inserting a fake document requirement) | This is a **safety** matter, not a quality one: report → quarantine → admin. That path exists. | Exists |
| **Fake sources** | `sourceUrl` shows its real host before the reader leaves (invariant 10, FR-64). Shortened or obscured URLs are never `trusted` (FR-65). A source that cannot be reached is a challengeable claim. | Exists |
| **Trivial repeated edits** | Every edit writes a revision, so a churner is visible in the history rather than hidden. Nothing rewards it. | Free |

### 8.1 AI-generated low-quality contributions — the strategy

**Do not attempt detection.** It does not work and it will misfire on non-native English writers,
which on this platform is most contributors — a false positive there is worse than the problem.

Three workflow mechanisms instead, all evidence-shaped:

**1. Ask for what a model cannot have: a specific, dated, first-person encounter.**
Not "describe the process" but *when were you there, which office, which channel, what were you
told*. A model produces fluent plausible generalities; it cannot produce a checkable particular.
The form should therefore prefer **narrow closed questions over open text boxes** — which it does
anyway, for friction reasons. The two goals coincide.

**2. Make the cheap actions the useful ones.** If ~90% of contribution is CONFIRM, there is very
little surface for generated prose to enter at all. Generated text is a threat to essay-shaped
contributions; this product mostly does not have those.

**3. Corroboration over assertion.** A single uncorroborated claim never becomes
`community_confirmed` no matter how well written. It sits as `community_submission` with a
caution. **Fluency buys nothing** — only independent dated agreement moves a claim, and that
requires other people who were actually there.

The honest residual risk: a determined actor generating many plausible dated observations across
many accounts. That is a sockpuppet problem, not an AI problem, and the answer is the same as it
has always been — distinct-author counting and burst shape, plus the fact that nothing here is
worth farming because standing confers no power.

---

## 9. Moderation

### 9.1 The central point: quality is not moderated, danger is

The schema already encodes this and it is the reason the system scales without the owner reading
everything:

- A **wrong** claim is answered by the community, with a revision. No moderator.
- A **dangerous** claim — phishing, scam, malware, impersonation, harassment — goes to an
  administrator. That queue exists (`/admin/reports`) and is deliberately small.

There is no approval gate, no reviewer role, and §8.6 forbids introducing one.

### 9.2 What publishes immediately

**Everything, except quarantined content.** Confirmations, challenges, updates, new fields, new
routes — all live on write, all attributed, all reversible by a further revision.

This sounds risky and is not, because of the invariants: nothing is destroyed, everything is
attributed, prior values remain readable, and a new route publishes as `experimental` and says so.

### 9.3 What draws attention, without drawing a moderator

Three automatic signals, none of which take action on their own (invariant 14):

| Signal | Surfaces as | Who acts |
|---|---|---|
| A field's revision chain has **forked** | The field renders contested | The community, via a revision |
| A field has an **open challenge** | Caution on the field; **Phase 15** makes it reachable from the route | Anyone |
| A field has **reports from several distinct people in a short window** | The admin queue, ordered by distinct reporters | Administrator |

### 9.4 What the owner actually has to do

Reports of danger, and nothing else. On present volume that is minutes a week. If it ever is not,
§35's volunteer maintainers is the documented next step — not a bigger queue.

---

## 10. Contribution lifecycle

The generic lifecycle in the brief (Draft → Submitted → Validation → Pending review → Accepted →
Published) **does not fit this product**, and forcing it would break invariant 7 (no approval
gate) and §8.6. Here is the one that does:

```
                       ┌──────────────────────────────────────────┐
   written  ──────────►│  PUBLISHED  (immediately, attributed)    │
   (a revision row)    └──────────────┬───────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
        CONFIRMED               CHALLENGED               SUPERSEDED
   independent people      someone says it is wrong   a later revision
   vouch for it            (reason recorded)          changes the value
              │                       │                       │
              │                       ▼                       │
              │              answered by a revision ──────────┤
              │              (never by a moderator)           │
              ▼                                               ▼
     may become                                        prior value stays
   community_confirmed                                readable in history
                                      │
                                      ▼
                            ┌──────────────────┐
                            │  or FORKED       │  two people revise the
                            │  = contested     │  same parent → both stand,
                            └──────────────────┘  the field says so

   Separately, and only for danger:
        REPORTED ──► QUARANTINED (hidden from public view, not deleted)
                          └──► released / archived / removed, by an administrator, recorded
```

**What happens at each stage:**

- **Published** — live, attributed to a handle, timestamped, carrying its source class,
  applicability and any effective dates. Visible to everyone including anonymous readers.
- **Confirmed** — a `Confirmation` row per person. Enough independent confirmations may justify
  promoting a community claim to `community_confirmed`; the threshold is an open decision (§11)
  and this proposal deliberately does not invent one.
- **Challenged** — a `Challenge` with a reason. The field renders as contested. **A confirmation
  cannot clear it** — that is schema-enforced and prevents a dispute being buried under
  reassurance.
- **Answered** — a revision sets `resolvedByRevisionId`. Both the challenge and the old value
  remain readable.
- **Superseded** — the field's `currentRevisionId` moves. Nothing is lost.
- **Forked** — two revisions share a parent. This is the contested state and it is *evidence*,
  not a failure.
- **Expired** — `expiresAt` passes. The claim is stale by its own stored date, not by a guessed
  threshold.

---

## 11. Three end-to-end scenarios

### Scenario A — a German university changed an admission requirement

Rifat is following `bd-de-masters-2027`. He is on step 5, *Check which application channel your
university uses*. On TU Munich's page he sees they now require a certified translation that the
route does not mention.

1. He is on the route page. The field list for step 5 has, under each item, a quiet
   **"Something changed?"** link. No navigation.
2. He picks **"I know something this is missing"** → `ADD a field`.
3. The form knows the route, the step, and him. It asks four things:
   - *What is the requirement?* → "Certified German translation of the degree certificate"
   - *Where does this come from?* → **An institution's page** + URL
   - *Does this apply to the whole route?* → he unticks *whole route*, ticks **Only this
     university**, and types "TU Munich"
   - *(optional) anything a reader should know* → left blank
4. **Publish.** It is live, attributed to his handle, in the official-and-institutional group,
   marked as applying to one institution.
5. He sees: *"Added. 14 people are following this route and have not reached this step yet."*

**No review. No queue.** If he is wrong, somebody challenges it and a revision answers.

### Scenario B — a personal experience conflicts with official information

Nusrat marks *Wait for appointment eligibility* complete, actual date 4 March 2026. The route says
the wait exceeds 27 months, sourced to the German Embassy Dhaka. Hers was six weeks.

1. The completion prompt fires: **"Was this step still accurate?"** → she taps **"Something was
   different."**
2. The three fields of the step appear. Against the 27-month one she picks **"It was right for
   me, but only because…"**
3. That branch asks a single question — *what made your case different?* — with the applicability
   options as choices. She picks **application channel** and types "DAAD scholarship holder".
4. She adds the observation: *"Appointment offered in 6 weeks, March 2026, as a scholarship
   holder."* The date is already known from her progress row.

**What the product does with it — this is the important part.** It does **not** overwrite the
official claim (invariant 11), does not average them, and does not ask anyone to vote. The field
now reads:

```
  Official · German Embassy Dhaka · effective 2026-06-04
    Waiting time exceeds 27 months for regular applicants
    ✓ Confirmed by 4 people

  From the community · 1 person · March 2026
    Appointment offered in 6 weeks
    Applies to: application channel — DAAD scholarship holders
    ⚠ Community submission, not corroborated by anyone else
```

If two more scholarship holders report the same thing, it becomes `community_confirmed` and stops
carrying the caution. **The information is now better than either claim alone**, because it names
the condition under which each is true — and nobody had to be wrong.

### Scenario C — noticing something is outdated

Tanvir is reading the Malaysia route and the EMGS fee looks wrong; he paid more last month.

1. Beside the field, **"Something changed?"** → **"It is out of date."**
2. That is the whole interaction: a `Challenge` with reason `obsolete`. He is offered — not
   required — a box for what he actually paid. He types "RM 1,060, paid Feb 2026."
3. The field immediately renders as contested, with his note and its date.
4. It appears in the route's *needs review* list (Phase 15), and on the Updates screen for anyone
   following the route (Phase 14).
5. A week later somebody with the official EMGS page updates the value. The revision sets
   `resolvedByRevisionId`; the challenge closes; the old value stays in history; Tanvir sees on
   his own route that the question he raised was answered.

**He never had to be sure, and never had to write an essay.** He noticed something, and that was
enough — which is the entire design goal.

---

## 12. MVP, Phase 2, Phase 3

### MVP — now, small user base, no budget

The whole point is that **most of this is wiring, not building.**

1. **The journey completion prompt, properly designed** (§4.2). Exists as a mechanism; deserves
   the best UX in the product.
2. **"Something changed?" beside every field**, routing into the cheap actions (§4.3).
3. **"N people are following this route and have not reached this step"** at the moment of
   contributing. One query, the strongest sentence available.
4. **Scope-narrowing as a first-class contribution** — surfacing `applicability` in the
   contribution form. Small change, the highest-value idea here.
5. **The dated observation** — one new column, plus the form asking for it (§3.1).
6. **Contributor page showing the four facts** (§6.3). Mostly exists.
7. **Self-confirmation refused.** One check.
8. **Phase 15's needs-help lists** — already planned.

### Phase 2 — hundreds of contributors

- Confirmation thresholds for promoting `community_submission` → `community_confirmed` (needs
  §11's open decision answered by real data)
- Distinct-author and burst-shape signals on confirmations, surfaced not enforced
- Destination and step-category maintainers (§35)
- A stable, citable contribution record
- Cross-route "what needs help" worklist

### Phase 3 — a real knowledge network

- Certificates and institutional partnerships
- Self-reported processing-time distributions (§35)
- Research/archive view across historical versions (§35)
- Additional origin countries

---

## 13. Five distinctive ideas, derived from this product

Each is something Wikipedia, Reddit, Quora, a Facebook group and a study-abroad site cannot
readily do — with the reason it fits *here*.

### Idea 1 — The journey is the contribution queue
**Product-novel.** The product knows who is standing in the visa queue, which step they just
finished, and on what date. So it can ask *the right person the right closed question at the exact
moment they know the answer* — instead of waiting for someone to arrive wanting to edit.
**Problem solved:** the cold-start and motivation problem that kills every community knowledge
base. **Why they participate:** it costs one tap at a moment they are already present.
**Implementation:** `JourneyStepProgress.actualDate` + `confirmStepFields`, both built.

### Idea 2 — Disagreement resolved by scope, not by vote
**Genuinely novel as a product mechanism.** `FieldApplicability` is a *set* on the revision, so
the first question about a conflict is not "who is right" but "do these have the same scope".
**Problem solved:** the thing that makes study-abroad information so hard — almost every rule has
exceptions by university, programme, intake or channel, and flattening them into one true answer
is why existing sources are wrong so often. **Why they participate:** nobody has to be told they
were wrong. **Implementation:** the column exists (FR-81, D-47); only the contribution form and
the conflict display need building.

### Idea 3 — The dated first-hand observation as the unit of community evidence
**Product-novel, and the anti-AI strategy.** Not "here is how the process works" but "on 4 March
2026, at VFS Dhaka, as a scholarship holder, I was told X". **Problem solved:** distinguishing
lived knowledge from fluent text, without trying to detect AI — and giving conflicting reports a
resolvable axis. **Why they participate:** it is easier than writing a guide, and it is the only
thing they are uniquely qualified to say. **Implementation:** one new column plus form design.

### Idea 4 — "14 people ahead of you have not reached this step yet"
**A very good UX decision rather than a technical novelty**, and possibly the highest
motivation-per-line-of-code in the whole proposal. The abstract beneficiary of a public good
becomes a specific number of specific people who will hit this exact step. **Implementation:** one
`Journey` count, scoped to a step — no privacy exposure, since it is an aggregate that identifies
nobody (invariant 5).

### Idea 5 — Standing that gates nothing
**Product-novel by refusal.** Reputation exists as *description* — what you contributed, what
others later confirmed, which destinations and steps you have worked on — and confers **no
authority whatsoever**. **Problem solved:** every points system eventually decides who gets
believed, which is how communities calcify and how spam becomes worth farming. Here there is
nothing to farm, because standing buys nothing. **Why they participate:** credit that is honest,
durable, and pointable-at. **Implementation:** `ContributorHistory` already computes most of it
and already refuses to score it.

---

## 14. Recommended data model changes

Deliberately minimal — three additions and one constraint. Everything else this design needs
already exists.

```prisma
model FieldRevision {
  // NEW. When the contributor personally encountered this, as distinct from
  // `effectiveFrom` (when the rule starts applying). The backbone of the dated
  // observation: it makes two community reports comparable and gives the anti-AI
  // workflow something a model cannot supply.
  observedOn        DateTime?

  // NEW, optional. Free text naming the narrowing, e.g. "TU Munich", "DAAD holders".
  // `applicability[]` already says WHICH DIMENSION varies; this says which value.
  // Deliberately not a foreign key — institutions are not modelled and should not be
  // modelled for this.
  applicabilityNote String?
}

model Confirmation {
  // NEW CONSTRAINT (application-level, plus a check): the author of a confirmation
  // may not be the author of the revision being confirmed. Self-confirmation is the
  // cheapest attack in the system and the cheapest to close.
}
```

**Not recommended:** a `Contribution` table. Every contribution here is already a revision, a
confirmation or a challenge, and adding a parallel table would create a second history that can
disagree with the ledger — the exact failure CLAUDE.md §5 warns about for change announcements.

**Not recommended:** a `reputation` column. Reputation is derived on read from rows that already
exist; storing it creates something to drift, something to game, and something that looks
authoritative.

---

## 15. Recommended UI, routes and components

**New components**
- `ContributionPrompt` — the post-completion step prompt (§4.2)
- `FieldChangePrompt` — the four-way "something was different" chooser (§4.3)
- `ScopeChooser` — applicability as checkboxes, reusable in every contribution form
- `ConflictView` — two claims of different scope, side by side, in `step-fields.tsx`
- `ContributorStanding` — the four facts, on the existing contributor page

**Changed**
- `src/components/contribute.tsx` — `FieldActions` gains the scope-narrowing and add-a-source
  branches; `AddFieldForm` gains `ScopeChooser` and `observedOn`
- `src/app/[locale]/routes/[slug]/journey/page.tsx` — the completion prompt becomes the designed
  flow rather than a single line
- `src/server/revisions/service.ts` — `reviseField` accepts `observedOn` and
  `applicabilityNote`; `confirmField` refuses self-confirmation

**New routes:** none for MVP. Every entry point attaches to a page that already exists — which is
the design working, not a limitation.

---

## 16. What NOT to build yet

- **A "Contribute" hub page** (§2.1) — a fifth door with less context than the other four
- **Comment threads on challenges** — §33 excludes a social feed; a challenge is answered by a
  revision
- **Any approval queue** — §8.6, explicitly
- **Points, levels, badges, streaks, leaderboards** — §25, and the build fails on the vocabulary
- **A reputation score or weight** — §11 open decision; and it would gate things, which invariant
  14 forbids
- **AI detection** — unreliable, and it would misfire on the non-native English writers who are
  most of this platform's contributors
- **Confirmation thresholds** — needs real data; inventing one now is exactly what §11 forbids
- **Institution or programme as modelled entities** — `applicabilityNote` as free text is enough
  until it demonstrably is not
- **Contributor messaging** — §33

---

## 17. Prioritised roadmap

Ordered by **impact × feasibility × ability to attract the first real contributors** — with an
emphasis on the third, because with no contributors nothing else matters.

| # | Item | Impact | Effort | Why here |
|---|---|---|---|---|
| **1** | **The journey completion prompt, designed properly** | Very high | Small | The mechanism exists. This is the moment of fresh knowledge and it is currently one line of text. Everything else depends on contributions existing at all. |
| **2** | **"N people behind you have not reached this step"** | High | Tiny | One query. The strongest motivating sentence available, and nobody else can say it. |
| **3** | **"Something changed?" beside every field**, routing to the cheap actions | High | Small | Makes contribution possible without navigation, and routes people to the cheapest action that captures what they know |
| **4** | **Self-confirmation refused** | Medium | Tiny | Closes the cheapest attack before there is any incentive to use it |
| **5** | **Scope-narrowing as a contribution type** | Very high | Medium | The most distinctive idea here, and the honest answer to conflicting information. Column exists. |
| **6** | **The dated observation** (`observedOn`) | High | Small | One column plus form design. Underpins conflict resolution *and* the anti-AI strategy. |
| **7** | **Phase 15 — needs-help lists** | Medium | Small | Already planned; turns counts into a worklist |
| **8** | **Contributor standing page** | Medium | Small | Durable credit; mostly exists |
| **9** | **`ConflictView`** — two scopes side by side | Medium | Medium | Only pays off once there is enough content to conflict |
| **10** | **Distinct-author and burst signals on confirmations** | Low now | Medium | Matters at scale, not before. The primitive exists in `safety/service.ts`. |

**Items 1–4 are roughly one focused session** and would take the product from "contribution is
possible" to "contribution is the natural thing to do next". Items 5–6 are the distinctive half
and are worth doing carefully.

---

## 18. Two things this proposal needs from the owner

1. **FR-80.** Several items here — scope-narrowing as a contribution type, the dated observation,
   the contributor standing page — are materially new behaviour. Per FR-80 and BR-35 they are
   requirement changes to be raised, not assumed. This document *is* that raising.

2. **§11's open decisions are load-bearing here** and this proposal deliberately does not answer
   them: contributor reputation labels and weights, and the confirmation threshold at which a
   community claim becomes `community_confirmed`. Both need real data. Shipping items 1–6 without
   answering either is possible and is what is recommended.
