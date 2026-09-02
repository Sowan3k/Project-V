'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { JourneyStepStatus } from '@/domain/enums'
import { JOURNEY_STEP_STATUSES } from '@/domain/enums'
import { optionalDate, optionalText, text } from '@/lib/form-fields'
import { currentViewer } from '@/server/auth'
import { confirmStepFields } from '@/server/revisions/service'
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
    targetDate: optionalDate(formData, 'targetDate'),
    actualDate: optionalDate(formData, 'actualDate'),
    // An empty note is a cleared note, not an absent one.
    privateNote: optionalText(formData, 'privateNote'),
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

/**
 * "Was this step still accurate?" — FR-42, §16.5.
 *
 * Offered right after a follower marks a step complete, "because this is when firsthand
 * knowledge is freshest". Answering yes confirms the live fields in that step.
 *
 * **This introduces no new contribution type.** The prompt is a moment, not an action: "yes"
 * is CONFIRM (FR-17) and "something changed" sends the contributor to the step's fields where
 * UPDATE and CHALLENGE already live. A fifth verb here would have meant a fifth set of
 * semantics to keep straight, for no gain.
 */
export async function confirmStepAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer()
  const slug = text(formData, 'slug')

  await confirmStepFields({
    actor: { id: viewer.id },
    stepId: text(formData, 'stepId'),
    reason: 'Confirmed after completing this step',
  })

  revalidatePath(`/en/routes/${slug}/journey`)
  revalidatePath(`/en/routes/${slug}`)
}
