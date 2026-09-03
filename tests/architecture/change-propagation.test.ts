import { describe, expect, it } from 'vitest'

import { COMMUNITY_SIGNAL_MODELS, PRIVATE_USER_STATE_MODELS } from '../../src/domain/models'
import { checkWrite } from '../../src/server/write-guard'
import { read, stripComments, walk } from '../support/source-files'

/**
 * Phase 10 — change propagation, and the four ways it could quietly go wrong.
 *
 * Each of these is a guard against a shortcut that would have been *easier* than the thing
 * actually built, which is why a test rather than a note:
 *
 *   1. Editing the route to express a two-week closure (invariant 19, BR-27).
 *   2. Resetting or rewriting a follower's progress when the route moves (invariant 8, FR-30).
 *   3. Deriving severity or relevance from a count (FR-71, §41.2, CLAUDE.md §11).
 *   4. Writing a second renderer for the comparison (invariant 24).
 *
 * Every guard carries a planted-violation check, because a guard nobody has watched fail is
 * decoration.
 */

const SOURCE_FILES = walk('src', ['.ts', '.tsx'])
const CODE = SOURCE_FILES.map((file) => ({ file, code: stripComments(read(file)) }))
const SCHEMA = walk('prisma/schema', ['.prisma'])
  .map((file) => read(file).replace(/^\s*\/\/\/.*$/gm, ''))
  .join('\n')

const CHANGE_MODULES = SOURCE_FILES.filter(
  (file) => file.startsWith('src/server/changes/') || file === 'src/domain/changes.ts',
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

describe('the modules under test exist — this file is not scanning an empty set', () => {
  it('finds the change modules', () => {
    expect(CHANGE_MODULES).toContain('src/domain/changes.ts')
    expect(CHANGE_MODULES).toContain('src/server/changes/service.ts')
    expect(CHANGE_MODULES).toContain('src/server/changes/read.ts')
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('invariant 19, BR-08, BR-27 — a disruption is an overlay, never a route edit', () => {
  /**
   * The shortcut this forbids: expressing "the Dhaka centre is shut for a fortnight" by
   * editing the IELTS step, because editing is one line and an overlay is a model.
   *
   * §31.4 is explicit that contributors "add a temporary disruption with date/location scope
   * rather than permanently modifying the normal IELTS process", and that "after the
   * disruption expires, the normal route remains unchanged". A route edited to say it is
   * closed stays edited.
   */
  const REVISIONED_WRITE =
    /prisma\.(route|step|stepEdge|field)\.(create|update|updateMany|upsert|delete|deleteMany)\(/

  it('never writes a route, step, edge or field from the change service', () => {
    for (const file of CHANGE_MODULES) {
      expect(stripComments(read(file)), file).not.toMatch(REVISIONED_WRITE)
    }
  })

  it('never reaches the revision write service either', () => {
    for (const file of CHANGE_MODULES) {
      expect(stripComments(read(file)), file).not.toMatch(/@\/server\/revisions\/service/)
    }
  })

  it('would catch a planted violation', () => {
    for (const planted of [
      "await prisma.step.update({ where: { id }, data: { label: 'Closed' } })",
      'await prisma.field.create({ data: { valueText: note } })',
    ]) {
      expect(REVISIONED_WRITE.test(planted)).toBe(true)
    }
  })

  /**
   * **Expiry has no moving parts.**
   *
   * A stored `active` flag would need something to flip it; that something would be a
   * scheduled job; and a job that edits rows is exactly the machinery BR-08 is trying to
   * avoid — it can fail, run twice, or leave a closure showing a month after it ended. With
   * no flag, expiry is a comparison and cannot fail to happen.
   */
  it('stores no status or active flag on a disruption', () => {
    const start = SCHEMA.indexOf('model TemporaryDisruption {')
    expect(start).toBeGreaterThan(-1)
    const block = SCHEMA.slice(start, SCHEMA.indexOf('}', start))

    expect(block).not.toMatch(/\b(active|isActive|status|expired|state)\s+\w/i)
    // The three scope dimensions FR-63 names are all present, one column each.
    expect(block).toMatch(/startsAt\s+DateTime/)
    expect(block).toMatch(/endsAt\s+DateTime\?/)
    expect(block).toMatch(/locationScope\s+String\?/)
    expect(block).toMatch(/stepId\s+String\?/)
  })

  it('has no scheduled job, cron or sweeper anywhere in src/', () => {
    expect(findAll(/\b(cron|setInterval|scheduleJob|node-schedule|expireDisruptions)\b/i)).toEqual(
      [],
    )
  })

  /**
   * A disruption is community-authored and must survive being inconvenient: a closure that
   * could be deleted is a closure that could be denied afterwards (invariant 1).
   */
  it('refuses to delete a disruption or a change announcement', () => {
    expect(COMMUNITY_SIGNAL_MODELS).toContain('TemporaryDisruption')
    expect(COMMUNITY_SIGNAL_MODELS).toContain('RouteChange')

    for (const model of ['TemporaryDisruption', 'RouteChange']) {
      for (const operation of ['delete', 'deleteMany']) {
        for (const inContext of [true, false]) {
          expect(checkWrite(model, operation, inContext).allowed, `${model}.${operation}`).toBe(
            false,
          )
        }
      }
      // Updating stays allowed: a severity can be corrected, a disruption resolved early.
      expect(checkWrite(model, 'update', false).allowed).toBe(true)
    }
  })

  it('keeps disruptions out of the revision engine', () => {
    // Invariant 19 in the registry: an overlay is not an edit, so it must never appear in a
    // route's revision history.
    const models = stripComments(read('src/domain/models.ts'))
    const revisioned = models.slice(
      models.indexOf('export const REVISIONED_SHARED_MODELS'),
      models.indexOf('export const REVISION_MODELS'),
    )
    expect(revisioned).not.toMatch(/TemporaryDisruption|RouteChange/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('invariant 8, FR-30, BR-17 — a public change never touches private progress', () => {
  /**
   * The strongest available static claim: **no module that knows about changes writes journey
   * state at all.**
   *
   * Not "we are careful to preserve completions" — there is no code that could reset one,
   * because the only writer of `journeyStepProgress` is the journey service, and nothing in
   * the change path calls it. A cascade in the schema would be the other way this could
   * happen, and that is asserted separately below.
   */
  const PRIVATE_WRITE =
    /prisma\.(journeyStepProgress|journeyTask|journey)\.(create|update|updateMany|upsert|delete|deleteMany|createMany)\(/

  it('writes no journey progress from any change module', () => {
    for (const file of [...CHANGE_MODULES, 'src/app/[locale]/routes/[slug]/changes/actions.ts']) {
      expect(stripComments(read(file)), file).not.toMatch(PRIVATE_WRITE)
    }
  })

  /**
   * The follower-scoped module is allowed exactly one write — the stance the follower asked
   * for (§13.3) — and it must not be a write to progress. Saying "this change does not apply
   * to me" and marking a *step* not applicable are different statements, and conflating them
   * would let a change rewrite progress through the side door.
   */
  it('writes only the follower stance from the follower-scoped module', () => {
    const code = stripComments(read('src/server/journeys/changes.ts'))
    const writes = [...code.matchAll(/prisma\.(\w+)\.(create|update|upsert|delete\w*)\(/g)].map(
      (match) => match[1],
    )
    expect([...new Set(writes)]).toEqual(['journeyChangeNote'])
  })

  it('would catch a planted violation', () => {
    for (const planted of [
      "await prisma.journeyStepProgress.updateMany({ data: { status: 'not_started' } })",
      'await prisma.journey.update({ where: { id }, data: { startedAt: new Date() } })',
    ]) {
      expect(PRIVATE_WRITE.test(planted)).toBe(true)
    }
  })

  /**
   * And the database cannot do it either. A cascade from a step or a route into journey
   * progress would reset a follower's record with nobody writing a line of code — invariant 8
   * broken by a schema default.
   */
  it('never cascades from shared knowledge into private progress', () => {
    for (const model of ['JourneyStepProgress', 'JourneyTask', 'JourneyChangeNote']) {
      const start = SCHEMA.indexOf(`model ${model} {`)
      expect(start, model).toBeGreaterThan(-1)
      const block = SCHEMA.slice(start, SCHEMA.indexOf('\n}', start))

      for (const line of block.split('\n')) {
        // Cascade is permitted only from the owning journey — that is the user's own data
        // going away with their own journey. Every relation into shared knowledge restricts.
        if (/onDelete:\s*Cascade/.test(line)) {
          expect(line, `${model}: ${line.trim()}`).toMatch(/journey\s+Journey/)
        }
      }
      // The relations into public knowledge exist and restrict.
      expect(block).toMatch(/onDelete: Restrict/)
    }
  })

  it('classifies the follower stance as private user state', () => {
    expect(PRIVATE_USER_STATE_MODELS).toContain('JourneyChangeNote')
  })

  /**
   * There is no way to *say* a completion is invalid, which is stronger than not saying it.
   * `ChangeBearing` is a closed union and none of its members means "your progress is wrong".
   */
  it('has no vocabulary for invalidating a completion', () => {
    const domain = stripComments(read('src/domain/changes.ts'))
    expect(domain).not.toMatch(/invalidat|reset|revoke|voided|no_longer_valid/i)
    // And the copy has none either.
    const dictionary = stripComments(read('src/i18n/dictionaries/en.ts'))
    const start = dictionary.indexOf('changes: {')
    const block = dictionary.slice(start, dictionary.indexOf('\n  routeLifecycle', start))
    expect(block).not.toMatch(/no longer valid|invalid|must redo|start again/i)
    // It does say the opposite, in as many words.
    expect(block).toMatch(/still stands/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('invariant 21, BR-26 — effective date beats edit date', () => {
  /**
   * The rule has one implementation, `operativeDate`, and everything that decides whether a
   * change reaches a follower goes through it. A second place comparing `announcedAt` against
   * a follower's date would be the bug BR-26 exists to prevent, and it would be invisible.
   */
  it('decides through one function, which prefers the effective date', () => {
    const domain = stripComments(read('src/domain/changes.ts'))
    expect(domain).toMatch(/export function operativeDate/)
    expect(domain).toMatch(/return change\.effectiveAt \?\? change\.announcedAt/)
  })

  it('never compares a follower date against the announcement date', () => {
    const domain = stripComments(read('src/domain/changes.ts'))
    // The only comparison against a recorded personal date is the operative one.
    expect(domain).not.toMatch(/announcedAt[^)\n]*[<>]=?[^)\n]*(actualDate|targetDate)/)
    expect(domain).not.toMatch(/(actualDate|targetDate)[^)\n]*[<>]=?[^)\n]*announcedAt/)
    expect(domain).toMatch(/operative\.getTime\(\) > done\.getTime\(\)/)
  })

  it('stores the two dates separately, so they can never be conflated', () => {
    const start = SCHEMA.indexOf('model RouteChange {')
    const block = SCHEMA.slice(start, SCHEMA.indexOf('\n}', start))
    expect(block).toMatch(/announcedAt DateTime\s+@default\(now\(\)\)/)
    // Nullable: §41.1 says "where known", and a default would manufacture a fact.
    expect(block).toMatch(/effectiveAt DateTime\?/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('FR-71, §41.2, CLAUDE.md §11 — nothing is scored, and no threshold is invented', () => {
  const SCORING =
    /\b(relevanceScore|changeScore|impactScore|severityScore|confidence|percentile|weightedSum|churnRate|volatilityScore)\b/i
  const THRESHOLD =
    /\b(changeThreshold|severityThreshold|MIN_CHANGES|CHANGE_LIMIT|autoSeverity|deriveSeverity|inferSeverity)\b/i

  it('has no score or threshold concept in the change modules', () => {
    for (const file of CHANGE_MODULES) {
      const code = stripComments(read(file))
      expect(code, file).not.toMatch(SCORING)
      expect(code, file).not.toMatch(THRESHOLD)
    }
  })

  it('would catch a planted violation', () => {
    expect(SCORING.test('const relevanceScore = weights.reduce(sum)')).toBe(true)
    expect(THRESHOLD.test('function deriveSeverity(diff) { return diff.length > 3 }')).toBe(true)
  })

  /**
   * **Severity is carried, never computed.** §41.2 defines each level by consequence to the
   * follower — a judgement about the world — and the module that decides relevance never
   * assigns one. It only ever reads `change.severity` through, so a route with three changed
   * fields cannot become "important" by arithmetic.
   */
  it('never assigns a severity in the domain', () => {
    const domain = stripComments(read('src/domain/changes.ts'))
    expect(domain).not.toMatch(/severity\s*[:=]\s*(Severity\.|['"`])/)
    expect(domain).not.toMatch(/ChangeSeverity\.\w+/)
  })

  /**
   * And the relevance engine never counts anything. `changeRelevance` decides from a status
   * and two dates; if it ever compared a tally to a number, that number would be a threshold
   * nobody agreed (CLAUDE.md §11).
   */
  it('never branches on how many changes there are', () => {
    const domain = stripComments(read('src/domain/changes.ts'))
    expect(domain).not.toMatch(/\.length\s*[><]=?\s*\d/)
  })

  it('exposes counts, and only counts, as the scale of change', () => {
    // FR-77 wants "2 steps added, 1 archived, 3 fields changed" — facts a reader can weigh.
    const domain = stripComments(read('src/domain/changes.ts'))
    expect(domain).toMatch(/readonly added: number/)
    expect(domain).toMatch(/readonly archived: number/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('invariant 24 — the comparison introduced no second renderer', () => {
  /**
   * The obvious way to build a shadow route is a bespoke comparison renderer. It would work,
   * and it would mean every future change to route drawing had to be made twice — and the
   * second copy would drift, because nobody looks at it.
   *
   * So both sides of the comparison are the ordinary `Road`, given ordinary graphs. This
   * asserts the comparison component draws no geometry of its own.
   */
  const SHADOW = 'src/components/shadow-compare.tsx'

  it('draws both versions with the shared renderer', () => {
    const code = stripComments(read(SHADOW))
    expect(code).toMatch(/from '@\/renderer'/)
    expect(code).toMatch(/<Road/)
  })

  it('contains no SVG of its own', () => {
    const code = stripComments(read(SHADOW))
    for (const tag of ['<svg', '<path', '<circle', '<rect', '<line', '<polyline', 'viewBox']) {
      expect(code, tag).not.toContain(tag)
    }
  })

  it('names no route, destination or country anywhere in the change path', () => {
    // The renderer-identity test covers src/renderer/**. This covers the new modules, which
    // sit outside it and could reintroduce identity branching in the comparison layer.
    for (const file of [...CHANGE_MODULES, SHADOW, 'src/components/changes.tsx']) {
      const code = stripComments(read(file))
      expect(code, file).not.toMatch(/(slug|destinationCountry|title)\s*===\s*['"`]/)
    }
  })

  it('would catch a planted violation', () => {
    expect(/(slug|destinationCountry|title)\s*===\s*['"`]/.test("if (route.slug === 'bd-de')")).toBe(
      true,
    )
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('§35, CLAUDE.md §8.6 — no notification infrastructure was introduced', () => {
  /**
   * VR-10 offers "Subscribe to Alerts", "Get instant alerts" and "Manage Alert Settings".
   * CLAUDE.md §8.6 lists all three as mockup exceptions: proactive external notification is
   * deferred, and in-app change visibility is the first-release mechanism.
   *
   * The temptation in this phase specifically is an email digest — it is the natural next
   * thought after "the follower should know the route changed", and it is out of scope.
   */
  const NOTIFICATION =
    /\b(nodemailer|sendgrid|postmark|resend|mailgun|webpush|serviceworker|pushSubscription|sendEmail|subscribeToAlerts|alertSettings)\b/i

  it('has no mailer, push channel or subscription concept in src/', () => {
    expect(findAll(NOTIFICATION)).toEqual([])
  })

  it('has no notification or subscription table', () => {
    expect(SCHEMA).not.toMatch(/model (Notification|Subscription|AlertPreference)\b/)
  })

  it('says plainly that it does not send anything', () => {
    const dictionary = read('src/i18n/dictionaries/en.ts')
    expect(dictionary).toMatch(/do not send emails or push notifications/)
  })

  it('would catch a planted violation', () => {
    expect(NOTIFICATION.test("import { sendEmail } from './mailer'")).toBe(true)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('the public and private reads stay on their own sides of the line', () => {
  /**
   * `src/server/changes/read.ts` is the anonymous path and takes no identity at all —
   * the same guarantee `src/server/routes/read.ts` gives, and for the same reason: change
   * history is readable signed out (FR-01, FR-31, D-03).
   */
  it('takes no user id in the public change read path', () => {
    const code = stripComments(read('src/server/changes/read.ts'))
    const exports = [...code.matchAll(/export (?:async )?function (\w+)\s*\(([\s\S]*?)\)\s*:/g)]
    expect(exports.length).toBeGreaterThan(3)
    for (const [, name, signature] of exports) {
      expect(signature ?? '', `changes/read.ts#${name ?? '?'}`).not.toMatch(
        /\b(userId|viewerId|session)\b/,
      )
    }
  })

  it('never reads private journey state from the public path', () => {
    const code = stripComments(read('src/server/changes/read.ts'))
    expect(code).not.toMatch(/prisma\.(journey|journeyStepProgress|journeyTask|journeyChangeNote)\./)
  })

  /**
   * And the write service is not an authorisation boundary pretending to be one: it takes an
   * `authorId` because contributions are attributable, and checks no role, because there is
   * no approval gate (invariant 3, FR-16, FR-44, §43.1).
   */
  it('gates change contribution on nothing but being signed in', () => {
    const service = stripComments(read('src/server/changes/service.ts'))
    expect(service).not.toMatch(/requireAdministrator|role\s*===|isAdmin|approve/i)
    expect(service).toMatch(/readonly authorId: string/)
  })
})
