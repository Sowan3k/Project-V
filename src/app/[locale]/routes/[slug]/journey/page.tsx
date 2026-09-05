import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ContentColumn } from '@/components/layout'
import { LinkButton, Panel, buttonClass } from '@/components/ui'
import { RouteContext } from '@/components/route-context'
import { rendererStrings } from '@/components/route-shared'
import { JourneyStepStatus, JOURNEY_STEP_STATUSES } from '@/domain/enums'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { ResponsiveRoad } from '@/renderer'
import { currentViewer } from '@/server/auth'
import { shadowSince } from '@/server/changes/read'
import { followerChangeReport } from '@/server/journeys/changes'
import { getJourneyForRoute, type JourneyView } from '@/server/journeys/read'
import { getRouteBySlug, type RouteDetail } from '@/server/routes/read'

import {
  addTaskAction,
  confirmStepAction,
  deleteJourneyAction,
  followRouteAction,
  removeTaskAction,
  saveStepProgressAction,
  setCompletionAction,
  toggleTaskAction,
  unfollowRouteAction,
} from './actions'

/**
 * My Journey — Phase 7, VR-06. FR-23, FR-24, FR-25, FR-26, FR-27, FR-41.
 *
 * > Live public route + private user progress = My Journey.
 *
 * A **tab on the route**, not a separate place. The road stays above the progress, the route's
 * title and standing stay in the header, and the URL is still a link somebody could send
 * themselves. That is the whole point of following a route rather than copying one: the public
 * knowledge keeps improving underneath the private record (FR-27, D-11, invariant 18).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Three things this page must never do, each of which it is built not to be able to do:
 *
 *   **Show one person's progress to another.** Everything private on this page comes from
 *   `getJourneyForRoute(viewer.id, ...)`, and there is no function available to it that could
 *   fetch a journey without a user id (FR-26, BR-16, D-10, invariant 5).
 *
 *   **Ask for evidence.** There is no file input here and no upload action to point one at.
 *   Marking a step complete is a statement, not a claim requiring proof (FR-25, BR-06, D-09,
 *   invariant 6).
 *
 *   **Verify anything.** Completion is self-reported and the copy says so. We do not know
 *   whether this person flew, and we must not imply that we do (FR-41, BR-20, invariant 17).
 *
 * Every control is a plain form posting to a server action, so the whole thing works with
 * JavaScript disabled — the same guarantee Phase 5 gave the read path, kept.
 */
export const dynamic = 'force-dynamic'

/**
 * The route's own name in the browser tab - Phase 12.
 *
 * A reader comparing three routes has three tabs; identical titles make that impossible to
 * work with, and a bookmark or a shared link carries the same title into somebody else's
 * history. `notPublished` rather than a blank for a route that does not exist, so a broken
 * link is legible in a tab too.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  const route = await getRouteBySlug(slug)
  if (route === null) return { title: t.notPublished.title }
  return {
    title: t.meta.routeJourney(route.title), description: route.summary ?? t.meta.description,
    // **noindex, and not only a robots.txt disallow.** A disallow asks a crawler not to
    // *fetch* the page; it does not stop the URL being indexed from a link elsewhere, and an
    // indexed journey URL would advertise that a private page exists at a guessable address.
    // This is the directive that actually keeps it out of a search index (invariant 5).
    robots: { index: false, follow: false },
  }
}

export default async function JourneyPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const route = await getRouteBySlug(slug)
  if (!route) notFound()

  const viewer = await currentViewer()
  // Anonymous visitors reach this URL legitimately — the tab is shown to everyone so the
  // navigation does not rearrange itself around who is signed in. They see an invitation,
  // never somebody else's data.
  const journey = viewer ? await getJourneyForRoute(viewer.id, route.id, { includeArchived: true }) : null

  const following = journey !== null && journey.archivedAt === null

  return (
    <RouteContext
      route={route}
      dictionary={t}
      locale={locale}
      tab="journey"
      // Only once there is a journey to control. An anonymous visitor or somebody not
      // following this route sees the route's standing and nothing that implies they have
      // progress to manage.
      rail={
        following && journey !== null ? (
          <JourneyRail journey={journey} slug={slug} dictionary={t} />
        ) : undefined
      }
    >
      {viewer === null ? (
        <SignInInvitation dictionary={t} locale={locale} slug={slug} />
      ) : journey === null || journey.archivedAt !== null ? (
        <FollowInvitation
          dictionary={t}
          route={route}
          resumable={journey !== null}
          slug={slug}
        />
      ) : (
        <JourneyBoard
          dictionary={t}
          route={route}
          journey={journey}
          slug={slug}
          locale={locale}
          userId={viewer.id}
        />
      )}
    </RouteContext>
  )
}

function SignInInvitation({
  dictionary: t,
  locale,
  slug,
}: {
  dictionary: Dictionary
  locale: string
  slug: string
}) {
  return (
    <Panel as="section">
      <ContentColumn width="reading">
        <h2 className="text-section font-semibold text-ink-900">{t.journey.title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-700">{t.journey.signInToFollow}</p>
        {/* The privacy promise appears before the sign-in button, not after it. Somebody
            deciding whether to create an account needs it while deciding (FR-26, §12.3). */}
        <p className="mt-3 text-sm leading-6 text-ink-500">{t.journey.privateExplainer}</p>
        <div className="mt-6">
          <LinkButton
            href={`/${locale}/signin?next=${encodeURIComponent(`/${locale}/routes/${slug}/journey`)}`}
          >
            {t.auth.signIn}
          </LinkButton>
        </div>
      </ContentColumn>
    </Panel>
  )
}

function FollowInvitation({
  dictionary: t,
  route,
  resumable,
  slug,
}: {
  dictionary: Dictionary
  route: RouteDetail
  resumable: boolean
  slug: string
}) {
  return (
    <Panel as="section">
      <ContentColumn width="reading">
        <h2 className="text-section font-semibold text-ink-900">{t.journey.title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-700">{t.journey.privateExplainer}</p>
        {resumable ? (
          <p className="mt-2 text-sm leading-6 text-ink-500">{t.journey.resumed}</p>
        ) : null}
        <form action={followRouteAction} className="mt-6">
          <input type="hidden" name="routeId" value={route.id} />
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" className={buttonClass()}>
            {resumable ? t.journey.resume : t.journey.follow}
          </button>
        </form>
      </ContentColumn>
    </Panel>
  )
}

function JourneyBoard({
  dictionary: t,
  route,
  journey,
  slug,
  locale,
  userId,
}: {
  dictionary: Dictionary
  route: RouteDetail
  journey: JourneyView
  slug: string
  locale: string
  userId: string
}) {
  const byStep = new Map(journey.progress.map((row) => [row.stepId, row]))
  const done = journey.progress.filter((row) => row.status === JourneyStepStatus.completed).length

  return (
    <>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-900">{t.journey.progressTitle}</h2>
          {/* Visually connected to the public route, unmistakably personal (§8.5). */}
          <span className="rounded-full border border-brand-500/40 bg-brand-500/5 px-3 py-1 text-xs font-medium text-brand-900">
            {t.journey.privateBadge}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-700">
          {t.journey.overall(done, route.stepCount)}
        </p>

        {/* The same road, from the same renderer. A journey is a view of the route, and it
            must look like the route the follower opened (invariant 25). */}
        <div className="mt-4 overflow-x-auto rounded-panel border border-hairline bg-surface p-4">
          <ResponsiveRoad graph={route.graph} strings={rendererStrings(t)} />
        </div>
        <p className="mt-2 text-xs text-ink-500">{t.journey.routeChangedNote}</p>
      </section>

      <ChangesSinceStarted
        userId={userId}
        routeId={route.id}
        slug={slug}
        locale={locale}
        dictionary={t}
      />

      {/*
       * The steps take the whole body column — Phase 12E.
       *
       * This used to nest a `PageGrid` here, splitting eight-of-twelve into another eight and
       * four: the step rows got about 530px and the panels beside them about 265. Each step
       * row carries a status select, two dates and a note field, so 530px made every one of
       * them wrap into a column of stubs.
       *
       * The panels moved up into the page's own rail instead, where VR-05 and VR-06 both put
       * them — one rail carrying the route's standing and the follower's own controls
       * together, rather than two columns competing inside one.
       */}
      <ul className="mt-8 space-y-3">
        {route.steps.map((step, index) => (
          <StepProgressRow
            key={step.id}
            index={index}
            step={step}
            progress={byStep.get(step.id) ?? null}
            journeyId={journey.id}
            slug={slug}
            locale={locale}
            dictionary={t}
          />
        ))}
      </ul>
    </>
  )
}

/** The follower's own controls, for the page rail rather than a column of their own. */
function JourneyRail({
  journey,
  slug,
  dictionary: t,
}: {
  journey: JourneyView
  slug: string
  dictionary: Dictionary
}) {
  return (
    <>
      <PersonalTasks journey={journey} slug={slug} dictionary={t} />
      <CompletionPanel journey={journey} slug={slug} dictionary={t} />
      <LeavePanel journey={journey} slug={slug} dictionary={t} />
    </>
  )
}

function StepProgressRow({
  index,
  step,
  progress,
  journeyId,
  slug,
  locale,
  dictionary: t,
}: {
  index: number
  step: RouteDetail['steps'][number]
  progress: JourneyView['progress'][number] | null
  journeyId: string
  slug: string
  locale: string
  dictionary: Dictionary
}) {
  const isoDay = (date: Date | null): string => (date === null ? '' : date.toISOString().slice(0, 10))

  return (
    <li className="rounded-panel border border-hairline bg-surface p-4">
      <div className="flex items-baseline gap-3">
        <span className="text-xs text-ink-500">{index + 1}</span>
        <span className="font-medium text-ink-900">{step.label}</span>
        <span className="text-xs text-ink-500">
          {t.stepCategory[step.category as keyof typeof t.stepCategory]}
        </span>
      </div>

      {/* One form per step, posting to a server action. No JavaScript required anywhere. */}
      <form action={saveStepProgressAction} className="mt-3 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="journeyId" value={journeyId} />
        <input type="hidden" name="stepId" value={step.id} />
        <input type="hidden" name="slug" value={slug} />

        <label className="text-xs text-ink-700">
          {t.journey.status}
          <select
            name="status"
            defaultValue={progress?.status ?? JourneyStepStatus.not_started}
            className="mt-1 block w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900"
          >
            {JOURNEY_STEP_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t.journeyStepStatus[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-ink-700">
          {t.journey.targetDate}
          <input
            type="date"
            name="targetDate"
            defaultValue={isoDay(progress?.targetDate ?? null)}
            className="mt-1 block w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900"
          />
        </label>

        <label className="text-xs text-ink-700">
          {t.journey.actualDate}
          <input
            type="date"
            name="actualDate"
            defaultValue={isoDay(progress?.actualDate ?? null)}
            className="mt-1 block w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900"
          />
        </label>

        <label className="text-xs text-ink-700 sm:col-span-3">
          {t.journey.privateNote}
          <textarea
            name="privateNote"
            rows={2}
            defaultValue={progress?.privateNote ?? ''}
            placeholder={t.journey.privateNotePlaceholder}
            className="mt-1 block w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900"
          />
        </label>

        <div className="sm:col-span-3">
          <button
            type="submit"
            className="rounded-control border border-brand-700 px-3 py-1.5 text-xs font-medium text-brand-700"
          >
            {t.journey.save}
          </button>
        </div>
      </form>

      {/* FR-42, §16.5: the prompt appears only once the step is done, because that is the
          moment the follower's knowledge is worth the most. It offers CONFIRM and a route to
          UPDATE/CHALLENGE — no new contribution type is invented for it. */}
      {progress?.status === JourneyStepStatus.completed ? (
        <div className="mt-3 rounded-control border border-brand-500/40 bg-brand-500/5 p-3">
          <p className="text-sm font-medium text-ink-900">{t.contribute.stillAccurate}</p>
          <p className="mt-0.5 text-xs leading-5 text-ink-700">{t.contribute.stillAccurateLede}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <form action={confirmStepAction}>
              <input type="hidden" name="stepId" value={step.id} />
              <input type="hidden" name="slug" value={slug} />
              <button
                type="submit"
                className={buttonClass('primary', { size: 'compact' })}
              >
                {t.contribute.yesAccurate}
              </button>
            </form>

            <Link
              href={`/${locale}/routes/${slug}?step=${step.id}`}
              className="text-xs text-brand-700 underline"
            >
              {t.contribute.somethingChanged}
            </Link>
          </div>
          <p className="mt-1.5 text-xs text-ink-500">{t.contribute.somethingChangedHint}</p>
        </div>
      ) : null}
    </li>
  )
}

/** §12.1: "Optional personal tasks that do not belong in the public route." */
function PersonalTasks({
  journey,
  slug,
  dictionary: t,
}: {
  journey: JourneyView
  slug: string
  dictionary: Dictionary
}) {
  return (
    <section className="rounded-panel border border-hairline bg-surface p-4">
      <h3 className="text-sm font-semibold text-ink-900">{t.journey.tasksTitle}</h3>
      <p className="mt-1 text-xs leading-5 text-ink-500">{t.journey.tasksLede}</p>

      {journey.tasks.length === 0 ? (
        <p className="mt-3 text-xs text-ink-500">{t.journey.noTasks}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {journey.tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2 text-sm">
              <form action={toggleTaskAction}>
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="done" value={task.doneAt === null ? 'yes' : 'no'} />
                <button type="submit" className="text-xs text-brand-700 underline">
                  {task.doneAt === null ? '○' : '●'}
                </button>
              </form>
              <span className={task.doneAt === null ? 'text-ink-900' : 'text-ink-500 line-through'}>
                {task.label}
              </span>
              <form action={removeTaskAction} className="ml-auto">
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="slug" value={slug} />
                <button type="submit" className="text-xs text-ink-500 underline">
                  {t.journey.removeTask}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addTaskAction} className="mt-3 flex gap-2">
        <input type="hidden" name="journeyId" value={journey.id} />
        <input type="hidden" name="slug" value={slug} />
        <input
          type="text"
          name="label"
          placeholder={t.journey.taskPlaceholder}
          className="min-w-0 flex-1 rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-control border border-brand-700 px-3 text-xs text-brand-700">
          {t.journey.addTask}
        </button>
      </form>
    </section>
  )
}

function CompletionPanel({
  journey,
  slug,
  dictionary: t,
}: {
  journey: JourneyView
  slug: string
  dictionary: Dictionary
}) {
  const completed = journey.selfReportedCompletedAt !== null

  return (
    <section className="mt-4 rounded-panel border border-hairline bg-surface p-4">
      <form action={setCompletionAction}>
        <input type="hidden" name="journeyId" value={journey.id} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="markCompleted" value={completed ? 'no' : 'yes'} />
        <button type="submit" className="text-sm font-medium text-brand-700 underline">
          {completed ? t.journey.unmarkCompleted : t.journey.markCompleted}
        </button>
      </form>
      {/* Self-reported, said out loud rather than implied (FR-41, invariant 17). */}
      {completed ? <p className="mt-2 text-xs text-ink-500">{t.journey.completedNote}</p> : null}
    </section>
  )
}

function LeavePanel({
  journey,
  slug,
  dictionary: t,
}: {
  journey: JourneyView
  slug: string
  dictionary: Dictionary
}) {
  return (
    <section className="mt-4 rounded-panel border border-hairline bg-surface p-4">
      {/* Unfollowing keeps the data; deleting is a separate action that says what it does.
          A student should never lose months of notes to a mis-click, and should always be
          able to remove them on purpose. */}
      <form action={unfollowRouteAction}>
        <input type="hidden" name="journeyId" value={journey.id} />
        <input type="hidden" name="slug" value={slug} />
        <button type="submit" className="text-sm text-ink-700 underline">
          {t.journey.unfollow}
        </button>
      </form>
      <p className="mt-1 text-xs text-ink-500">{t.journey.unfollowNote}</p>

      <form action={deleteJourneyAction} className="mt-4 border-t border-hairline pt-3">
        <input type="hidden" name="journeyId" value={journey.id} />
        <input type="hidden" name="slug" value={slug} />
        <button type="submit" className="text-sm text-caution-900 underline">
          {t.journey.deletePermanently}
        </button>
      </form>
      <p className="mt-1 text-xs text-ink-500">{t.journey.deleteExplainer}</p>
    </section>
  )
}

/**
 * What has changed since this follower started — Phase 10. FR-28, FR-29, FR-61, FR-76, §13.1.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Relevance, not volume.** §13.1: the platform "should emphasize changes affecting
 * unfinished or upcoming steps rather than forcing the user to reread the entire route." So
 * this panel shows only what carries a caution — a change or a disruption touching a step
 * they have not finished — and sends everything else to the Changes tab.
 *
 * A follower with twelve changes, eleven of them on steps they completed months ago, sees
 * one. That is the whole point of scoping relevance to progress: a notice that fires on every
 * edit is a notice nobody reads, and the one that mattered goes with it.
 *
 * It is also the only place this phase touches the journey page, and it touches it read-only.
 * Nothing here writes progress, and there is no code path from a route change to a journey row
 * anywhere in the application (FR-30, BR-17, D-12, invariant 8).
 */
async function ChangesSinceStarted({
  userId,
  routeId,
  slug,
  locale,
  dictionary: t,
}: {
  userId: string
  routeId: string
  slug: string
  locale: string
  dictionary: Dictionary
}) {
  const now = new Date()
  const report = await followerChangeReport(userId, routeId, { now })
  if (report === null) return null

  // The comparison is public data drawn against a private date — see the note in
  // src/server/journeys/changes.ts on why those two live on opposite sides of the boundary.
  const shadow = await shadowSince(routeId, report.startedAt)

  const pressing = report.changes.filter((entry) => entry.relevance.weight === 'caution')
  const disrupting = report.disruptions.filter((entry) => entry.relevance.weight === 'caution')
  const nothingToSee =
    pressing.length === 0 && disrupting.length === 0 && !shadow.comparison.structureChanged

  return (
    <section className="mt-8 rounded-panel border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-900">{t.changes.yourPositionTitle}</h2>
        <Link
          href={`/${locale}/routes/${slug}/changes`}
          className="text-xs text-brand-700 underline"
        >
          {t.changes.title}
        </Link>
      </div>

      <p className="mt-1 text-sm text-ink-700">{t.changes.needsAttention(report.needsAttention)}</p>

      {nothingToSee ? null : (
        <ul className="mt-3 space-y-2">
          {disrupting.map((entry) => (
            <li
              key={entry.disruption.id}
              className="rounded-control border border-caution-500/40 bg-caution-50 px-3 py-2"
            >
              <p className="text-xs font-medium text-caution-900">{entry.disruption.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-700">
                {t.changes.disruptionBearing[entry.relevance.bearing]}
              </p>
            </li>
          ))}
          {pressing.map((entry) => (
            <li
              key={entry.change.id}
              className="rounded-control border border-caution-500/40 bg-caution-50 px-3 py-2"
            >
              <p className="text-xs font-medium text-caution-900">{entry.change.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-700">
                {t.changes.bearing[entry.relevance.bearing]}
                {entry.change.stepLabel === null ? '' : ` · ${entry.change.stepLabel}`}
              </p>
            </li>
          ))}
          {shadow.comparison.structureChanged ? (
            <li className="text-xs leading-5 text-ink-700">
              {t.changes.note.shape_changed}{' '}
              <Link
                href={`/${locale}/routes/${slug}/changes`}
                className="text-brand-700 underline"
              >
                {t.changes.title}
              </Link>
            </li>
          ) : null}
        </ul>
      )}

      {/* The reassurance a follower actually came for, stated whether or not anything moved. */}
      <p className="mt-3 text-xs leading-5 text-ink-500">{t.changes.progressUntouched}</p>
    </section>
  )
}
