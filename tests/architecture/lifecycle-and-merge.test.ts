import { describe, expect, it } from 'vitest'

import { COMMUNITY_SIGNAL_MODELS } from '../../src/domain/models'
import { checkWrite } from '../../src/server/write-guard'
import { read, stripComments, walk } from '../support/source-files'

/**
 * Phase 11 — lifecycle, dormancy, merge and admin, and the five shortcuts that would break it.
 *
 *   1. Deleting a route instead of archiving it (invariants 1 and 4, FR-45, BR-15).
 *   2. Letting a count promote a route, or a report move its standing (invariant 14, FR-71).
 *   3. Making an established quiet route look invalid (invariant 23, FR-39, BR-10).
 *   4. Moving content or followers during a merge (invariant 20, FR-58, BR-25).
 *   5. Introducing a paid or promoted route standing (invariant 13, FR-78).
 *
 * Every guard carries a planted-violation check.
 */

const SOURCE_FILES = walk('src', ['.ts', '.tsx'])
const CODE = SOURCE_FILES.map((file) => ({ file, code: stripComments(read(file)) }))
const SCHEMA = walk('prisma/schema', ['.prisma'])
  .map((file) => read(file).replace(/^\s*\/\/\/.*$/gm, ''))
  .join('\n')

const LIFECYCLE_MODULES = SOURCE_FILES.filter(
  (file) => file.startsWith('src/server/lifecycle/') || file === 'src/domain/lifecycle.ts',
)

function findAll(pattern: RegExp): string[] {
  const hits: string[] = []
  for (const { file, code } of CODE) {
    code.split('\n').forEach((line, index) => {
      if (pattern.test(line)) hits.push(`${file}:${index + 1}  ${line.trim()}`)
    })
  }
  return hits
}

describe('the modules under test exist', () => {
  it('finds them', () => {
    expect(LIFECYCLE_MODULES).toContain('src/domain/lifecycle.ts')
    expect(LIFECYCLE_MODULES).toContain('src/server/lifecycle/service.ts')
    expect(LIFECYCLE_MODULES).toContain('src/server/lifecycle/read.ts')
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('invariants 1 and 4, FR-45, BR-15 — nothing here destroys anything', () => {
  /**
   * §19.2 is explicit: "Normal historical information should be archived rather than
   * destroyed." Archival is a lifecycle state and a column; there is no delete anywhere on
   * this path, and no code that could be pointed at one.
   */
  it('never deletes a route, step, edge, field or journey', () => {
    const DELETE =
      /prisma\.(route|routeRevision|step|stepRevision|stepEdge|stepEdgeRevision|field|fieldRevision|journey|journeyStepProgress|journeyTask)\.(delete|deleteMany)\(/

    for (const file of [...LIFECYCLE_MODULES, 'src/app/[locale]/admin/actions-lifecycle.ts']) {
      expect(stripComments(read(file)), file).not.toMatch(DELETE)
    }

    // Not vacuous.
    expect(DELETE.test('await prisma.route.deleteMany({ where: { id } })')).toBe(true)
  })

  /**
   * A merge and a lifecycle transition are records of decisions, and a record that can be
   * removed is a decision that can be denied afterwards. Both models refuse deletion.
   */
  it('refuses to delete a lifecycle event or a duplicate flag', () => {
    expect(COMMUNITY_SIGNAL_MODELS).toContain('RouteLifecycleEvent')
    expect(COMMUNITY_SIGNAL_MODELS).toContain('DuplicateFlag')

    for (const model of ['RouteLifecycleEvent', 'DuplicateFlag']) {
      for (const operation of ['delete', 'deleteMany']) {
        for (const inContext of [true, false]) {
          expect(checkWrite(model, operation, inContext).allowed, `${model}.${operation}`).toBe(
            false,
          )
        }
      }
    }
    // A flag is resolved by update, not by removal.
    expect(checkWrite('DuplicateFlag', 'update', false).allowed).toBe(true)
  })

  it('keeps both relations into shared knowledge on Restrict', () => {
    for (const model of ['RouteLifecycleEvent', 'DuplicateFlag']) {
      const start = SCHEMA.indexOf(`model ${model} {`)
      expect(start, model).toBeGreaterThan(-1)
      const block = SCHEMA.slice(start, SCHEMA.indexOf('\n}', start))
      expect(block, model).toMatch(/onDelete: Restrict/)
      // Nothing about a route may be removed by removing one of these.
      expect(block, model).not.toMatch(/route\s+Route\s+@relation\([^)]*Cascade/)
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('invariant 14, FR-71, BR-32 — no count decides standing', () => {
  /**
   * The forbidden shape is the obvious one: promote a route once it passes N followers, or
   * archive it once it passes N reports. FR-71 forbids raw counts being "the sole automatic
   * determinant of trust, ranking, deletion or archival", and CLAUDE.md §11 leaves the numbers
   * open, so there is no threshold to reach for even if it were allowed.
   */
  const THRESHOLD =
    /\b(followerThreshold|promoteAt|MIN_FOLLOWERS|establishedAt|maturityScore|routeScore|autoPromote|autoArchive|popularityRank)\b/i

  it('has no promotion threshold anywhere in src/', () => {
    expect(findAll(THRESHOLD)).toEqual([])
  })

  it('would catch a planted violation', () => {
    for (const planted of [
      'if (followers >= MIN_FOLLOWERS) await autoPromote(routeId)',
      'const maturityScore = followers * 2 + confirmations',
    ]) {
      expect(THRESHOLD.test(planted)).toBe(true)
    }
  })

  /**
   * **Reports may never move a lifecycle state.**
   *
   * This is invariant 12's sibling, and Phase 11 is the phase that could have broken it: the
   * temptation is to archive a heavily reported route automatically. That would make brigading
   * a way to bury a route, which is exactly why BR-11 keeps safety reports apart from ordinary
   * accuracy signals. Asserted structurally — the lifecycle modules never read the table.
   */
  it('never reads a report from any lifecycle module', () => {
    for (const file of LIFECYCLE_MODULES) {
      const code = stripComments(read(file))
      expect(code, file).not.toMatch(/prisma\.report\./)
      expect(code, file).not.toMatch(/@\/server\/safety/)
    }
  })

  it('gives the lifecycle evidence no report field, and none it could be inferred from', () => {
    const domain = stripComments(read('src/domain/lifecycle.ts'))
    const start = domain.indexOf('export interface LifecycleEvidence')
    const block = domain.slice(start, domain.indexOf('}', start))

    expect(block).not.toMatch(/\b(report|reports|reportCount|flagged|abuse|quarantin)/i)
    // It does carry the two counts it is allowed, and only as zero tests.
    expect(block).toMatch(/followerCount/)
    expect(block).toMatch(/confirmationCount/)
  })

  /**
   * `followerCount` is permitted only as a zero test — "has anybody used this at all" — which
   * is how FR-38 and §19 define an unused route. It must never be compared to a number other
   * than zero, and never to another route's.
   */
  it('compares follower and confirmation counts only against zero', () => {
    const domain = stripComments(read('src/domain/lifecycle.ts'))
    const comparisons = [
      ...domain.matchAll(/(followerCount|confirmationCount)\s*[><=!]+\s*(\w+)/g),
    ]
    expect(comparisons.length).toBeGreaterThan(0)
    for (const [, name, operand] of comparisons) {
      expect(operand, `${name ?? ''} compared against ${operand ?? ''}`).toBe('0')
    }
  })

  /** The maintenance queue must not be ordered by popularity either (§19). */
  it('orders the administrator queue by age, never by followers', () => {
    const code = stripComments(read('src/server/lifecycle/read.ts'))
    const start = code.indexOf('export async function routesForMaintenance')
    const body = code.slice(start, code.indexOf('\n}', start))
    expect(body).toMatch(/orderBy: \[\{ createdAt: 'asc' \}/)
    expect(body).not.toMatch(/follower|journey|_count/i)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('invariant 23, FR-39, BR-10 — quiet is not a defect', () => {
  /**
   * Two modules have to agree about this or the product contradicts itself: the transition
   * rules decide a route is quiet, and the trust surface decides whether that is worth a
   * caution. They agree because there is one function, and both call it.
   */
  it('shares one rule between the transition logic and the trust surface', () => {
    const trust = stripComments(read('src/domain/trust.ts'))
    expect(trust).toMatch(/lifecycleWarrantsCaution/)
    expect(trust).toMatch(/from '@\/domain\/lifecycle'/)
    // The old inline comparison is gone, so there is no second definition to drift.
    expect(trust).not.toMatch(/lifecycleState !== Lifecycle\.established/)
  })

  it('guards dormancy behind the experimental state in the code, not in a comment', () => {
    const domain = stripComments(read('src/domain/lifecycle.ts'))
    // The branch that can produce `dormant` is inside a check for `experimental`.
    const start = domain.indexOf('if (current === Lifecycle.experimental)')
    expect(start).toBeGreaterThan(-1)
    const branch = domain.slice(start, domain.indexOf('\n  }', start))
    expect(branch).toMatch(/Lifecycle\.dormant/)

    // And `dormant` is proposed nowhere else.
    const proposals = [...domain.matchAll(/propose\(Lifecycle\.(\w+)/g)].map((m) => m[1])
    expect(proposals.filter((state) => state === 'dormant')).toHaveLength(1)
  })

  it('explains a quiet route rather than warning about it', () => {
    const dictionary = read('src/i18n/dictionaries/en.ts')
    expect(dictionary).toMatch(/quietExplainer/)

    /**
     * **Quiet is an activity description, and the copy must not turn it into a claim.**
     *
     * Corrected twice. The first draft read as neglect; the second read "no one has needed to
     * change this route recently", which is not something the platform knows — the absence of
     * recorded changes does not establish that no change was needed. Both are asserted
     * against here: the opening must be evidential, and the disclaimer must be present.
     */
    expect(dictionary).toMatch(/No recent changes have been recorded/)
    expect(dictionary).toMatch(/describes its activity, not its accuracy/)
    // The wording that made a claim out of a record. Checked against the **code**: the note
    // above `quietExplainer` quotes the rejected phrase to explain why it was rejected, and
    // a raw scan reports that explanation as the violation. Fifth time (Test.md §22).
    expect(stripComments(dictionary)).not.toMatch(/no one has needed to change/i)
    /**
     * No copy in the lifecycle vocabulary calls a route wrong for being quiet — scanned with
     * **comments stripped**, for the third time in this project. The schema prose in Phase 10
     * (Test.md §19) and the "points readers" copy in Phase 11 were the first two.
     *
     * Without stripping, the note above `quietExplainer` explaining *why the word "abandoned"
     * must never appear* makes this guard report that "abandoned" appears. An absence guard
     * that reads prose reports the documentation of a rule as a violation of it.
     *
     * **Standing rule: an absence guard reads code, never comments.**
     */
    const code = stripComments(dictionary)
    const start = code.indexOf('lifecycle: {')
    const block = code.slice(start, code.indexOf('\n  admin: {', start))
    expect(block).not.toMatch(/out of date|no longer valid|unreliable|abandoned/i)

    /**
     * And no claim in the other direction either. A lifecycle state describes activity; it
     * must not imply accuracy, safety or confidence any more than it implies neglect.
     *
     * `accuracy` is deliberately not in this list — the copy uses it to *deny* a claim
     * ("describes its activity, not its accuracy"), and forbidding the word would forbid the
     * disclaimer along with the claim.
     */
    expect(block).not.toMatch(/\b(accurate|reliable|trustworthy|verified|dependable|safe)\b/i)

    // Not vacuous: the block really is the lifecycle vocabulary.
    expect(block).toMatch(/dormantExplainer/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('invariant 20, FR-58, BR-25, D-38 — a merge moves nothing', () => {
  /**
   * **The whole physical effect of a merge is one pointer.** No step, field, revision,
   * contributor attribution or journey is touched, which is what makes both histories
   * reconstructable and both follower sets intact afterwards: nothing moved, so nothing could
   * be lost.
   *
   * Asserted as an absence in the merge path, because the failure mode — a merge that
   * "helpfully" relocates the duplicate's steps — would look like a feature.
   */
  it('never reassigns a step, field or journey to another route', () => {
    const REASSIGN = /\b(routeId|journeyId|stepId):\s*(canonical|target|survivor)/i
    for (const file of LIFECYCLE_MODULES) {
      expect(stripComments(read(file)), file).not.toMatch(REASSIGN)
    }
    expect(REASSIGN.test('await tx.step.updateMany({ data: { routeId: canonicalRouteId } })')).toBe(
      true,
    )
  })

  it('writes only the merge pointer and its metadata', () => {
    const service = stripComments(read('src/server/revisions/service.ts'))
    const start = service.indexOf('export async function setRouteMergePointer')
    expect(start).toBeGreaterThan(-1)
    const body = service.slice(start, service.length)

    // The only table it writes is `route`, and the only columns are the merge ones.
    expect(body).toMatch(/tx\.route\.update/)
    expect(body).not.toMatch(/tx\.(step|field|journey|stepEdge)\./)
    expect(body).toMatch(/mergedIntoId/)
  })

  it('keeps a merged route readable rather than hiding it', () => {
    // `getRouteBySlug` must not filter on `mergedIntoId`, or a merged route's followers would
    // lose the page their journey is attached to (FR-58, §40.4).
    const readPath = stripComments(read('src/server/routes/read.ts'))
    const start = readPath.indexOf('export async function getRouteBySlug')
    const body = readPath.slice(start, readPath.indexOf('\nexport ', start + 10))
    expect(body).not.toMatch(/mergedIntoId: null/)
    // Search does exclude it, which is the point of merging.
    expect(readPath).toMatch(/mergedIntoId: null/)
  })

  it('is reversible', () => {
    const service = stripComments(read('src/server/lifecycle/service.ts'))
    expect(service).toMatch(/export async function unmergeRoute/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('invariant 13, FR-78 — no paid or promoted route standing', () => {
  const PAID =
    /\b(sponsor|promoted|featured|paidPlacement|premiumRoute|boostRoute|advertis|partnerRoute)\b/i

  it('has no paid or promoted standing anywhere in the lifecycle path', () => {
    for (const file of [
      ...LIFECYCLE_MODULES,
      'src/app/[locale]/admin/actions-lifecycle.ts',
      'src/app/[locale]/admin/routes/page.tsx',
      'src/components/lifecycle.tsx',
    ]) {
      expect(stripComments(read(file)), file).not.toMatch(PAID)
    }
  })

  it('has no paid standing in the lifecycle enum or the schema', () => {
    expect(SCHEMA).not.toMatch(PAID)
    const enums = read('src/domain/enums.ts')
    const start = enums.indexOf('export const ROUTE_LIFECYCLE_STATES')
    const block = enums.slice(start, enums.indexOf(']', start))
    expect(block).not.toMatch(PAID)
  })

  it('would catch a planted violation', () => {
    expect(PAID.test("lifecycleState: 'promoted',")).toBe(true)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('the administrator role is checked in the service, not in a page', () => {
  it('checks the role for every mutating administrator action', () => {
    const service = stripComments(read('src/server/lifecycle/service.ts'))
    expect(service).toMatch(/export async function requireAdministrator/)

    for (const fn of ['setLifecycleState', 'mergeRoutes', 'unmergeRoute', 'resolveDuplicateFlag']) {
      const start = service.indexOf(`export async function ${fn}`)
      expect(start, fn).toBeGreaterThan(-1)
      expect(service.slice(start, start + 900), fn).toMatch(/requireAdministrator/)
    }
  })

  /**
   * Flagging a duplicate is deliberately *not* gated — §40.4 says users flag, and a flag
   * changes nothing on its own. The distinction is worth asserting so a later tightening does
   * not quietly turn a community signal into an administrator-only action.
   */
  it('does not gate flagging a duplicate', () => {
    const service = stripComments(read('src/server/lifecycle/service.ts'))
    const start = service.indexOf('export async function flagDuplicate')
    const body = service.slice(start, service.indexOf('\nexport ', start + 10))
    expect(body).not.toMatch(/requireAdministrator/)
    expect(body).toMatch(/flaggedById/)
  })

  it('shows a not-found rather than a forbidden to everyone else', () => {
    const page = stripComments(read('src/app/[locale]/admin/routes/page.tsx'))
    expect(page).toMatch(/NotAnAdministratorError/)
    expect(page).toMatch(/notFound\(\)/)
  })
})
