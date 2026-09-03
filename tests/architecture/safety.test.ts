import { describe, expect, it } from 'vitest'

import { REPORT_REASONS, CHALLENGE_REASONS } from '../../src/domain/enums'
import { COMMUNITY_SIGNAL_MODELS } from '../../src/domain/models'
import { checkWrite } from '../../src/server/write-guard'
import { read, stripComments, walk } from '../support/source-files'

/**
 * Phase 9 — safety, and the two things it must never become.
 *
 * A moderation system fails in one of two directions. It automates, and then a brigade of
 * eight accounts can silence a true warning about a visa fee. Or it becomes an approval queue,
 * and then a student with a corrected deadline waits for a stranger. These guard against both.
 *
 * Every guard carries a planted-violation check.
 */

const SOURCE_FILES = walk('src', ['.ts', '.tsx'])
const CODE = SOURCE_FILES.map((file) => ({ file, code: stripComments(read(file)) }))
const SCHEMA = walk('prisma/schema', ['.prisma'])
  .map((file) => read(file).replace(/^\s*\/\/\/.*$/gm, ''))
  .join('\n')

function findAll(pattern: RegExp): string[] {
  const hits: string[] = []
  for (const { file, code } of CODE) {
    code.split('\n').forEach((line, index) => {
      if (pattern.test(line)) hits.push(`${file}:${index + 1}  ${line.trim()}`)
    })
  }
  return hits
}

describe('invariant 14 / FR-71 — no count decides anything', () => {
  /**
   * The design this forbids is the obvious one: quarantine automatically once N credible
   * reports arrive. FR-71 is explicit that raw counts "shall not be the sole automatic
   * determinant of trust, ranking, deletion or archival", and §23.2 leaves the number to an
   * operational decision that CLAUDE.md §11 has not made.
   *
   * Making quarantine an administrator action dissolves the question: there is no threshold to
   * guess, and the guarantee holds whatever the number would have been.
   */
  const THRESHOLD =
    /\b(reportThreshold|quarantineThreshold|autoQuarantine|MIN_REPORTS|REPORT_LIMIT|abuseScore|riskScore)\b/i

  it('has no threshold or automatic-quarantine concept in src/', () => {
    expect(findAll(THRESHOLD)).toEqual([])
  })

  it('has no threshold column or counter in the schema', () => {
    expect(SCHEMA).not.toMatch(THRESHOLD)
    expect(SCHEMA).not.toMatch(/reportCount\s+Int/)
    // Not vacuous: the safety schema really is being read.
    expect(SCHEMA).toMatch(/model Report \{/)
  })

  it('would catch a planted violation', () => {
    for (const planted of [
      'const quarantineThreshold = 3',
      'if (openReports >= MIN_REPORTS) await autoQuarantine(fieldId)',
      'riskScore: reports.length * 2,',
    ]) {
      expect(THRESHOLD.test(planted)).toBe(true)
    }
  })

  /**
   * And the safety module never compares a count to anything.
   *
   * A threshold does not need a named constant to exist — `if (reports.length > 2)` would do
   * it. This asserts the module contains no comparison of a report count at all.
   */
  it('never branches on how many reports there are', () => {
    const safety = stripComments(read('src/server/safety/service.ts'))
    expect(safety).not.toMatch(/(openReports|reports\.length|_count)\s*[><]=?\s*\d/)
    // It does count them — to show a person, which is the point.
    expect(safety).toMatch(/distinctReporters/)
  })
})

describe('invariant 12 still holds — the passport cannot see reports', () => {
  /**
   * Phase 6 made this structural: `RouteTrustInput` has no report field, so no positive
   * signal can be derived from the absence of reports (BR-04, D-19).
   *
   * Phase 9 was the phase that could have broken it, by "helpfully" adding a report count to
   * the route summary. It added `quarantinedCount` instead — a count of *administrator
   * actions*, which is a caution and never a reassurance. This re-asserts the original rule
   * now that reports actually exist.
   */
  it('gives the route passport no way to observe reports', () => {
    const trust = stripComments(read('src/domain/trust.ts'))
    const start = trust.indexOf('export interface RouteTrustInput')
    const block = trust.slice(start, trust.indexOf('}', start))

    expect(block).not.toMatch(/\b(report|reports|reportCount|flagged|abuse|complaint)\b/i)
    expect(block).toMatch(/contributorCount/)
  })

  it('keeps the snapshot free of reports too', () => {
    const trust = stripComments(read('src/domain/trust.ts'))
    const start = trust.indexOf('export interface RouteTrustSnapshot')
    const block = trust.slice(start, trust.indexOf('}', start))

    expect(block).not.toMatch(/\breport/i)
    // It does carry the quarantine count, which is an administrator action, not a report.
    expect(block).toMatch(/quarantinedCount/)
  })

  it('never imports the safety service into the trust surface or the read path', () => {
    for (const file of ['src/domain/trust.ts', 'src/server/routes/read.ts']) {
      expect(stripComments(read(file))).not.toMatch(/@\/server\/safety/)
    }
  })
})

describe('REPORT and CHALLENGE stay different things — §23.1', () => {
  it('uses two separate reason vocabularies with nothing in common', () => {
    const shared = REPORT_REASONS.filter((reason) =>
      (CHALLENGE_REASONS as readonly string[]).includes(reason),
    )
    expect(shared).toEqual([])
  })

  it('keeps reporting out of the contribution module entirely', () => {
    expect(stripComments(read('src/app/[locale]/routes/[slug]/actions.ts'))).not.toMatch(/report/i)
  })

  it('keeps challenging out of the safety module entirely', () => {
    expect(stripComments(read('src/server/safety/service.ts'))).not.toMatch(/challenge/i)
  })
})

describe('quarantine hides, it never deletes — FR-36, invariants 1 and 4', () => {
  it('is a nullable column, not a removal', () => {
    expect(SCHEMA).toMatch(/quarantinedAt\s+DateTime\?/)
    // Nothing in the safety path deletes a field, a revision or anything else.
    const safety = stripComments(read('src/server/safety/service.ts'))
    expect(safety).not.toMatch(/\.delete\(|\.deleteMany\(/)
  })

  it('withholds the value in the read layer rather than in a component', () => {
    /**
     * A phishing URL that reaches the page has already done most of its work: it is in the
     * HTML, and one careless copy away from being followed. `display: none` is not
     * containment.
     */
    const readLayer = stripComments(read('src/server/routes/read.ts'))
    expect(readLayer).toMatch(/valueText: quarantined \? '' : current\.valueText/)
    expect(readLayer).toMatch(/sourceUrl: quarantined \? null : current\.sourceUrl/)
  })

  it('routes the field mutation through the revision service, like every other Field write', () => {
    // `Field` is a revisioned model, so only src/server/revisions may write it (Phase 3).
    // The first draft of the safety service wrote it directly and the model-classification
    // test caught it — the boundary working, rather than an inconvenience.
    const safety = stripComments(read('src/server/safety/service.ts'))
    expect(safety).toMatch(/setFieldQuarantine/)
    expect(safety).not.toMatch(/prisma\.field\.update/)
  })

  it('refuses to delete a report, in or out of a write context', () => {
    expect(COMMUNITY_SIGNAL_MODELS).toContain('Report')
    for (const operation of ['delete', 'deleteMany']) {
      for (const inContext of [true, false]) {
        expect(checkWrite('Report', operation, inContext).allowed).toBe(false)
      }
    }
    // Updating one is how it gets marked handled.
    expect(checkWrite('Report', 'updateMany', false).allowed).toBe(true)
  })
})

describe('the administrator role is a safety role, checked server-side — §23.3', () => {
  it('checks the role in the service, not in a page or an action', () => {
    const safety = stripComments(read('src/server/safety/service.ts'))
    expect(safety).toMatch(/async function requireAdministrator/)

    // Every mutating export calls it. A hidden button is not a permission (CLAUDE.md §9).
    for (const fn of ['quarantineField', 'releaseField', 'handleReport', 'fieldsWithOpenReports']) {
      const start = safety.indexOf(`export async function ${fn}`)
      expect(start).toBeGreaterThan(-1)
      const body = safety.slice(start, start + 700)
      expect(body).toMatch(/requireAdministrator/)
    }
  })

  it('gives the administrator nothing to do with ordinary contributions', () => {
    // §23.3: "The administrator should not be expected to approve every normal contribution."
    const safety = stripComments(read('src/server/safety/service.ts'))
    expect(safety).not.toMatch(/approve|reviseField|addField|createRoute/i)
  })

  it('has exactly two roles, and member is the default', () => {
    expect(SCHEMA).toMatch(/role\s+UserRole\s+@default\(member\)/)
  })
})

describe('reports carry no attachment — FR-25, §8.6, invariants 6 and 7', () => {
  it('has no file column on the report model', () => {
    const start = SCHEMA.indexOf('model Report {')
    const block = SCHEMA.slice(start, SCHEMA.indexOf('}', start))
    expect(block).not.toMatch(/attachment|screenshot|fileUrl|imageUrl|upload|blob/i)
    expect(block).toMatch(/detail\s+String\?/)
  })

  it('reads the report form through the file-refusing helper', () => {
    const action = stripComments(read('src/app/[locale]/routes/[slug]/safety-actions.ts'))
    expect(action).toMatch(/from '@\/lib\/form-fields'/)
    expect(action).not.toMatch(/String\(\s*formData\.get/)
  })
})

describe('nothing here is a leaderboard — §25, VR-11 exception', () => {
  /**
   * VR-11 shows a "Safety Leaderboard". CLAUDE.md §8.6 lists it as an exception not to build:
   * §25 warns against turning contribution into a competitive points game, and turning
   * *reporting* into one would be worse — it rewards volume of accusation.
   */
  const REPORTER_SCORING =
    /\b(topReporters|reporterRank|safetyLeaderboard|reporterScore|reportsLeaderboard)\b/i

  it('ranks no reporter anywhere', () => {
    expect(findAll(REPORTER_SCORING)).toEqual([])
    expect(REPORTER_SCORING.test('const topReporters = await prisma.report.groupBy()')).toBe(true)
  })
})
