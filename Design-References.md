# Design-References.md — libraries to consider, and when

Saved 2026-09-03 at the owner's request, for the visual-design phase (Phase 12) rather than now.

These are **candidates, not decisions.** Nothing here is installed and nothing here is
approved. The point of writing them down with their trade-offs is that the choice gets made
deliberately, against this product's actual constraints, rather than because a library looked
impressive in a demo.

---

## The constraints any of these has to survive

Before evaluating a visual library, the non-negotiables it must not break:

| Constraint | Where it comes from |
|---|---|
| **Mobile is a first-class target.** Many students arrive on a phone browser. | CLAUDE.md §7, §32 |
| **The read path works with JavaScript disabled.** Proved by an E2E test today. | Phase 5 exit criteria |
| **Search must not wait on a bundle.** The first interaction is a search, not an app boot. | REQUIREMENTS.md §8.1 |
| **Meaning never depends on colour, hover or fine visual detail.** | CLAUDE.md §7, §10.4 |
| **Free-tier hosting; cost philosophy.** | REQUIREMENTS.md §28.1 |
| **Never look like an agency.** | REQUIREMENTS.md §44.2 |
| **Route visuals are data-driven and route-agnostic.** No bespoke artwork per route. | Invariant 24 |

A student in Dhaka on a slow connection is the person this product is for. A 500 KB WebGL
bundle to render a gradient is not a neutral choice for them.

---

## The candidates

### [react-three-fiber](https://github.com/pmndrs/react-three-fiber) — React renderer for three.js

**Where it could genuinely help:** nowhere in the core journey. The road and ribbon are SVG,
route-agnostic and must render identically as static markup (invariants 24, 25). Replacing that
with WebGL would break both.

**Where it might earn a place:** a landing-page hero, if a hero visual is ever wanted — and only
behind a static fallback, lazily loaded, and never in the path of search.

**Cost to be honest about:** three.js plus the fiber layer is a large dependency, it needs
JavaScript, and it needs a GPU. On a mid-range phone it is a battery and jank risk.

**Verdict for now:** not for route rendering. Reconsider only for a decorative hero, with a
measured budget.

### [liquid-glass-js](https://github.com/dashersw/liquid-glass-js) — glass/refraction effect

**Where it could help:** surface treatment on a small number of elements — a hero panel, a
sticky header — where depth would add hierarchy.

**Tension with existing guidance:** CLAUDE.md §8.5 asks for a restrained direction — white and
light backgrounds, subtle borders, *very light shadows*, and explicitly warns against heavy
gradients and decorative excess. A glass effect is close to that line.

**Verdict for now:** possible as a small accent. Would need to survive the contrast requirement
— text over a refracting background is a common accessibility failure.

### [shadergradient](https://github.com/ruucm/shadergradient) — animated shader gradients

**Where it could help:** a landing hero background.

**Cost:** WebGL again, plus continuous animation, which costs battery and is a motion concern.
Anything animated must respect `prefers-reduced-motion` — the global CSS already does this, and
a shader canvas would need to honour it explicitly rather than inherit it.

**Verdict for now:** hero only, behind a static gradient fallback, disabled under reduced
motion, and never blocking first paint.

### [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — UI/UX design intelligence

**Different in kind from the other three.** This is guidance rather than a runtime dependency,
so it carries no bundle cost and no accessibility risk. It is also already available in this
environment as loadable skills.

**Where it helps:** Phase 12, for palette, typography pairing and density decisions — and
specifically for the two things CLAUDE.md §11 still lists as open: the category colour palette
and the route maturity labels.

**Verdict for now:** the most immediately useful of the four, and the only one with no cost to
the student.

---

## How to decide, when the time comes

1. **The core journey stays SVG and server-rendered.** Ribbons, roads, steps and fields are the
   product. They must work with no JavaScript and no GPU.
2. **Decoration is opt-in and non-blocking.** Anything from the first three belongs at the
   edges — a hero, a background — lazily loaded, with a static fallback, behind
   `prefers-reduced-motion`.
3. **Measure before adopting.** A bundle-size and time-to-interactive budget on a throttled
   connection, not a desktop impression.
4. **"Not generic" is not the same as "heavy".** The thing that will stop this looking like a
   template is the road metaphor, the honest trust surface and the information architecture in
   CLAUDE.md §7.1–7.2 — not a shader. A distinctive product with a 4-second first paint on a
   phone in Dhaka has failed at the thing it was built for.
