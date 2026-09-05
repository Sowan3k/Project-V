import { GridRegion, PageGrid } from '@/components/layout'
import { rendererStrings } from '@/components/route-shared'
import type { ComparisonRow, ShadowComparison, StepChangeMark } from '@/domain/changes'
import type { RouteGraph } from '@/domain/graph/types'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { ROAD_NARROW, Road, type RouteAnnotations } from '@/renderer'

/**
 * The shadow route — Phase 10. FR-22, FR-77, §14.1, §14.2, VR-07.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Why this is side by side and not an overlay, which is what "shadow route" sounds like.**
 *
 * Phase 4 built the overlay primitives — `ShadowSegment`, `ShadowMarker` — and then found the
 * flaw by drawing with them: laying the previous version's geometry underneath the current one
 * makes it *invisible exactly when the two are similar*. And they are nearly always similar.
 * A route that gained one step is 90% identical, so 90% of the shadow sits precisely behind
 * the road drawn on top of it, and the only part a reader can see is the part they could have
 * found anyway. The comparison vanishes in the common case and survives only in the rare one.
 *
 * That is not a rendering bug to tune with opacity. It is the wrong encoding: two things at
 * the same coordinates cannot both be read.
 *
 * So the two versions get **their own space, aligned by step identity**. Step ids are stable
 * across revisions — Phase 3 guaranteed that — so the same step can be found on both sides and
 * put on one line, and a step present on only one side leaves a visible gap opposite it. The
 * numbered spine down the middle is what makes two columns read as one comparison instead of
 * two lists, and it is exactly what VR-07 shows.
 *
 * The Phase 4 primitives are not wasted and are not removed: an overlay still expresses
 * "something moved here" at ribbon density, where there is no room for two columns. What
 * changed is that the *comparison view* no longer asks geometry to carry a job it cannot do.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Invariant 24 is untouched, and that was the constraint.**
 *
 * Each side is the ordinary `Road`, given an ordinary `RouteGraph`, through the ordinary
 * layout pass. There is no comparison renderer, no second layout, and nothing here knows or
 * asks which route it is drawing — the alignment is done on data in `compareVersions` and the
 * rendering is done twice by the component every other page already uses. A route created by
 * a contributor at 2am compares correctly with no developer involved.
 *
 * Both sides deliberately use the **same density**, so the reader is comparing like with like.
 * `ROAD_NARROW` is chosen because each column is roughly half a canvas wide; that is a density
 * constant, which is the whole mobile strategy from Phase 4 reused rather than reinvented.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Mobile (CLAUDE.md §7.2).** `PageGrid` stacks its regions in source order below `lg`, so a
 * phone gets: then-road, now-road, then the aligned rows as a single column where each row
 * shows before above after. It is a different composition, not a squeezed desktop one.
 */

const MARK_STYLE: Record<StepChangeMark, string> = {
  step_added: 'border-brand-700/40 bg-brand-500/10 text-brand-900',
  step_archived: 'border-hairline bg-surface-muted text-ink-700',
  step_reordered: 'border-caution-500/40 bg-caution-50 text-caution-900',
  step_relabelled: 'border-caution-500/40 bg-caution-50 text-caution-900',
  step_retimed: 'border-caution-500/40 bg-caution-50 text-caution-900',
}

function MarkChip({ mark, dictionary: t }: { mark: StepChangeMark; dictionary: Dictionary }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${MARK_STYLE[mark]}`}
    >
      {t.changes.mark[mark]}
    </span>
  )
}

/**
 * The scale of change — §14.1's "2 steps added, 1 archived, 3 fields changed".
 *
 * Counts and nothing else. No percentage, no "how much this route churns" index, no verdict
 * on whether that is a lot. A reader deciding whether a route is worth trusting can weigh six
 * changes in a week themselves; a number claiming to have weighed it for them would be
 * inventing a threshold nobody has agreed (CLAUDE.md §7.3, §11).
 */
export function ChangeScale({
  comparison,
  fieldsChanged,
  dictionary: t,
}: {
  comparison: ShadowComparison
  fieldsChanged: number
  dictionary: Dictionary
}) {
  const { scale } = comparison
  const lines: string[] = []
  if (scale.added) lines.push(t.changes.stepsAdded(scale.added))
  if (scale.archived) lines.push(t.changes.stepsArchived(scale.archived))
  if (scale.reordered) lines.push(t.changes.stepsReordered(scale.reordered))
  if (scale.relabelled) lines.push(t.changes.stepsRelabelled(scale.relabelled))
  if (scale.retimed) lines.push(t.changes.stepsRetimed(scale.retimed))
  if (fieldsChanged) lines.push(t.changes.fieldsChanged(fieldsChanged))

  return (
    <section className="rounded-panel border border-hairline bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink-900">{t.changes.summaryTitle}</h2>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-ink-700">{t.changes.nothingYet}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-ink-700">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li className="text-ink-500">{t.changes.stepsUnchanged(scale.unchanged)}</li>
        </ul>
      )}
      {scale.archived > 0 ? (
        // Invariants 1 and 4: a reader seeing "1 step archived" must not conclude somebody
        // deleted it. Said here rather than as a global footnote, so it appears exactly when
        // it is the thing being read.
        <p className="mt-3 text-xs leading-5 text-ink-500">{t.changes.archivedIsNotDeleted}</p>
      ) : null}
    </section>
  )
}

function RoadPanel({
  graph,
  heading,
  subheading,
  dictionary: t,
  muted = false,
  annotations,
}: {
  graph: RouteGraph
  heading: string
  subheading: string
  dictionary: Dictionary
  muted?: boolean
  annotations?: RouteAnnotations
}) {
  return (
    <section className="rounded-panel border border-hairline bg-surface p-4">
      <h3 className="text-sm font-semibold text-ink-900">{heading}</h3>
      <p className="mt-0.5 text-xs text-ink-500">{subheading}</p>
      {/* Wide content scrolls inside its own box; the page never scrolls sideways. */}
      <div className="mt-3 overflow-x-auto">
        {graph.steps.length === 0 ? (
          <p className="text-sm text-ink-500">{t.changes.notPresentThen}</p>
        ) : (
          <Road
            graph={graph}
            density={ROAD_NARROW}
            strings={rendererStrings(t)}
            annotations={annotations}
            // The older side is drawn quieter, so a glance can tell which is which without
            // reading the headings. It is the same road, at the same density, not a
            // different rendering — only its opacity differs.
            className={muted ? 'opacity-60' : ''}
          />
        )}
      </div>
    </section>
  )
}

function RowSide({
  step,
  absentLabel,
}: {
  step: ComparisonRow['before']
  absentLabel: string
}) {
  if (step === null) {
    return <p className="text-sm text-ink-500 italic">{absentLabel}</p>
  }
  return (
    <>
      <p className="text-sm font-medium text-ink-900">{step.label}</p>
      {step.typicalDurationDays === null ? null : (
        <p className="text-xs text-ink-500">{step.typicalDurationDays} days</p>
      )}
    </>
  )
}

/**
 * The aligned rows — the part that answers "what exactly", after the roads answer "how much".
 *
 * One line per step, the ordinal between the two sides. A row with no marks says so plainly
 * rather than being hidden: VR-07 shows "No change" on six of its nine rows, and that is
 * right — a comparison that only listed differences would leave a reader unable to tell
 * "unchanged" from "not looked at".
 */
export function ComparisonRows({
  comparison,
  beforeHeading,
  afterHeading,
  dictionary: t,
}: {
  comparison: ShadowComparison
  beforeHeading: string
  afterHeading: string
  dictionary: Dictionary
}) {
  return (
    <section className="mt-6 rounded-panel border border-hairline bg-surface">
      <div className="hidden border-b border-hairline sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:px-4 sm:py-2">
        <h3 className="text-xs font-medium tracking-wide text-ink-500 uppercase">
          {beforeHeading}
        </h3>
        <span className="w-6" aria-hidden="true" />
        <h3 className="text-xs font-medium tracking-wide text-ink-500 uppercase">
          {afterHeading}
        </h3>
      </div>

      <ul className="divide-y divide-hairline">
        {comparison.rows.map((row) => (
          <li
            key={row.key}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-4"
          >
            <div className="min-w-0 sm:order-1">
              {/* On a phone the two sides stack, so each needs saying which it is. On a wide
                  screen the column headings above already do it. */}
              <p className="text-xs text-ink-500 sm:hidden">{beforeHeading}</p>
              <RowSide step={row.before} absentLabel={t.changes.notPresentThen} />
            </div>

            <div
              className="flex items-center gap-2 sm:order-2 sm:w-6 sm:flex-col sm:justify-center"
              aria-hidden="true"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-muted text-xs text-ink-500">
                {row.ordinal}
              </span>
            </div>

            <div className="min-w-0 sm:order-3">
              <p className="text-xs text-ink-500 sm:hidden">{afterHeading}</p>
              <RowSide step={row.after} absentLabel={t.changes.notPresentNow} />
              <div className="mt-1 flex flex-wrap gap-1.5">
                {row.marks.length === 0 ? (
                  <span className="text-xs text-ink-500">{t.changes.noChangeRow}</span>
                ) : (
                  row.marks.map((mark) => (
                    <MarkChip key={mark} mark={mark} dictionary={t} />
                  ))
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Row keys carrying one mark — the bridge from the comparison to the renderer's annotations. */
function marked(comparison: ShadowComparison, mark: StepChangeMark): string[] {
  return comparison.rows.filter((row) => row.marks.includes(mark)).map((row) => row.key)
}

/**
 * The whole comparison: two roads, the scale, and the aligned rows.
 *
 * `beforeLabel` is supplied by the caller because the same component serves two questions —
 * "the route when you started" for a follower (§14.2) and "the route before the most recent
 * change" for everyone else. The comparison is identical; only which date it is drawn against
 * differs, which is precisely why it takes a date rather than a journey.
 */
export function ShadowCompare({
  before,
  after,
  comparison,
  fieldsChanged,
  beforeLabel,
  beforeDate,
  dictionary: t,
}: {
  before: RouteGraph
  after: RouteGraph
  comparison: ShadowComparison
  fieldsChanged: number
  beforeLabel: string
  beforeDate: string
  dictionary: Dictionary
}) {
  return (
    <div>
      {/*
       * The scale of change leads, and the two roads share the width — Phase 12E, VR-07.
       *
       * This was three equal columns, and because the whole comparison is nested inside the
       * route body's eight-of-twelve region, each road was given about 285px. A road drawn
       * at 285px is not a road anybody can read, which defeats the point of showing two of
       * them: VR-07's whole idea is that you see the *shape* of the change before you read a
       * word of it.
       *
       * The counts are a two-line summary, not a third road-sized panel, so they belong
       * above rather than beside.
       */}
      <div className="mb-6">
        <ChangeScale comparison={comparison} fieldsChanged={fieldsChanged} dictionary={t} />
      </div>

      <PageGrid>
        <GridRegion span={6}>
          <RoadPanel
            graph={before}
            heading={beforeLabel}
            subheading={t.changes.asOf(beforeDate)}
            dictionary={t}
            muted
            // Steps that leave are drawn as departing on the older road — dashed, faded,
            // labelled. Without this the two roads differed only by a block being missing
            // from one of them, which a reader has to find by counting.
            annotations={{ archivedStepIds: marked(comparison, 'step_archived') }}
          />
        </GridRegion>
        <GridRegion span={6}>
          <RoadPanel
            graph={after}
            heading={t.changes.currentRoute}
            subheading={t.changes.asOf(t.changes.today)}
            dictionary={t}
            // And steps that arrive are outlined and labelled on the current one.
            annotations={{ addedStepIds: marked(comparison, 'step_added') }}
          />
        </GridRegion>
      </PageGrid>

      <ComparisonRows
        comparison={comparison}
        beforeHeading={beforeLabel}
        afterHeading={t.changes.currentRoute}
        dictionary={t}
      />
    </div>
  )
}
