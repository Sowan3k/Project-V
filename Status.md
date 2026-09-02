# Status.md — session log

Append-only record of what happened each session: work done, decisions taken, blockers, and
the next concrete step. **Update at the end of every session.** Newest session at the top.

Read this first when starting a session, then [Phases.md](Phases.md) and [Test.md](Test.md).

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

### Blockers

**Vercel preview deploys — needs your decision.** This is the one Phase 0 exit criterion
still open: *"Playwright smoke test loads the deployed preview."* The smoke suite passes
10/10 against a local production build and is already parameterised
(`E2E_BASE_URL=<url> npm run test:e2e`), so closing this is one command once a deployment
exists. What is missing is the deployment itself, and creating it is not mine to decide:

- Your Vercel account (`noor-mohammad-sowans-projects`, hobby plan) has no project for this
  repository.
- Linking `Sowan3k/Project-V` publishes the shell at a public URL.
- A working `/api/health` requires the Neon `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to be
  stored in Vercel — real database credentials leaving this machine for a third party.

Tracked as `Test.md` OF-1.

**CI has not been observed running on GitHub** (`Test.md` OF-2). The workflow is committed
and its exact command chain was verified locally in a clean checkout, but no GitHub Actions
run has executed. Closes on the first push.

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

**Left in place for you to review:** Neon branch `phase-0-migration-rehearsal`
(`br-dark-forest-aejlwdbw`). It is the rehearsal evidence and costs nothing to keep. Delete
it with `neon branches delete phase-0-migration-rehearsal` when you no longer want it — I
did not, because deleting is irreversible and nothing required it.

### Next step

**Phase 0 is complete except for the Vercel deployment.** Nothing in Phase 1 depends on it:
Phase 1 is two throwaway kill spikes driven by hand-written JSON fixtures, with no database
and no deployment. So the deploy decision can be settled in parallel rather than blocking.

Awaiting approval to begin **Phase 1 — kill spikes** (Spike A: ribbon-to-road renderer;
Spike B: revision graph).

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
