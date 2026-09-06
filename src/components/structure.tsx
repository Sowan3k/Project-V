import {
  connectStepsAction,
  reviseConnectionAction,
  reviseRouteAction,
  reviseStepAction,
  setConnectionArchivedAction,
  setFieldArchivedAction,
  setStepArchivedAction,
} from '@/app/[locale]/routes/[slug]/actions'
import { Caution } from '@/components/trust'
import { ARCHIVE_INTENT, RESTORE_INTENT } from '@/lib/contribution-input'
import { buttonClass } from '@/components/ui'
import { STEP_CATEGORIES, STEP_EDGE_KINDS } from '@/domain/enums'
import type { Dictionary } from '@/i18n/dictionaries/en'
import type { RouteDetail, RouteStructure, StructureStep } from '@/server/routes/read'

/**
 * Maintaining the shape of a road — Phase 12E, audit F6. FR-14, FR-16, FR-21, FR-57, FR-69.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **The gap this closes, stated plainly.**
 *
 * The revision engine has been able to rename a stage, retime it, connect two stages with any
 * of four typed connections, change a connection's kind, and archive and restore all of it
 * since Phase 3. Every one of those was proved by tests. None of them was reachable from any
 * page: a contributor could add a stage and nothing else.
 *
 * So a route whose stages were named wrongly, ordered wrongly, or which needed an optional
 * detour could not be corrected by the community that is supposed to maintain it — and the
 * product's whole premise is that "people ahead on the journey leave the route clearer for the
 * people coming behind them". A capability that exists only in a service is not a capability.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **The words are the design, not the decoration.**
 *
 * The domain calls these `sequential`, `optional_branch`, `alternative` and `rejoin`, and
 * those names are exactly right for the schema. Nobody maintaining a route to Germany thinks
 * in edge kinds. A student who knows that the APS certificate has to be done before the visa
 * appointment, and that a blocked account and a scholarship letter are two ways of proving
 * finance, is describing `sequential` and `alternative` — but will never find them under those
 * words.
 *
 * So every control here asks a question in the contributor's own terms, and the dictionary
 * carries a one-line explanation beside each choice, because these are genuinely different
 * claims about the world and picking the wrong one changes what the road says.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **How two stages are said to happen at the same time.**
 *
 * Not with a "parallel" checkbox, and not with a position column — there is no orderIndex
 * anywhere in this product and none may be added (invariant 22). Overlap is expressed through
 * **timing**: two stages whose windows intersect are concurrent, `buildTimeline` puts them in
 * separate lanes, and the renderer draws them side by side (§20.2, §20.3).
 *
 * That is why "when can this start" and "how long does it usually take" sit in the stage form
 * rather than being hidden as advanced options. They are the mechanism. The form says so, in
 * one line, because a contributor who does not know that will never produce a parallel road.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What this deliberately is not.**
 *
 * Not a graph editor. There is no canvas, no node palette and no separate builder page — the
 * controls sit inside the route, beside the road they change, and every one is a `<details>`
 * disclosure containing a plain form that works with JavaScript disabled (CLAUDE.md §7.1,
 * FR-50). A disconnected developer-style editor would be a different product for a different
 * person.
 *
 * Not destructive. Archiving takes a stage or a connection off the current road and leaves it,
 * its revisions and every follower's progress against it exactly where they were; restoring
 * brings it back (FR-21, FR-45, BR-15, invariant 4).
 *
 * Not gated. Any signed-in contributor may reshape any route, with no owner and no approval
 * (FR-44, FR-69, BR-01, D-18, invariant 3, §43.1).
 */

const SUMMARY =
  'cursor-pointer list-none text-meta font-medium text-brand-700 underline decoration-hairline underline-offset-2'
const FORM = 'mt-2 grid gap-2 rounded-control border border-hairline bg-surface-muted p-3'
const LABEL = 'block text-xs text-ink-700'
const INPUT =
  'mt-1 block w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900'
const SUBMIT = buttonClass('primary', { size: 'compact', className: 'justify-self-start' })
const QUIET = buttonClass('secondary', { size: 'compact', className: 'justify-self-start' })

/** Every form carries these, and a hand-made POST is validated server-side regardless. */
function FormContext({ locale, slug }: { locale: string; slug: string }) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
    </>
  )
}

/**
 * Why a change is being made, carried onto the revision — FR-20, BR-03.
 *
 * Optional everywhere, deliberately. FR-50 asks for minimal unnecessary form filling, and a
 * required explanation is how a correction goes unmade. The revision records the author and
 * the timestamp whether or not one is given.
 */
function ReasonField({ dictionary: t }: { dictionary: Dictionary }) {
  return (
    <label className={LABEL}>
      {t.structure.reason}
      <input type="text" name="reason" className={INPUT} />
    </label>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The route's own name and summary
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * FR-16 — correct what the route is called.
 *
 * Reachable but quiet: it sits under the route heading rather than beside it, because
 * renaming a route is rare and reading one is not.
 */
export function ReviseRouteForm({
  route,
  structure,
  locale,
  dictionary: t,
}: {
  route: RouteDetail
  structure: RouteStructure
  locale: string
  dictionary: Dictionary
}) {
  return (
    <details className="mt-3">
      <summary className={SUMMARY}>{t.structure.reviseRoute}</summary>
      <form action={reviseRouteAction} className={FORM}>
        <FormContext locale={locale} slug={route.slug} />
        <input type="hidden" name="routeId" value={route.id} />
        <input
          type="hidden"
          name="basedOnRevisionId"
          value={structure.routeCurrentRevisionId ?? ''}
        />

        <label className={LABEL}>
          {t.structure.routeTitle}
          <input
            type="text"
            name="title"
            required
            maxLength={200}
            defaultValue={route.title}
            className={INPUT}
          />
        </label>

        <label className={LABEL}>
          {t.structure.routeSummary}
          <textarea
            name="summary"
            rows={3}
            maxLength={2000}
            defaultValue={route.summary ?? ''}
            className={INPUT}
          />
        </label>

        <ReasonField dictionary={t} />
        <button type="submit" className={SUBMIT}>
          {t.structure.save}
        </button>
      </form>
    </details>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   One stage
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * FR-16, FR-21 — correct a stage, or take it off the road.
 *
 * The timing pair is the part worth reading twice. It is not metadata: two stages whose
 * windows overlap are what makes a road parallel, and there is no other way to say it
 * (§20.2, §20.3, invariant 22). The hint under the fields says so in one sentence, because a
 * contributor who does not know it will build a straight line by accident.
 */
export function ReviseStepForm({
  step,
  routeSlug,
  locale,
  dictionary: t,
}: {
  step: StructureStep
  routeSlug: string
  locale: string
  dictionary: Dictionary
}) {
  return (
    <details className="mt-2">
      <summary className={SUMMARY}>{t.structure.reviseStep}</summary>
      <form action={reviseStepAction} className={FORM}>
        <FormContext locale={locale} slug={routeSlug} />
        <input type="hidden" name="stepId" value={step.id} />
        <input type="hidden" name="basedOnRevisionId" value={step.currentRevisionId ?? ''} />

        <label className={LABEL}>
          {t.structure.stepLabel}
          <input
            type="text"
            name="label"
            required
            maxLength={120}
            defaultValue={step.label}
            className={INPUT}
          />
        </label>

        <label className={LABEL}>
          {t.structure.stepCategory}
          <select name="category" defaultValue={step.category} className={INPUT}>
            {STEP_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t.stepCategory[category]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className={LABEL}>
            {t.structure.earliestStart}
            <input
              type="number"
              name="earliestStartOffsetDays"
              min={0}
              max={3650}
              step={1}
              defaultValue={step.earliestStartOffsetDays ?? ''}
              className={INPUT}
            />
          </label>
          <label className={LABEL}>
            {t.structure.typicalDuration}
            <input
              type="number"
              name="typicalDurationDays"
              min={0}
              max={3650}
              step={1}
              defaultValue={step.typicalDurationDays ?? ''}
              className={INPUT}
            />
          </label>
        </div>
        {/* The mechanism, said out loud. Without this sentence a contributor has no way to
            know that overlapping windows are how a road becomes parallel. */}
        <p className="text-meta leading-5 text-ink-500">{t.structure.timingExplainer}</p>

        <ReasonField dictionary={t} />
        <button type="submit" className={SUBMIT}>
          {t.structure.save}
        </button>
      </form>
    </details>
  )
}

/**
 * FR-21, FR-45, invariant 4 — take a stage off the road, or put it back.
 *
 * Its own form rather than a control inside the edit form, so it can never be triggered by
 * somebody who meant to rename something. The wording says what actually happens: the stage
 * leaves the road and stays in the history, and every follower's progress against it survives
 * — the database physically refuses to delete a step somebody is tracking.
 */
export function StepArchiveControl({
  step,
  routeSlug,
  locale,
  dictionary: t,
}: {
  step: StructureStep
  routeSlug: string
  locale: string
  dictionary: Dictionary
}) {
  return (
    <details className="mt-2">
      <summary className={SUMMARY}>
        {step.archived ? t.structure.restoreStep : t.structure.archiveStep}
      </summary>
      <form action={setStepArchivedAction} className={FORM}>
        <FormContext locale={locale} slug={routeSlug} />
        <input type="hidden" name="stepId" value={step.id} />
        <input
          type="hidden"
          name="intent"
          value={step.archived ? RESTORE_INTENT : ARCHIVE_INTENT}
        />
        <p className="text-xs leading-5 text-ink-700">
          {step.archived ? t.structure.restoreStepNote : t.structure.archiveStepNote}
        </p>
        <ReasonField dictionary={t} />
        <button type="submit" className={QUIET}>
          {step.archived ? t.structure.restoreStep : t.structure.archiveStep}
        </button>
      </form>
    </details>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Connections between stages
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * The four kinds, offered as the four different claims they are.
 *
 * Shared by the connect form and the revise form so the wording cannot drift between "what
 * you chose" and "what it says".
 */
function ConnectionKindSelect({
  defaultValue,
  dictionary: t,
}: {
  defaultValue?: string
  dictionary: Dictionary
}) {
  return (
    <label className={LABEL}>
      {t.structure.connectionKind}
      <select name="edgeKind" defaultValue={defaultValue} className={INPUT}>
        {STEP_EDGE_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t.stepEdgeKind[kind].label}
          </option>
        ))}
      </select>
      {/* Every kind explained together, rather than only the selected one: choosing well means
          comparing them, and a <select> cannot show a description per option without
          JavaScript. */}
      <ul className="mt-1.5 space-y-0.5">
        {STEP_EDGE_KINDS.map((kind) => (
          <li key={kind} className="text-meta leading-5 text-ink-500">
            <span className="font-medium text-ink-700">{t.stepEdgeKind[kind].label}</span> —{' '}
            {t.stepEdgeKind[kind].explainer}
          </li>
        ))}
      </ul>
    </label>
  )
}

/** FR-57, D-37 — join two stages that already exist. */
export function ConnectStepsForm({
  structure,
  routeSlug,
  locale,
  dictionary: t,
}: {
  structure: RouteStructure
  routeSlug: string
  locale: string
  dictionary: Dictionary
}) {
  const live = structure.steps.filter((step) => !step.archived)
  if (live.length < 2) return null

  return (
    <details className="mt-3">
      <summary className={SUMMARY}>{t.structure.connectSteps}</summary>
      <form action={connectStepsAction} className={FORM}>
        <FormContext locale={locale} slug={routeSlug} />
        <input type="hidden" name="routeId" value={structure.routeId} />

        <div className="grid gap-2 sm:grid-cols-2">
          <label className={LABEL}>
            {t.structure.fromStep}
            <select name="fromStepId" required className={INPUT}>
              {live.map((step) => (
                <option key={step.id} value={step.id}>
                  {step.label}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            {t.structure.toStep}
            <select name="toStepId" required className={INPUT}>
              {live.map((step) => (
                <option key={step.id} value={step.id}>
                  {step.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ConnectionKindSelect dictionary={t} />
        <ReasonField dictionary={t} />
        <button type="submit" className={SUBMIT}>
          {t.structure.connect}
        </button>
      </form>
    </details>
  )
}

/**
 * The connections this road already has, each editable in place.
 *
 * Shown as sentences rather than as a table of ids: "Documents → Visa appointment, must be
 * finished first" is a claim a contributor can check against what they know. A row of cuids
 * is not.
 */
export function ConnectionList({
  structure,
  routeSlug,
  locale,
  dictionary: t,
}: {
  structure: RouteStructure
  routeSlug: string
  locale: string
  dictionary: Dictionary
}) {
  const label = (id: string) => structure.steps.find((step) => step.id === id)?.label ?? '—'
  if (structure.edges.length === 0) return null

  return (
    <details className="mt-3">
      <summary className={SUMMARY}>{t.structure.connections}</summary>
      <ul className="mt-2 space-y-2">
        {structure.edges.map((edge) => (
          <li
            key={edge.id}
            className="rounded-control border border-hairline bg-surface px-3 py-2"
          >
            <p className="text-sm text-ink-900">
              {label(edge.fromStepId)} <span aria-hidden="true">→</span> {label(edge.toStepId)}
            </p>
            <p className="mt-0.5 text-meta text-ink-500">
              {t.stepEdgeKind[edge.kind].label}
              {edge.archived ? ` · ${t.structure.archivedNote}` : ''}
            </p>

            {edge.archived ? null : (
              <form action={reviseConnectionAction} className={FORM}>
                <FormContext locale={locale} slug={routeSlug} />
                <input type="hidden" name="edgeId" value={edge.id} />
                <input
                  type="hidden"
                  name="basedOnRevisionId"
                  value={edge.currentRevisionId ?? ''}
                />
                <ConnectionKindSelect defaultValue={edge.kind} dictionary={t} />
                <ReasonField dictionary={t} />
                <button type="submit" className={SUBMIT}>
                  {t.structure.save}
                </button>
              </form>
            )}

            <form action={setConnectionArchivedAction} className="mt-2">
              <FormContext locale={locale} slug={routeSlug} />
              <input type="hidden" name="edgeId" value={edge.id} />
              <input
                type="hidden"
                name="intent"
                value={edge.archived ? RESTORE_INTENT : ARCHIVE_INTENT}
              />
              <button type="submit" className="text-meta text-brand-700 underline">
                {edge.archived ? t.structure.restoreConnection : t.structure.removeConnection}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </details>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   What is still unfinished
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Says what is incomplete about this road, and never blocks anything — §7.3.
 *
 * These are the violations a later addition repairs: a stage connected to nothing, a stage
 * nothing leads to, a road with no starting point, a rejoin where nothing diverged. Every one
 * of them is the ordinary state of a road halfway through being built, so refusing them would
 * force a contributor to work in one exact order.
 *
 * The violations no addition can repair — a cycle, a duplicate connection — never reach here,
 * because the revision service refuses to commit them at all.
 *
 * It renders as a caution rather than as a chip because it changes what the reader should do,
 * which is §7.3's whole test for prominence. When there is nothing unfinished it renders
 * nothing at all, which is the third weight: the ordinary case gets no marker.
 */
export function IncompleteRoadNotice({
  structure,
  dictionary: t,
}: {
  structure: RouteStructure
  dictionary: Dictionary
}) {
  if (structure.incomplete.length === 0) return null

  const label = (id: string) => structure.steps.find((step) => step.id === id)?.label

  return (
    <div className="mt-3">
      <Caution>
        <span className="font-medium">{t.structure.unfinishedTitle}</span>
        <ul className="mt-1 space-y-0.5">
          {structure.incomplete.map((violation) => {
            const named = violation.subjects
              .map(label)
              .filter((name): name is string => name !== undefined)
            return (
              <li key={`${violation.code}-${violation.subjects.join('-')}`}>
                {t.structure.unfinished[violation.code as keyof typeof t.structure.unfinished] ??
                  violation.code}
                {named.length === 0 ? '' : `: ${named.join(', ')}`}
              </li>
            )
          })}
        </ul>
      </Caution>
    </div>
  )
}

/**
 * FR-21, FR-45, invariant 4 — take one piece of information off the route, or put it back.
 *
 * `archiveField` and `restoreField` have existed since Phase 3 and neither was reachable, so
 * the only way to deal with a field that had become wrong was to revise it into something
 * else. That is the correct action when there is a better value and the wrong one when the
 * fact simply no longer applies — a document that is no longer required is not a document
 * whose requirement changed, and rewriting it that way puts a fiction in the history.
 *
 * Deliberately worded as taking something *off the route* rather than deleting it, because
 * that is what happens: the field, every revision of it and its whole history stay readable
 * (FR-21, §17.5).
 */
export function FieldArchiveControl({
  field,
  stepId,
  routeSlug,
  locale,
  dictionary: t,
}: {
  field: { id: string; archived?: boolean }
  stepId: string
  routeSlug: string
  locale: string
  dictionary: Dictionary
}) {
  const archived = field.archived === true
  return (
    <details className="mt-2">
      <summary className={SUMMARY}>
        {archived ? t.structure.restoreField : t.structure.archiveField}
      </summary>
      <form action={setFieldArchivedAction} className={FORM}>
        <FormContext locale={locale} slug={routeSlug} />
        <input type="hidden" name="stepId" value={stepId} />
        <input type="hidden" name="fieldId" value={field.id} />
        <input
          type="hidden"
          name="intent"
          value={archived ? RESTORE_INTENT : ARCHIVE_INTENT}
        />
        <p className="text-xs leading-5 text-ink-700">{t.structure.archiveFieldNote}</p>
        <ReasonField dictionary={t} />
        <button type="submit" className={QUIET}>
          {archived ? t.structure.restoreField : t.structure.archiveField}
        </button>
      </form>
    </details>
  )
}
