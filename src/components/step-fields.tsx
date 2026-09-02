import { ExternalSourceLink, FieldContext, FieldSignals } from '@/components/trust'
import { fieldGroup, FIELD_GROUP_ORDER, type FieldGroupId, type FieldTrustInput } from '@/domain/trust'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { FieldView, StepView } from '@/server/routes/read'

/**
 * The fields inside a step — VR-05, FR-51, and the Phase 6 trust surface.
 *
 * **Fields are grouped by who is making the claim, not merely badged with it.** An official
 * requirement and a community experience are different claim types that must never look
 * alike or occupy one another's space (FR-33, FR-54, BR-07, invariant 11). Two ways to
 * express that were available: a source badge on every row, or separate labelled regions.
 * Regions win twice over — the separation is positional, so it survives a reader skimming;
 * and the provenance is stated once per group instead of once per field, which is most of
 * the reason this page is not a wall of badges.
 *
 * Disputed information comes first. A contested claim that a reader scrolls past is a
 * contested claim we failed to disclose (FR-70, invariant 15).
 *
 * Within a row the hierarchy is: the value, then any caution, then a quiet provenance line.
 * A field that is official, route-wide and recently confirmed has no caution at all — the
 * unremarkable case renders as unremarkable, which is what leaves room for the one field
 * that says "applies to this programme only" to be noticed (FR-81).
 */
export function StepFields({
  step,
  fields,
  dictionary: t,
  now = new Date(),
}: {
  step: StepView
  fields: readonly FieldView[]
  dictionary: Dictionary
  now?: Date
}) {
  if (fields.length === 0) {
    return <p className="text-sm text-ink-700">{t.route.noFields}</p>
  }

  const grouped = new Map<FieldGroupId, FieldView[]>()
  for (const field of fields) {
    const group = fieldGroup(field.sourceClass)
    grouped.set(group, [...(grouped.get(group) ?? []), field])
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-ink-900">{t.route.fieldsIn(step.label)}</h3>

      {FIELD_GROUP_ORDER.map((group) => {
        const inGroup = grouped.get(group)
        if (inGroup === undefined || inGroup.length === 0) return null

        return (
          <section key={group} className="mt-5 first:mt-4">
            <h4 className="text-xs font-semibold tracking-wide text-ink-900 uppercase">
              {t.trust.fieldGroup[group].title}
            </h4>
            <p className="mt-0.5 text-xs leading-5 text-ink-500">
              {t.trust.fieldGroup[group].note}
            </p>

            <ul className="mt-2 space-y-3">
              {inGroup.map((field) => (
                <FieldRow key={field.id} field={field} dictionary={t} now={now} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function FieldRow({
  field,
  dictionary: t,
  now,
}: {
  field: FieldView
  dictionary: Dictionary
  now: Date
}) {
  const trust = toFieldTrustInput(field)

  return (
    <li className="rounded-lg border border-hairline bg-surface-muted p-3">
      <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
        {t.fieldCategory[field.category]}
      </p>
      <p className="mt-1 text-sm leading-6 text-ink-900">{field.valueText}</p>

      <FieldSignals input={trust} dictionary={t} now={now} />
      <FieldContext input={trust} dictionary={t} now={now} />

      {field.sourceUrl === null ? null : (
        <ExternalSourceLink
          url={field.sourceUrl}
          declaredTrust={field.linkTrustClass}
          dictionary={t}
        />
      )}
      {field.sourceNote === null ? null : (
        <p className="mt-1 text-xs text-ink-500">{field.sourceNote}</p>
      )}
    </li>
  )
}

/**
 * The read layer's view of a field, narrowed to exactly what the trust rules may see.
 *
 * Written as an explicit mapping rather than a spread so that adding a column to `FieldView`
 * never silently widens what `src/domain/trust.ts` is allowed to reason about — which is how
 * a report count would eventually find its way in (invariant 12).
 */
function toFieldTrustInput(field: FieldView): FieldTrustInput {
  return {
    sourceClass: field.sourceClass,
    applicability: field.applicability,
    lastConfirmedAt: field.lastConfirmedAt,
    reviewDueAt: field.reviewDueAt,
    effectiveFrom: field.effectiveFrom,
    expiresAt: field.expiresAt,
    revisionCount: field.revisionCount,
    lastRevisedAt: field.lastRevisedAt,
    hasForkedHistory: field.hasForkedHistory,
  }
}
