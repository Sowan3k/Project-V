# spikes/ — throwaway code. Nothing here ships.

Phase 1 of [Phases.md](../Phases.md) exists to answer two questions that would invalidate
the architecture, **before** Phase 2 commits a schema and Phase 4 commits a renderer:

| Spike | Question | Go/no-go |
|---|---|---|
| A — renderer | Can one data-driven renderer draw every route shape, on a phone, with no route-specific code? | All fixtures render legibly at 360 / 768 / 1280 with no per-fixture code |
| B — revision graph | Does a branching graph with append-only revisions support concurrent edits, structural diffing and archival? | The diff correctly describes a change involving a **branch**, not just a field edit |

## Rules for this directory

- **It is outside `src/`** and must stay there. Phase 1's exit criteria require the spike
  code to be deleted or clearly quarantined.
- **It is not production code and must not be imported by anything in `src/`.** Phase 4
  rebuilds the renderer properly, informed by what is learned here.
- **It is excluded from `npm run test`** so it never gates CI. Run it deliberately:
  `npm run spike:revision` and `npm run spike:renderer`.
- **The fixtures are the durable output.** They are promoted into `Test.md` §7 as the
  permanent visualisation stress-route spec and outlive this directory.
- Colours, spacing and wording here are placeholders. The category palette and maturity
  labels are open decisions (CLAUDE.md §11) and are **not** being settled by a spike.

## Deleting this

Once Phase 4 has a production renderer passing tests 24–24f, and Phase 2/3 have the real
graph and revision engine, delete `spikes/` entirely. `Status.md` records the answers; the
code has no further value.
