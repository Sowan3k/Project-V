import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

import {
  AnnouncedChangeCard,
  DisruptionCard,
  DisruptionList,
  ExactChange,
  FollowerChangeList,
  ResolveDisruptionControl,
} from '@/components/changes'
import { ContentColumn, GridRegion, PageGrid } from '@/components/layout'
import { buttonClass } from '@/components/ui'
import { RouteContext } from '@/components/route-context'
import { ShadowCompare } from '@/components/shadow-compare'
import { CHANGE_SEVERITIES, ROUTE_CHANGE_KINDS } from '@/domain/enums'
import { isLocale } from '@/i18n/config'
import type { Dictionary } from '@/i18n/dictionaries/en'
import { getDictionary } from '@/i18n/get-dictionary'
import { currentViewer } from '@/server/auth'
import {
  changesForRoute,
  disruptionsForRoute,
  lastChangePoint,
  recentRevisionsForRoute,
  shadowForChange,
  shadowSince,
} from '@/server/changes/read'
import { followerChangeReport } from '@/server/journeys/changes'
import { getRouteBySlug, type RouteDetail } from '@/server/routes/read'

import {
  announceChangeAction,
  clearChangeStanceAction,
  recordDisruptionAction,
  resolveDisruptionAction,
  setChangeStanceAction,
} from './actions'

/**
 * The Changes tab — Phase 10. FR-22, FR-28, FR-29, FR-31, FR-32, FR-59, FR-60, FR-61, FR-63,
 * FR-76, FR-77. §13, §14, §41. VR-07, VR-10.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **A tab, not a destination** (CLAUDE.md §7.1).
 *
 * Overview, My journey, Changes and History are four views of one object. The route's title,
 * origin, destination, standing and fly window stay on screen across all of them, and each is
 * a real URL somebody can send. Changes is emphatically *not* a page you leave the route to
 * reach — "what changed" is unreadable without the thing it changed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The same page answers two different questions, and says which one it is answering.**
 *
 *   A follower gets the comparison against **the day they started following** (§14.2), their
 *   own position on every change, and the §13.3 control where scope is uncertain.
 *
 *   Everyone else gets the comparison against **the route's last change point** — the most
 *   recent thing that moved. Not a personalised view with the personal parts blanked out: a
 *   different, honest question, because there is no journey to measure against and pretending
 *   otherwise would be inventing a follower.
 *
 * Both are readable signed out (FR-01, D-03). A student deciding whether to trust a route
 * needs to see how much it moves *before* they commit to it.
 */
export const dynamic = 'force-dynamic'

const INPUT =
  'mt-1 block w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900'
const LABEL = 'block text-xs text-ink-700'

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
  return { title: t.meta.routeChanges(route.title), description: route.summary ?? t.meta.description }
}

export default async function RouteChangesPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const route = await getRouteBySlug(slug)
  if (route === null) notFound()

  const viewer = await currentViewer()
  const now = new Date()

  // The follower-scoped read takes a user id and filters on it; the anonymous one takes no
  // identity at all. Two functions in two directories, on opposite sides of the privacy line.
  const report = viewer === null ? null : await followerChangeReport(viewer.id, route.id, { now })

  // Resolving a running disruption is a contribution like any other, so it is offered to any
  // signed-in reader — following the route is not a prerequisite for knowing the centre
  // reopened (invariant 3).
  const resolve =
    viewer === null ? undefined : { locale, slug, action: resolveDisruptionAction }

  return (
    <RouteContext route={route} dictionary={t} locale={locale} tab="changes">
      <ContentColumn width="canvas">
        <h2 className="text-xl font-semibold tracking-tight text-ink-900">{t.changes.title}</h2>
        <ContentColumn width="reading">
          <p className="mt-2 text-sm leading-6 text-ink-700">{t.changes.lede}</p>
        </ContentColumn>

        {report === null ? (
          <AnonymousComparison routeId={route.id} dictionary={t} />
        ) : (
          <FollowerPanel report={report} routeId={route.id} dictionary={t} />
        )}

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">
            {t.changes.announcedTitle}
          </h2>
          <ContentColumn width="reading">
            <p className="mt-1 text-sm leading-6 text-ink-700">{t.changes.announcedLede}</p>
            {/* BR-26 stated once, where the dates are about to be read. */}
            <p className="mt-1 text-xs leading-5 text-ink-500">{t.changes.effectiveExplainer}</p>
            <p className="mt-1 text-xs leading-5 text-ink-500">{t.changes.severityExplainer}</p>
          </ContentColumn>

          {report === null ? (
            <AnonymousChangeList routeId={route.id} dictionary={t} />
          ) : (
            <FollowerChangeList
              entries={report.changes}
              locale={locale}
              slug={slug}
              routeId={route.id}
              stanceAction={setChangeStanceAction}
              clearStanceAction={clearChangeStanceAction}
              dictionary={t}
              exactChange={(changeId) => <ExactChangeFor changeId={changeId} dictionary={t} />}
            />
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">
            {t.changes.disruptionsTitle}
          </h2>
          <ContentColumn width="reading">
            <p className="mt-1 text-sm leading-6 text-ink-700">{t.changes.disruptionsLede}</p>
          </ContentColumn>

          {report === null ? (
            <PublicDisruptions
              routeId={route.id}
              dictionary={t}
              now={now}
              resolve={resolve}
            />
          ) : (
            <DisruptionList
              entries={report.disruptions}
              dictionary={t}
              now={now}
              resolve={resolve}
            />
          )}
        </section>

        <RecordSection
          route={route}
          locale={locale}
          slug={slug}
          signedIn={viewer !== null}
          dictionary={t}
        />

        {/* §35, CLAUDE.md §8.6: VR-10 offers "Subscribe to Alerts". Proactive external
            notification is deferred, and saying so is better than a control that does
            nothing. In-product visibility is the mechanism, and this page is it. */}
        <p className="mt-8 border-t border-hairline pt-4 text-xs leading-5 text-ink-500">
          {t.changes.noAlerts}
        </p>
      </ContentColumn>
    </RouteContext>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   The two readings
   ══════════════════════════════════════════════════════════════════════════════════════════ */

async function AnonymousComparison({
  routeId,
  dictionary: t,
}: {
  routeId: string
  dictionary: Dictionary
}) {
  const since = await lastChangePoint(routeId)
  if (since === null) {
    return (
      <ContentColumn width="reading" className="mt-6">
        <p className="text-sm text-ink-700">{t.changes.nothingYet}</p>
        {/* FR-74: a young route says so plainly rather than looking settled. */}
        <p className="mt-1 text-xs leading-5 text-ink-500">{t.changes.nothingYetHint}</p>
      </ContentColumn>
    )
  }

  const shadow = await shadowSince(routeId, since)
  return (
    <div className="mt-6">
      <ShadowCompare
        before={shadow.before}
        after={shadow.after}
        comparison={shadow.comparison}
        fieldsChanged={shadow.fieldsChanged}
        beforeLabel={t.changes.sinceLastChange}
        beforeDate={since.toISOString().slice(0, 10)}
        dictionary={t}
      />
    </div>
  )
}

/**
 * What the route's changes mean for this follower — §14.2, §41.3, FR-30.
 *
 * The panel leads with the reassurance rather than burying it, because it is the thing a
 * student arriving here is actually worried about: nothing on this page has touched their
 * progress, and it says so in those words (BR-17, invariant 8).
 *
 * The comparison itself comes from the *public* read layer, given this follower's start date.
 * Only the date is private; the two graphs it produces are the same public route anyone can
 * see. That split is why the journey module needs no access to the revision engine, and it
 * means a follower and an anonymous reader run identical comparison code.
 */
async function FollowerPanel({
  report,
  routeId,
  dictionary: t,
}: {
  report: NonNullable<Awaited<ReturnType<typeof followerChangeReport>>>
  routeId: string
  dictionary: Dictionary
}) {
  const shadow = await shadowSince(routeId, report.startedAt)
  return (
    <div className="mt-6">
      <PageGrid>
        <GridRegion span={12}>
          <section className="rounded-panel border border-hairline bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink-900">{t.changes.yourPositionTitle}</h2>
            <p className="mt-1 text-sm text-ink-700">
              {t.changes.needsAttention(report.needsAttention)}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {t.changes.startedFollowing(report.startedAt.toISOString().slice(0, 10))}
            </p>
            {/* FR-30, BR-17, D-12, invariant 8 — said out loud, every time. */}
            <p className="mt-2 text-xs leading-5 text-ink-700">{t.changes.progressUntouched}</p>
          </section>
        </GridRegion>
      </PageGrid>

      <div className="mt-6">
        <ShadowCompare
          before={shadow.before}
          after={shadow.after}
          comparison={shadow.comparison}
          fieldsChanged={shadow.fieldsChanged}
          beforeLabel={t.changes.sinceYouStarted}
          beforeDate={report.startedAt.toISOString().slice(0, 10)}
          dictionary={t}
        />
      </div>
    </div>
  )
}

async function AnonymousChangeList({
  routeId,
  dictionary: t,
}: {
  routeId: string
  dictionary: Dictionary
}) {
  const changes = await changesForRoute(routeId)
  if (changes.length === 0) {
    return <p className="mt-3 text-sm text-ink-700">{t.changes.noAnnouncements}</p>
  }
  return (
    <ul className="mt-3 space-y-3">
      {changes.map((change) => (
        <AnnouncedChangeCard key={change.id} change={change} dictionary={t}>
          <ExactChangeFor changeId={change.id} dictionary={t} />
        </AnnouncedChangeCard>
      ))}
    </ul>
  )
}

/**
 * Resolves the announcement's own link and renders what it names.
 *
 * A separate component so the reconstruction is fetched per change rather than eagerly for
 * every change on the page, and so the same disclosure serves the follower list too.
 */
async function ExactChangeFor({
  changeId,
  dictionary: t,
}: {
  changeId: string
  dictionary: Dictionary
}) {
  return <ExactChange shadow={await shadowForChange(changeId)} dictionary={t} />
}

/**
 * Disruptions for a reader with no journey — no relevance, because there is no progress to
 * measure against and inventing a position would be a lie.
 */
async function PublicDisruptions({
  routeId,
  dictionary: t,
  now,
  resolve,
}: {
  routeId: string
  dictionary: Dictionary
  now: Date
  resolve?: {
    locale: string
    slug: string
    action: (formData: FormData) => void | Promise<void>
  }
}) {
  const disruptions = await disruptionsForRoute(routeId, { now })
  if (disruptions.length === 0) {
    return <p className="mt-3 text-sm text-ink-700">{t.changes.noDisruptions}</p>
  }
  return (
    <ul className="mt-3 space-y-3">
      {disruptions.map((disruption) => (
        <DisruptionCard key={disruption.id} disruption={disruption} dictionary={t} now={now}>
          {resolve === undefined || !disruption.active ? null : (
            <ResolveDisruptionControl
              disruptionId={disruption.id}
              locale={resolve.locale}
              slug={resolve.slug}
              action={resolve.action}
              dictionary={t}
            />
          )}
        </DisruptionCard>
      ))}
    </ul>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Contributing
   ══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Two forms, deliberately separate — invariant 19, BR-27.
 *
 * Announcing a permanent change and recording a temporary disruption are different acts with
 * different consequences, so they are different forms with different fields and their own
 * explanation of when to use each. One form with a "temporary?" checkbox would let a
 * fortnight of flooding be filed as a permanent change to Germany's visa rules by ticking the
 * wrong box, and nothing downstream could tell the difference afterwards.
 *
 * Every control is a plain form posting to a server action — no JavaScript required, the same
 * guarantee the read path and the contribution loop already give.
 */
async function RecordSection({
  route,
  locale,
  slug,
  signedIn,
  dictionary: t,
}: {
  route: RouteDetail
  locale: string
  slug: string
  signedIn: boolean
  dictionary: Dictionary
}) {
  if (!signedIn) {
    return (
      <section className="mt-10 border-t border-hairline pt-6">
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">
          {t.changes.recordTitle}
        </h2>
        <p className="mt-2 text-sm text-ink-700">
          <Link
            href={`/${locale}/signin?next=${encodeURIComponent(`/${locale}/routes/${slug}/changes`)}`}
            className="text-brand-700 underline"
          >
            {t.changes.signInToRecord}
          </Link>
        </p>
      </section>
    )
  }

  const recentRevisions = await recentRevisionsForRoute(route.id)

  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="routeId" value={route.id} />
    </>
  )

  const stepOptions = route.steps.map((step) => (
    <option key={step.id} value={step.id}>
      {step.label}
    </option>
  ))

  return (
    <section className="mt-10 border-t border-hairline pt-6">
      <h2 className="text-lg font-semibold tracking-tight text-ink-900">
        {t.changes.recordTitle}
      </h2>
      <ContentColumn width="reading">
        {/* Invariant 3, §43.1: no approval gate, and the page says so. */}
        <p className="mt-1 text-sm leading-6 text-ink-700">{t.changes.recordLede}</p>
      </ContentColumn>

      <PageGrid className="mt-4">
        <GridRegion span={6}>
          <form
            action={announceChangeAction}
            className="rounded-panel border border-hairline bg-surface p-4"
          >
            {hidden}
            <h3 className="text-sm font-semibold text-ink-900">{t.changes.announceHeading}</h3>
            <p className="mt-1 text-xs leading-5 text-ink-500">{t.changes.announceHint}</p>

            <label className={`${LABEL} mt-3`}>
              {t.changes.fieldTitle}
              <input type="text" name="changeTitle" required className={INPUT} />
            </label>
            <label className={`${LABEL} mt-2`}>
              {t.changes.fieldDetail}
              <textarea name="changeDetail" rows={2} className={INPUT} />
            </label>
            <label className={`${LABEL} mt-2`}>
              {t.changes.fieldKind}
              <select name="changeKind" className={INPUT}>
                {ROUTE_CHANGE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t.changes.kind[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${LABEL} mt-2`}>
              {t.changes.fieldSeverity}
              <select name="changeSeverity" className={INPUT}>
                {CHANGE_SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {t.changes.severity[severity]}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${LABEL} mt-2`}>
              {t.changes.fieldStep}
              <select name="changeStepId" className={INPUT}>
                <option value="">{t.changes.wholeRoute}</option>
                {stepOptions}
              </select>
            </label>
            <label className={`${LABEL} mt-2`}>
              {t.changes.fieldEffective}
              <input type="date" name="effectiveAt" className={INPUT} />
            </label>

            {/* The durable link. A revision id, chosen by the person who knows which edit
                they are announcing — never guessed from "whichever revision is newest",
                which would look identical and be wrong whenever it mattered. */}
            <label className={`${LABEL} mt-2`}>
              {t.changes.fieldDescribes}
              <select name="describesRevision" className={INPUT}>
                <option value="">{t.changes.describesNone}</option>
                {recentRevisions.map((option) => (
                  <option key={option.revisionId} value={`${option.kind}:${option.revisionId}`}>
                    {t.changes.describesKind[option.kind]}: {option.label} (
                    {option.createdAt.toISOString().slice(0, 10)})
                  </option>
                ))}
              </select>
              <span className="mt-0.5 block text-ink-500">{t.changes.fieldDescribesHint}</span>
            </label>

            <button
              type="submit"
              className={buttonClass('primary', { size: 'compact', className: 'mt-3' })}
            >
              {t.changes.submitAnnounce}
            </button>
          </form>
        </GridRegion>

        <GridRegion span={6}>
          <form
            action={recordDisruptionAction}
            className="rounded-panel border border-hairline bg-surface p-4"
          >
            {hidden}
            <h3 className="text-sm font-semibold text-ink-900">{t.changes.disruptHeading}</h3>
            <p className="mt-1 text-xs leading-5 text-ink-500">{t.changes.disruptHint}</p>

            <label className={`${LABEL} mt-3`}>
              {t.changes.fieldTitle}
              <input type="text" name="disruptionTitle" required className={INPUT} />
            </label>
            <label className={`${LABEL} mt-2`}>
              {t.changes.fieldDetail}
              <textarea name="disruptionDetail" rows={2} className={INPUT} />
            </label>
            <label className={`${LABEL} mt-2`}>
              {t.changes.fieldSeverity}
              <select name="disruptionSeverity" className={INPUT}>
                {CHANGE_SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {t.changes.severity[severity]}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className={LABEL}>
                {t.changes.fieldStarts}
                <input type="date" name="startsAt" required className={INPUT} />
              </label>
              <label className={LABEL}>
                {t.changes.fieldEnds}
                <input type="date" name="endsAt" className={INPUT} />
              </label>
            </div>

            <label className={`${LABEL} mt-2`}>
              {t.changes.fieldLocation}
              <input
                type="text"
                name="locationScope"
                placeholder={t.changes.locationPlaceholder}
                className={INPUT}
              />
            </label>
            <label className={`${LABEL} mt-2`}>
              {t.changes.fieldStep}
              <select name="disruptionStepId" className={INPUT}>
                <option value="">{t.changes.disruptionEverywhere}</option>
                {stepOptions}
              </select>
            </label>

            <button
              type="submit"
              className={buttonClass('primary', { size: 'compact', className: 'mt-3' })}
            >
              {t.changes.submitDisrupt}
            </button>
          </form>
        </GridRegion>
      </PageGrid>
    </section>
  )
}
