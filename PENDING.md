# Pending: what is left for you

Last updated 2026-10-17. This file lists only what an agent cannot do for you. The full reasoning
for each item is in `Phases.md`, under "Things you need to do".

## What was finished on 2026-10-17

Phase 14 (the Updates page), Phase 15 (the "what needs help" lists on each route), Phase 16 (the
version picker and the ribbon's follower and change counts), and the half of Phase 18 that needed
no decision from you (a reporter can see what happened to their report, and How it works explains
reporting). Five stale tests that had kept CI red on main since run #75 were fixed. Two
accessibility defects were fixed along the way. Details are in `Status.md` and `Test.md` §32.

## 1. Before anyone can use it

- [ ] **A2. Publish the Google OAuth consent screen.** While it is in "testing", only accounts you
  whitelisted can sign in. Google Cloud console, under your account.
- [ ] **A3. Make yourself an administrator in production.** Run `npm run admin:grant` against
  production. Until then nobody can withhold a reported phishing link.
- [ ] **A4. Decide the public name.** "Vindeshi Express" is still a working name. The domain, the
  consent screen and every shared link depend on it.
- [ ] **A5. Buy the domain, point it at Vercel, and set `AUTH_URL`.**

## 2. Before it is public

- [ ] **B1. Read and approve the privacy policy and terms.** Both are drafts and say so on the page.
- [ ] **B2. Give a contact address** for reports, takedowns and data requests.
- [ ] **B3. Decide how many edits an hour is normal.** There is no rate limiting yet. Give the
  numbers and an agent can build the limiter.
- [ ] **B4. Test a Neon restore once.** The revision history is the product, and nobody has tried
  restoring it.

## 3. The long one

- [ ] **C1. Research the launch routes:** Germany first, then Australia, USA and Malaysia. This is
  Gate 2, and it is weeks of work.
- [ ] **C2. Watch one Bangladeshi student who has never seen the site read a route.**
- [ ] **C3. Review the screenshots against the mockups (Gate 4).** CI now makes the contact sheet
  on every push to main. Open the latest CI run on the Actions tab, download the
  `visual-review-sheet` artifact, and open `index.html`. It now includes the Updates page, the
  needs-help list and How it works. Screens behind sign-in (My Journey, the account page's
  reports list, correcting and reporting a field) are listed on the sheet as not captured.

## 4. Decisions only you can make

Leaving any of these open is fine until something needs it.

- [ ] **D5. A deadlines view?** (Phase 17.) The data exists. No requirement asks for the view, so
  building it is a scope change.
- [ ] **D6. A public list of quarantined items?** (The rest of Phase 18.) Transparency against
  telling a scammer which links stopped working.
- [ ] **D7. Is advertising ruled out for good?** The terms page promises no ads; the baseline allows
  them to cover costs.
- [ ] **D8. Amend the baseline for account closure and the two legal pages, or remove them.** None
  of the three traces to a requirement.
- [ ] **Contribution items 5 and 6** in `Contribution-Design.md`: narrowing a claim's scope, and the
  dated first-hand observation. Both are new behaviour, so they need your approval under FR-80.
- [ ] **D1 to D4** (loading indicator, keeping Neon warm, staleness and report thresholds,
  reputation labels) stay open until real use needs them.

## 5. What an agent can do once you decide

- Rate limiting, once you give the B3 numbers.
- Phase 17, if you approve D5.
- The public quarantine list, if you approve D6.
- Contribution items 5 to 10, once 5 and 6 are approved.
- **One accessibility defect that needs a small design call.** On a phone, a long route's ribbon
  scrolls sideways inside its search result, and that scroll area cannot be reached by keyboard
  (WCAG scrollable-region rule). It appears once real routes with 10+ stages exist. The choice is
  between letting the ribbon compress to fit a phone, or keeping the scroll and making it a
  separate focusable element. Either is a small job; say which, or let the next session pick.

## How to check today's work

CI runs on every push to main: https://github.com/Sowan3k/Project-V/actions. Locally,
`npm run lint`, `npm run typecheck` and `npm run test` should all be green.
