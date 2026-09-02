# CLAUDE.md — Vindeshi Express (ভিনদেশী এক্সপ্রেস)

Guidance for Claude Code when working in this repository.

---

## 1. What this project is

A **Bangladesh-first, community-maintained navigation and tracking platform for students
pursuing higher education abroad.** It is a public good, not a business.

A visitor searches `origin → destination → study level → intake`. Results appear as compact
visual **ribbons**. Opening a ribbon unfolds it into a **road** of ordered **steps**
(documents, IELTS, admission, funding, visa, departure). Each step expands into **fields**
(requirement, procedure, document, contact, address, link, cost, deadline, duration,
community experience, warning). A signed-in user can **follow** a route as a private
**journey**, mark progress, and see when the live public route changes underneath them.
The community maintains route accuracy through **ADD → UPDATE → CONFIRM → CHALLENGE**.

**One line:** *Compare the available ways to reach an overseas study destination, open a route
to understand every step, privately follow it as your own journey, and benefit continuously as
the community corrects and updates the public route.*

**Essence:** *People ahead on the journey leave the route clearer for the people coming behind them.*

### What this project is NOT — never build these

- A scholarship finder or university ranking site
- An education agency / consultancy / application submission service
- A document vault (no passports, transcripts, IELTS certificates, bank statements, visa documents, admission letters)
- A verification authority — we never verify a user's claimed progress
- A social feed, follower culture, or private-messaging network
- A paid-placement or sponsored-ranking marketplace
- Flight/accommodation booking, loans, jobs, travel sales
- AI-dependent — AI is not a core feature
- Dependent on third-party study-abroad data APIs for core route knowledge

---

## 2. Source of truth and traceability

The **frozen requirements baseline** (v2.0, 1 September 2026) contains 80 functional
requirements (FR-01…FR-80), 35 business rules (BR-01…BR-35), and 46 decision-register entries
(D-01…D-46). It exists in three formats — same content, different purposes:

| File | Role | Use it when |
|---|---|---|
| `..._Baseline.docx` | **The frozen archival requirements artifact.** The single authority. | Formal change process; sign-off; sharing with non-technical stakeholders. |
| `REQUIREMENTS.md` | **Preferred development-readable representation.** Plain Markdown, generated verbatim from the DOCX. | **Always — this is what you read during normal sessions.** |
| `..._Baseline.mht` | Optional browser-readable copy (Word "Single File Web Page"). | Reading in a browser. Not for agent sessions. |

**Read `REQUIREMENTS.md`. Do not parse the DOCX or MHT during normal work.** All three were
verified equivalent on 2026-09-02: all 47 sections, all 80 FR statements verbatim, all 35 BR,
all 46 D, zero discrepancies. The Markdown is ~4.7× cheaper to read than the DOCX's XML payload
and ~10.6× cheaper than the MHT, which despite being intended as the lightweight copy is
actually the heaviest (1.06 MB of Word-generated HTML).

**`REQUIREMENTS.md` is a representation, not a source.** It is generated, and it carries no
independent authority:

- **Never hand-edit it**, and never edit it to change a requirement. Editing the Markdown does
  not change the requirements — it only makes the copy wrong.
- A requirements change follows the **formal change process** against the DOCX: amend the
  frozen baseline, regenerate `REQUIREMENTS.md`, and record the change in `Status.md`.
- If the Markdown and the DOCX ever disagree, **the DOCX is correct** and the Markdown must be
  regenerated.

Rules for working against it:

- Every first-release behaviour must be traceable to the baseline (FR-80).
- If a feature cannot be traced to it, treat it as a **change request** — raise it, do not
  silently implement it (BR-35, §46.3).
- Cite requirement IDs in commit messages, PR descriptions and non-obvious code comments,
  e.g. `feat(revisions): non-destructive field update (FR-20, BR-03)`.
- When a baseline rule and an implementation convenience conflict, **the baseline wins**.
- The baseline deliberately prescribes no architecture. Architecture decisions live in this
  file and in `Phases.md`, not in the baseline.

---

## 3. Working files in this repo

| File | Purpose | When to update |
|---|---|---|
| `CLAUDE.md` | This file. Project rules, invariants, conventions. | When a durable rule or convention changes. |
| `Phases.md` | Ordered development phases, each with scope, exit criteria and FR coverage. | When a phase completes or scope shifts. |
| `Status.md` | Append-only session log: what was done, decisions made, blockers, next step. | **At the end of every session.** |
| `Test.md` | Test ledger: every test written/run, its result, and what remains untested. | **After every test run.** |
| `REQUIREMENTS.md` | Generated Markdown copy of the frozen baseline. | Never by hand — regenerate from the DOCX. |
| `Visual References/` | UI/UX mockups defining design intent. Indexed in §8. | When a mockup is added or replaced. |

`Status.md` and `Test.md` are the memory between sessions — read them at the start of a
session before touching code.

---

## 4. Tech stack (decided)

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript (strict) |
| Database | **Neon** serverless PostgreSQL 18.6 — project `young-river-98582189`, branch `production` |
| ORM | Prisma |
| Auth | Auth.js (NextAuth) — Google OAuth as primary sign-in |
| Styling | Tailwind CSS |
| Ribbon / road / shadow-route visuals | **Data-driven SVG renderer** built from a hand-authored library of reusable SVG primitives + CSS (no chart library). Primitives are hand-drawn; **routes never are** — see invariant 24. |
| Testing | Vitest (unit) + Playwright (E2E) |
| Hosting | **Vercel** (decided 2026-09-02) + Neon — free tiers, per §28.1 cost philosophy. Node runtime, standard Prisma client. **Cloudflare Workers is explicitly not in the initial architecture**; do not introduce it or its edge-driver requirements without an operational reason and a recorded decision. |
| Interface language | **English UI, Bengali brand identity.** i18n scaffolding from day one so Bangla can be added without rework. |

Scaffolding exists as of Phase 0 (2026-09-02). The standard commands are:

```bash
npm run dev            # local dev server
npm run build          # production build
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run test           # vitest — unit + architecture tests
npm run test:e2e       # playwright (E2E_BASE_URL targets a deployed preview)
npm run seed           # seed Bangladesh-origin baseline routes (no content yet)

npm run prisma:enums   # regenerate prisma/schema/enums.prisma from src/domain/enums.ts
npm run db:migrate     # prisma migrate dev — local schema change
npm run db:deploy      # prisma migrate deploy — apply committed migrations
npm run db:status      # is the linked branch up to date with prisma/migrations?
npm run db:objects     # list tables, enum types and row counts on the linked branch
npm run db:studio      # inspect data
```

Every `db:*` script is prefixed with `dotenv -e .env.local --`. A Prisma config file
(`prisma.config.ts`) disables Prisma's own `.env` loading, so the prefix is what supplies
`DATABASE_URL` and `DATABASE_URL_UNPOOLED` — do not drop it when adding a script.

**The Prisma schema is a folder, not a file.** `prisma/schema/schema.prisma` is
hand-written; `prisma/schema/enums.prisma` is generated from `src/domain/enums.ts` and must
never be edited by hand. Migrations live in `prisma/migrations/`.

**`prisma migrate dev` needs a shadow database and prompts interactively; it hangs against
Neon in a non-interactive shell.** For an agent session, generate the SQL and apply it
deterministically instead:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema --script
#   ...or --from-schema-datasource for an incremental migration; write the output to
#   prisma/migrations/<UTC timestamp>_<name>/migration.sql, then:
npm run db:deploy
```

### Neon

The Neon CLI is set up and the repo is linked to project `young-river-98582189`, branch
`production`. Branch policy lives in `neon.ts`.

```bash
neon config plan               # preview branch-policy changes (always run before deploy)
neon deploy                    # apply neon.ts policy + refresh .env.local
neon branches create --name X  # create a throwaway branch for risky migrations
neon checkout <name>           # pin an EXISTING branch in .neon (does not create one)
neon connection-string <name>  # pooled URL; omit --pooled for the direct URL
neon diff <name>               # git-style schema diff between branches
neon branches list             # what exists
neon me                        # check auth
```

`.env.local` holds `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` and `NEON_BRANCH`.
It is regenerated by `neon link` / `neon deploy` and is **gitignored — never commit it**.
Use `DATABASE_URL_UNPOOLED` for Prisma migrations, `DATABASE_URL` for app queries.

**Branch discipline:** the linked branch is `production`. Before running a destructive or
untested migration, create a scratch branch and test there — a bad migration that drops
revision history violates invariant 2 and is not recoverable from application code.

The rehearsal that does **not** disturb the linked context (`neon checkout --env-pull`
rewrites local env files; this does not):

```bash
neon branches create --name scratch-<what>
SCRATCH_POOLED=$(neon connection-string scratch-<what> --pooled | tail -1)
SCRATCH_DIRECT=$(neon connection-string scratch-<what>          | tail -1)
DATABASE_URL="$SCRATCH_POOLED" DATABASE_URL_UNPOOLED="$SCRATCH_DIRECT" npx prisma migrate deploy
DATABASE_URL="$SCRATCH_POOLED" node scripts/db-objects.mjs      # verify before and after
neon diff scratch-<what>                                        # confirm parity, then:
npm run db:deploy                                               # apply to production
```

Keep this table current — if a command changes, edit it here.

---

## 5. Domain model and vocabulary

Use these exact terms in code, database, UI copy and commit messages. Do not invent synonyms.

| Term | Meaning |
|---|---|
| **Route** | A public, community-maintained path describing one recognisable way to reach an overseas study objective. A persistent object with stable identity. |
| **Ribbon** | The compressed visual representation of a route in search results. **Not a card, not a preview** — it *is* the route, compressed. |
| **Road** | The expanded visual form of a ribbon: steps in sequence and timeline. |
| **Step** (Road Block) | A major stage — IELTS, academic documents, admission, scholarship, visa, departure. |
| **Field** | One information element inside a step. Has a category, source class, freshness and its own revision history. |
| **Journey** | A signed-in user's *private* followed instance of a public route. Live route + private progress. |
| **Revision** | A preserved prior state of a route/step/field. Never destroyed by normal users. |
| **Shadow Route** | The faded previous version rendered beneath/alongside the current road to reveal change scale and location. |
| **Confirm** | Positive signal that information is still current. |
| **Challenge** | Signal that information is obsolete, incorrect, misleading or suspicious. Carries a reason. |
| **Report** | Distinct from Challenge — flags *abuse or danger* (phishing, adult content, malware, impersonation, harassment, scam). |
| **Archive** | Removed from current view, retained in history. **Not deletion.** |
| **Expected Fly Window** | Approximate departure period inferred from the route timeline. A planning window, never a promise. |
| **Temporary Disruption** | Time- and location-scoped overlay (weather, strike, closure). Expires without rewriting the route. |

### Core entities (shape, not final schema)

```
User ──< Journey >── Route ──< Step ──< Field
                       │        │        └──< FieldRevision
                       │        └──< StepRevision
                       ├──< RouteRevision
                       ├──< Confirmation / Challenge / Report
                       ├──< TemporaryDisruption (date + location + process scope)
                       └──< RouteChange (severity, announcedAt, effectiveAt)

Journey ──< JourneyStepProgress (status, targetDate, actualDate, privateNote)
```

### Field categories (FR-51, §39.1)

`requirement` · `procedure` · `document` · `contact` · `address` · `link` · `cost` ·
`deadline` · `duration` · `community_experience` · `warning`

### Source classes (§21)

`official` · `institutional_public` · `community_confirmed` · `community_submission` · `disputed_under_review`

### Route lifecycle states (FR-11, §19)

`experimental` · `developing` · `established` · `quiet` · `stale` · `disputed` · `dormant` · `archived` · `removed`

### Change severity (FR-60, §41.2)

`informational` · `relevant` · `important` · `critical`

### Link trust classes (FR-34, §22.1)

`trusted` · `community_submitted` · `quarantined`

---

## 6. Non-negotiable invariants

These are the rules a coding agent is most likely to break by accident. Treat any code that
violates one as a bug, regardless of how convenient it is.

### Non-destructive knowledge

1. **Normal users never hard-delete shared route knowledge** (FR-19, BR-02). No delete
   endpoint reachable by a non-admin role for routes, steps or fields. Obsolete content is
   **challenged → archived**, never erased (FR-21, D-17).
2. **Every update writes a revision** (FR-20, BR-03, BR-21). Updating a field must create a
   new revision preserving the prior value, author identity and timestamp. No in-place
   overwrite that loses the previous value.
3. **Route creators do not own routes** (FR-44, BR-01, D-18). No owner gate on edits. Any
   signed-in user may revise a field another user revised (FR-69, §43.1).
4. **Archived is not deleted.** Archived content stays queryable in history views (FR-45,
   BR-15). Permanent removal is admin-only and reserved for abuse, legal or safety cases.

### Privacy

5. **A user's journey progress, dates and notes are never visible to any other ordinary user**
   (FR-26, BR-16, D-10). Every journey query must be scoped by the authenticated user's id.
   Aggregates must not be derivable back to an individual.
6. **Never require evidence upload to mark personal progress** (FR-25, BR-06, D-09). No file
   upload path exists in the journey flow at all.
7. **Do not collect** passport scans, transcripts, test certificates, bank statements, visa
   documents, admission letters, or private residential addresses (§24.1). Do not add fields
   for them "for later".
8. **Public changes never silently erase private progress** (FR-30, BR-17, D-12). A route
   revision must not cascade-delete or reset journey progress.

### Trust and truth

9. **Unknown content never inherits platform authority** (FR-67, BR-28, D-42). A
   community-submitted link or contact must render visibly as unverified. No embedding of
   untrusted external content inside platform chrome.
10. **Show the real destination domain before the user leaves** (FR-64, BR-29, §42.1).
    Never render a bare "Apply Here" link that hides its host. Shortened or obscured URLs are
    never `trusted` (FR-65).
11. **Official requirements and community experience are different claim types** (FR-54,
    BR-07, BR-22, D-22). A community experience must never overwrite an official requirement
    or share its field — they coexist with distinct labels.
12. **No reports does not mean safe** (BR-04, D-19). Never render a verified/safe badge
    derived from the absence of reports. New routes must visibly show limited maturity (FR-74).
13. **Trust is never purchasable** (FR-78, BR-13, BR-14, D-28, D-43). No sponsorship, ad
    placement or payment may influence route order, confidence, source class or badges. Ads,
    if ever added, render in a visually separate region and never inside route content.
14. **Raw counts never automatically decide trust** (FR-71, BR-32, §43.3). Follower counts,
    vote totals or report volume alone must never trigger deletion, archival, ranking boosts
    or trusted status. Burst or coordinated activity is treated differently from independent
    signals accumulated over time.
15. **Conflict is shown, not hidden** (FR-70, FR-53, BR-23, D-35). A frequently revised or
    contested field renders as disputed / frequently changed, not as settled fact.
16. **Estimates are labelled as estimates** (BR-18, D-30). Expected fly window and durations
    are planning aids. Never phrase them as guaranteed dates.
17. **Self-reported aggregates must say so** (FR-41, §26). Copy reads
    "116 users marked this journey completed" — never "116 verified visas".

### Structure

18. **A journey stays linked to the live route** (FR-27, D-11). Following does not fork a
    detached copy.
19. **Temporary disruptions are overlays, not revisions** (FR-32, FR-63, BR-08, BR-27, D-23).
    They carry date, location and process scope, and expire without altering the base route.
20. **Route merges preserve follower progress and history** (FR-40, FR-58, BR-25, D-38).
21. **Effective date beats edit date** when deciding whether a change affects a follower
    (FR-59, BR-26, D-39).
22. **Routes may branch and overlap** (FR-57, BR-24, D-37, §20.2). Do not model a route as a
    strictly linear array of steps — support parallel and alternative branches from the start.
23. **30-day dormancy applies only to unused new routes** (FR-38, FR-39, BR-10, D-20). An
    established route with no recent activity becomes quiet or stale and shows last-confirmed
    information — it is never auto-invalidated.

### Rendering

24. **Route visuals are data-driven and route-agnostic.** No country, destination, route, step
    count, branch structure or route version may require bespoke SVG artwork or route-specific
    frontend code. The renderer takes route data and produces the visual; a route created by a
    community contributor at 2am must draw correctly with no developer involved. Seeded and
    community-created routes use the identical rendering path (FR-13, FR-57, FR-72, D-37).

    Hand-authoring is permitted **only** for the reusable primitive library — road segment,
    curved segment, junction, step marker, optional branch, parallel branch, merge point, start
    marker, destination/fly marker, archived segment, new/changed segment, shadow segment,
    disruption indicator. Think LEGO bricks, not illustrations. If a fix requires touching SVG
    to make one specific route look right, the renderer is wrong — fix the renderer.

    **What is prohibited is destination- or route-specific *rendering logic and artwork*** —
    not the appearance of a destination name in the product. Country names legitimately appear
    in route data, seed content, i18n strings, alt text, fixtures and tests; none of that
    violates this invariant. The line is: the renderer must never branch on *which* route it
    is drawing.

    How this is enforced — see `Test.md` §3 (tests 24–24e):

    - **Structural equivalence.** Two routes with identical graph structure but different
      destinations, titles and ids must produce identical geometry — only labels differ. This
      is the primary proof: if any destination-specific logic exists, this test fails.
    - **Generative coverage.** Randomly generated valid route graphs (varying step count 3–20,
      branch kinds, parallelism, archived/new steps) all render to valid geometry. A renderer
      with special cases fails on inputs nobody special-cased.
    - **Dependency boundary.** The renderer module may not import from seed, content or
      destination modules — enforced by an ESLint import-boundary rule, not by convention.
    - **No identity branching.** A narrowly scoped check over the renderer directory only,
      asserting its code contains no comparison against route id, slug, destination or title.
      Scoped to `src/renderer/**`; deliberately *not* a repo-wide country-name grep, which
      would false-positive on legitimate data, labels and fixtures.

25. **Ribbon and road are one representation at two densities** (D-33, FR-04, FR-05). Both
    derive from the same route structure through the same layout pass; the ribbon is the road
    compressed. They are never two independently maintained designs. A step added to a route
    must appear in both without separate work. If a route's road shows eight stages, its ribbon
    shows those same eight stages compressed — never a different count or order.

---

## 7. UI and UX principles

- **Anonymous first.** Search, ribbons, roads, steps, fields, sources, history and safety
  indicators are all readable with no account (FR-01, D-03). Sign-in gates only *contribution*
  and *private tracking* (FR-12).
- **Visual continuity.** The ribbon must visually unfold into the same road — segment colours
  and order carry over. It must never navigate to a disconnected detail page (D-33, FR-05).
- **Colour communicates category, never alone.** Documentation / language and testing /
  admission / funding / immigration / travel each get a category colour, always paired with
  text and an icon. Meaning must never depend on colour, hover or fine visual detail (§32, §10.4).
- **Mobile is a first-class target.** Many students arrive via a phone browser (§32).
- **Low-friction contribution.** Confirm, Update, Challenge and Report must be reachable in
  minimal interaction, with no unnecessary form filling (FR-50).
- **Contribute at the moment of fresh knowledge.** After a follower marks a step complete,
  offer a lightweight "Was this still accurate?" prompt (FR-42, §16.5, D-36).
- **Change relevance over change volume.** Surface changes ahead of the follower's progress;
  do not force a full reread or notify on every edit (FR-29, FR-61, FR-76).
- **Shadow route shows scale and location of change**, not merely that something changed —
  e.g. "2 steps added, 1 archived, 3 fields changed" (FR-77, §14.1).
- **Never make the platform look like an agency** (§44.2).

---

## 8. Visual references

`Visual References/*.png` are the UI/UX mockups produced during product design. They define
**design intent**: visual direction, page hierarchy, interaction metaphors, layout, information
placement, responsive behaviour, and how trust, change, routes, steps, fields and journeys
should look.

### 8.1 Where they sit in the hierarchy

1. **`REQUIREMENTS.md`** (the frozen baseline) — what the product must *do*. Functional truth.
2. **`CLAUDE.md`** (this file) — how we build it. Invariants, terminology, conventions.
3. **`Visual References/`** — how it should *look and feel*. Design intent only.

**If a mockup conflicts with the baseline or this file, the mockup loses.** Every mockup
contains illustrative sample data — universities, dates, IELTS scores, visa rules, processing
times, follower counts, confidence percentages, usernames, contributor counts. **None of it is
factual, and none of it is seed data.** Read mockups for layout and interaction, never for content.

### 8.2 Index

| Ref | File | Screen | Purpose |
|---|---|---|---|
| VR-01 | `01-landing-minimal-home.png` | Landing | Minimal public entry point |
| VR-02 | *missing* | Route discovery | Not supplied — see 8.4 |
| VR-03 | `03-route-dashboard-ribbon-to-road.png` | Ribbon → Road | Core route expansion interaction |
| VR-04 | `04-route-detail-full-road-view.png` | Full road | Primary route visualisation, wrapping road |
| VR-05 | `05-step-detail-fields-view.png` | Step → Fields | Field table with source/freshness/confidence |
| VR-06 | `06-my-journey-private-tracker.png` | My Journey | Private progress tracking |
| VR-07 | `07-route-changes-shadow-comparison.png` | Route changes | Shadow-route comparison |
| VR-08 | `08-community-update-field-flow.png` | Update field | Contribution flow creating a revision |
| VR-09 | `09-create-new-route-build-road.png` | Create route | Contributor builds a new road |
| VR-10 | `10-updates-and-temporary-disruptions.png` | Updates | Permanent change vs temporary disruption |
| VR-11 | `11-report-safety-and-quarantine.png` | Report & Safety | Abuse reporting and quarantine |
| VR-12 | `12-responsive-route-search-and-browse.png` | Responsive search | Mobile route discovery |
| VR-13 | `13-responsive-road-and-step-experience.png` | Responsive road | Mobile route → step → field |
| VR-14 | `14-experimental-disputed-route-state.png` | Low-trust route | Experimental/disputed presentation |

### 8.3 Per-reference notes

**VR-01 — Minimal landing.** Anonymous first-time visitor. Bengali headline with English
subhead, `Find My Route` primary CTA, `How It Works` secondary, trust badges (Free / Community
Maintained / No Document Upload), Bangladesh→Germany curved-road illustration, popular
destinations. *This is the authoritative homepage direction — keep it minimal.* Complexity
appears only after the user acts.

**VR-03 — Ribbon → road dashboard.** The single most important reference. Search controls,
several horizontal coloured ribbons, one selected and expanded into a road beneath it, with
step list, step detail and a My Journey panel. Demonstrates invariant 25: a ribbon is **not a
card** — it is the compressed route, and opening it unfolds the same object.

**VR-04 — Full road view.** The road is visually dominant, numbered stages, expected duration,
expected fly window, followers, maturity. **Note the road wraps across three rows with curved
connectors** — the renderer must support wrapping (see invariant 24), not a single straight
line. Do not degrade this into a generic task checklist.

**VR-05 — Step → fields.** Shows the `Route → Step → Field` hierarchy. Field table columns:
Information, Source, Last Updated, Confidence, Your Status, Action. `Add New Field to this
Step`. Fields are the smallest community-maintained unit and change independently of the route.

**VR-06 — My Journey.** Signed-in follower. Private badge, overall progress, expected fly
window, per-step status with target/completion dates and private notes, upcoming deadlines,
recent route changes. `Public route + private progress = My Journey`. No evidence upload, no
verification, not visible to others.

**VR-07 — Shadow comparison.** "Your route when you started" beside "Current route (now)", with
added / removed / duration-changed markers, change summary counts, effective dates, and a "How
changes affect you" panel confirming completed steps remain valid. Must answer: what changed,
where, when, how much, does it affect me.

**VR-08 — Update field flow.** Contributor. Current value beside proposed value, with route /
step / field context, reason, source, staged review. An update creates a **new revision**;
prior values persist and others may later confirm, challenge or update again.

**VR-09 — Create new route.** Route Basics → Build Road → Add Fields → Review → Publish. Note
it models "Documents Preparation" as *one* step, not seven — the correct grouping instinct.
New routes publish as experimental; the creator does not own the route.

**VR-10 — Updates & disruptions.** Tabs by scope, severity levels (Critical / Important /
Relevant / Information), and the crucial distinction: "Germany adds new visa document" is a
**permanent route change**; "IELTS Dhaka centre closed 18–30 Sep due to flooding" is a
**temporary disruption** with date and location scope that expires without rewriting the route.

**VR-11 — Report & Safety.** Report categories, detail form, recently quarantined items,
quarantine explanation. **Report ≠ Challenge**: challenge means "this may be wrong", report
means "this may be dangerous". Normal users never get arbitrary delete.

**VR-12 — Responsive search.** Desktop discovery beside phone mockups: stacked filters, compact
ribbons, bottom tab navigation. Mobile is a reflow, never a scaled-down desktop screenshot.

**VR-13 — Responsive road/step.** Desktop route with one step expanded (actions, requirements,
tips, resources) beside phones showing compact route, expandable steps and step detail. Mobile
must not attempt to show all desktop panels at once.

**VR-14 — Experimental/disputed route.** The trust reference. Bangladesh→Canada with 1
contributor, 9 followers, **0 recent confirmations**, 3 fields needing review, 2 open
challenges, 20% freshness, 28% confidence, "Use with Caution", and a legend explaining
Established / Experimental / Under Review / Disputed. Anyone may create a route; that does not
make it trustworthy, and "no reports" is not a trust signal.

### 8.4 Missing reference

**VR-02 (route discovery / search) was not supplied** — 13 files for 14 canonical names. Its
described content is largely covered by the desktop half of VR-12 and the search controls in
VR-03. Do not invent it. If a dedicated discovery mockup is produced later, add it as
`02-route-discovery-search-and-ribbons.png` and update this index.

### 8.5 Visual design principles

1. **Progressive disclosure.** `Landing → Search → Ribbon → Road → Step → Field`. Never expose
   the whole application on the homepage.
2. **Ribbon-to-road continuity.** The ribbon is the compressed route; opening it should feel
   like the same object expanding. See invariant 25.
3. **The road is the primary metaphor.** Resist turning this into a generic checklist or
   project-management dashboard.
4. **Category colour, never colour alone.** Persistent semantic categories — documents /
   preparation, language / tests, admission / university, funding / scholarship, immigration /
   visa, travel / departure — always paired with text, status and icon.
5. **Restrained visual direction.** White and light backgrounds, generous whitespace, navy/blue
   brand, pastel category accents, rounded panels, subtle borders, very light shadows, clean
   icons, strong hierarchy. Avoid heavy gradients and shadows, clutter, decorative excess and
   generic SaaS-dashboard styling.
6. **Bengali identity, English interface.** Bengali brand and headline treatment; English UI.
   Do not translate the whole application unless that decision changes.
7. **Mobile is first-class.** Reflow intelligently; never scale the desktop layout down.
8. **Trust must be visible.** Established, Developing, Experimental, Quiet/Stale, Disputed and
   Quarantined must look materially different from one another.
9. **Uncertainty must be visible.** Official source, community confirmed, community submission
   and disputed information must never look equivalent.
10. **Private journeys feel linked but private.** Visually connected to the public route while
    unmistakably personal.
11. **Change is explained, not just flagged.** The shadow experience answers what changed,
    where, when, how much, and whether it affects this user.

### 8.6 Known mockup exceptions

Present in the mockups, **not** first-release behaviour. Do not implement from the image:

| Seen in | Exception | Why |
|---|---|---|
| VR-06, VR-13 | "Share Progress" / "Share" | Progress is private (FR-26, BR-16, D-10). Out of scope absent a formal change request. |
| VR-08 | "Update goes live when confirmed by the community"; "All updates are reviewed" | Contradicts the revision model. Updates create revisions and are visible; the community corrects afterwards (FR-16, FR-69, §43.1). **Do not build an approval gate.** |
| VR-13, VR-14 | "Verified Route" badge | We are not an admission or immigration authority. Show sources, last reviewed, maturity, confirmations — never a verification claim (BR-20). |
| VR-03, VR-12 | "Verified information", "Community Verified 98%" | Same reason. Reword to source/freshness language. |
| VR-10 | "Subscribe to Alerts" / "Get instant alerts" | Proactive external notifications are deferred (§35). In-app change visibility is the first-release mechanism. |
| VR-11 | "Safety Leaderboard" | §25 warns against turning contribution into a competitive points game. |
| VR-11 | Screenshot / file upload on the report form | **Deferred from V1 (decided 2026-09-02).** Reports are structured and textual, referencing the field, link, contact or content being reported. **Do not create a general upload or file-storage path for reports** — no upload endpoint, no blob storage, no attachment table. Journey tracking remains upload-free regardless (invariant 6). |
| VR-13 | 4.8/5 star route maturity | Maturity is computed from combined signals, not user ratings; popularity is not correctness (§21.1, BR-05). |
| All | Sample universities, IELTS/APS/visa requirements, fees, processing times, durations, follower counts, freshness and confidence percentages, usernames, destination statistics, external links | Illustrative only. Never seed data, never factual requirements, never pre-approved trusted sources. |

### 8.7 Intended screen flow

```
Anonymous visitor
  Landing → Find My Route → Route Search → Ribbons
    → Open Ribbon → Road → Step → Field

Signed-in follower
  Road → Follow Route → My Journey → Update Private Progress
    → Live Route Changes → Shadow Comparison → Continue Journey

Contributor
  Route / Step / Field → ADD | UPDATE | CONFIRM | CHALLENGE
    → Revision Created → Community Continues Correcting

New-route contributor
  Search → Route Missing → Create New Route → Build Road
    → Add Steps → Add Fields → Publish (Experimental) → Community Improves

Safety
  Field / Link / Contact → Report → Potential Quarantine
    → Review + Community Signals → Restore | Correct | Archive | Remove
```

---

## 9. Code conventions

- TypeScript strict mode. No `any` in domain code; model unions explicitly
  (`type SourceClass = 'official' | ...`).
- Domain vocabulary from §5 is used verbatim in table names, model names, route paths,
  component names and props: `Ribbon`, `Road`, `Step`, `Field`, `Journey`, `Revision`.
- **Enums live in one place** and are shared by the Prisma schema, TypeScript types and UI
  labels. Never duplicate a status string literal across files.
- Revisioned writes go through a single service function (e.g. `reviseField()`), never a raw
  `prisma.field.update()` scattered through route handlers. This is how invariant 2 stays true.
- Authorisation is checked server-side. Never rely on the client hiding a control.
- Journey queries always take the session user id as a required argument — make it impossible
  to construct one without it.
- Server Components by default; Client Components only where interaction requires it.
- Seed data for Bangladesh-origin routes lives in version control and is reviewable (FR-75).
- Commit style: `type(scope): summary (FR-xx, BR-yy)`.
- Migrations are additive and reviewed; never write a migration that drops revision history.

---

## 10. First-release scope (§34, §46.1)

Ship this, and only this:

- Bangladesh origin; a small set of manually seeded destinations — Germany, Australia, USA, Malaysia
- Anonymous search and route viewing
- Ribbon → road → step → field experience
- Signed-in route following, private progress, personal dates and notes (no uploads)
- Community creation of routes, steps and fields
- ADD / UPDATE / CONFIRM / CHALLENGE with non-destructive revision history
- Change propagation to followers preserving private progress
- Shadow-route comparison
- Freshness, maturity, volatility and dispute signals
- Temporary disruptions distinct from permanent changes
- Expected fly window and step timing
- Reporting, quarantine and trust separation for links, contacts and abuse
- Route dormancy and archival for unused experimental content
- Public-good neutrality

Deliberately deferred (§35, §46.2): email and other proactive alerts, additional origin
countries, volunteer maintainer governance, advanced statistics, advertising, multilingual UI
beyond English plus Bengali brand, research/archive browsing view.

### 10.1 Approved scope change — voluntary support link (2026-09-02)

**Status: approved, scheduled for the polish phase. Not core scope; nothing depends on it.**

Users who wish to help with operating costs may do so via an external **Gumroad
"pay what you want"** page. This is the only monetisation of any kind.

What it is:

- A link labelled **"Support Vindeshi Express"** — not "Donate" (avoid tax-deductible charitable
  framing) and not a purchase prompt.
- Placed unobtrusively: footer, About/Community area, or menu. It must never compete visually
  with `Find My Route`, route navigation or community contribution.
- The user **leaves the platform** and completes payment on Gumroad.

Hard constraints — this is a link, and nothing more:

- Vindeshi Express **never processes, stores or sees payment information**.
- **No** Gumroad API integration, payment tables, donor profiles, supporter status, receipts or
  payment verification. Adding any of these is a new change request.
- Supporting the project must have **zero effect** on route ranking, maturity, confidence,
  source classification, moderation outcomes, contributor reputation, feature access or any
  other trust mechanism. There is no supporter flag to condition behaviour on, because no such
  flag exists.
- The platform remains free: no paid features, no premium routes, no paid rankings.

This is consistent with, and bounded by, invariant 13 and BR-13/BR-14/FR-78 — trust cannot be
purchased. A supporter and a non-supporter are indistinguishable to the system by construction.

---

## 11. Open decisions — do not invent answers

These are unresolved in the baseline (§36). If work depends on one, flag it and use a clearly
labelled placeholder rather than silently choosing:

- Final public brand name (Vindeshi Express is a working candidate, not frozen — D-32)
- Exact route maturity label wording and colour palette
- Exact staleness thresholds for established routes (30 days applies only to dormant new routes)
- Exact quarantine and report numeric thresholds
- Exact contributor reputation labels and weights
- Precise seeded route list per destination
- Final tagline and public-facing Bengali terminology

---

## 12. Definition of done

A unit of work is done when:

1. It traces to a specific FR/BR/D id, recorded in the commit message.
2. `npm run lint`, `npm run typecheck` and `npm run test` pass.
3. No invariant in §6 is violated — check the list explicitly for anything touching deletion,
   revisions, privacy, trust badges or ranking.
4. `Test.md` is updated with what was tested and what remains untested.
5. `Status.md` is updated at session end with decisions, blockers and the next step.

---

## 13. Session workflow

**Start of session:** read `Status.md` → `Phases.md` (current phase) → `Test.md` (open gaps).

**During:** work the current phase; raise anything untraceable to the baseline as a change request.

**End of session:** append to `Status.md`; update `Test.md`; mark phase progress in `Phases.md`.
