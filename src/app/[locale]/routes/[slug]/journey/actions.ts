'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { JourneyStepStatus } from '@/domain/enums'
import { JOURNEY_STEP_STATUSES } from '@/domain/enums'
import { currentViewer } from '@/server/auth'
import {
  addTask,
  deleteJourney,
  followRoute,
  removeTask,
  setSelfReportedCompletion,
  setStepProgress,
  setTaskDone,
  unfollowRoute,
} from '@/server/journeys/service'

/**
 * Server actions for a private journey — Phase 7.
 *
 * **Every one of these resolves the actor server-side, from the session, and never from the
 * form.** A `userId` in a submitted payload is a request, not a fact; taking one would make
 * every privacy guarantee below it decorative. The service layer then refuses to act without
 * a user id at all, so there is no path that reaches a journey anonymously (invariant 5).
 *
 * Authorisation is checked here and in the service, not in the component. A hidden button is
 * not a permission (CLAUDE.md §9).
 *
 * Progressive enhancement is deliberate: these are plain `<form action={...}>` submissions, so
 * a follower can record progress with JavaScript disabled, exactly as they can read with it
 * disabled (Phase 5). No fetch, no client state, no bundle to wait for on a slow phone.
 */

async function requireViewer(): Promise<{ id: string }> {
  const viewer = await currentViewer()
  // Signing in is the only gate on contribution and private tracking (FR-12). Reading is not
  // gated anywhere, which is why this appears in actions and never in a read path.
  if (!viewer) redirect('/en/signin')
  return viewer
}

function isStatus(value: unknown): value is JourneyStepStatus {
  return typeof value === 'string' && (JOURNEY_STEP_STATUSES as readonly string[]).includes(value)
}

/**
 * Reads a text field — and refuses a file.
 *
 * `FormData` entries are `string | File`, so `String(entry)` on a file would quietly produce
 * `"[object Object]"`. That is the lint error; this is the reason it matters.
 *
 * **A file arriving at a journey action is an upload, and the journey flow has no uploads.**
 * The platform does not ask a student to prove they sat an exam before ticking a box, and it
 * is not a store for passports, transcripts or bank statements (FR-25, BR-06, D-09, §24.1,
 * invariants 6 and 7). There is no input that offers one and no column that could hold one —
 * this makes the boundary refuse one as well, so a hand-crafted multipart POST is answered
 * with an error rather than a coerced string.
 */
class UploadRefusedError extends Error {
  constructor(field: string) {
    super(
      `refusing a file in "${field}": the journey flow accepts no uploads. Marking personal ` +
        `progress never requires evidence (FR-25, BR-06, D-09, CLAUDE.md invariant 6).`,
    )
    this.name = 'UploadRefusedError'
  }
}

function text(form: FormData, field: string): string {
  const value = form.get(field)
  if (value === null) return ''
  if (typeof value !== 'string') throw new UploadRefusedError(field)
  return value
}

/** Dates arrive as `yyyy-mm-dd` from a date input, or empty when cleared. */
function parseDate(form: FormData, field: string): Date | null | undefined {
  if (form.get(field) === null) return undefined
  const value = text(form, field).trim()
  if (value === '') return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export async function followRouteAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer()
  const routeId = text(formData, 'routeId')
  const slug = text(formData, 'slug')

  await followRoute({ userId: viewer.id, routeId })
  revalidatePath(`/en/routes/${slug}`)
  redirect(`/en/routes/${slug}/journey`)
}

export async function unfollowRouteAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer()
  await unfollowRoute({ userId: viewer.id, journeyId: text(formData, 'journeyId') })
  redirect(`/en/routes/${text(formData, 'slug')}`)
}

/**
 * The destructive one, and the only hard delete in the application.
 *
 * Invariant 1 protects shared community knowledge from deletion and deliberately not this:
 * a person's own private progress is theirs to erase.
 */
export async function deleteJourneyAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer()
  await deleteJourney({ userId: viewer.id, journeyId: text(formData, 'journeyId') })
  redirect(`/en/routes/${text(formData, 'slug')}`)
}

export async function saveStepProgressAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer()
  const status = text(formData, 'status')
  const slug = text(formData, 'slug')

  await setStepProgress({
    userId: viewer.id,
    journeyId: text(formData, 'journeyId'),
    stepId: text(formData, 'stepId'),
    ...(isStatus(status) ? { status } : {}),
    targetDate: parseDate(formData, 'targetDate'),
    actualDate: parseDate(formData, 'actualDate'),
    // An empty note is a cleared note, not an absent one.
    privateNote: text(formData, 'privateNote').trim() || null,
  })

  revalidatePath(`/en/routes/${slug}/journey`)
}

export async function setCompletionAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer()
  await setSelfReportedCompletion({
    userId: viewer.id,
    journeyId: text(formData, 'journeyId'),
    completed: text(formData, 'markCompleted') === 'yes',
  })
  revalidatePath(`/en/routes/${text(formData, 'slug')}/journey`)
}

export async function addTaskAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer()
  const label = text(formData, 'label').trim()
  const slug = text(formData, 'slug')
  if (label === '') return

  const stepId = text(formData, 'stepId')
  await addTask({
    userId: viewer.id,
    journeyId: text(formData, 'journeyId'),
    label,
    stepId: stepId === '' ? null : stepId,
  })
  revalidatePath(`/en/routes/${slug}/journey`)
}

export async function toggleTaskAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer()
  await setTaskDone({
    userId: viewer.id,
    taskId: text(formData, 'taskId'),
    done: text(formData, 'done') === 'yes',
  })
  revalidatePath(`/en/routes/${text(formData, 'slug')}/journey`)
}

export async function removeTaskAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer()
  await removeTask({ userId: viewer.id, taskId: text(formData, 'taskId') })
  revalidatePath(`/en/routes/${text(formData, 'slug')}/journey`)
}
