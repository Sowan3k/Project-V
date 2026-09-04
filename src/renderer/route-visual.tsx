import type { StepCategory } from '@/domain/enums'
import type { RouteGraph } from '@/domain/graph/types'

import { layout, RIBBON, ROAD, ROAD_NARROW, type Density } from './layout'
import {
  Connector,
  DestinationMarker,
  DisruptionIndicator,
  RibbonSegment,
  RoadSegment,
  ShadowMarker,
  ShadowSegment,
  StartMarker,
  StepMarker,
} from './primitives'

/**
 * The route visual — Phase 4.
 *
 * `Ribbon` and `Road` are the same component at two densities. There is no separate ribbon
 * implementation and no mobile implementation; the only thing that varies is a constants
 * object (CLAUDE.md invariant 25).
 *
 * Nothing here reads a route's identity. The component is given a graph, a density and
 * localised strings — never an id, slug, title or destination — so it cannot branch on which
 * route it is drawing even by accident (invariant 24).
 */

/**
 * Presentation state that is not part of the graph itself.
 *
 * Kept separate on purpose. Which steps are newly added, which are disrupted and what the
 * previous version looked like are all answers Phase 10's change engine will supply; the
 * primitives that draw them exist now and are proven to draw, without this phase inventing
 * the change model that feeds them.
 */
export interface RouteAnnotations {
  readonly addedStepIds?: readonly string[]
  /**
   * Steps to draw as departing — dashed, faded, labelled — even though this graph still
   * contains them as live (Phase 12).
   *
   * Needed by the shadow comparison and by nothing else. In the *older* of two versions an
   * archived step is not archived: it was live on that date, which is the whole point of
   * reconstructing it. Without this the "before" road drew a departing step identically to a
   * surviving one, so the two roads differed only by a block being absent from one of them —
   * a difference a reader has to find by counting rather than by looking.
   *
   * Route-agnostic like every other annotation: a list of ids the caller worked out, never
   * something this module decides (invariant 24).
   */
  readonly archivedStepIds?: readonly string[]
  readonly disruptedStepIds?: readonly string[]
  /** A previous version, drawn beneath as the shadow route (FR-77). */
  readonly shadow?: RouteGraph
}

/**
 * Every user-facing string the visual needs.
 *
 * Passed in rather than imported so the renderer holds no copy of its own and no dependency
 * on the dictionary — it stays a pure function of data (CLAUDE.md §4: no hardcoded strings).
 */
export interface RouteVisualStrings {
  readonly categories: Record<StepCategory, string>
  readonly start: string
  readonly destination: string
  readonly added: string
  readonly archived: string
  readonly disrupted: string
  /**
   * Formats a step duration in days as a phrase — "about 3 weeks". Passed in for the same
   * reason as every other string here: "weeks" is English, and English does not live in the
   * renderer.
   */
  readonly duration: (days: number) => string
  /** Accessible description of the whole visual, e.g. "Route with 8 steps". */
  readonly summary: (stepCount: number) => string
}

export interface RouteVisualProps {
  readonly graph: RouteGraph
  readonly strings: RouteVisualStrings
  readonly annotations?: RouteAnnotations
  readonly className?: string
}

function RouteVisual({
  graph,
  density,
  strings,
  annotations = {},
  className,
}: RouteVisualProps & { density: Density }) {
  const frame = layout(graph, density)
  const shadow = annotations.shadow ? layout(annotations.shadow, density) : null
  const added = new Set(annotations.addedStepIds ?? [])
  const departing = new Set(annotations.archivedStepIds ?? [])
  const disrupted = new Set(annotations.disruptedStepIds ?? [])

  const first = frame.nodes.at(0)
  const last = frame.nodes.at(-1)

  return (
    <svg
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      /**
       * **Scales to its container rather than to a pixel size — Phase 12C.**
       *
       * `width={frame.width}` pinned the drawing to whatever the density happened to
       * produce, which is how the ribbon ended up 160 pixels wide inside a 790-pixel search
       * result. With `w-full` and a viewBox the aspect ratio is preserved and the browser
       * fits the drawing to the row — and because `fitWidth` already normalised the *shape*,
       * a four-step ribbon and a twelve-step one now come out at similar heights instead of
       * one being twice as tall as the other.
       */
      role="img"
      aria-label={strings.summary(frame.order.length)}
      className={`h-auto w-full ${className ?? ''}`}
      /**
       * Fill the container, but never magnify past natural size.
       *
       * Without the cap, `w-full` scales a three-step road up to whatever the canvas gives
       * it and the cards come out enormous — the mirror image of the defect this phase is
       * fixing. The ribbon is unaffected because `fitWidth` already normalises it to ~960
       * units whatever the step count, so its cap is always above the container and it
       * always fills.
       */
      style={{ maxWidth: frame.width }}
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      {shadow === null ? null : (
        <g aria-hidden="true">
          {shadow.edges.map((placed) => (
            <ShadowSegment key={`shadow-edge-${placed.edge.id}`} placed={placed} />
          ))}
          {shadow.nodes.map((node) => (
            <ShadowMarker key={`shadow-node-${node.step.id}`} node={node} />
          ))}
        </g>
      )}

      {/* The carriageway, in its own layer beneath everything, so a wrapped row's curved
          return reads as the same continuous road rather than as a separate connector. */}
      {density.carriageway > 0 ? (
        <g aria-hidden="true">
          {frame.edges.map((placed) => (
            <RoadSegment key={`road-${placed.edge.id}`} placed={placed} density={density} />
          ))}
        </g>
      ) : (
        frame.edges.map((placed) => <Connector key={placed.edge.id} placed={placed} />)
      )}

      {first === undefined ? null : <StartMarker node={first} label={strings.start} />}
      {last === undefined ? null : <DestinationMarker node={last} label={strings.destination} />}

      {frame.nodes.map((node) => {
        // An annotated departure is drawn exactly as a genuinely archived step is, by giving
        // the marker the same input rather than a second code path.
        const drawn = departing.has(node.step.id)
          ? { ...node, step: { ...node.step, archived: true } }
          : node
        const duration =
          node.step.typicalDurationDays === null
            ? null
            : strings.duration(node.step.typicalDurationDays)

        return density.showLabels ? (
          <StepMarker
            key={node.step.id}
            node={drawn}
            density={density}
            categoryLabel={strings.categories[node.step.category]}
            duration={duration}
            added={added.has(node.step.id)}
            addedLabel={strings.added}
            archivedLabel={strings.archived}
          />
        ) : (
          <RibbonSegment
            key={node.step.id}
            node={drawn}
            categoryLabel={strings.categories[node.step.category]}
            archived={drawn.step.archived}
            added={added.has(node.step.id)}
            addedLabel={strings.added}
            archivedLabel={strings.archived}
          />
        )
      })}

      {frame.nodes
        .filter((node) => disrupted.has(node.step.id))
        .map((node) => (
          <DisruptionIndicator
            key={`disruption-${node.step.id}`}
            node={node}
            density={density}
            label={strings.disrupted}
          />
        ))}
    </svg>
  )
}

/**
 * The expanded road.
 *
 * `density` is a parameter so a caller can pass ROAD_NARROW on a phone. That is the whole
 * mobile strategy: Spike A proved a constants object is sufficient, so there is no second
 * implementation to keep in step.
 */
export function Road(props: RouteVisualProps & { density?: Density }) {
  return <RouteVisual {...props} density={props.density ?? ROAD} />
}

/**
 * The compressed ribbon.
 *
 * Not a card and not a preview — the same route through the same layout pass, drawn small.
 * Opening it unfolds the identical structure (D-33, FR-04, FR-05).
 */
export function Ribbon(props: RouteVisualProps) {
  return <RouteVisual {...props} density={RIBBON} />
}

/**
 * The road at whichever density the viewport can actually carry — Phase 12.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The gap this closes.** `ROAD_NARROW` has existed since Phase 4, which proved a phone
 * needs only a different constants object rather than a second renderer. Nothing ever
 * selected it. Every phone was therefore served the 5-column, ~890px desktop road inside a
 * horizontal scroller — which is precisely the "scaled desktop" CLAUDE.md §7 and VR-12
 * forbid. A reader on a 360px screen saw a fifth of a road and had to drag.
 *
 * At `ROAD_NARROW` the same route wraps at 2 columns instead of 5, so a phone gets a
 * genuinely different composition — more rows, shorter runs — rather than a shrunken one.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why both are rendered and toggled by CSS rather than chosen in JavaScript.**
 *
 * The application has **zero client components**, which is most of why it is fast, and a
 * `useMediaQuery` here would be the first — on the read path, which is the one page a student
 * on a slow connection must not wait for a bundle to see (Phase 5). A media query costs no
 * JavaScript at all, works before hydration because there is none, and works with scripting
 * disabled.
 *
 * The cost is one extra SVG in the markup. Both come from the *same* graph through the *same*
 * layout pass, so they cannot disagree about what the route contains (invariant 25), they
 * gzip together extremely well, and the hidden one is `display: none` so assistive technology
 * reads exactly one road.
 */
export function ResponsiveRoad(props: RouteVisualProps) {
  return (
    <>
      {/* Phone: 2 columns per row. A different composition, not a smaller one. */}
      <div className="sm:hidden">
        <RouteVisual {...props} density={ROAD_NARROW} />
      </div>
      {/* Tablet and up: the full 5-column road. */}
      <div className="hidden sm:block">
        <RouteVisual {...props} density={ROAD} />
      </div>
    </>
  )
}
