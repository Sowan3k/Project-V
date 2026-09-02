import { describe, expect, it } from 'vitest'

import { COMMUNITY_SIGNAL_MODELS, isCommunitySignal } from '../../src/domain/models'
import { checkWrite } from '../../src/server/write-guard'
import { read, stripComments, walk } from '../support/source-files'

/**
 * Phase 8 — the contribution loop, and the things it must never grow.
 *
 * Every guard here carries a planted-violation check. A guard nobody has watched fail reads
 * like coverage and is not.
 */

const SOURCE_FILES = walk('src', ['.ts', '.tsx'])
const CODE = SOURCE_FILES.map((file) => ({ file, code: stripComments(read(file)) }))

function findAll(pattern: RegExp): string[] {
  const hits: string[] = []
  for (const { file, code } of CODE) {
    code.split('\n').forEach((line, index) => {
      if (pattern.test(line)) hits.push(`${file}:${index + 1}  ${line.trim()}`)
    })
  }
  return hits
}

describe('no approval gate has appeared', () => {
  /**
   * The single most important thing Phase 8 must *not* have built.
   *
   * VR-08 shows "Update goes live when confirmed by the community" and "All updates are
   * reviewed". CLAUDE.md §8.6 lists both as mockup exceptions: an update goes live and
   * creates a revision, and the community corrects afterwards (FR-16, FR-69, §43.1).
   *
   * A review queue would not merely be extra work — it would invert the product. A student
   * with a corrected deadline would be told to wait, and the platform would be asserting an
   * authority it does not have.
   */
  const APPROVAL =
    /\b(pendingApproval|awaitingReview|approvalQueue|reviewQueue|moderationQueue|isApproved|approvedBy|approvedAt|submitForReview|needsApproval)\b/i

  it('has no approval or review-queue concept in src/', () => {
    expect(findAll(APPROVAL)).toEqual([])
  })

  it('would catch a planted violation', () => {
    for (const planted of [
      'const pendingApproval = await prisma.fieldRevision.findMany()',
      'if (!revision.isApproved) return null',
      'model ReviewQueue { approvedBy String? }',
    ]) {
      expect(APPROVAL.test(planted)).toBe(true)
    }
  })

  it('has no approval column anywhere in the schema', () => {
    const schema = walk('prisma/schema', ['.prisma'])
      .map((file) => read(file).replace(/^\s*\/\/\/.*$/gm, ''))
      .join('\n')
    expect(schema).not.toMatch(APPROVAL)
    // Not vacuous: the schema really is being read.
    expect(schema).toMatch(/model FieldRevision \{/)
  })

  it('never tells a contributor their change is waiting for anything', () => {
    const dictionary = stripComments(read('src/i18n/dictionaries/en.ts'))
    expect(dictionary).not.toMatch(/awaiting approval|pending review|submitted for review|once approved/i)
    // And says the opposite, in the contributor's own reading.
    expect(dictionary).toMatch(/goes live immediately/i)
  })
})

describe('the four actions stay four actions', () => {
  /**
   * ADD, UPDATE, CONFIRM and CHALLENGE mean different things and must not blur (§16).
   * REPORT — "this may be dangerous" — is a fifth, and it is Phase 9 (CLAUDE.md §5).
   */
  it('exports exactly the contribution actions Phase 8 owns', () => {
    const actions = stripComments(read('src/app/[locale]/routes/[slug]/actions.ts'))
    const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1])

    expect(exported).toContain('addStepAction')
    expect(exported).toContain('addFieldAction')
    expect(exported).toContain('updateFieldAction')
    expect(exported).toContain('confirmFieldAction')
    expect(exported).toContain('challengeFieldAction')
  })

  it('has no report action, model or endpoint anywhere yet', () => {
    // Phase 9's, deliberately. A challenge says "this may be wrong"; a report says "this may
    // be dangerous", and they carry different consequences (CLAUDE.md §5).
    const REPORT = /\breportAction\b|\bcreateReport\b|model Report\b|prisma\.report\b/i
    expect(findAll(REPORT)).toEqual([])
    expect(REPORT.test('export async function reportAction(formData: FormData) {}')).toBe(true)
  })

  /**
   * CONFIRM must not create a revision. Confirming is not editing — no value changed, so
   * nothing goes in the ledger (§39.4). If it did, a burst of confirmations would look like
   * a burst of edits and the volatility signal would lie (FR-53, §17.5).
   */
  it('never writes a revision when confirming', () => {
    const service = stripComments(read('src/server/revisions/service.ts'))
    const start = service.indexOf('export async function confirmField')
    const body = service.slice(start, service.indexOf('export async function confirmStepFields'))

    expect(body).not.toMatch(/Revision\.create|revision\.create/)
    expect(body).toMatch(/confirmation\.upsert/)
  })

  /**
   * A confirmation must not resolve a challenge. Somebody vouching that a field is fine is a
   * competing signal, not an answer — and burying a dispute under reassurance is precisely
   * what FR-70 exists to prevent. Only a revision resolves.
   */
  it('resolves a challenge only from a revision, never from a confirmation', () => {
    const service = stripComments(read('src/server/revisions/service.ts'))

    const revise = service.slice(
      service.indexOf('export async function reviseField'),
      service.indexOf('export async function confirmField'),
    )
    expect(revise).toMatch(/challenge\.updateMany[\s\S]*resolvedByRevisionId/)

    const confirm = service.slice(
      service.indexOf('export async function confirmField'),
      service.indexOf('export async function confirmStepFields'),
    )
    expect(confirm).not.toMatch(/resolvedAt|resolvedByRevisionId/)
  })
})

describe('community signals are shared knowledge and are never erased', () => {
  it('classifies confirmations and challenges as community signals', () => {
    expect(COMMUNITY_SIGNAL_MODELS).toContain('Confirmation')
    expect(COMMUNITY_SIGNAL_MODELS).toContain('Challenge')
    expect(isCommunitySignal('Challenge')).toBe(true)
    expect(isCommunitySignal('Journey')).toBe(false)
  })

  it('refuses delete on them, in or out of a revision write context', () => {
    for (const model of COMMUNITY_SIGNAL_MODELS) {
      for (const operation of ['delete', 'deleteMany']) {
        for (const inContext of [true, false]) {
          const verdict = checkWrite(model, operation, inContext)
          expect(verdict.allowed).toBe(false)
        }
      }
    }
  })

  it('allows create and update, because a challenge is resolved by being updated', () => {
    for (const model of COMMUNITY_SIGNAL_MODELS) {
      for (const operation of ['create', 'update', 'updateMany', 'upsert']) {
        expect(checkWrite(model, operation, false).allowed).toBe(true)
      }
    }
  })
})

describe('nothing here became a game or a market', () => {
  /**
   * §25 warns against turning contribution into "a competitive points game", and CLAUDE.md
   * §11 leaves reputation labels and weights open — so Phase 8 must not invent either. The
   * contributor page reports counts and dates; there is no score, level, rank or badge.
   *
   * Invariant 13's monetisation guard lives in `trust-vocabulary.test.ts`; this is the
   * gamification half.
   */
  const GAMIFICATION =
    /\b(leaderboard|reputationScore|karma|points|badgeLevel|rankPosition|trustScore|trustPercent|credibilityScore)\b/i

  it('has no score, rank, badge tier or leaderboard in src/', () => {
    expect(findAll(GAMIFICATION)).toEqual([])
  })

  it('would catch a planted violation', () => {
    for (const planted of [
      'const reputationScore = confirmations * 3 - challenges',
      'export function leaderboard() {}',
      'trustScore: 0.92,',
    ]) {
      expect(GAMIFICATION.test(planted)).toBe(true)
    }
  })

  /**
   * And the contributor summary decides nothing. It is read by a page and by nothing else —
   * no ordering, no gating, no promotion anywhere reads it (FR-71, BR-32, invariant 14).
   */
  it('lets contributor history be displayed and nothing more', () => {
    const importers = CODE.filter(({ code }) => code.includes('@/server/contributors')).map(
      ({ file }) => file,
    )
    expect(importers).toEqual(['src/app/[locale]/contributors/[handle]/page.tsx'])
  })
})

describe('new routes publish as experimental', () => {
  it('defaults the lifecycle in the schema, not in a code path that could be skipped', () => {
    const schema = read('prisma/schema/route.prisma')
    expect(schema).toMatch(/lifecycleState RouteLifecycleState @default\(experimental\)/)
  })

  it('never sets a lifecycle state when creating a route', () => {
    // The create path must not be able to publish something more established than the
    // default, so it does not name the column at all (FR-74, §18.1).
    const service = stripComments(read('src/server/revisions/service.ts'))
    const create = service.slice(
      service.indexOf('export async function createRoute'),
      service.indexOf('export async function addStep'),
    )
    expect(create).not.toMatch(/lifecycleState/)

    const action = stripComments(read('src/app/[locale]/routes/new/actions.ts'))
    expect(action).not.toMatch(/lifecycleState/)
  })
})

describe('contributions cannot bypass the revision engine', () => {
  it('routes every contribution action through the revision service', () => {
    const actions = stripComments(read('src/app/[locale]/routes/[slug]/actions.ts'))
    expect(actions).toMatch(/from '@\/server\/revisions\/service'/)
    // The ESLint boundary already forbids a database client outside src/server; this asserts
    // the intent as well, so a future refactor cannot quietly reach around it.
    expect(actions).not.toMatch(/@prisma\/client|@\/server\/db\/client/)
  })

  it('never lets a contribution form name the actor', () => {
    // The actor comes from the session, always. A `userId` in a submitted payload is a
    // request, not a fact, and taking one would make every attribution meaningless.
    for (const file of SOURCE_FILES.filter((f) => f.endsWith('actions.ts'))) {
      const code = stripComments(read(file))
      expect(code).not.toMatch(/(text|formData\.get)\(\s*formData\s*,\s*['"](userId|actorId|authorId)['"]/)
      expect(code).not.toMatch(/formData\.get\(['"](userId|actorId|authorId)['"]\)/)
    }
  })
})
