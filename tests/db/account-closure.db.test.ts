import { beforeAll, describe, expect, it } from 'vitest'

import {
  FieldCategory,
  JourneyStepStatus,
  RouteMechanism,
  SourceClass,
  StepCategory,
  StudyLevel,
} from '../../src/domain/enums'
import { closeAccount, isAccountClosed } from '../../src/server/accounts/service'
import { generateHandle } from '../../src/server/auth/handle'
import { prisma } from '../../src/server/db/client'
import { followRoute, setStepProgress, addTask } from '../../src/server/journeys/service'
import { addField, addStep, createRoute } from '../../src/server/revisions/service'

/**
 * Phase 13 — closing an account, against a real database.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **This is the only code in the product that destroys somebody's data on purpose**, so it is
 * the code that most needs proving rather than reasoning about. Two halves, and both have to
 * hold at once or the feature is a lie in one direction or the other:
 *
 *   the private half is **gone**   — email, sessions, OAuth links, journeys, progress, notes,
 *                                    tasks. If any of it survives, the privacy promise fails.
 *   the public half **survives**   — every revision, still attributed to the handle. If any
 *                                    of it disappears, invariants 2 and 4 fail and a public
 *                                    ledger has quietly lost its authorship.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **And one thing that is not obvious until you try it.** The natural implementation is
 * `prisma.user.delete()`. It cannot work: every attribution is `onDelete: SetNull`, and
 * setting a revision's `authorId` to null is an UPDATE on a revision row, which
 * `vindeshi_revisions_are_immutable` refuses. The last test in this file performs that delete
 * and asserts it is refused — so if somebody later "simplifies" `closeAccount` into a delete,
 * this file explains why the database says no before they spend an afternoon on it.
 */

const url = process.env.TEST_DATABASE_URL
/** The private note, named so the assertion below can insist it was really written. */
const NOTE = 'Ask the university registrar about the attestation stamp'

interface Fixture {
  readonly userId: string
  readonly handle: string
  readonly otherUserId: string
  readonly routeId: string
  readonly stepId: string
  readonly fieldId: string
  readonly revisionId: string
}

let fx: Fixture

beforeAll(async () => {
  if (!url) return

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const [leaver, stayer] = await Promise.all([
    prisma.user.create({
      data: { handle: generateHandle(), email: `leaver-${suffix}@example.test` },
    }),
    prisma.user.create({
      data: { handle: generateHandle(), email: `stayer-${suffix}@example.test` },
    }),
  ])

  // A contribution authored by the person who will leave. This is what must survive.
  const { routeId } = await createRoute({
    actor: { id: leaver.id, system: false },
    slug: `closure-${suffix}`,
    originCountry: 'BD',
    destinationCountry: 'MY',
    studyLevel: StudyLevel.masters,
    mechanism: RouteMechanism.direct_admission,
    title: 'A route written by somebody who later left',
  })

  const step = await addStep({
    actor: { id: leaver.id, system: false },
    routeId,
    label: 'Documents',
    category: StepCategory.documents_preparation,
    typicalDurationDays: 30,
  })

  const field = await addField({
    actor: { id: leaver.id, system: false },
    stepId: step.stepId,
    category: FieldCategory.requirement,
    valueText: 'Attested transcripts from the awarding institution',
    sourceClass: SourceClass.official,
  })

  // Private state: a followed route, progress against a step, a note and a task.
  const { journeyId } = await followRoute({ userId: leaver.id, routeId })
  await setStepProgress({
    userId: leaver.id,
    journeyId,
    stepId: step.stepId,
    status: JourneyStepStatus.in_progress,
    targetDate: new Date('2027-03-01'),
    privateNote: NOTE,
  })
  await addTask({ userId: leaver.id, journeyId, label: 'Book the notary' })

  // An OAuth link and a live session, as Auth.js would have written them.
  await prisma.account.create({
    data: {
      userId: leaver.id,
      type: 'oauth',
      provider: 'google',
      providerAccountId: `google-${suffix}`,
    },
  })
  await prisma.session.create({
    data: {
      userId: leaver.id,
      sessionToken: `token-${suffix}`,
      expires: new Date(Date.now() + 86_400_000),
    },
  })

  const revision = await prisma.fieldRevision.findFirstOrThrow({
    where: { fieldId: field.fieldId },
    select: { id: true },
  })

  fx = {
    userId: leaver.id,
    handle: leaver.handle,
    otherUserId: stayer.id,
    routeId,
    stepId: step.stepId,
    fieldId: field.fieldId,
    revisionId: revision.id,
  }
})

describe.skipIf(!url)('closing an account', () => {
  it('starts from a fixture that actually has something to destroy', async () => {
    // A test that passes because the setup silently did nothing is the failure mode here.
    const [journeys, progress, tasks, accounts, sessions] = await Promise.all([
      prisma.journey.count({ where: { userId: fx.userId } }),
      prisma.journeyStepProgress.count({ where: { journey: { userId: fx.userId } } }),
      prisma.journeyTask.count({ where: { journey: { userId: fx.userId } } }),
      prisma.account.count({ where: { userId: fx.userId } }),
      prisma.session.count({ where: { userId: fx.userId } }),
    ])
    expect({ journeys, progress, tasks, accounts, sessions }).toEqual({
      journeys: 1,
      progress: 1,
      tasks: 1,
      accounts: 1,
      sessions: 1,
    })

    /*
     * The note specifically. An earlier draft of this file passed `privateNote` inside an
     * `input:` object that `setStepProgress` does not take — so a progress row was created
     * with a null note and every deletion assertion below still went green. The test was
     * proving that nothing is deleted correctly.
     */
    const progressRow = await prisma.journeyStepProgress.findFirstOrThrow({
      where: { journey: { userId: fx.userId } },
      select: { privateNote: true, targetDate: true },
    })
    expect(progressRow.privateNote, 'the note must exist before it can be destroyed').toBe(NOTE)
    expect(progressRow.targetDate).not.toBeNull()

    const before = await prisma.user.findUniqueOrThrow({ where: { id: fx.userId } })
    expect(before.email).not.toBeNull()
    expect(before.closedAt).toBeNull()
  })

  it('destroys every private thing, and says how much', async () => {
    const result = await closeAccount({ userId: fx.userId })
    expect(result.journeysDeleted).toBe(1)

    const [journeys, progress, tasks, accounts, sessions] = await Promise.all([
      prisma.journey.count({ where: { userId: fx.userId } }),
      prisma.journeyStepProgress.count({ where: { journey: { userId: fx.userId } } }),
      prisma.journeyTask.count({ where: { journey: { userId: fx.userId } } }),
      prisma.account.count({ where: { userId: fx.userId } }),
      prisma.session.count({ where: { userId: fx.userId } }),
    ])
    // The note and the target date lived on the progress row; the task on its own.
    expect({ journeys, progress, tasks, accounts, sessions }).toEqual({
      journeys: 0,
      progress: 0,
      tasks: 0,
      accounts: 0,
      sessions: 0,
    })
  })

  it('erases the email, which is the only value here that names a person', async () => {
    const after = await prisma.user.findUniqueOrThrow({ where: { id: fx.userId } })
    expect(after.email).toBeNull()
    expect(after.closedAt).not.toBeNull()
    expect(await isAccountClosed(fx.userId)).toBe(true)
  })

  it('keeps the handle, because it never identified anybody', async () => {
    const after = await prisma.user.findUniqueOrThrow({ where: { id: fx.userId } })
    expect(after.handle).toBe(fx.handle)
  })

  it('leaves every contribution standing, still attributed', async () => {
    const [route, step, field, revision] = await Promise.all([
      prisma.route.findUnique({ where: { id: fx.routeId }, select: { createdById: true } }),
      prisma.step.findUnique({ where: { id: fx.stepId }, select: { id: true } }),
      prisma.field.findUnique({ where: { id: fx.fieldId }, select: { id: true } }),
      prisma.fieldRevision.findUnique({
        where: { id: fx.revisionId },
        select: { authorId: true, valueText: true },
      }),
    ])

    expect(step, 'the step survives the author leaving').not.toBeNull()
    expect(field, 'the field survives the author leaving').not.toBeNull()
    // Attribution is *kept*, not nulled. Invariants 2 and 4: a public ledger does not lose its
    // authorship because somebody closed their account, and the handle names nobody.
    expect(route?.createdById).toBe(fx.userId)
    expect(revision?.authorId).toBe(fx.userId)
    expect(revision?.valueText).toBe('Attested transcripts from the awarding institution')
  })

  it('is idempotent — closing twice is not an error', async () => {
    const again = await closeAccount({ userId: fx.userId })
    expect(again.journeysDeleted).toBe(0)
  })

  it('touched nobody else', async () => {
    const other = await prisma.user.findUniqueOrThrow({ where: { id: fx.otherUserId } })
    expect(other.email).not.toBeNull()
    expect(other.closedAt).toBeNull()
  })

  /**
   * **The delete that looks right and is refused by the database.**
   *
   * Kept as an executable explanation. `ON DELETE SET NULL` on `field_revisions.author_id` is
   * an UPDATE on a revision row, and the immutability trigger refuses UPDATE outright — so the
   * obvious implementation of "delete my account" fails with `restrict_violation` rather than
   * quietly stripping authorship out of the ledger.
   *
   * If this ever stops throwing, the trigger has been weakened and invariant 2 has a hole.
   */
  it('refuses a raw user delete, because it would rewrite revision rows', async () => {
    await expect(prisma.user.delete({ where: { id: fx.userId } })).rejects.toThrow()

    // Still there, and still attributed — the refusal was total, not partial.
    const survivor = await prisma.fieldRevision.findUnique({
      where: { id: fx.revisionId },
      select: { authorId: true },
    })
    expect(survivor?.authorId).toBe(fx.userId)
  })
})
