# Status.md — session log

Append-only record of what happened each session: work done, decisions taken, blockers, and
the next concrete step. **Update at the end of every session.** Newest session at the top.

Read this first when starting a session, then [Phases.md](Phases.md) and [Test.md](Test.md).

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
