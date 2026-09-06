import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { SOURCE_CLASSES, STUDY_LEVELS } from '../../src/domain/enums'
import {
  boundedOptionalText,
  ContributionInputError,
  countryCode,
  LIMITS,
  optionalEnum,
  optionalId,
  optionalWholeNumber,
  requiredEnum,
  requiredId,
  requiredText,
  sourceUrl,
} from '../../src/lib/contribution-input'

/**
 * Server-side validation for public contributions — audit F9.
 *
 * A server action is a POST endpoint reachable without the page ever rendering, so `required`,
 * `maxlength` and a `<select>` of valid options are advisory. Everything asserted below was
 * previously decided by markup, or not decided at all.
 */

const form = (entries: Record<string, string>): FormData => {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.append(key, value)
  return data
}

function refusal(fn: () => unknown): ContributionInputError {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(ContributionInputError)
    return error as ContributionInputError
  }
  throw new Error('expected the value to be refused, but it was accepted')
}

describe('countryCode', () => {
  it('accepts a two-letter code and normalises its case', () => {
    expect(countryCode(form({ c: 'bd' }), 'c', 'Origin')).toBe('BD')
    expect(countryCode(form({ c: ' DE ' }), 'c', 'Origin')).toBe('DE')
  })

  it('refuses a country name instead of silently truncating it', () => {
    // The old code did `.toUpperCase().slice(0, 2)`, turning "Bangladesh" into "BA" — Bosnia
    // and Herzegovina — and `Char(2)` accepted it. A published route then claimed an origin
    // nobody chose.
    const error = refusal(() => countryCode(form({ c: 'Bangladesh' }), 'c', 'Origin'))
    expect(error.message).toContain('two-letter country code')
    expect(error.message).toContain('Bangladesh')
  })

  it('refuses an empty, one-letter, three-letter or non-alphabetic value', () => {
    for (const value of ['', 'D', 'DEU', 'D3', '  ', '德国']) {
      refusal(() => countryCode(form({ c: value }), 'c', 'Origin'))
    }
  })
})

describe('requiredEnum', () => {
  it('accepts a member of the set', () => {
    expect(requiredEnum(form({ level: 'phd' }), 'level', STUDY_LEVELS, 'Study level')).toBe('phd')
  })

  it('refuses an unrecognised value rather than substituting a default', () => {
    // The old `oneOf(values, raw, fallback)` published a Master's route when somebody asked
    // for something it could not read. Publishing under a contributor's name a choice they
    // did not make is not the safe side of a guess.
    const error = refusal(() =>
      requiredEnum(form({ level: 'postdoc' }), 'level', STUDY_LEVELS, 'Study level'),
    )
    expect(error.message).toContain('postdoc')
    expect(error.message).toContain('did not choose')
  })

  it('refuses an absent value', () => {
    expect(
      refusal(() => requiredEnum(form({}), 'level', STUDY_LEVELS, 'Study level')).message,
    ).toContain('required')
  })

  it('refuses an unrecognised source class, which decides how a claim is presented', () => {
    // Substituting `community_submission` is safe in one direction and wrong in every other:
    // the class is what tells a reader who asserts a fact (FR-33, invariant 11).
    refusal(() => requiredEnum(form({ s: 'verified' }), 's', SOURCE_CLASSES, 'Source'))
  })
})

describe('optionalEnum', () => {
  it('treats absent as null, and still refuses a wrong value', () => {
    expect(optionalEnum(form({}), 'm', STUDY_LEVELS, 'Level')).toBeNull()
    expect(optionalEnum(form({ m: '' }), 'm', STUDY_LEVELS, 'Level')).toBeNull()
    refusal(() => optionalEnum(form({ m: 'nonsense' }), 'm', STUDY_LEVELS, 'Level'))
  })
})

describe('requiredText and boundedOptionalText', () => {
  it('refuses a whitespace-only value, which used to publish an unnamed route', () => {
    const error = refusal(() =>
      requiredText(form({ title: '   ' }), 'title', { max: LIMITS.title, label: 'A route title' }),
    )
    expect(error.message).toContain('required')
  })

  it('refuses a value past its ceiling rather than storing it', () => {
    // The columns are unbounded `text`, so without this one POST stores megabytes that every
    // page rendering the route then carries.
    const long = 'x'.repeat(LIMITS.title + 1)
    expect(
      refusal(() => requiredText(form({ t: long }), 't', { max: LIMITS.title, label: 'Title' }))
        .message,
    ).toContain(String(LIMITS.title))
  })

  it('trims, and returns null for an empty optional value', () => {
    expect(requiredText(form({ t: '  Route  ' }), 't', { max: 10, label: 'T' })).toBe('Route')
    expect(boundedOptionalText(form({ n: '  ' }), 'n', { max: 10, label: 'N' })).toBeNull()
  })
})

describe('sourceUrl', () => {
  it('accepts http and https', () => {
    expect(sourceUrl(form({ u: 'https://example.org/a' }), 'u')).toBe('https://example.org/a')
    expect(sourceUrl(form({ u: 'http://example.org' }), 'u')).toBe('http://example.org/')
  })

  it('treats an empty value as no source, which is a legitimate answer', () => {
    expect(sourceUrl(form({ u: '' }), 'u')).toBeNull()
  })

  it('refuses a javascript: or data: URL — a stored scripting vector in a rendered link', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
      expect(refusal(() => sourceUrl(form({ u: value }), 'u')).message).toMatch(/http|web address/)
    }
  })

  it('refuses something that is not a URL at all', () => {
    expect(refusal(() => sourceUrl(form({ u: 'ask at the embassy' }), 'u')).message).toContain(
      'not a web address',
    )
  })
})

describe('requiredId and optionalId', () => {
  it('accepts an ordinary cuid', () => {
    expect(requiredId(form({ id: 'clxk2p8q40000abcdef123456' }), 'id', 'Field')).toBe(
      'clxk2p8q40000abcdef123456',
    )
  })

  it('refuses a blank, and a value carrying characters an id never has', () => {
    for (const value of ['', '  ', "'; drop table routes; --", 'a b', 'x'.repeat(65)]) {
      refusal(() => requiredId(form({ id: value }), 'id', 'Field'))
    }
  })

  it('lets an optional id be absent but not malformed', () => {
    expect(optionalId(form({ id: '' }), 'id', 'Step')).toBeNull()
    refusal(() => optionalId(form({ id: 'not an id' }), 'id', 'Step'))
  })
})

describe('optionalWholeNumber', () => {
  it('accepts a whole number in range and null for empty', () => {
    expect(optionalWholeNumber(form({ d: '30' }), 'd', { max: 3650, label: 'Duration' })).toBe(30)
    expect(optionalWholeNumber(form({ d: '' }), 'd', { max: 3650, label: 'Duration' })).toBeNull()
  })

  it('refuses a negative, a fraction, a word and an out-of-range value', () => {
    for (const value of ['-1', '1.5', 'thirty', '99999', 'Infinity', 'NaN']) {
      refusal(() => optionalWholeNumber(form({ d: value }), 'd', { max: 3650, label: 'Duration' }))
    }
  })
})

describe('the contribution actions use it, and keep no silent fallback', () => {
  const read = (path: string) =>
    readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')

  const withoutComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('create-route validates every published value here rather than in the form', () => {
    const code = withoutComments(read('src/app/[locale]/routes/new/actions.ts'))
    expect(code).toContain('countryCode(formData')
    expect(code).toContain('requiredEnum(formData')
    expect(code).toContain("requiredText(formData, 'title'")
    // The three specific bugs.
    expect(code).not.toContain('.slice(0, 2)')
    expect(code).not.toMatch(/function oneOf/)
    expect(code).toContain('origin === destination')
  })

  it('the route contribution actions no longer carry a defaulting helper', () => {
    const code = withoutComments(read('src/app/[locale]/routes/[slug]/actions.ts'))
    expect(code).not.toMatch(/function oneOf/)
    expect(code).toContain('requiredEnum(formData')
    expect(code).toContain('requiredId(formData')
  })

  it('the add-step action creates the step and its edge in one operation', () => {
    // Audit F7: two calls meant a failure between them left an unreachable step on the road.
    const code = withoutComments(read('src/app/[locale]/routes/[slug]/actions.ts'))
    // Scoped to this action's own body. `addEdge` is legitimately called elsewhere in the file
    // since Phase 12E — `connectStepsAction` joins two steps that already exist — and a
    // file-wide check would forbid the feature rather than the defect it replaced.
    const body = code.slice(
      code.indexOf('export async function addStepAction'),
      code.indexOf('export async function addFieldAction'),
    )
    expect(body).toContain('addStepWithConnection')
    expect(body).not.toMatch(/\baddEdge\(/)
  })
})
