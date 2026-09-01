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

`Vindeshi_Express_Final_PreDevelopment_Requirements_Baseline.docx` is the **frozen
requirements baseline** (v2.0, 1 September 2026). It contains 80 functional requirements
(FR-01…FR-80), 35 business rules (BR-01…BR-35), and 46 decision-register entries (D-01…D-46).

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

`Status.md` and `Test.md` are the memory between sessions — read them at the start of a
session before touching code.

---

## 4. Tech stack (decided)

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript (strict) |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | Auth.js (NextAuth) — Google OAuth as primary sign-in |
| Styling | Tailwind CSS |
| Ribbon / road / shadow-route visuals | Hand-authored inline SVG + CSS (no heavy chart library) |
| Testing | Vitest (unit) + Playwright (E2E) |
| Hosting target | Vercel + Neon/Supabase Postgres — free tiers, per §28.1 cost philosophy |
| Interface language | **English UI, Bengali brand identity.** i18n scaffolding from day one so Bangla can be added without rework. |

Scaffolding does not exist yet — Phase 0 creates it. Once it does, the standard commands are:

```bash
npm run dev            # local dev server
npm run build          # production build
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run test           # vitest unit tests
npm run test:e2e       # playwright
npx prisma migrate dev # apply schema changes locally
npx prisma studio      # inspect data
npm run seed           # seed Bangladesh-origin baseline routes
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

## 8. Code conventions

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

## 9. First-release scope (§34, §46.1)

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

---

## 10. Open decisions — do not invent answers

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

## 11. Definition of done

A unit of work is done when:

1. It traces to a specific FR/BR/D id, recorded in the commit message.
2. `npm run lint`, `npm run typecheck` and `npm run test` pass.
3. No invariant in §6 is violated — check the list explicitly for anything touching deletion,
   revisions, privacy, trust badges or ranking.
4. `Test.md` is updated with what was tested and what remains untested.
5. `Status.md` is updated at session end with decisions, blockers and the next step.

---

## 12. Session workflow

**Start of session:** read `Status.md` → `Phases.md` (current phase) → `Test.md` (open gaps).

**During:** work the current phase; raise anything untraceable to the baseline as a change request.

**End of session:** append to `Status.md`; update `Test.md`; mark phase progress in `Phases.md`.
