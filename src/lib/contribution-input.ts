import { text } from './form-fields'

/**
 * Server-side validation for public contributions — audit F9.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Why the HTML form is not the validation.**
 *
 * `createRouteAction` trimmed the country codes to two characters and uppercased them,
 * accepted a whitespace-only title, permitted an origin identical to the destination, and
 * substituted a default whenever an enum value was unrecognised. Everything it relied on was
 * in the markup: `required`, `maxlength`, and a `<select>` whose options happened to be the
 * valid ones.
 *
 * A server action is a POST endpoint. Next.js gives it an id and it is reachable without ever
 * rendering the page, so every browser control is advisory. What lands in the database is
 * decided here or it is not decided at all — and this database is a public good whose whole
 * value is that a reader can trust what a route says (FR-13, FR-75).
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **A malformed enum is refused, never defaulted.**
 *
 * The old `oneOf(values, raw, fallback)` quietly substituted. For a study level that means
 * somebody's PhD route is published as a Master's route; for a source class it means an
 * unreadable value becomes `community_submission` — the least authoritative class, so safe in
 * that one direction and wrong in every other. Publishing something a contributor did not ask
 * for, under their name, is not a safe failure. Refusing is.
 *
 * The deliberate exception is elsewhere and stays: `announceChangeAction` falls back to
 * `informational` severity, documented at its call site, because over-claiming severity
 * trains readers to ignore the level that matters and no route content is published by it.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What a failure looks like.**
 *
 * A thrown `ContributionInputError`, which reaches the error boundary. That is blunt, and it
 * is deliberately the smaller problem: the alternative was publishing a different route than
 * the person asked for. Field-level messages returned to the form belong with the rest of the
 * contribution surface work (Phase 12E) and want `useActionState`, which is a change to every
 * form rather than to this file.
 */

export class ContributionInputError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'ContributionInputError'
  }
}

/**
 * Length ceilings.
 *
 * Not opinions about good writing — they are the point past which a value is not a
 * contribution. A title is a name, a summary is a paragraph, a field value is a claim
 * somebody can read. The database columns are unbounded `text`, so without these a single
 * POST can store megabytes and every page rendering that route carries it.
 */
export const LIMITS = {
  title: 200,
  summary: 2000,
  stepLabel: 120,
  fieldValue: 4000,
  note: 2000,
  intake: 60,
  url: 2000,
} as const

/** A required text value, trimmed, present and within its ceiling. */
export function requiredText(
  form: FormData,
  field: string,
  { max, label }: { max: number; label: string },
): string {
  const value = text(form, field).trim()
  if (value === '') {
    throw new ContributionInputError(field, `${label} is required.`)
  }
  if (value.length > max) {
    throw new ContributionInputError(
      field,
      `${label} is longer than ${max} characters. Shorten it, or put the detail in a field of its own.`,
    )
  }
  return value
}

/** An optional text value: `null` when empty, still bounded when present. */
export function boundedOptionalText(
  form: FormData,
  field: string,
  { max, label }: { max: number; label: string },
): string | null {
  const value = text(form, field).trim()
  if (value === '') return null
  if (value.length > max) {
    throw new ContributionInputError(field, `${label} is longer than ${max} characters.`)
  }
  return value
}

/**
 * One of a fixed set, or a refusal.
 *
 * The replacement for `oneOf(values, raw, fallback)`. There is no fallback parameter, which
 * is the whole change: a caller cannot accidentally publish a default.
 */
export function requiredEnum<T extends string>(
  form: FormData,
  field: string,
  values: readonly T[],
  label: string,
): T {
  const raw = text(form, field).trim()
  if ((values as readonly string[]).includes(raw)) return raw as T
  throw new ContributionInputError(
    field,
    raw === ''
      ? `${label} is required.`
      : `"${raw}" is not a recognised ${label.toLowerCase()}. Nothing was saved, because ` +
          `substituting a default would publish something you did not choose.`,
  )
}

/** Optional membership of a fixed set: absent is allowed, wrong is not. */
export function optionalEnum<T extends string>(
  form: FormData,
  field: string,
  values: readonly T[],
  label: string,
): T | null {
  const raw = text(form, field).trim()
  if (raw === '') return null
  if ((values as readonly string[]).includes(raw)) return raw as T
  throw new ContributionInputError(field, `"${raw}" is not a recognised ${label.toLowerCase()}.`)
}

/**
 * An ISO 3166-1 alpha-2 country code.
 *
 * The old code did `.trim().toUpperCase().slice(0, 2)`, which turns "Bangladesh" into "BA" —
 * Bosnia and Herzegovina. The column is `Char(2)`, so the database accepted it, and a route
 * would have been published claiming an origin nobody chose. Two letters are required rather
 * than produced.
 *
 * Membership of the real ISO list is deliberately not checked here: the list changes, and a
 * route to a country we had not enumerated would be refused for the wrong reason. Shape and
 * distinctness are what stop the failures actually seen.
 */
export function countryCode(form: FormData, field: string, label: string): string {
  const raw = text(form, field).trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(raw)) {
    throw new ContributionInputError(
      field,
      `${label} must be a two-letter country code, such as BD or DE. "${text(form, field).trim()}" is not one.`,
    )
  }
  return raw
}

/** An id that must look like one. Refuses a blank or an obviously malformed value early. */
export function requiredId(form: FormData, field: string, label: string): string {
  const raw = text(form, field).trim()
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(raw)) {
    throw new ContributionInputError(field, `${label} is missing or malformed.`)
  }
  return raw
}

/** The same, but absent is a legitimate answer. */
export function optionalId(form: FormData, field: string, label: string): string | null {
  const raw = text(form, field).trim()
  if (raw === '') return null
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(raw)) {
    throw new ContributionInputError(field, `${label} is malformed.`)
  }
  return raw
}

/**
 * A source URL, or null.
 *
 * Only `http` and `https` are accepted. A `javascript:` or `data:` value in a field the
 * product renders as a link is a stored cross-site scripting vector, and this platform's own
 * safety story is about what happens when a reader follows a link (FR-64, FR-65,
 * invariants 9 and 10). Whether the host is *trustworthy* is a separate question the link
 * trust classes answer; this is only about whether it is a web address at all.
 */
export function sourceUrl(form: FormData, field: string): string | null {
  const raw = text(form, field).trim()
  if (raw === '') return null
  if (raw.length > LIMITS.url) {
    throw new ContributionInputError(field, `That source URL is longer than ${LIMITS.url} characters.`)
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new ContributionInputError(
      field,
      `"${raw}" is not a web address. Leave it empty, or describe the source in the note instead.`,
    )
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ContributionInputError(
      field,
      `A source link must be http or https. "${parsed.protocol}" is not.`,
    )
  }
  return parsed.toString()
}

/** A whole number within bounds, or null. Used for step timing offsets and durations. */
export function optionalWholeNumber(
  form: FormData,
  field: string,
  { max, label }: { max: number; label: string },
): number | null {
  const raw = text(form, field).trim()
  if (raw === '') return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new ContributionInputError(
      field,
      `${label} must be a whole number of days between 0 and ${max}.`,
    )
  }
  return value
}
