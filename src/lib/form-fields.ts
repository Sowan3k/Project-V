/**
 * Reading form fields, and refusing files.
 *
 * Shared by every server action in the application — private journey progress (Phase 7) and
 * public contributions (Phase 8) alike — because the rule is the same in both places and a
 * rule duplicated is a rule that drifts.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Why this exists rather than `String(form.get(x))`.**
 *
 * `FormData` entries are `string | File`, so `String(entry)` on a file quietly produces
 * `"[object Object]"`. That is the shallow reason, and it arrived as an ESLint
 * `no-base-to-string` error. The real one is deeper:
 *
 * **Next.js encodes every server-action form as `multipart/form-data`.** That enctype belongs
 * to the framework and appears on forms accepting nothing but text, so a hand-crafted POST can
 * carry a file part no matter what any page renders. "There is no upload path" therefore
 * cannot be proved from markup — it has to be refused here, at the boundary.
 *
 * And it must be refused. The platform does not ask a student to prove they sat an exam before
 * ticking a box (FR-25, BR-06, D-09, invariant 6), and it is not a store for passports,
 * transcripts, bank statements, visas or admission letters (§24.1, invariant 7). There is no
 * column that could hold one and no code that would read one; this makes the door refuse it
 * too, rather than leaving the guarantee resting on an absence.
 */

export class UploadRefusedError extends Error {
  constructor(field: string) {
    super(
      `refusing a file in "${field}": this platform accepts no uploads. Contributions and ` +
        `personal progress are text, and marking progress never requires evidence ` +
        `(FR-25, BR-06, D-09, §24.1, CLAUDE.md invariants 6 and 7).`,
    )
    this.name = 'UploadRefusedError'
  }
}

/** A text field, or `''` when absent. Throws on a file. */
export function text(form: FormData, field: string): string {
  const value = form.get(field)
  if (value === null) return ''
  if (typeof value !== 'string') throw new UploadRefusedError(field)
  return value
}

/** A trimmed text field, or `null` when empty — for optional notes and reasons. */
export function optionalText(form: FormData, field: string): string | null {
  return text(form, field).trim() || null
}

/**
 * A date field, as `yyyy-mm-dd` from a date input.
 *
 * Three outcomes, all meaningful: `undefined` when the field was not submitted at all (leave
 * it alone), `null` when it was submitted empty (the user cleared it), and a `Date` otherwise.
 * Collapsing the first two would make clearing a date impossible.
 */
export function optionalDate(form: FormData, field: string): Date | null | undefined {
  if (form.get(field) === null) return undefined
  const value = text(form, field).trim()
  if (value === '') return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}
