import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { StudyLevel, RouteMechanism } from '../../src/domain/enums'
import { isMergeCandidate, mergeCompatibility, type MergeIdentity } from '../../src/domain/merge'

/**
 * Which two routes may be declared duplicates — audit F5, FR-40, BR-25, §40.
 *
 * Before this, `mergeRoutes` refused only self-merges, already-merged routes and cycles, and
 * the administrator's dropdown offered every other route in the database. A Bangladesh→Germany
 * Master's route could therefore be declared superseded by a Bangladesh→Malaysia Bachelor's
 * route, and every preservation guarantee would hold perfectly while meaning nothing.
 */

const germany: MergeIdentity = {
  originCountry: 'BD',
  destinationCountry: 'DE',
  studyLevel: StudyLevel.masters,
  mechanism: null,
  intake: null,
}

const identity = (over: Partial<MergeIdentity>): MergeIdentity => ({ ...germany, ...over })

describe('mergeCompatibility', () => {
  it('permits two routes with the same origin, destination and study level', () => {
    expect(mergeCompatibility(germany, identity({}))).toEqual({
      compatible: true,
      blocking: [],
      cautions: [],
    })
  })

  it('refuses a different destination — the failure the audit named', () => {
    const malaysia = identity({ destinationCountry: 'MY' })
    const result = mergeCompatibility(germany, malaysia)
    expect(result.compatible).toBe(false)
    expect(result.blocking).toEqual(['destination'])
  })

  it('refuses a different origin', () => {
    expect(mergeCompatibility(germany, identity({ originCountry: 'IN' })).blocking).toEqual([
      'origin',
    ])
  })

  it('refuses a different study level — a PhD route is not a Master’s route', () => {
    expect(mergeCompatibility(germany, identity({ studyLevel: StudyLevel.phd })).blocking).toEqual([
      'study_level',
    ])
  })

  it('names every dimension that disagrees, not just the first', () => {
    const unrelated = identity({
      originCountry: 'IN',
      destinationCountry: 'MY',
      studyLevel: StudyLevel.bachelors,
    })
    expect(mergeCompatibility(germany, unrelated).blocking).toEqual([
      'origin',
      'destination',
      'study_level',
    ])
  })

  it('is symmetric — which of a pair survives is a separate decision', () => {
    const other = identity({ destinationCountry: 'MY' })
    expect(mergeCompatibility(germany, other).blocking).toEqual(
      mergeCompatibility(other, germany).blocking,
    )
  })
})

describe('mechanism and intake are surfaced, never enforced', () => {
  it('warns when both state a mechanism and the two differ', () => {
    const a = identity({ mechanism: RouteMechanism.direct_admission })
    const b = identity({ mechanism: RouteMechanism.government_scholarship })
    const result = mergeCompatibility(a, b)
    // Not blocking. §40.1 says a differing mechanism makes two routes materially different;
    // §40.4 equally permits judging one of them mislabelled. The baseline does not say which
    // reading wins, so the person deciding is told rather than overruled.
    expect(result.compatible).toBe(true)
    expect(result.cautions).toEqual(['differing_mechanism'])
  })

  it('does not warn when one side has not stated a mechanism', () => {
    // Null means "not stated", not "none" — and the commonest genuine duplicate is a route
    // created without a mechanism beside the same route with one. Warning here would put a
    // caution on the case merges exist for.
    const stated = identity({ mechanism: RouteMechanism.direct_admission })
    expect(mergeCompatibility(stated, germany).cautions).toEqual([])
    expect(mergeCompatibility(germany, stated).cautions).toEqual([])
  })

  it('warns on differing intakes, and stays silent when one is unstated', () => {
    const autumn = identity({ intake: '2027 autumn' })
    const spring = identity({ intake: '2027 spring' })
    expect(mergeCompatibility(autumn, spring).cautions).toEqual(['differing_intake'])
    expect(mergeCompatibility(autumn, germany).cautions).toEqual([])
    expect(mergeCompatibility(autumn, identity({ intake: '2027 autumn' })).cautions).toEqual([])
  })

  it('reports both cautions together where both differ', () => {
    const a = identity({ mechanism: RouteMechanism.direct_admission, intake: '2027 autumn' })
    const b = identity({ mechanism: RouteMechanism.other_mechanism, intake: '2028 spring' })
    expect(mergeCompatibility(a, b).cautions).toEqual(['differing_mechanism', 'differing_intake'])
  })
})

describe('isMergeCandidate', () => {
  it('agrees with mergeCompatibility, so the dropdown and the server cannot disagree', () => {
    const cases = [
      germany,
      identity({ destinationCountry: 'MY' }),
      identity({ studyLevel: StudyLevel.phd }),
      identity({ mechanism: RouteMechanism.university_scholarship }),
    ]
    for (const candidate of cases) {
      expect(isMergeCandidate(germany, candidate)).toBe(
        mergeCompatibility(germany, candidate).compatible,
      )
    }
  })
})

describe('the rule is enforced where it is authoritative', () => {
  const read = (path: string) =>
    readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')

  it('the server refuses an incompatible pair, not only the form', () => {
    // A server action is reachable by anyone who can construct a POST, so a filtered dropdown
    // is a convenience and never the rule (CLAUDE.md §9).
    const service = read('src/server/lifecycle/service.ts')
    expect(service).toContain('mergeCompatibility(duplicate, canonical)')
    expect(service).toContain('IncompatibleMergeError')
  })

  it('the administrator form offers compatible candidates only', () => {
    const page = read('src/app/[locale]/admin/routes/page.tsx')
    expect(page).toContain('mergeCompatibility(route, other)')
    expect(page).toContain('candidate.compatible')
    // The options are built from the compatible set, never from `routes` directly — which is
    // what the old version did, offering every route in the database as a successor.
    const select = page.slice(
      page.indexOf('name="canonicalRouteId"'),
      page.indexOf('</select>', page.indexOf('name="canonicalRouteId"')),
    )
    expect(select).toContain('candidates.map(')
    expect(select).not.toContain('routes')
  })

  it('invents no similarity score — a threshold would need a number the baseline lacks', () => {
    const source = read('src/domain/merge.ts')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const forbidden of ['score', 'similarity', 'threshold', 'confidence', 'weight']) {
      expect(code.toLowerCase()).not.toContain(forbidden)
    }
  })
})
