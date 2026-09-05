'use server'

import { redirect } from 'next/navigation'

import { ROUTE_MECHANISMS, STUDY_LEVELS } from '@/domain/enums'
import {
  boundedOptionalText,
  ContributionInputError,
  countryCode,
  LIMITS,
  optionalEnum,
  requiredEnum,
  requiredText,
} from '@/lib/contribution-input'
import { text } from '@/lib/form-fields'
import { currentViewer } from '@/server/auth'
import { createRoute } from '@/server/revisions/service'

/**
 * Create a route — Phase 8, FR-13, VR-09.
 *
 * **The route is published the moment it is created, as `experimental`.** There is no draft
 * state, no submission for review and no publish button: a new route is real, visible and
 * honestly labelled as immature (FR-74, §18.1). The lifecycle default lives in the schema, so
 * this action cannot accidentally create anything more established than that.
 *
 * **Creating a route confers no ownership** (FR-44, BR-01, D-18). `createdById` is attribution
 * and nothing else — there is no owner column, and the very next signed-in visitor can revise
 * every field in it.
 *
 * VR-09 shows a five-stage wizard: Basics → Build Road → Add Fields → Review → Publish. The
 * stages are real; the wizard is not how they are best served. Only the basics need a form of
 * their own, because until the route exists there is nothing to add steps *to*. Everything
 * after that happens in place on the route itself, where the contributor can see the road they
 * are building and the trust surface reacting to it — which is both the navigation principle
 * (progressive disclosure over a page per action, CLAUDE.md §7.1) and the more honest
 * arrangement: "Review" is just looking at the route, and "Publish" already happened.
 */

function slugFrom(title: string, origin: string, destination: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean)
    .slice(0, 6)
    .join('-')

  // A short random suffix rather than a collision retry loop: slugs are addresses, not names,
  // and two people creating "germany-masters" on the same day is ordinary rather than an error.
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${origin.toLowerCase()}-${destination.toLowerCase()}-${words || 'route'}-${suffix}`
}

/**
 * Everything below is validated here rather than by the form — audit F9.
 *
 * This action is a POST endpoint reachable without the page ever rendering, so `required`,
 * `maxlength` and a `<select>` of valid options are advisory. What is published is decided
 * here, and a route is public knowledge somebody else will rely on (FR-13, FR-75).
 *
 * Three specific failures this closes, all of which produced a *published* route:
 *
 *   * `.slice(0, 2)` on the country turned "Bangladesh" into "BA" — Bosnia and Herzegovina —
 *     and `Char(2)` accepted it.
 *   * An unrecognised study level became `masters`, so a PhD route published as a Master's.
 *   * A whitespace-only title became an empty one, giving a route no name at all — and the
 *     slug is derived from the title, so it became `bd-de-route-<random>`.
 *
 * Refusal rather than substitution, throughout: publishing something under a contributor's
 * name that they did not choose is not the safe side of a guess.
 */
export async function createRouteAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const viewer = await currentViewer()
  if (!viewer) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/routes/new`)}`)

  const title = requiredText(formData, 'title', { max: LIMITS.title, label: 'A route title' })
  const origin = countryCode(formData, 'originCountry', 'The origin country')
  const destination = countryCode(formData, 'destinationCountry', 'The destination country')

  // A route from a country to itself is not a route to study abroad, and the whole search
  // model is origin → destination (FR-01, §9).
  if (origin === destination) {
    throw new ContributionInputError(
      'destinationCountry',
      'A route needs a different origin and destination. This one has the same country for both.',
    )
  }

  const slug = slugFrom(title, origin, destination)

  await createRoute({
    actor: { id: viewer.id },
    slug,
    originCountry: origin,
    destinationCountry: destination,
    studyLevel: requiredEnum(formData, 'studyLevel', STUDY_LEVELS, 'Study level'),
    intake: boundedOptionalText(formData, 'routeIntake', {
      max: LIMITS.intake,
      label: 'The intake',
    }),
    mechanism: optionalEnum(formData, 'mechanism', ROUTE_MECHANISMS, 'Route type'),
    title,
    summary: boundedOptionalText(formData, 'summary', {
      max: LIMITS.summary,
      label: 'The summary',
    }),
    reason: boundedOptionalText(formData, 'reason', { max: LIMITS.note, label: 'The reason' }),
  })

  // Straight to the route, which is where the rest of VR-09's stages happen: add the steps,
  // add the fields, and look at what you built. Nothing is waiting for approval.
  redirect(`/${locale}/routes/${slug}`)
}
