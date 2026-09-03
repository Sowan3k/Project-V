/**
 * The route renderer's public surface.
 *
 * Everything a caller needs, and nothing that would let them reach around the layout pass.
 * The renderer may not import from seed, content or destination modules — enforced by the
 * ESLint boundary `vindeshi/renderer-import-boundary` (CLAUDE.md invariant 24, Test.md 24c).
 */
export { Ribbon, ResponsiveRoad, Road } from './route-visual'
export type { RouteAnnotations, RouteVisualProps, RouteVisualStrings } from './route-visual'
export { RIBBON, ROAD, ROAD_NARROW, layout } from './layout'
export type { Density, Layout, PlacedEdge, PlacedNode } from './layout'
export { CATEGORY_STYLE, EDGE_STYLE } from './primitives'
