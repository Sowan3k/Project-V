import { describe, expect, it } from 'vitest'

import { read } from '../support/source-files'

/**
 * FR-80: "First-release product behavior shall be traceable to this final baseline."
 *
 * Traceability is only real if it is checked. This was owed as a manual audit from session 2,
 * did not happen for two sessions, and when finally run found two orphaned requirements. So
 * it is a test now rather than an intention.
 *
 * The rule it enforces is **at least one delivering phase**, not "exactly one". That
 * correction came out of running the audit: nine requirements legitimately span two phases,
 * because a mechanism and the surface that exposes it are different work. FR-57 is the
 * branching schema in Phase 2 and the branching renderer in Phase 4. Forcing one phase each
 * would make the plan less accurate, not more.
 *
 * Phase 1 is excluded because it states outright that its FRs are "proved, not delivered" —
 * a kill spike cites a requirement to say it tested the idea, not that it shipped it.
 */

const requirements = read('REQUIREMENTS.md')
const phases = read('Phases.md')

/** Every FR the frozen baseline defines, read from its catalogue table (§29). */
const DEFINED_FRS = [...requirements.matchAll(/^\| (FR-\d{2}) \|/gm)].map((m) => m[1] ?? '')

/** FR ids cited under a delivering phase heading, excluding prose sections and Phase 1. */
function assignments(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>()
  let section: string | null = null

  for (const line of phases.split(/\r?\n/)) {
    const heading = /^## (.+)$/.exec(line)
    if (heading) {
      const title = heading[1] ?? ''
      const delivering = /^(Phase \d+|Content track)/.exec(title)
      // Phase 1 proves; it does not deliver. Its own heading says so.
      section = delivering && !title.startsWith('Phase 1 ') ? (delivering[1] ?? null) : null
      continue
    }
    if (!section) continue

    for (const match of line.matchAll(/FR-\d{2}/g)) {
      const id = match[0]
      if (!found.has(id)) found.set(id, new Set())
      found.get(id)?.add(section)
    }
  }
  return found
}

describe('every requirement is traceable to a phase (FR-80)', () => {
  it('reads all 80 requirements from the baseline', () => {
    expect(DEFINED_FRS).toHaveLength(80)
    expect(DEFINED_FRS[0]).toBe('FR-01')
    expect(DEFINED_FRS[79]).toBe('FR-80')
  })

  it('assigns every requirement to at least one delivering phase', () => {
    const assigned = assignments()
    const orphans = DEFINED_FRS.filter((id) => !assigned.has(id))

    expect(
      orphans,
      `These requirements are in the baseline but no phase claims them, so nothing would ` +
        `build them: ${orphans.join(', ')}. Assign each to a phase in Phases.md, or raise it ` +
        `as a change request (BR-35).`,
    ).toEqual([])
  })

  it('cites no requirement that the baseline does not define', () => {
    const invented = [...assignments().keys()].filter((id) => !DEFINED_FRS.includes(id))
    expect(
      invented,
      `Phases.md cites requirement ids that do not exist in the baseline: ${invented.join(', ')}`,
    ).toEqual([])
  })

  it('keeps every phase FR list sorted and free of duplicates', () => {
    for (const line of phases.split(/\r?\n/)) {
      if (!line.startsWith('**FRs')) continue
      const ids = [...line.matchAll(/FR-\d{2}/g)].map((m) => m[0])
      expect(new Set(ids).size, `duplicate FR in: ${line}`).toBe(ids.length)
    }
  })
})
