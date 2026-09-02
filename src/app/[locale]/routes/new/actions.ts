'use server'

import { redirect } from 'next/navigation'

import type { RouteMechanism, StudyLevel } from '@/domain/enums'
import { ROUTE_MECHANISMS, STUDY_LEVELS, StudyLevel as Level } from '@/domain/enums'
import { optionalText, text } from '@/lib/form-fields'
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

function oneOf<T extends string>(values: readonly T[], raw: string, fallback: T): T {
  return (values as readonly string[]).includes(raw) ? (raw as T) : fallback
}

export async function createRouteAction(formData: FormData): Promise<void> {
  const locale = text(formData, 'locale')
  const viewer = await currentViewer()
  if (!viewer) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/routes/new`)}`)

  const title = text(formData, 'title').trim()
  const origin = text(formData, 'originCountry').trim().toUpperCase().slice(0, 2)
  const destination = text(formData, 'destinationCountry').trim().toUpperCase().slice(0, 2)
  const slug = slugFrom(title, origin, destination)

  const mechanism = oneOf<RouteMechanism | ''>(
    [...ROUTE_MECHANISMS, ''],
    text(formData, 'mechanism'),
    '',
  )

  await createRoute({
    actor: { id: viewer.id },
    slug,
    originCountry: origin,
    destinationCountry: destination,
    studyLevel: oneOf<StudyLevel>(STUDY_LEVELS, text(formData, 'studyLevel'), Level.masters),
    intake: optionalText(formData, 'routeIntake'),
    mechanism: mechanism === '' ? null : mechanism,
    title,
    summary: optionalText(formData, 'summary'),
    reason: optionalText(formData, 'reason'),
  })

  // Straight to the route, which is where the rest of VR-09's stages happen: add the steps,
  // add the fields, and look at what you built. Nothing is waiting for approval.
  redirect(`/${locale}/routes/${slug}`)
}
