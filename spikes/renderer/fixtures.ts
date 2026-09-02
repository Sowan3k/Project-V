import type { RouteGraph } from './types'

/**
 * Spike A fixtures — the required stress cases from Phases.md §Phase 1 and Test.md §7.
 *
 * Hand-written, no database. These are the durable output of the spike: they get promoted
 * into Test.md as the permanent visualisation stress-route spec and outlive `spikes/`.
 *
 * Labels name real-world stages because that is what routes contain, and destination names
 * appear in route *data*. Neither violates invariant 24, which prohibits destination-specific
 * rendering *logic*, not destination names in content (CLAUDE.md §6.24).
 *
 * Every number, requirement and duration here is invented for layout testing. **None of it
 * is seed data and none of it is factual** (CLAUDE.md §8.6).
 */

const seq = (from: string, to: string) => ({ from, to, kind: 'sequential' as const })

/** 1. The simple case that must not be broken by supporting the hard ones. */
export const linear4: RouteGraph = {
  id: 'fx-linear-4',
  title: 'Linear, 4 steps',
  destination: 'Placeholder A',
  steps: [
    { id: 'a', label: 'Documents', category: 'documents' },
    { id: 'b', label: 'Language test', category: 'language' },
    { id: 'c', label: 'Admission', category: 'admission' },
    { id: 'd', label: 'Departure', category: 'travel' },
  ],
  edges: [seq('a', 'b'), seq('b', 'c'), seq('c', 'd')],
}

/** 2. Long enough to wrap across rows — VR-04's three-row road. */
export const wrapping15: RouteGraph = {
  id: 'fx-wrapping-15',
  title: 'Wrapping, 15 steps',
  destination: 'Placeholder B',
  steps: [
    { id: 's1', label: 'Research options', category: 'documents' },
    { id: 's2', label: 'Academic transcripts', category: 'documents' },
    { id: 's3', label: 'Attestation', category: 'documents' },
    { id: 's4', label: 'Language test', category: 'language' },
    { id: 's5', label: 'Shortlist courses', category: 'admission' },
    { id: 's6', label: 'Statement of purpose', category: 'admission' },
    { id: 's7', label: 'References', category: 'admission' },
    { id: 's8', label: 'Submit applications', category: 'admission' },
    { id: 's9', label: 'Offer received', category: 'admission' },
    { id: 's10', label: 'Financial proof', category: 'funding' },
    { id: 's11', label: 'Scholarship round', category: 'funding' },
    { id: 's12', label: 'Visa file', category: 'immigration' },
    { id: 's13', label: 'Biometrics', category: 'immigration' },
    { id: 's14', label: 'Visa decision', category: 'immigration' },
    { id: 's15', label: 'Fly', category: 'travel' },
  ],
  edges: Array.from({ length: 14 }, (_, i) => seq(`s${i + 1}`, `s${i + 2}`)),
}

/** 3. Reachable but skippable. */
export const optionalBranch: RouteGraph = {
  id: 'fx-optional',
  title: 'Optional branch',
  destination: 'Placeholder C',
  steps: [
    { id: 'a', label: 'Documents', category: 'documents' },
    { id: 'opt', label: 'Bridging course', category: 'admission' },
    { id: 'b', label: 'Admission', category: 'admission' },
    { id: 'c', label: 'Visa', category: 'immigration' },
  ],
  edges: [
    seq('a', 'b'),
    { from: 'a', to: 'opt', kind: 'optional_branch' },
    { from: 'opt', to: 'b', kind: 'rejoin' },
    seq('b', 'c'),
  ],
}

/** 4. Mutually exclusive paths — the IELTS-vs-PTE case named in Phases.md. */
export const alternativeBranch: RouteGraph = {
  id: 'fx-alternative',
  title: 'Alternative branch (IELTS or PTE)',
  destination: 'Placeholder D',
  steps: [
    { id: 'a', label: 'Documents', category: 'documents' },
    { id: 'ielts', label: 'IELTS', category: 'language' },
    { id: 'pte', label: 'PTE', category: 'language' },
    { id: 'b', label: 'Admission', category: 'admission' },
    { id: 'c', label: 'Visa', category: 'immigration' },
  ],
  edges: [
    { from: 'a', to: 'ielts', kind: 'alternative' },
    { from: 'a', to: 'pte', kind: 'alternative' },
    { from: 'ielts', to: 'b', kind: 'rejoin' },
    { from: 'pte', to: 'b', kind: 'rejoin' },
    seq('b', 'c'),
  ],
}

/** 5. Two things genuinely running at the same time (REQUIREMENTS.md §20.2). */
export const parallelActivities: RouteGraph = {
  id: 'fx-parallel',
  title: 'Parallel activities',
  destination: 'Placeholder E',
  steps: [
    { id: 'a', label: 'Decide destination', category: 'documents' },
    { id: 'p1', label: 'Language prep', category: 'language' },
    { id: 'p2', label: 'Document collection', category: 'documents' },
    { id: 'p3', label: 'Financial planning', category: 'funding' },
    { id: 'b', label: 'Apply', category: 'admission' },
    { id: 'c', label: 'Visa', category: 'immigration' },
    { id: 'd', label: 'Fly', category: 'travel' },
  ],
  edges: [
    seq('a', 'p1'),
    seq('a', 'p2'),
    seq('a', 'p3'),
    { from: 'p1', to: 'b', kind: 'rejoin' },
    { from: 'p2', to: 'b', kind: 'rejoin' },
    { from: 'p3', to: 'b', kind: 'rejoin' },
    seq('b', 'c'),
    seq('c', 'd'),
  ],
}

/** 6. A divergence that reconnects downstream, mid-route. */
export const rejoiningBranch: RouteGraph = {
  id: 'fx-rejoin',
  title: 'Diverge and reconnect',
  destination: 'Placeholder F',
  steps: [
    { id: 'a', label: 'Documents', category: 'documents' },
    { id: 'b', label: 'Language test', category: 'language' },
    { id: 'uni', label: 'Direct application', category: 'admission' },
    { id: 'agent', label: 'Uni-assist route', category: 'admission' },
    { id: 'c', label: 'Offer', category: 'admission' },
    { id: 'd', label: 'Financial proof', category: 'funding' },
    { id: 'e', label: 'Visa', category: 'immigration' },
    { id: 'f', label: 'Fly', category: 'travel' },
  ],
  edges: [
    seq('a', 'b'),
    { from: 'b', to: 'uni', kind: 'alternative' },
    { from: 'b', to: 'agent', kind: 'alternative' },
    { from: 'uni', to: 'c', kind: 'rejoin' },
    { from: 'agent', to: 'c', kind: 'rejoin' },
    seq('c', 'd'),
    seq('d', 'e'),
    seq('e', 'f'),
  ],
}

/** 7 + 8 + 9. Archived step, newly added step, a previous version for the shadow overlay, and a disruption. */
export const evolvedRoute: RouteGraph = {
  id: 'fx-evolved',
  title: 'Archived, added, shadow and disruption',
  destination: 'Placeholder G',
  disruptedStepIds: ['lang'],
  steps: [
    { id: 'a', label: 'Documents', category: 'documents' },
    { id: 'lang', label: 'Language test', category: 'language' },
    { id: 'old', label: 'Retired embassy step', category: 'immigration', state: 'archived' },
    { id: 'new', label: 'New biometrics step', category: 'immigration', state: 'added' },
    { id: 'b', label: 'Admission', category: 'admission' },
    { id: 'c', label: 'Visa decision', category: 'immigration' },
    { id: 'd', label: 'Fly', category: 'travel' },
  ],
  edges: [
    seq('a', 'lang'),
    seq('lang', 'b'),
    { from: 'b', to: 'old', kind: 'optional_branch' },
    seq('b', 'new'),
    { from: 'old', to: 'c', kind: 'rejoin' },
    { from: 'new', to: 'c', kind: 'rejoin' },
    seq('c', 'd'),
  ],
  previous: {
    id: 'fx-evolved-prev',
    title: 'Previous version',
    destination: 'Placeholder G',
    steps: [
      { id: 'a', label: 'Documents', category: 'documents' },
      { id: 'lang', label: 'Language test', category: 'language' },
      { id: 'old', label: 'Retired embassy step', category: 'immigration' },
      { id: 'b', label: 'Admission', category: 'admission' },
      { id: 'c', label: 'Visa decision', category: 'immigration' },
      { id: 'd', label: 'Fly', category: 'travel' },
    ],
    edges: [seq('a', 'lang'), seq('lang', 'b'), seq('b', 'old'), seq('old', 'c'), seq('c', 'd')],
  },
}

/** Range acceptance: the smallest and largest routes the renderer must stay usable at. */
export const tiny3: RouteGraph = {
  id: 'fx-tiny-3',
  title: 'Minimum, 3 steps',
  destination: 'Placeholder H',
  steps: [
    { id: 'a', label: 'Documents', category: 'documents' },
    { id: 'b', label: 'Admission', category: 'admission' },
    { id: 'c', label: 'Fly', category: 'travel' },
  ],
  edges: [seq('a', 'b'), seq('b', 'c')],
}

export const large20: RouteGraph = {
  id: 'fx-large-20',
  title: 'Maximum, 20 steps',
  destination: 'Placeholder I',
  steps: Array.from({ length: 20 }, (_, i) => ({
    id: `n${i + 1}`,
    label: `Stage ${i + 1}`,
    category: (['documents', 'language', 'admission', 'funding', 'immigration', 'travel'] as const)[
      i % 6
    ] as RouteGraph['steps'][number]['category'],
  })),
  edges: Array.from({ length: 19 }, (_, i) => seq(`n${i + 1}`, `n${i + 2}`)),
}

export const ALL_FIXTURES: readonly RouteGraph[] = [
  tiny3,
  linear4,
  optionalBranch,
  alternativeBranch,
  parallelActivities,
  rejoiningBranch,
  evolvedRoute,
  wrapping15,
  large20,
]

/**
 * Structural twin of `wrapping15`: identical graph shape, different destination, title and
 * every id. Test.md 24 — the geometry must come out identical. This is the direct proof
 * that no destination-specific logic exists.
 */
export const wrapping15Twin: RouteGraph = {
  id: 'fx-wrapping-15-twin',
  title: 'Structural twin, different destination',
  destination: 'Placeholder Z',
  steps: wrapping15.steps.map((s) => ({ ...s, id: `t-${s.id}`, label: `Other ${s.label}` })),
  edges: wrapping15.edges.map((e) => ({ ...e, from: `t-${e.from}`, to: `t-${e.to}` })),
}
