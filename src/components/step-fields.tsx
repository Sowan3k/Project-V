import type { Dictionary } from '@/i18n/dictionaries/en'
import type { FieldView, StepView } from '@/server/routes/read'

/**
 * The fields inside a step — VR-05, FR-51.
 *
 * Fields are the smallest community-maintained unit, and each carries its own source and
 * history. Two things this must get right even before Phase 6 builds the full trust surface:
 *
 *   - **Where a value came from is always shown.** An official requirement and a community
 *     experience are different claim types and must never look alike (FR-54, BR-07,
 *     invariant 11). Showing the source class as plain text is the honest minimum; badges,
 *     freshness scoring and dispute markers are Phase 6.
 *   - **A link's real destination is visible before the reader leaves.** No bare "apply
 *     here" (FR-64, invariant 10). The host is printed next to the link, and unverified
 *     sources say so.
 *   - **How widely a claim applies is shown next to who asserts it** (FR-81, D-47). These are
 *     different questions and are rendered as visibly different things: source class is a
 *     provenance line, applicability is a scope chip. Without it, "GRE required" sitting
 *     beside "blocked account €11,904" reads as though Germany demanded both — the failure
 *     this requirement exists to prevent.
 */
export function StepFields({
  step,
  fields,
  dictionary: t,
}: {
  step: StepView
  fields: readonly FieldView[]
  dictionary: Dictionary
}) {
  if (fields.length === 0) {
    return <p className="text-sm text-ink-700">{t.route.noFields}</p>
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-ink-900">{t.route.fieldsIn(step.label)}</h3>
      <ul className="mt-3 space-y-3">
        {fields.map((field) => (
          <li key={field.id} className="rounded-lg border border-hairline bg-surface-muted p-3">
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
              {t.fieldCategory[field.category]}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-900">{field.valueText}</p>

            <ul className="mt-2 flex flex-wrap gap-1.5">
              {field.applicability.length === 0 ? (
                <li className="rounded-full border border-dashed border-hairline px-2 py-0.5 text-xs text-ink-500">
                  {t.applicabilityUnknown}
                </li>
              ) : (
                field.applicability.map((scope) => (
                  <li
                    key={scope}
                    className="rounded-full border border-brand-500/40 bg-brand-500/5 px-2 py-0.5 text-xs text-brand-900"
                  >
                    {t.applicability[scope]}
                  </li>
                ))
              )}
            </ul>

            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
              <div className="flex gap-1">
                <dt>{t.route.source}:</dt>
                <dd className="text-ink-700">{t.sourceClass[field.sourceClass]}</dd>
              </div>

              <div className="flex gap-1">
                <dt>{t.route.lastConfirmed}:</dt>
                <dd className="text-ink-700">
                  {field.lastConfirmedAt === null
                    ? t.route.neverConfirmed
                    : field.lastConfirmedAt.toISOString().slice(0, 10)}
                </dd>
              </div>

              <div className="flex gap-1">
                <dd className="text-ink-700">{t.route.revisionCount(field.revisionCount)}</dd>
              </div>
            </dl>

            {field.sourceUrl === null ? null : <SourceLink url={field.sourceUrl} />}
            {field.sourceNote === null ? null : (
              <p className="mt-1 text-xs text-ink-500">{field.sourceNote}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * An external source link with its real host shown.
 *
 * "The visible domain/destination should be understandable before a user leaves the
 * platform" (§22.2, FR-64). A malformed URL is printed as text rather than linked — if we
 * cannot parse it, we cannot tell the reader where it goes.
 */
function SourceLink({ url }: { url: string }) {
  let host: string | null = null
  try {
    host = new URL(url).host
  } catch {
    host = null
  }

  if (host === null) {
    return <p className="mt-2 break-all text-xs text-ink-500">{url}</p>
  }

  return (
    <p className="mt-2 text-xs">
      <a
        href={url}
        rel="nofollow noopener noreferrer external"
        target="_blank"
        className="text-brand-700 underline"
      >
        {host}
      </a>{' '}
      <span className="break-all text-ink-500">{url}</span>
    </p>
  )
}
