# Status.md — session log

Append-only record of what happened each session: work done, decisions taken, blockers, and
the next concrete step. **Update at the end of every session.** Newest session at the top.

Read this first when starting a session, then [Phases.md](Phases.md) and [Test.md](Test.md).

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

**Cloudflare plugin install** still needs the user (unchanged from Session 1):
`/plugin marketplace add cloudflare/skills` → `/plugin install cloudflare@cloudflare` →
`/reload-plugins`.

**Partial workflow failure.** The phase-plan workflow's judge and FR-coverage-audit agents did
not run — session limit reached. The three source proposals completed and were synthesised
manually. Consequence: **phase FR assignments are authored, not machine-verified.** Recorded as
an open item in Phases.md; audit before Phase 2 closes.

### Next step

Await approval of the organised visual references and the revised plan. Then **Phase 0**.
Two things to settle first: hosting target (Vercel vs Cloudflare Workers — affects the Prisma
driver), and whether abuse reports may carry a screenshot attachment (VR-11).

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
