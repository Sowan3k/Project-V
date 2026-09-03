# Status.md — session log

Append-only record of what happened each session: work done, decisions taken, blockers, and
the next concrete step. **Update at the end of every session.** Newest session at the top.

Read this first when starting a session, then [Phases.md](Phases.md) and [Test.md](Test.md).

---

## Session 13 — 2026-09-03

**Goal:** Phase 10 — change propagation and shadow route. Plus verifying the Vercel deployment
after the OAuth env vars were added.

### Done

**Deployment verified.** The redeploy took: `/api/auth/providers` returns the Google provider
(was a 500), `/en/signin` offers "Continue with Google" (was "not configured"), and the health
endpoint reaches Neon in ~190ms. The production OAuth callback was already registered — driving
the real handshake lands on Google's sign-in page with no `redirect_uri_mismatch`.

**Phase 10 implemented.** `RouteChange`, `TemporaryDisruption` and `JourneyChangeNote`; a pure
`src/domain/changes.ts`; public reads in `src/server/changes/`; follower-scoped reads in
`src/server/journeys/changes.ts`; a Changes tab with the side-by-side shadow comparison; change
surfacing on the journey tab. Full write-up in [Phases.md](Phases.md).

### Decisions taken

| Decision | Why |
|---|---|
| **Severity is declared by a contributor, never derived** | §41.2 defines each level by consequence to the follower. No diff of the ledger contains that, and inferring it from a count is the opaque heuristic FR-71 forbids. |
| **Relevance is a closed set of positions, never a number** | A "73% relevant" implies a precision nobody has. `ChangeBearing` has seven members, each a checkable fact, and none means "your progress is invalid". |
| **Shadow comparison is side by side, not an overlay** | Phase 4 proved an overlay is invisible whenever the two shapes are similar — the common case. Aligned columns on a shared ordinal spine, which is what VR-07 shows. Both sides still use the one generic `Road`. |
| **The shadow is reconstructed from the ledger, not stored** | A snapshot would be a second copy of the truth, free to drift. `loadRouteGraphAt` works for any date and needed no schema support. |
| **A disruption expires by comparison, with no status column** | A stored flag needs a job to flip it, and a job that edits rows is exactly what BR-08 avoids. With no flag, expiry cannot fail, run twice, or arrive late. |
| **Applicability is reported, never resolved** | We do not know which programme somebody applied to. §13.3's "applicable / already handled / not applicable" hands the judgement to the person who knows, and the answer is believed. |
| **No cross-route Updates feed** | Not in Phase 10's scope, and VR-10's page carries the deferred alerts concept with it. Route-scoped visibility satisfies FR-28/FR-76. |

### Blockers

**None for development.** Two items need the owner, neither blocking:

1. **Production is three migrations behind** — Phase 7, 8 and 9 are committed but unapplied,
   and Phase 10 adds a fourth. `users` on production still lacks `email`, and `accounts` and
   `sessions` do not exist, so **the first person to complete Google sign-in gets a 500.**
   All four migrations are purely additive and production is empty (0 rows), so applying is
   zero-risk: `npm run db:deploy`. Deliberately a person's action per CLAUDE.md §4.
2. **The local unpooled path to Neon is down again** — five consecutive `P1001` timeouts, the
   same instability recorded in Test.md §12 and §14. Vercel reaches the pooled endpoint fine,
   so it is the local network path, not the database. Schema inspection went through the Neon
   API instead; the migration was generated offline by diffing the committed schema against the
   working tree, which needs no database at all.

### Phase 10 review follow-up (same session)

Phase 10 was provisionally approved with one model gap to close: **a change announcement could
only be associated with the history it described by date.** Closed with `RouteChangeRevision` —
see [Phases.md](Phases.md) and CLAUDE.md §5. Two decisions recorded durably at the owner's
request:

| Decision | Recorded in |
|---|---|
| **Severity is contributor-assigned metadata, never a system-derived score, and is never described as objectively determined.** Three guards: no derivation, no effect on relevance, no claim of measurement in the copy. | CLAUDE.md §5, `tests/architecture/change-propagation.test.ts` |
| **Change announcements point at revisions, never at dates.** Only the "to" side is stored; "from" is the ledger's own immutable `previousRevisionId`. Not a second versioning system — no snapshot, no version number, no sequence. | CLAUDE.md §5, `prisma/schema/changes.prisma` |

### Requirements-traceability follow-up (open, no action taken)

**§13.3 "User control over applicability" has no FR id.** It is normative baseline prose —
"the follower should be shown the change and allowed to mark it as applicable, already handled,
or not applicable to their case" — but it does not appear in the FR-01…FR-81 catalogue. Phase
10 implements it (`JourneyChangeNote`), so that behaviour currently traces to a **section
reference rather than an FR**, and `tests/architecture/fr-coverage.test.ts` only checks FR ids
and therefore did not flag it.

**No FR has been invented or renumbered.** Assigning an id is a change to the frozen baseline
and belongs to the formal change process (CLAUDE.md §2, BR-35, §46.3): amend the DOCX,
regenerate `REQUIREMENTS.md` *and* the MHT in the same commit, and record it here. Logged as an
open traceability item for the owner to decide, not a defect in the implementation.

### Migrations applied and authentication verified (owner, 2026-09-03)

The five pending migrations — Phases 7, 8, 9, 10 and the Phase 10 review follow-up — were
applied by the owner to **Neon `test` first, then `production`**, following the rehearsal
procedure. Owner-reported outcome:

- Both branches migrated successfully; `test` carried real data (52 users, 359 routes, 713
  field revisions) through the `ADD COLUMN`s, which is the case production could not exercise.
- **Production drift check clean** — the schema matches the Prisma models exactly.
- `/api/health` confirms the production database is reachable.
- **Google authentication tested end to end on the Vercel deployment and works.**

This closes the two long-standing blockers. The deployment now has the tables Auth.js writes
on sign-in (`users.email`, `accounts`, `sessions`), so the 500 that would have met the first
person to sign in is gone. Recorded, not re-verified from here — the reads above are the
owner's.

### Phase 11 — lifecycle, dormancy, merge and admin (same session)

Full write-up in [Phases.md](Phases.md). Decisions worth carrying forward:

| Decision | Why |
|---|---|
| **Dormancy is guarded by a state check, not a period check** | The only branch producing `dormant` is inside `if (current === experimental)`, so an established route cannot reach it however silent it goes. That is invariant 23 made structural rather than remembered. |
| **Automation may only lower prominence or ask for review** | Every piece of evidence for promotion is a count, and FR-71 forbids counts alone conferring standing. `established` and `developing` are reachable only through an administrator's decision (FR-46). |
| **`quiet` carries no caution** | FR-39: an established route is not false because nothing happened. `snapshotCautions` and `proposeLifecycle` share one `lifecycleWarrantsCaution`, so the transition and the rendering cannot disagree. |
| **Staleness comes only from stored dates** | CLAUDE.md §11 leaves the period open, so nothing decides a route is stale after N days — only a contributor's own `reviewDueAt` / `expiresAt`. |
| **Merge is a pointer, not a content transfer** | Relocating steps would put revision chains under a route that did not author them and detach journey progress from the route its owner chose. Nothing moves, so both histories and both follower sets survive by construction (FR-58, BR-25, §40.4). |
| **A duplicate flag changes nothing, and is never counted** | §40.1 protects routes that overlap but differ. Ten flags and one flag both mean "an administrator should compare these". |

### Next step

Phase 12 — responsive, accessibility, polish and the support link — **awaiting approval.**

Two items are already logged for it (Test.md §18 and §21): the Phase 10 shadow comparison and
the Phase 11 "quiet" copy have both been reasoned about carefully and neither has been in front
of a reader. Both are judgement calls a test cannot settle.

---

## Session 12 — 2026-09-03

**Goal:** Phase 9 — safety: reporting and quarantine. Plus Germany research pass 3, and wiring
Google sign-in.

### Phase 9 — reporting and quarantine

**Gate green on run #39, `e3dea2b`:** lint, typecheck, 508 unit/architecture tests, build,
migrations onto an empty database, schema-drift check, the integration suite, and 52 E2E
assertions — all on a container.

### Decisions taken

**1. The threshold question dissolved rather than being answered.** §23.2 leaves quarantine
thresholds open and §11 lists them as undecided — but FR-71 and invariant 14 independently
forbid a raw count being the *sole automatic determinant* of a state change. So automatic
quarantine was never available in the first place, and making quarantine an administrator
action means **no number has to be guessed**. This was the one place I expected to have to stop
and ask; the requirements had already answered it.

**2. Reports are not public.** A challenge is a claim about information and belongs beside it.
A report is an accusation about *conduct*, and a public accusation board would be a defamation
surface and a brigading target. Readers see the outcome — whether content is withheld — and
nothing else.

**3. Quarantine withholds server-side.** A phishing URL that reaches the page has already done
most of its work; `display: none` is not containment. The value never leaves the server, and
the browser suite proves it by reading the raw HTML.

**4. A fourth model class gained a third member.** `Report` joins `Confirmation` and
`Challenge` as a `communitySignal` — community-authored, never deleted by a normal user.
Classification governs *write* rules; visibility is separate, which is how reports can be
undeletable and private at once.

**5. The administrator is a safety role only** (§23.3). A non-administrator asking for the
queue gets a 404, not a 403.

### Things that went wrong, and what they taught

**An existing guard caught a real mistake.** The first draft put the quarantine field-write in
the safety service; the model-classification test refused it, because `Field` is revisioned and
only `src/server/revisions` may write one. Authorisation stayed in safety, execution moved. The
Phase 3 boundary earning its keep three phases later.

**Two of my own assertions were too blunt for shared fixtures.** One asserted the public route
projection did not match `/report/i` and matched its own fixture's title — "a route with
something **report**able on it". The other matched copy shared by fields the seeded route has
accumulated across CI runs. Both now assert against values unique to their own run.

**Two older guards were rescoped rather than deleted.** The approval-gate scan reads the
contribution block rather than the whole dictionary, because "Withheld pending review" is
honest copy. And "no report action exists" became a *separation* guard — the property that
mattered all along.

### Also done this session

**Germany research pass 3** (content track, no production data). uni-assist handling fees
verified: €75 first course, €30 each additional, per semester, charged "regardless of the
result". **This is the first verified `application_channel` fact** — Amendment 001 added that
dimension on a hypothesis and pass 2 found no instance. RWTH uses its own portal, so a student
on that route pays it zero times while one applying to three uni-assist universities pays €135.
Five of six applicability values now have verified instances.

**A scope correction:** insurance was filed under post-arrival formalities and asked whether
those fall outside V1. Wrong stage — Embassy Dhaka requires travel health insurance *at the
visa application*, before departure, inside V1. The statutory insurance after arrival is a
different requirement. A word like "insurance" is not a step.

**Google sign-in is live.** The owner supplied OAuth credentials; `AUTH_SECRET` was generated
locally. Verified by driving the real handshake — CSRF → Auth.js → `accounts.google.com` —
which returned Google's email-entry form with no `invalid_client` or `redirect_uri_mismatch`.
Two of the three values had arrived as my own `.env.example` placeholder text, angle brackets
included; the diagnosis was done by shape alone, without any value entering the transcript.

### A question the owner raised, worth recording

**"Nothing I see matches the visual references — is the frontend still pending?"**

The observation is right and the answer is that the *structure* the references define exists
and is tested, while the *visual* layer is Phase 12 and has not been started. Fifteen colour
tokens exist — neutrals, brand, one attention colour — and **zero category colours**, because
the six semantic category colours and the maturity palette are open decisions (§11) that
inventing would answer by accident.

Options were offered: hold the line, bring a slice of Phase 12 forward for the road, or do a
full design pass now. **The owner chose to hold the line and follow the phases.** Recorded
because the cost is real — the product looks like a wireframe until Phase 12 — and that is now
a known, accepted trade rather than an oversight.

### Blockers

None for Phase 10. Standing owner actions, none blocking:

- **Phases 7, 8 and 9 migrations are on no Neon branch yet** — all verified against CI's empty
  Postgres. `npm run db:deploy` against `test` then `production` is deliberately a person's job.
- **Vercel needs its own `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`** before
  sign-in works on the deployment. Generate a *separate* secret there, so a local session
  cannot be replayed against production.
- The failing `Workers Builds: project-v` check from the Cloudflare app.

### Next step

**Phase 10 — change propagation and shadow route**, on approval. Change severity, announcement
versus effective date, relevance scoped to a follower's progress, the shadow comparison, and
temporary disruptions that expire without rewriting the route.

Two things already recorded that Phase 10 owns: the **shadow overlay problem** from Phase 4 — an
overlay at identical geometry is invisible, and VR-07 shows side-by-side rather than pure
overlay — and **effective date beats edit date** when deciding whether a change affects a
follower (FR-59, BR-26, D-39, invariant 21).

## Session 11 — 2026-09-03

**Goal:** correct the overclaim about generated handles, then Phase 8 — the contribution loop.

### The handle wording, corrected

The claim that dropping vowels means a generated handle "can never spell a word" was too
absolute: consonant runs can still read as initialisms, abbreviations or words in other
languages. Reworded in all four places to say it **reduces the likelihood** — worth doing
because every handle lands on a real person who did not choose it, and the honest remedy for an
unlucky one is to let that person change it. No behaviour changed, and the privacy property is
untouched: handles are still generated and never derived from real identity data.

### Phase 8 — ADD, UPDATE, CONFIRM, CHALLENGE

**Gate green on run #34, `69132e2`:** lint, typecheck, 480 unit/architecture tests, build,
migrations onto an empty database, schema-drift check, the integration suite, and 46 E2E
assertions — all on a container.

### Decisions taken

**1. A fourth model class: `communitySignal`.** Confirmations and challenges are public and
community-authored but not revisioned — a confirmation is not edited into a different
confirmation, and a challenge is answered rather than rewritten. They do not belong in the
revision engine, but they are still shared knowledge, so the write guard now refuses `delete`
on them exactly as it does for revisioned models. A deletable challenge is a deletable safety
signal, and invariant 12 already says a reader over-reads the absence of warnings.

**2. A revision resolves a challenge; a confirmation never does.** The sharpest call in the
phase. Someone vouching for a field is a competing signal, not an answer — and letting a
confirmation clear a challenge is precisely how a dispute gets buried under reassurance
(FR-70). The challenge row survives resolution with its reason, its author and a pointer to the
revision that answered it.

**3. Confirmations count people, not clicks.** One row per person per field. A count that
cannot distinguish fifty people from one person fifty times is not a signal (invariant 14).

**4. VR-09's five-stage wizard became one form and then the route.** Only the basics need a
page, because until the route exists there is nothing to add steps to. "Review" is looking at
the route; "Publish" already happened, as experimental. Everything else is a disclosure on the
route itself — the route stays on screen, and the loop works with JavaScript disabled.

**5. Contributor history is evidence, not a score.** CLAUDE.md §11 leaves reputation weights
open and §25 warns against a points game, so there is no score, rank or badge. A guard forbids
the vocabulary, and a second test asserts the summary is imported by exactly one page and by
nothing that orders or gates anything.

**6. The completion prompt invents no new action.** "Yes" is CONFIRM; "something changed" opens
the step where UPDATE and CHALLENGE already live.

### Things that went wrong, and what they taught

**E2E specs that create public content race specs that read it.** Ten failures at once: search
is newest-first, Playwright runs fully parallel, and the reading journey's "click the first
result" started landing on a route the contribution spec had just made. "The first result" was
never a good locator — it only looked like one while exactly one route existed.

**Playwright's accessible name includes the control's own content.**
`getByLabel(/^information$/)` stopped matching the moment the field had a value in it, and
`getByLabel(/^reason$/)` never matched a select at all, because every option's text is part of
the name. Form controls are now located by their `name` attribute.

Both are in Test.md §17. Both failures were also evidence the product works — the strict-mode
violation was the update form correctly prefilled with the current value, and a stray text
match was the renderer having drawn a newly added step.

### Blockers

None for Phase 9. The same owner actions stand, none blocking development:

- **The Phase 7 and Phase 8 migrations are on no Neon branch yet** — both verified against
  CI's empty Postgres and nothing else. `npm run db:deploy` against `test` then `production` is
  deliberately a person's job (CLAUDE.md §4).
- **Sign-in needs `AUTH_SECRET` and Google OAuth credentials**, which must never live in this
  repository. Until they are set, `/en/signin` says so and reading works without them.
- Still outstanding: the failing `Workers Builds: project-v` check from the Cloudflare app,
  which targets an architecture this project does not use.

### Next step

**Phase 9 — safety: reporting and quarantine**, on approval. REPORT as an action distinct from
CHALLENGE, quarantine of high-risk content, admin review/restore/archive/remove, contact
safety, burst detection. Reports are **structured and textual — no upload path** (§8.6, decided
2026-09-02).

One note to carry into it: invariant 12 currently holds because the route passport *cannot
observe reports at all*. Phase 9 must add reporting to a caution path and must not add a report
count to `RouteTrustInput`.

## Session 10 — 2026-09-03

**Goal:** close the Phase 6 verification gap properly, then Phase 7 — identity and private
journeys.

### Phase 6, actually verified

The previous report said the gate was pending and that GitHub Actions could not be inspected
from here. Both halves were wrong in useful ways.

**Actions is reachable without the `gh` CLI** — the repository is public, so the runs and jobs
endpoints answer unauthenticated; only raw log download needs admin. Inspecting it exposed the
real gap: **CI had no E2E job at all.** Run #21 on the Phase 6 commit was green over lint,
typecheck, unit tests, build, migrations and integration — and never executed Playwright.
Calling that proof of E2E would have been false.

E2E now runs in CI against the same `postgres:18` container, and **failed on its first run**,
which is the entire argument for adding it: the spec still clicked a "See what has changed"
link that the navigation work had replaced with a History tab, and `route.viewHistory` had been
orphaned copy ever since. Nothing was watching, because E2E only ever ran on a workstation.

Phase 6 closed on run #24. **The remote-Neon failures were never a Phase 6 defect** — the same
commit that could not finish locally passes every job on a container.

### Phase 7 — identity and private journeys

Auth.js with Google, a generated pseudonymous handle, following a route, private per-step
progress with dates and notes, personal tasks, and self-reported completion. `My journey` is a
**tab on the route**, so the road and the route's standing stay on screen; `/journeys` is the
index across routes.

**Gate green on run #28, `cc42268`:** lint, typecheck, 460 unit/architecture tests, build,
migrations onto an empty database, schema-drift check, the integration suite, and 38 E2E
assertions.

### Decisions taken

**1. Unfollow archives; delete is separate and explicit.** Asked rather than invented, and
approved. Months of private notes should not go to a mis-click, and "I stopped following" is
not the same statement as "erase my data" — but a platform that promises privacy must let
somebody actually erase their own data. The explicit delete is the only hard delete in the
application; invariant 1 protects *shared* knowledge and deliberately not this.

**2. Privacy is structural, not remembered.** Every exported function in
`src/server/journeys/` takes `userId` and every query against a private model filters on it in
its own `where` clause. Not fetched-then-checked: a fetch followed by an `if` is a rule
somebody can forget to write. Public aggregates live on the public read path instead, so the
rule needs no exceptions — and an exception list is where a rule like this goes to die.

**3. The handle is generated, never derived.** A handle taken from a Google display name would
publish the real identity §24.3 says a contributor need not expose — by default, without
asking, which is the worst way to make that choice for someone. Its alphabet drops the vowels,
which **reduces the likelihood** of a suffix reading as a recognisable word — cheap risk
reduction on something that lands on a real person, not a mathematical guarantee. If an
unlucky handle ever appears, the answer is to let that person change it.

**4. Database sessions, not JWTs.** Signing out revokes immediately, and the E2E suite can
write a session row directly — so **the application contains no test-only authentication path
at all.** A credentials provider behind a flag is one misconfiguration away from a
password-free login on the real site.

**5. We keep the email and discard the rest.** Google offers a name and a photograph with
every sign-in; the adapter drops both and there are no columns for them to land in (§24.2).

### Things that went wrong, and what they taught

**Next.js encodes every server-action form as `multipart/form-data`.** An E2E assertion that no
form is multipart failed — the enctype is the framework's, on forms accepting only text. The
useful reading: a hand-crafted POST could carry a file part whatever the page renders, so "no
upload path" can never be proved from markup. It is refused at the action boundary instead, by
a helper that throws on a `File` rather than coercing it. That helper began life as an ESLint
`no-base-to-string` error, which was right for a reason the rule does not know about.

**Auth.js returns no session, silently, when `trustHost` is unset.** Ten E2E failures that all
looked like a bad cookie. The cookie was fine; `trustHost` derives from `AUTH_URL`, which CI
did not set. A signed-in flow behaving exactly like a signed-out one is a host-trust problem
before it is a cookie problem.

### Blockers

None for Phase 8. Two owner actions, neither blocking development:

- **The Phase 7 migration is on no Neon branch yet** — verified against CI's empty Postgres and
  nothing else. `npm run db:deploy` against `test` then `production` is deliberately a person's
  job (CLAUDE.md §4), best done when the link is healthy.
- **Sign-in needs secrets that must never be in this repository**: `AUTH_SECRET`, and
  `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` from a Google Cloud OAuth client. Until they exist,
  `/en/signin` says so plainly rather than offering a button that fails, and reading the
  platform works without any of it.
- Still outstanding from before: the failing `Workers Builds: project-v` check from the
  Cloudflare GitHub app, which targets an architecture this project does not use.

### Next step

**Phase 8 — the contribution loop**, on approval. ADD / UPDATE / CONFIRM / CHALLENGE with
reasons, the create-route flow (VR-09), the update-field flow (VR-08), and the "Was this still
accurate?" prompt after a follower marks a step complete (FR-42, §16.5) — which Phase 7
deliberately left alone. **There is no approval gate**: updates go live and create a revision
(CLAUDE.md §8.6).

## Session 9 — 2026-09-03

**Goal:** clear the stale-MHT ambiguity, then Phase 6 — make uncertainty visible before the
community can write anything.

### Done

**The MHT no longer lags the DOCX.** Amendment 001 had left it one amendment behind for a
commit. Regenerated from the amended DOCX via Word's Single File Web Page export and verified
properly: 81 FR / 35 BR / 47 D with **identical id sets** across all three artifacts, and the
DOCX sha256 unchanged by the export. Two traps recorded in `Test.md` §13 — the MHT is
quoted-printable, so a naive `grep FR-81` returns 0 for a file that contains it; and the
export must be proved not to touch the authority it reads.

The rule now lives in `CLAUDE.md` rather than in a commit message: **a requirements change
regenerates every representation in the same commit, and no representation may be left an
amendment behind.** A file that looks like the requirements but silently isn't is worse than
no copy at all, because a reader cannot tell.

`Design-References.md` gained an explicit statement that it has **no authority**, with the
hierarchy written out. External products are pattern references; they never introduce or
override a requirement.

**Phase 6 — the trust surface.** `src/domain/trust.ts` and `src/domain/links.ts` decide which
signals are true; `src/components/trust.tsx` decides how loud each is; the dictionary owns
every word. 67 new tests — 44 unit, 13 architecture, 10 integration.

### Decisions taken

**1. A signal earns prominence by changing what the reader should do.** The hard part of this
phase was not showing the metadata — a field now carries source class, applicability,
freshness, review and expiry dates, revision count and fork history, and a route adds
lifecycle state, contributors and change activity. Showing all of it at equal weight is easy
and would have been a failure. Three weights: **caution**, **context**, and **nothing**.

The third is load-bearing and has its own test: an official, route-wide, recently confirmed
field produces **zero** cautions. `route_wide` renders as nothing at all — it is what a reader
already assumes, and marking it would drown the `programme`-scoped fact beside it, which is
the exact confusion FR-81 exists to prevent.

**2. Provenance is a heading, not a badge.** Fields are grouped into disputed /
official-and-institutional / community regions. Eleven fields state their provenance once
instead of eleven times, and the FR-54 separation becomes positional rather than a matter of
telling two chips apart. This is most of the reason the page is not a wall of badges.

**3. No thresholds were invented, because CLAUDE.md §11 leaves them open.** Nothing decides a
fact is stale after N days — staleness comes only from `reviewDueAt` and `expiresAt` dates a
contributor actually stored. Dispute is structural: a field is contested when its revision
chain has **forked**, which is evidence Phase 3 already preserves, not a "revised more than N
times" guess.

**4. No percentages.** VR-14 shows "20% freshness, 28% confidence" and VR-03 "Community
Verified 98%". All illustrative (§8.6), and a percentage implies a precision we do not have.
The passport reports counts and dates and lets the reader weigh them.

**5. Invariant 12 is enforced by construction.** `RouteTrustInput` has no report count and no
field one could be inferred from, so the function that summarises a route cannot observe
reports at all. **Phase 9 must add reporting to a caution path, never to this one.** The
passport also ends with the sentence the invariant exists for: the absence of a warning is
not evidence that there is nothing wrong.

**6. One attention colour, not a maturity palette.** `--color-caution-*` says "there is
something here to read" and is identical for a disputed field, a shortened link and an
experimental route. It assigns no colour to any lifecycle state, so §11's open palette
decision stays open. Meaning never rests on it: every caution carries an icon and words.

**7. Link trust can only ever fall.** A declared class is a ceiling; no URL shape promotes a
link. Asserted over 13 URLs × 4 classes. Assigning `trusted` or `quarantined` is a
contribution and a moderation action — Phase 8 and Phase 9. Phase 6 delivers the capability
and the honest default: an unclassified link is a community submission, because silence is
not endorsement.

### Things that went wrong, and what they taught

**A source guard failed its own planted violation.** The monetisation guard used `...`
word boundaries and did not match `sponsoredRoutes` — camelCase leaves no boundary after
`sponsored`, which is the exact identifier shape a real violation takes. It now matches
unanchored stems. The planted-violation checks are the reason this was caught rather than
shipped as decoration.

**OF-6 has a second, independent cause.** Ten timed connects to a *demonstrably awake*
compute: successes took 2.4–8.8s, failures cut off at ~5.01s, four in ten failed. Not the
cold start of §12 and not the quoting bug either. It produced four test failures that looked
like three different problems — a fixture that rebuilt a full route in every test, a
global setup with no retry, and a search that loads every matching route's full graph. All
three were real and were fixed on their own terms. See `Test.md` §14.

The integration suite now gets a 20s connect timeout. **The application deliberately did
not**, because the same exposure on the deployed read path is a real user-facing question
that belongs to Phase 12 — widening it globally would have made the suite green and the
product question invisible.

### Phase 6 regression gate — verified on a container, not on a home network

Reported at first as *implementation complete, full regression gate pending*, because the
integration and E2E suites had not finished against the remote Neon branch. That gap is now
closed, and it is worth recording how rather than just that.

**GitHub Actions turned out to be reachable** without the `gh` CLI: the repository is public,
so `https://api.github.com/repos/Sowan3k/Project-V/actions/runs` and the per-job endpoints
answer unauthenticated. Only the raw log download needs admin rights; per-step conclusions do
not, and they are what matters.

Inspecting it exposed something the earlier report had wrongly assumed away: **CI had a
`verify` job and a `database` job and no E2E job at all.** Run #21 on the Phase 6 commit
`68be0b7` was green — but green over lint, typecheck, unit tests, build, migrations and the
integration suite only. It never executed Playwright. Claiming that run proved E2E would have
been false.

So E2E was added to CI against the same `postgres:18` service container, and **it failed on its
first run** — which is the entire argument for adding it. The failure was in the test: the spec
still clicked a *"See what has changed"* link that the navigation work had replaced with a
**History tab**, and `route.viewHistory` had been orphaned copy ever since. Nothing was
watching, because E2E only ever ran on a workstation. My replacement then failed a second time
on a race I introduced — reading the `h1` before the click navigation settled, so it captured
the search page's title.

**Final result — run #24, commit `b9348c3`, all three jobs green:**

| Job | What it actually executed |
|---|---|
| `lint · typecheck · test · build` | eslint · `tsc --noEmit` · **430** unit/architecture tests · production build |
| `schema · migration · integration` | migrations onto an **empty** database · schema-drift check · disposability marker · full integration suite |
| `end-to-end journey` | `npx playwright test` — **28** assertions at 360px and 1280px, JavaScript on and off |

**The remote-Neon failures were not a Phase 6 defect.** The same commit that could not finish
locally passes every job on a container; the variable was the network. And nothing was weakened
to get there — the Phase 3 interactive-transaction budget stays at 20 seconds. The only timeout
raised was `connect_timeout` in `vitest.db.config.mts`, which the application never reads.

### Blockers

None. OF-4 and OF-5 remain open by the owner's decision and block nothing. OF-6 is an
infrastructure and testing concern, not a Phase 6 architecture question, and its user-facing
half stays Phase 12 scope.

**One item for the owner, unrelated to the build:** every commit carries a failing
`Workers Builds: project-v` check from the `cloudflare-workers-and-pages` GitHub app. Nothing
here targets Cloudflare Workers and CLAUDE.md §4 puts it outside the architecture. Disconnecting
that integration is an owner action.

### Next step

**Phase 7 — identity and private journeys**, on approval. Auth.js with Google sign-in,
pseudonymous public handle, follow a route, private progress. Invariant tests 5, 5b, 6, 8 and
18 land there, and `src/domain/models.ts` already classifies journey state as private so it
stays out of the public revision engine.

Content track: the Germany worksheet still has UNVERIFIED sections (steps 1, 2, 5, 6, 7, 11,
12, 13), and Australia, USA and Malaysia have not started.

## Session 8 — 2026-09-02

**Goal:** Phase 5 — a Bangladeshi student can search and understand routes with no account.
Content track continues in parallel.

### Done

**The reading journey exists end to end.** Landing (VR-01) → search → ribbon → road → step →
field → history. All server-rendered, all anonymous.

| Page | Purpose |
|---|---|
| `/[locale]` | Minimal landing: Bengali headline, one primary action, how it works |
| `/[locale]/routes` | Search with a GET form; ribbons as results |
| `/[locale]/routes/[slug]` | The road, with in-place step expansion via `?step=` |
| `/[locale]/routes/[slug]/history` | Every revision, newest first |

**Anonymous is structural, not remembered.** No function in `src/server/routes/read.ts` takes
a session, an actor or a role. There is no parameter a caller could use to gate access, which
is a stronger guarantee than a convention about not checking one (FR-01, D-03). A test
requests every read URL directly and asserts none redirects anywhere resembling auth.

**Step expansion is a URL, not client state.** `?step=<id>` is deep-linkable, shareable and
survives JavaScript being off — proved by running the whole journey in a context with JS
disabled. Search is the first thing a visitor does and must not wait on a bundle (§8.1), and
many arrive on a phone browser on a slow connection.

**The renderer was reused unchanged.** Phase 4's architecture needed no integration changes:
the ribbon in search results and the road on the route page are the same component, from the
same graph, at two densities. Opening a route unfolds the same object rather than navigating
to a disconnected detail page (D-33, invariant 25). An integration test asserts search and
detail return identical step sets, so the two views cannot drift.

**The expected fly window is a range by type, not by convention.** `FlyWindow` has no field
that could be rendered as a single date, and `expectedFlyWindow` returns `null` rather than
guessing when a route has no timing. Verified that overlap is respected: the test route models
67 days, not the 97 a naive sum would give (invariant 16, §20.2).

**Production is still empty, deliberately.** The E2E server runs against the **test** database;
the seeded route says in its own summary that it is test data. Confirmed after the full run:
production has 0 routes, 0 steps, 0 fields.

### Decisions taken

| # | Decision | Why |
|---|---|---|
| 1 | **Search is a plain GET form, server-rendered.** | Deep-linkable, shareable and works with no JavaScript. The first interaction should resemble searching for a journey, not booting an application (§8.1). |
| 2 | **Step expansion via `?step=`, not client state.** | Makes "collapse the detail and return to the visual journey" (§8.3) a link, and makes any step in any route directly linkable. |
| 3 | **Fields show their source class as plain text now**, with badges deferred to Phase 6. | Invariant 11 says an official requirement and a community experience must never look alike. Showing nothing until Phase 6 would have misrepresented the data; showing a full trust surface would have been Phase 6's work. Plain text is the honest minimum. |
| 4 | **A real empty state that explains itself.** | §45's first risk is the empty platform. "No routes have been published yet — routes are researched from official sources and reviewed before they appear here" is honest. Inventing routes to look populated is the failure mode. |
| 5 | **E2E runs against the test database, not production.** | The journey spec needs a route to walk through. Seeding production would put unreviewed content in front of real visitors, which the content track forbids outright. |
| 6 | **Playwright assertion timeout raised to 15s.** | Every read page is server-rendered against a remote database whose compute scales to zero. The 5s default produced failures that looked like product bugs and were cold starts. |
| 7 | **Step rows show how much information they hold.** | Added while fixing a test that opened an empty step. It is genuinely useful — a reader can see where the detail is before clicking (VR-05). |

### Issues found

**The E2E seed was create-once, so it went stale.** It returned early if any route existed,
which meant a route seeded by an earlier run never gained fields added to the seed later, and
the journey spec failed against data that no longer matched its own setup. Nothing can be
deleted (the database refuses), so the seed now **converges** on the shape it wants rather
than assuming a clean slate. Worth remembering for every future fixture: in an append-only
system, seeds must be ensure-shaped.

**Three test defects of my own**, each mistaken for a product failure at first: an assertion
timeout too short for a cold database; a strict-mode clash once the brand appeared in both the
header and the landing headline; and a URL captured before client navigation settled, which
produced a request for `/en/routes/history`.

### Content track

Continues in parallel. `content/` holds worksheets only — no facts were added this session
and nothing was loaded into any database. The Bangladesh → Germany → Master's → Direct
admission worksheet remains `UNVERIFIED` by design, and `MODELLING-NOTES.md` still has an
empty findings table because no research has been carried out yet.

**This remains the project's biggest schedule risk.** The engineering is now far enough along
that a student could read a route — there simply are not any. Phase 6 does not change that.

### Blockers

**None.**

### Carried forward — not done

**OF-5, the account-scoped Neon API key.** Open by decision, with the agreed trigger: close it
when a phase actually needs automated Neon branch or project management (`Test.md` §11).

**OF-4, `CLAUDE.md` in public git history** — the owner's to remove manually.

**Shadow-route overlap** — recorded in Phase 4, untouched here as agreed. An overlay at
identical geometry is invisible; VR-07 shows side by side. Phase 10 owns it.

### Next step

**Phase 6 — trust, provenance and freshness surface.** Deliberately ordered before the
contribution loop: the day an unverified link can be added is the day it must already render
as unverified. Source-class badges, link trust with visible destination domain, route maturity
and lifecycle display, freshness and last-confirmed, volatility, dispute markers, and the
route passport summary.

---

## Session 7 — 2026-09-02

**Goal:** Phase 3 — make non-destructive, attributed, append-only writing the *only* physical
way shared knowledge can change, before any API, seed script or UI can write.

### Done

**One service owns every mutation.** `src/server/revisions/service.ts` — `createRoute`,
`addStep`, `addEdge`, `addField`, `reviseRoute`, `reviseStep`, `reviseEdge`, `reviseField`,
`confirmField`, `archiveField`, `archiveStep`, `archiveEdge`, `restoreField`. Each writes its
revision row and moves the current-state pointer inside one transaction. There is no delete
counterpart to anything.

**Enforcement is three independent layers.** Any one alone would be a convention; together
they are a property, and each catches what the others cannot:

| Layer | Mechanism | Catches |
|---|---|---|
| Static | ESLint: only `src/server/**` may import a database client | The mistake while it is being written |
| Runtime | Prisma client extension checking an async-local write context | Code that obtained a client another way — a seed script, a dynamic import, a future package |
| Database | Triggers refusing UPDATE/DELETE on revision tables and DELETE on shared knowledge | Everything else, including `psql` and a future migration |

The context is async-local rather than a parameter on purpose: a parameter can be passed by
anyone, which would make the guard decorative. The only way to be inside the context is to
have gone through the service.

**The client moved to `src/server/db/client.ts`.** It used to live in `src/lib/`, which meant
the boundary rule needed an exception for the one file that constructs a client. Moving it
inside the boundary removed the exception, and a rule with no exceptions is a much easier
rule to keep.

**Shared and private are classified, exhaustively.** `src/domain/models.ts` labels every model
revisioned-shared, private user state, or supporting, and a test asserts the registry covers
every model in the schema. A new model fails the build until somebody classifies it — so when
Phase 7 adds `Journey`, the decision gets made deliberately rather than inherited from
whichever file was copied. `Journey` and `JourneyStepProgress` are named in advance on the
private side, and the runtime guard deliberately does not restrict them: a journey note must
be editable in place by its owner and must never enter a public revision history (invariant 5).

**Diff moved into production code.** `src/domain/graph/diff.ts` names structural change —
added, archived, reordered, relabelled steps, and added, archived or retyped edges, counting
branch-forming connections separately. Proved in Phase 1's spike; this is the real one,
working on the same graph shape the validators and renderer use.

### The two defects the tests found

Both are concurrency bugs that no amount of reading the code would have surfaced, and both
would have silently lost a contribution in production — the exact failure this phase exists
to prevent.

**1. Deadlock.** Two contributors revising the same field at the same moment deadlocked.
Inserting a revision takes a share lock on the parent row for the foreign-key check; moving
the current pointer then needs an exclusive lock on that same row. Each transaction held what
the other wanted, Postgres killed one, and that contribution was gone.

*Fixed* by taking the parent row lock first, so both transactions queue on the same resource
in the same order. The lock is per row, so edits to different fields still run in parallel.

**2. Transaction timeout.** Once serialised, the five-way stress test failed differently:
Prisma's default 5-second interactive-transaction budget expired for the contributor at the
back of the queue, and Prisma aborted it.

*Fixed* by raising the budget to 20s with a 10s pool wait. Deliberately generous rather than
tuned — contention on a single field is rare, and quietly dropping someone's correction when
it happens is not an acceptable trade.

The five-way test exists because the two-way test passed after the deadlock fix and would
have hidden the timeout.

### Decisions taken

| # | Decision | Why |
|---|---|---|
| 1 | **Three enforcement layers, not one.** | Each fails differently. ESLint cannot see a dynamic import; the runtime guard cannot see `psql`; a trigger cannot explain itself to a developer at the moment they write the mistake. |
| 2 | **Async-local write context, not a parameter.** | A parameter is passable by anyone; being inside an async-local context requires having gone through the service. |
| 3 | **Hard delete of shared knowledge is refused even inside the service.** | There is no legitimate caller today. Phase 9's administrative removal for abuse or legal reasons will be a separate audited surface, not a flag on this one. |
| 4 | **The Prisma client lives inside the server boundary.** | An exception-free rule. The alternative was allowing one file to break the rule that protects everything else. |
| 5 | **Model classification is exhaustive and fails the build on a new model.** | The failure mode is a private journey note reaching a public history. That must not depend on somebody remembering. |
| 6 | **Confirming does not create a revision.** | Confirming is not editing. Revisions where nothing changed would pollute the history that the shadow route reads (§39.4). |
| 7 | **Integration tests refuse to run against an unmarked database.** | "Never test against production" was a convention in `Test.md`. The suite creates and archives real rows; the marker row makes the rule mechanical. Production has never carried it. |
| 8 | **The unguarded client is used in tests on purpose.** | Testing immutability through the guarded client would only prove the guard works. Using a raw client proves the *database* refuses. |

### Issues found

**My own enum guard was wrong, and I found it by tripping it.** It claimed to ignore prose in
comments but did not: a doc comment writing an enum value in markdown backticks is
indistinguishable from a template literal. Fixed by stripping comments before scanning —
block comments entirely, and only whole-line `//` comments, because truncating at a trailing
`//` could hide a real literal after a URL. Missing a comment is harmless; missing a
violation is not.

### Blockers

**None.**

### Carried forward — not done

**OF-5, the account-scoped Neon API key, is still pending.** Procedure in `Test.md` §11.
Needs an interactive terminal. Unchanged by this session.

**OF-4, `CLAUDE.md` in public git history**, remains the owner's to remove manually.

### Next step

**Phase 4 — the production route renderer**, built on Spike A's proven approach: the
hand-authored primitive library, one layout pass shared by ribbon and road, and genuine
proof of route-agnosticism through the structural-equivalence, generative, import-boundary
and no-identity-branching tests (Test.md 24–24f). The Phase 1 fixtures and the four
assertions promoted into `Test.md` §7 carry across.

Not started. Awaiting approval.

---

## Session 6 — 2026-09-02

**Goal:** Phase 2 — commit, in one migration, the two shapes no later phase can retrofit:
the route graph and the revision ledger.

### Done

**The migration is applied to `production`.** 9 tables, 4 new enum types, **zero `DROP`
statements**. Rehearsed on `phase-2-migration-rehearsal` first; `neon diff` afterwards
reports no schema difference between that branch and `production`. Phase 0's `platform_meta`
and its row count are untouched.

| Table | Holds |
|---|---|
| `users` | Pseudonymous contributor identity — minimal, so revision attribution is a real foreign key |
| `routes` | Permanent route identity: origin, destination, level, intake, mechanism, lifecycle, merge target |
| `route_revisions` | Revisable route content — title, summary |
| `steps` | Graph **nodes** |
| `step_revisions` | Label, category, and the timing that expresses overlap |
| `step_edges` | Graph **edges** — where ordering lives |
| `step_edge_revisions` | Edge kind, so a branch change is diffable |
| `fields` | Smallest community-maintained unit, with freshness and link trust |
| `field_revisions` | Typed values, source class, effective dates |

**Ordering lives in edges and nothing else.** There is no `orderIndex`, `position`,
`sequence` or `sortOrder` anywhere, and `tests/architecture/schema-shape.test.ts` fails the
build if one appears. Order is derived on every read by `rankSteps()`, so it cannot drift out
of step with the graph and there is no column for a later refactor to start trusting.

**Every revisable model has a revision model — edges included.** That is the one most likely
to be skipped, and Phase 1 showed exactly what skipping it would cost: without versioned
edges, a route can change shape and the shadow route can only say "some fields changed".

**Deletion is refused by Postgres, not by convention.** Every revision relation carries
`onDelete: Restrict`, and the integration test proves it: `prisma.step.delete` and
`prisma.route.delete` on rows with history both fail at the database. Invariants 1, 2 and 4
are now physical properties rather than promises.

**Concurrent edits survive at the database level.** `previousRevisionId` is deliberately
**not** unique. Two revisions sharing a parent is exactly a concurrent edit; a unique
constraint there would have made Postgres reject the second contributor's work. Proved with
two revisions written against one parent — all three retained, two sharing a parent.

**Graph validators and timeline ordering** (`src/domain/graph/`) reject cycles, self-loops,
orphans, unknown steps, duplicate active edges, unreachable steps and dangling rejoins,
reporting **all** violations at once rather than the first. They operate on the *active*
graph, because archived is not deleted and history may legitimately contain shapes the
current view no longer shows.

**A branching, overlapping route round-trips through Postgres.** Six steps, seven edges, two
`alternative` and three `rejoin` connections. It persists, reads back, validates clean, ranks
the two alternatives equal with the rejoin after them, and produces **parallel lanes** — the
total span is shorter than the sum of the durations, because language preparation and
document collection genuinely overlap. Flattening them would have inflated the fly window.

**CI now has a database job.** A `postgres:18` service container, migrations applied to an
empty database from scratch, a **drift check** that fails if the schema was edited without a
matching migration, then the integration suite. CI still never touches Neon.

### The FR coverage audit, owed since session 2

**Run, and it found two orphans.** FR-48 (Bangladesh origin specificity) and FR-54
(official/community separation) were in the baseline but claimed by no phase — the work was
scoped in both cases, the requirement simply was not cited. FR-48 now sits with the content
track, FR-54 with Phase 6.

**The audit rule itself was wrong.** "Every FR appears in exactly one phase" fails on nine
requirements that legitimately span two, because a mechanism and the surface that exposes it
are different work: FR-57 is the branching *schema* in Phase 2 and the branching *renderer*
in Phase 4; FR-12 is the write gate in Phase 3 and sign-in in Phase 7. Forcing those into one
phase each would have made the plan less accurate. The rule is now **at least one delivering
phase**, with Phase 1 citations treated as proofs rather than assignments.

It is `tests/architecture/fr-coverage.test.ts` now rather than an intention. It went two
sessions un-run as a manual task and then found real gaps; that is what a manual audit does.

### Decisions taken

| # | Decision | Why |
|---|---|---|
| 1 | **`currentRevisionId` is an explicit pointer, not "newest by timestamp".** | Under concurrent edits timestamps are ambiguous and a pointer is not. It also makes Phase 3's contract explicit: append a revision and move the pointer, in one transaction. |
| 2 | **`previousRevisionId` is not unique.** | Two revisions sharing a parent *is* the concurrency case. Making it unique would enforce last-write-wins at the database level and silently destroy a contributor's work — the opposite of invariant 2. |
| 3 | **Edge endpoints are immutable; only `kind` is revisable.** | Repointing an edge is archiving one connection and adding another. Mutable endpoints would make a structural diff lie about what changed. |
| 4 | **No unique constraint on `(fromStepId, toStepId)`.** | Archiving a connection and later re-adding it is legitimate, and a plain unique index forbids it. Duplicate *active* edges are rejected by the validator instead, where the rule can be scoped correctly. |
| 5 | **Typed value columns on `field_revisions`** — amount, currency, date, duration — alongside the always-present text. | The expected fly window and step timing must be computed (FR-56, §20). Retrofitting typed columns later would mean reparsing every historical value, which is precisely what this phase exists to prevent. |
| 6 | **A minimal `users` table now, not in Phase 7.** | Revision attribution should be a foreign key, not an unchecked string. Phase 7 adds the Auth.js columns and journeys on top; that is additive. |
| 7 | **Freshness lives on `fields`, not on revisions.** | `lastConfirmedAt` describes the field's standing, not any one value. Confirming is not editing, so it must not create a revision. |
| 8 | **A typed value map added to the enums module** (`StepEdgeKind.rejoin`). | The single-source guard caught a hardcoded `'rejoin'` in the validator — correctly. But a rule with no ergonomic alternative puts pressure on the test rather than the code. Now the correct form is typed and refactorable. |
| 9 | **Database tests excluded from `npm run test`, not left to self-skip.** | The main suite briefly reported "182 passed, 7 skipped". Skipped reads like dormant coverage; out-of-scope should read as out of scope. |

### Issues found

**The enum single-source guard fired on my own code**, on `src/domain/graph/validate.ts`,
for a hardcoded `'rejoin'`. That is the guard doing its job — but it exposed a design gap:
there was no non-hardcoded way to compare against an enum value. Fixed by adding typed value
maps to `src/domain/enums.ts`, so the correct form is now easier than the wrong one.

**The Phase 1 fixture set is not yet reimplemented against production code.** The renderer
tests remain 🟡 in `Test.md`: the approach is proven, but against throwaway spike code.
Phase 4 must carry the fixtures and the four assertions across.

### Blockers

**None.**

### Carried forward — not done

**OF-5, the account-scoped Neon API key, is still pending.** Procedure in `Test.md` §11.
Needs an interactive terminal. Unchanged by this session.

**OF-4, `CLAUDE.md` in public git history**, remains the owner's to remove manually.

### Next step

**Phase 3 — the revision write engine.** Make non-destructive, attributed, append-only
writing the *only* physical way shared knowledge can change, before any API, seed script or
UI can write. One service layer owning every mutation, each writing its revision row in the
same transaction, plus a test that fails if anything outside that layer writes these tables.

Phase 2 gave that engine somewhere safe to write. Phase 3 makes it the only door.

---

## Session 5 — 2026-09-02

**Goal:** Phase 1 — the two kill spikes. Answer the questions that would invalidate the
architecture, using disposable code, **before** Phase 2 commits a schema and Phase 4 commits
a renderer.

### Go/no-go answers

Both **GO**. Evidence in `Test.md` §2; assertions in `spikes/`; screenshots in
`spikes/renderer/out/` (gitignored, regenerate with `npm run spike:gallery`).

#### Spike A — ribbon-to-road renderer: **GO**

*Can one data-driven renderer draw every route shape, on a phone, with no route-specific code?*

Yes. 10 fixtures — 3-step, 4-step linear, 15-step wrapping, 20-step, optional branch,
alternative branch, three parallel activities, a rejoining divergence, and one route carrying
an archived step, a newly added step, a prior version and a scoped disruption at once — all
render legibly at 360, 768 and 1280 with **no per-fixture code**. No page-wide horizontal
overflow at any width.

Three findings worth more than the pass:

1. **Ribbon and road genuinely share one layout pass.** There is a single `layout()`; ribbon
   and road differ only in density constants. Step count and order are identical at both
   densities for all 10 fixtures, and adding a step changes both with no separate work.
   Invariant 25 is achievable by construction, not by discipline.
2. **The road adapts to a phone through a density constant alone.** `ROAD_NARROW` differs
   from `ROAD` only in `columnsPerRow` and sizing — no branching, no second code path, no
   mobile renderer. The 15-step route fits entirely within 360px in 8 rows, in correct order,
   with no horizontal scroll. Phase 4 should pick density from a media query.
3. **Serpentine wrapping is the right model for VR-04.** Odd rows run right-to-left so a wrap
   is a short hook, not a sweep back across the page.

#### Spike B — revision graph: **GO**

*Does a branching graph with append-only revisions support concurrent edits, structural
diffing and archival?*

Yes. The decisive test was the diff, and it passes on its own terms:

```
1 step added, route structure changed (2 branch connections), 1 field changed
```

It names the **branch connections** — `alternative` and `rejoin` — not merely a step count. A
shadow route built on this can say what changed, where and how much (FR-77). A diff that
could only count fields would have failed the phase.

Also proved: two contributors revising one field against the same parent revision keep all
three revisions with none lost, and the field reads `contested: true` — conflict surfaced,
never auto-resolved (invariant 15). A sequential edit chain is correctly *not* flagged.
Archived fields and steps leave the current projection and remain in history with actor and
reason. `project({ at })` reconstructs the route as it was when a follower started, which is
exactly what the shadow comparison needs.

### What the spikes actually caught

This is the return on doing them. Four real defects, none of which a fixture alone would have
found — every one is now a written assertion promoted into `Test.md` §7 for Phase 4:

| Defect | How it was caught |
|---|---|
| Dense ranks fanned lanes past the top edge — nodes at negative `y`, silently clipped | Generative test, seed 56 |
| Node coordinates are centres, so the leftmost marker overhung the viewBox | Tightening the assertion to the full box rather than the centre point |
| At ribbon density the lane gap was smaller than the marker height, so concurrent steps stacked and **the ribbon showed fewer steps than the road** | Looking at a screenshot, then encoded as a no-overlap invariant |
| Wrap connectors overshot by a fixed offset and were clipped at both canvas edges | Looking at a screenshot, then encoded as a connector-bounds invariant |

The third is the one that justifies the phase. It is a silent correctness bug in the exact
place invariant 25 lives — the ribbon under-reporting a route's shape — and it was invisible
to every assertion until a screenshot was inspected and the finding turned into a test.

### Decisions taken

| # | Decision | Why |
|---|---|---|
| 1 | **Ordering lives in typed edges, never in array position.** Spike shapes are `steps[] + edges[]` with `sequential`/`optional_branch`/`alternative`/`rejoin`. | Phase 2 has to commit this and cannot retrofit it. Using an ordered array in the spike would have proved nothing, since the whole question is whether a branching graph draws. |
| 2 | **Rank = longest path from a start node; shared rank means concurrent.** | Makes parallel activities and mutually exclusive alternatives fall out of the graph rather than needing a flag, and makes a rejoin land after both of its branches automatically. |
| 3 | **Density is a parameter, not a mode.** Ribbon, road and narrow road are three constant sets through one function. | The only way invariant 25 stays true without discipline. Also removes the need for a mobile renderer. |
| 4 | **Concurrency is detected structurally, via `basedOn`.** Two revisions sharing a parent is a conflict; a chain is not. | Gives invariant 15 ("conflict is shown, not hidden") a mechanical definition rather than a heuristic like edit frequency. |
| 5 | **Edges are versioned, and archival is a flag on an append-only log.** | Without versioned edges a branch change is undiffable. Without append-only, "archived is not deleted" is a promise rather than a property. |
| 6 | **Spikes run outside CI.** `npm run test` excludes `spikes/`; they run via `npm run spike:test`. | Throwaway code must never gate the build. It is still linted and typechecked, which keeps it honest. |
| 7 | **The placeholder palette stays placeholder.** Six category colours and the maturity labels are invented for the spike and labelled as such. | Those are open decisions (CLAUDE.md §11). A spike must not settle them by accident. |

### What ships from this phase

Nothing. That is correct and intended.

The durable outputs are: the fixture specification promoted into `Test.md` §7, the four
assertions listed above, and the two answers recorded here. `spikes/` is quarantined outside
`src/`, imported by nothing in `src/`, excluded from CI, and carries a README stating when to
delete it — once Phase 4 passes tests 24–24f against production code.

### Blockers

**None.**

### Carried forward — not done

**OF-5, the account-scoped Neon API key, is still pending.** Procedure in `Test.md` §11.
Needs an interactive terminal. Unchanged by this session.

**OF-4, `CLAUDE.md` in public git history**, remains the owner's to remove manually.

### Next step

**Phase 2 — route graph + revision ledger schema.** The one irreversible migration: `Route`
identity held separately from revisable content, `Step` nodes plus a `StepEdge` table forming
a DAG, `Field` rows with freshness columns, and revision tables for route, step, field **and
edge**. Phase 1 says the shapes work; Phase 2 commits them to Postgres.

Before Phase 2 closes, the FR coverage audit owed since session 2 must run: verify every
FR-01…FR-80 appears in exactly one phase (Phases.md, open plan items).

---

## Session 4 — 2026-09-02

**Goal:** Build Phase 0 — the foundation spine. First implementation session.

### Done

**Application scaffolding.** Next.js 15.5.25 (App Router) on React 19.2.8, TypeScript
strict (plus `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noUnusedLocals`),
Tailwind CSS 4 with a CSS-first theme, ESLint 9 flat config, Prisma 6.19.3, Vitest 4,
Playwright 1.62. Minimal shell only — header, footer, an "under construction" page, a
health probe. The VR-01 landing page, search and ribbons stay in Phase 5.

**Shared enums module — the piece everything downstream consumes.** `src/domain/enums.ts`
is the single hand-written home of all seven domain enumerations: field categories (11),
source classes (5), route lifecycle states (9), change severity (4), link trust classes
(3), challenge reasons (8), report reasons (8). Every value is traced to the baseline.
`prisma/schema/enums.prisma` is **generated** from it by `npm run prisma:enums`, and the
i18n label maps consume it through exhaustive `satisfies Record<...>` types, so adding a
value fails `typecheck` until every locale supplies a label.

**Prisma wired to Neon.** `url = DATABASE_URL` (pooled) for queries, `directUrl =
DATABASE_URL_UNPOOLED` for migrations, standard Node client — no edge driver, per the
Session 3 hosting decision. The schema is a folder, not a file, so the generated enum block
stays visibly separate from hand-written schema.

**Migration rehearsed, then applied.** Created branch `phase-0-migration-rehearsal`,
snapshotted it, applied the migration, wrote a row, re-applied (no-op), confirmed the row
survived — then applied the same migration to `production`. `neon diff` reports no schema
difference between the two. Production went from 0 tables / 0 enums to 7 enum types,
`platform_meta` and `_prisma_migrations`. The migration contains zero `DROP` statements.

**i18n scaffolding.** `src/app/[locale]/` with the root layout inside the locale segment,
so `<html lang>` is always the locale being rendered. Middleware redirects unprefixed
paths. `en` is the only active locale; Bangla is one entry in `LOCALES` plus one dictionary
file away, with no restructuring. Every user-facing string comes from the dictionary.

**Four architecture guards, each watched failing.** Writing a guard is not the same as
knowing it works, so each was deliberately violated and confirmed to fail the build before
the probe was removed (evidence in `Test.md` §2):

| Guard | Holds |
|---|---|
| Enum literal appears in exactly one file | CLAUDE.md §9 / Phase 0 exit criterion |
| Generated `enums.prisma` is not stale | Database and TypeScript vocabularies cannot diverge |
| No explicit `any` in `src/`, rule configured as an error | Phase 0 exit criterion |
| Renderer may not import seed / content / destination modules | Invariant 24, Test.md 24c |

**CI.** `.github/workflows/ci.yml` runs lint → typecheck → test → build on push to `main`
and on every PR, with dummy database URLs — the health route is `force-dynamic`, so nothing
queries a database at build time. The same chain was verified locally from a clean checkout.

**Results:** `lint` clean, `typecheck` clean, 84 Vitest tests pass, `build` succeeds, 10
Playwright assertions pass at 360px and 1280px, `/api/health` returns 200 against Neon.

### Decisions taken

| # | Decision | Why |
|---|---|---|
| 1 | **Phase 0 commits one table (`platform_meta`) plus the seven enum types — no domain tables.** | The route graph and revision ledger are Phase 2's single irreversible migration. Guessing at them now is exactly the mistake `Phases.md` is ordered to avoid. `platform_meta` gives the rehearsal a real object and lets `/api/health` prove Prisma reaches Neon; it holds no user data, no route knowledge and nothing revisable, so it sits outside invariants 1–4 by construction. |
| 2 | **Prisma 6.19.3, not 7.x or the 8.0 RC.** | 6.19 is the best-documented combination of the standard Node client, `directUrl`, and GA multi-file schema. Prisma 7 moves to driver adapters — moving parts we do not need and would be debugging during Phase 2's most important migration. Consistent with the existing decision to pin Next 15 rather than 16. |
| 3 | **Migrations are generated with `prisma migrate diff` and applied with `migrate deploy`.** | `prisma migrate dev` needs a shadow database and prompts interactively; it hung for ten minutes against Neon in a non-interactive shell. `migrate deploy` is what CI and production use anyway, so the agent path and the production path are now one path. Recorded in CLAUDE.md §4. |
| 4 | **Next's ESLint rules come from `@next/eslint-plugin-next` directly, not `eslint-config-next`.** | The shared config sets `eslint-config-next/parser` project-wide, which disables every type-aware rule — including `no-explicit-any`, a Phase 0 exit criterion. Found the hard way: the first lint run crashed. |
| 5 | **The enum-duplication test matches quoted string literals, not object keys.** | It targets the real failure mode — a hardcoded `=== 'official'` drifting away from the enum. The i18n label maps key by enum value, but they are typed `satisfies Record<FieldCategory, string>`, so TypeScript already refuses to compile a drifted dictionary. `quote-props: as-needed` keeps those keys unquoted so a literal cannot hide behind quotes. The reasoning is written into the test file. |
| 6 | **`.gitattributes` pins the repository to LF.** | The generated-enum test compares file bytes. A Windows clone with CRLF conversion would have failed it on a clean checkout with nothing actually wrong. The test also normalises line endings, so the guard cannot be defeated by an editor. |
| 7 | **No category colour palette defined.** | The exact maturity labels and colour palette are open decisions (CLAUDE.md §11). Phase 0 defines only neutral and brand tokens — inventing the six semantic category colours now would be answering an open decision by accident. |
| 8 | **No coverage reporting yet.** | Coverage of an empty shell is a meaningless number that invites optimising it. Revisit at Phase 3 with the revision engine. Recorded as a deliberate gap in `Test.md` §6, not left silent. |

### Deployment (approved during the session)

You approved linking the repository, so this is done and the last exit criterion is closed.

`main` was merged and pushed to `Sowan3k/Project-V`, and Vercel project
**`vindeshi-express`** (`prj_hglC3xtSYshW4poAdpcxQ0WvaGL7`) is linked to it with `main` as
the production branch. Every push now builds automatically.

- **Live:** `https://vindeshi-express-noor-mohammad-sowans-projects.vercel.app`
- Built in 45s with **no database configured**, which usefully confirms that `next build`
  never touches Postgres — the health route is `force-dynamic` and nothing else queries.
- **Playwright: 11/11 against the deployed build**, at 360px and 1280px. Phase 0 exit
  criterion "Playwright smoke test loads the deployed preview" is met.

**Deployment Protection is on** — correct, since the repository is private and the shell is
unfinished. Rather than weakening it, `e2e/deployment-access.setup.ts` was added: a
Playwright setup project that visits a short-lived share URL once, saves the resulting
cookie as storage state, and lets the browser projects reuse it. When `E2E_BYPASS_URL` is
unset — the local default — it does nothing. A share token lasts under a day, so automated
CI against a protected deployment should later use Vercel's Protection Bypass for
Automation secret as an `x-vercel-protection-bypass` header instead.

**The Neon–Vercel integration was then connected, and the deployment reaches the database:**

```
GET /api/health -> 200 {"status":"ok","database":"reachable","latencyMs":300}
```

The full smoke suite passes 11/11 against the deployment and 11/11 against a local build.
`Test.md` OF-3 is closed.

Two notes from that episode worth keeping:

- **Environment variables are snapshotted per deployment**, so adding one changes nothing
  until the next build. The first reading after the integration came from the previous
  build and was misleading; the Vercel runtime logs were decisive
  (`Environment variable not found: DATABASE_URL`). Read the logs, not the response body,
  when a deployment disagrees with local.
- **The integration created a second Neon branch, `vercel-dev`** (`br-lingering-brook-aeac0ycs`),
  for Vercel's Development environment. It branched after the migration, so `neon diff`
  reports no schema difference from `production` — verified, not assumed.

### Repository made public (during the session)

You switched the repository to public, which closed one item and opened a smaller one.

**CI is confirmed green — OF-2 closed.** The public API made the runs readable: **5/5
successful**, and the latest run's steps — Install, Lint, Typecheck, Unit and architecture
tests, Build — all pass in 80 seconds. `Test.md` §5 now records no open failures.

**History scanned before trusting it.** All 111 blobs in the full history were enumerated
and checked for connection strings, `npg_` passwords, Neon hostnames, API keys and
`sk-`/`ghp_`/`AKIA` tokens: **zero matches**. `.env.local` and `.neon` were never tracked;
`.env.example` has only ever held placeholders; no personal email appears.

**Three Neon identifiers are public, none of them credentials:** the project id, two branch
ids, and — the one that matters — a compute endpoint id in a `Test.md` verification row.
That endpoint id *is* the database hostname. It cannot be connected to without the
password, but publishing it removes a layer of defence in depth, and there is no Neon IP
allow list. The row is redacted going forward and the rule is written into CLAUDE.md §4 and
`Test.md` §10 — but redaction does not remove it from history, so the exposure is closed by
rotating the password, not by editing the tree.

**`CLAUDE.md` is no longer published.** You asked for it to stay local, so it is untracked
and gitignored. It remains on disk and is still read at the start of every session — nothing
about the working process changes. Two things are worth being explicit about: it was tracked
from commit `64f5a1c` until now, so it is **still readable in the public history** (removing
that needs a history rewrite and force push, which is a separate decision); and roughly 70
references to it across `Status.md`, `Phases.md`, source comments and tests now dangle for
anyone reading only the public repository, though they stay accurate for a full local
checkout. Recorded in `Test.md` §10.

**Rotation is now worth doing rather than optional.** Two things happened this session that
are each survivable alone: the connection string was pasted into a chat transcript, and the
database hostname became public. Together they are the two halves of the same credential.

**Worth confirming once in the Vercel dashboard:** that the Production environment's
`DATABASE_URL` points at the Neon `production` branch rather than `vercel-dev`. Both
branches currently have identical schemas and no data, so nothing is at risk today — but
from Phase 2 onwards, writing to the wrong branch would be a silent and expensive mistake.

### Left in place for you to review

Neon branch `phase-0-migration-rehearsal` (`br-dark-forest-aejlwdbw`) — you asked to keep
it. It costs nothing and preserves the rehearsal evidence. Delete it whenever you like:

```
neon branches delete phase-0-migration-rehearsal
```

### Issues found

**Two transitive npm advisories, both in build tooling, neither actionable without
reversing a recorded decision.**

- `postcss` (4 advisories, high) via `next`. Fixed only in `next@16.3.4`; every Next 15
  release is affected. CLAUDE.md §4 pins Next 15. The advisories concern processing
  untrusted CSS and attacker-controlled `sourceMappingURL`; we compile our own stylesheets
  at build time, so the exposure is a build-machine one, not a runtime one.
- `deepmerge-ts` (1 advisory, high) via the `prisma` CLI. `npm audit fix --force` would
  downgrade to `prisma@6.12.0`. Dev-time CLI only; it never runs in the deployed application.

Both are recorded rather than silently worked around. Re-evaluate when Next 16 is adopted.

**`CLAUDE.md` described `neon checkout <name>` as creating a throwaway branch.** It does
not — it pins an *existing* branch, and its `--env-pull` default rewrites local env files.
Branch creation is `neon branches create --name X`. §4 is corrected, and now carries the
rehearsal recipe that leaves `.env.local` and `.neon` untouched.

**`prisma migrate deploy` silently found no migrations** until `migrations.path` was set
explicitly in `prisma.config.ts` — it printed the right directory while looking elsewhere.
Worth remembering before Phase 2.

**Word held the MHT baseline copy open, which blocked `git checkout`.** Merging to `main`
failed with `unable to unlink old '..._Baseline.mht': Invalid argument` because WINWORD
had the file locked. Rather than killing your Word process — it might have held unsaved
work — `main` was moved forward with `git reset --soft` followed by a mixed reset, which
reaches the same commit without rewriting a single file. `git diff HEAD` then confirmed
the working tree matched the commit exactly before pushing. Worth knowing: keeping the
baseline open in Word will block any git operation that has to rewrite it.

### Carried forward — not done

**OF-5, the account-scoped Neon API key, is pending.** Full procedure in `Test.md` §11.
Deferred deliberately, not forgotten: it needs an interactive terminal, because the fix
rewrites `~/.claude.json` while an agent is running inside Claude Code. Worth doing sooner
rather than later — the key is also present in a VS Code Settings Sync artifact, so it may
already have propagated to other machines on that account, and revocation is the only thing
that makes those copies worthless.

**OF-4, `CLAUDE.md` in public git history, is the owner's to remove manually.**

### Next step

**Phase 0 is complete. All five exit criteria are met.**

Awaiting approval to begin **Phase 1 — kill spikes**: Spike A (ribbon-to-road renderer:
can one data-driven renderer draw every route shape on a phone with no route-specific
code?) and Spike B (revision graph: does a branching graph with append-only revisions
support concurrent edits, structural diffing and archival?). Both are throwaway code
driven by hand-written JSON fixtures — no database, no deployment, nothing shipped.

Before Phase 2 closes, the FR coverage audit still owed from session 2 must run: verify
every FR-01…FR-80 appears in exactly one phase (Phases.md, open plan items).

---

## Session 3 — 2026-09-02

**Goal:** Record five approved refinements to the plan. **No implementation.**

### Decisions taken

| # | Decision | Recorded in |
|---|---|---|
| 1 | DOCX is the frozen archival authority; `REQUIREMENTS.md` is a generated dev-readable *representation* with no independent authority; MHT is an optional browser copy. Requirements changes follow the formal process against the DOCX. | CLAUDE.md §2 |
| 2 | Invariant 24 unchanged in principle. **Enforcement replaced** — the repo-wide country-name grep is dropped as unreliable; genericity is now proved structurally. | CLAUDE.md §6, Test.md §3, Phases.md P4 + Gate 1 |
| 3 | Gate 3 keeps one golden-path Playwright test **plus** focused unit/integration tests per mechanism — additive, never a substitute. | Test.md §8 |
| 4 | Abuse-report screenshot/file upload **deferred from V1**. Structured, textual reports referencing the reported entity. No general upload/storage path. | CLAUDE.md §8.6, Phases.md P9 |
| 5 | **Vercel** is the initial hosting target with Neon. Cloudflare Workers explicitly out of the initial architecture; Cloudflare plugin not installed. | CLAUDE.md §4, Phases.md P0 |

### Why the grep test was wrong

The original Gate 1 check — "no country or destination name appears in any SVG or layout file"
— would have false-positived on legitimate content: destination names in route data, seed
content, i18n strings, `alt` text, test fixtures and accessibility labels. It also would not
have caught the actual failure mode, since route-specific logic can branch on an id or slug
without ever writing "Germany".

Replaced with four checks that prove genericity by construction:

- **Structural equivalence** — identical graph shape with a different destination must produce
  identical geometry. This is the direct proof; any destination-specific logic fails it.
- **Generative coverage** — random valid graphs (3–20 steps, mixed branch kinds) all render.
- **Dependency boundary** — lint-enforced: the renderer cannot import seed/content/destination
  modules.
- **Scoped identity check** — `src/renderer/**` only, no branching on route id, slug,
  destination or title.

The prohibition is on destination-specific *rendering logic and artwork*, not on destination
names existing in the product. That distinction is now explicit in invariant 24.

### Blockers

**None.** The Cloudflare plugin install is withdrawn, not blocked — decision 5 removed the need
for it.

### Next step

**Phase 0 is unblocked and ready to start on approval.** No remaining blocking decisions.

---

## Session 2 — 2026-09-02

**Goal:** Organise the visual references, verify the Markdown/MHT requirements copies, and fold
four new product decisions into the plan. **No implementation.**

### Done

**[Phases.md](Phases.md) created.** 14 phases plus a parallel content track and three
pre-launch gates. Synthesised from three independently-generated phase plans (dependency-first,
risk-first, vertical-slice). Ordering rationale: the route graph and the revision ledger are the
only two irreversible shapes, so they come first — preceded by throwaway **kill spikes** that
answer "does this work?" before we build on the answer.

**Visual references organised.** Folder renamed `Visual Refernces` → `Visual References`
(typo fix). All 13 PNGs inspected by content and renamed to canonical kebab-case. Integrity
verified: 13 valid PNGs, 13 unique hashes, byte sizes unchanged, no strays, no duplicates, no
image edited.

**`REQUIREMENTS.md` generated.** Verbatim Markdown copy of the DOCX baseline — 98 KB, 14,670
words, all 80 FR / 35 BR / 46 D. Now the preferred working copy.

**CLAUDE.md substantially extended:** requirements-format hierarchy (§2), data-driven SVG
wording (§4), **two new invariants 24–25** (§6), a full **Visual References section** (§8:
index, per-reference notes, 11 design principles, mockup exceptions, screen flow), and the
approved **support-link scope change** (§10.1). Sections renumbered 8→13.

**Test.md extended:** rendering invariant tests 24–25, a development-only **visualisation stress
route** spec (§7), and **pre-launch gate verification** (§8).

### Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Requirements working copy | **`REQUIREMENTS.md`** (generated Markdown) | MHT was 1.06 MB — 10.6× *larger* than Markdown, so it did not achieve its goal. DOCX stays archival; MHT stays browser-readable. |
| Route visuals | Data-driven renderer; primitives hand-authored, routes never | Community-created routes must draw with no developer involved — invariant 24 |
| Ribbon/road | One structure, one layout pass, two densities | Invariant 25; prevents two drifting designs |
| Renderer risk | Proven in a Phase 1 kill spike before schema is committed | If the visual model cannot express branching on a phone, that must surface in week two |
| Seeded content | Depth over count: 4 destinations, ≥1 excellent route each | Gate 2; UK/Canada only after, never instead |
| Support link | External Gumroad "pay what you want", Phase 12 | No payment code, no supporter flag — a supporter is indistinguishable to the system |

### Findings worth keeping

- **MHT premise was wrong, goal achieved anyway.** MHT is content-identical (verified: 47
  sections, 80 FR verbatim, 35 BR, 46 D, zero discrepancies) but 1.06 MB of Word HTML vs 98 KB
  of Markdown. Generating `REQUIREMENTS.md` serves the original intent properly.
- **VR-02 was not supplied** — 13 images for 14 canonical names. Not invented; recorded as
  missing in CLAUDE.md §8.4.
- **Six mockup/baseline contradictions found** and recorded in CLAUDE.md §8.6 — most seriously
  VR-08's "update goes live when confirmed by the community", which would invert the revision
  model into an approval workflow.

### Blockers

**Cloudflare plugin install** — *superseded by Session 3, decision 5.* Cloudflare is no longer
part of the initial architecture; the plugin is deliberately not installed.

**Partial workflow failure.** The phase-plan workflow's judge and FR-coverage-audit agents did
not run — session limit reached. The three source proposals completed and were synthesised
manually. Consequence: **phase FR assignments are authored, not machine-verified.** Recorded as
an open item in Phases.md; audit before Phase 2 closes.

### Next step

Await approval of the organised visual references and the revised plan. Then **Phase 0**.
Two things to settle first: hosting target (Vercel vs Cloudflare Workers — affects the Prisma
driver), and whether abuse reports may carry a screenshot attachment (VR-11).

> *Both settled in Session 3: Vercel, and no report uploads in V1.*

---

## Session 1 — 2026-09-02

**Goal:** Read the frozen requirements baseline and establish project scaffolding documents.

### Done

**Requirements baseline read in full.**
`Vindeshi_Express_Final_PreDevelopment_Requirements_Baseline.docx` (v2.0, 1 Sep 2026) —
all 47 sections, 80 functional requirements, 35 business rules, 46 decision-register entries.
Extracted to plain text for reference; counts verified (80 FR / 35 BR / 46 D).

**[CLAUDE.md](CLAUDE.md) created.** 12 sections: project intent and the nine explicit
non-goals, traceability rule, working-file protocol, stack, domain vocabulary, 23
non-negotiable invariants, UI/UX principles, code conventions, first-release scope, open
decisions, definition of done, session workflow. Every invariant is traced to FR/BR/D ids.

**[Test.md](Test.md) created.** Test ledger with a 23-row invariant checklist mirroring
CLAUDE.md §6, a feature coverage matrix, and a verification log.

**Neon Postgres provisioned and connected.** Full CLI setup: global install, OAuth login,
skills, MCP registration, project link, config init, deploy. Connectivity verified live
against PostgreSQL 18.6.

**Git repository initialised and pushed.** `main` tracking
`https://github.com/Sowan3k/Project-V.git`.

### Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Stack | Next.js 15 App Router + TypeScript strict, Prisma, Auth.js (Google), Tailwind | Relational modelling for routes/steps/fields/revisions; server rendering for anonymous SEO-able browsing; free-tier hosting matches §28.1 cost philosophy |
| Database | Neon serverless Postgres, project `young-river-98582189`, branch `production` | Provisioned this session; replaces the earlier "Neon **or** Supabase" placeholder in CLAUDE.md |
| Interface language | English UI, Bengali brand identity, i18n scaffolded day one | Fastest path to MVP; baseline §36 leaves language open, so Bangla can layer on without rework |
| Ribbon/road visuals | Hand-authored inline SVG, no chart library | The ribbon *is* the compressed route (D-33) — off-the-shelf charts cannot express it |
| Migration safety | `neon checkout` scratch branch for risky migrations | A migration dropping revision history violates invariant 2 and is unrecoverable from app code |

### Blockers

**1. GitHub remote — RESOLVED.**
First URL given was `https://github.com/S0wan/Project-V.git` (with a zero), which returned
`Repository not found`. Correct owner is `Sowan3k`. Remote updated to
`https://github.com/Sowan3k/Project-V.git`; `main` pushed and tracking. Verified that
`.env.local` and `.neon` are absent from the remote tree.

**2. Cloudflare plugin install blocked.**
Fetched and verified the official instructions at
`developers.cloudflare.com/agent-setup/prompt.md`. For Claude Code it prescribes exactly two
commands. There is no standalone `claude` binary on PATH (this is the VS Code extension); the
bundled `claude.exe` exists inside the extension, but the permission classifier blocks invoking
it from inside the agent. Did not hand-edit plugin state files — that risks corrupting the
install. **Needs the user to run:**

```
/plugin marketplace add cloudflare/skills
/plugin install cloudflare@cloudflare
/reload-plugins
```

### Security notes

- `neon mcp -y` minted an **account-scoped** API key (`neon-cli-mcp-20260901T201753Z-3083`,
  id `3303456`) and wrote it into six agent config files including `~/.claude.json` and
  VS Code's `mcp.json`. Neon's own warning: *"This key reaches everything your account can, in
  every organization."* Revoke with `neon api-keys revoke 3303456` if tighter scoping is wanted.
- `.env.local` (holds `DATABASE_URL`) and `.neon` are gitignored; confirmed via
  `git check-ignore` that nothing sensitive was staged.

### Open question for next session

Hosting target is currently Vercel. Cloudflare tooling was requested — if the intent is to host
on **Workers** rather than Vercel, that changes CLAUDE.md §4 and forces Prisma's edge-compatible
driver setup. Cheaper to settle before Phase 0 scaffolding than after.

> *Resolved in Session 3: Vercel + Neon, Node runtime, standard Prisma client. Cloudflare
> Workers is explicitly out of the initial architecture.*

### Next step

Begin **Phase 0** in [Phases.md](Phases.md) — scaffold the Next.js app, wire Prisma to the
Neon branch, and stand up Vitest + Playwright.

---

<!-- Add new sessions ABOVE this line, newest first. Template:

## Session N — YYYY-MM-DD
**Goal:**
### Done
### Decisions taken
### Blockers
### Next step
-->
