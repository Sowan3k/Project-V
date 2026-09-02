import type { StepCategory } from '@/domain/enums'
import type { RouteGraph } from '@/domain/graph/types'

import { layout, RIBBON, ROAD, type Density } from './layout'
import {
  Connector,
  DestinationMarker,
  DisruptionIndicator,
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
  const disrupted = new Set(annotations.disruptedStepIds ?? [])

  const first = frame.nodes.at(0)
  const last = frame.nodes.at(-1)

  return (
    <svg
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      width={frame.width}
      height={frame.height}
      role="img"
      aria-label={strings.summary(frame.order.length)}
      className={className}
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

      {frame.edges.map((placed) => (
        <Connector key={placed.edge.id} placed={placed} />
      ))}

      {first === undefined ? null : <StartMarker node={first} label={strings.start} />}
      {last === undefined ? null : <DestinationMarker node={last} label={strings.destination} />}

      {frame.nodes.map((node) => (
        <StepMarker
          key={node.step.id}
          node={node}
          density={density}
          categoryLabel={strings.categories[node.step.category]}
          added={added.has(node.step.id)}
          addedLabel={strings.added}
          archivedLabel={strings.archived}
        />
      ))}

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
