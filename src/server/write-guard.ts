import { AsyncLocalStorage } from 'node:async_hooks'

import { isRevisionedShared, isRevisionModel } from '@/domain/models'

/**
 * The runtime half of "the revision service is the only write path".
 *
 * Three layers guard shared knowledge, each catching a failure the others cannot:
 *
 *   1. **Static** — an ESLint import boundary stops anything outside `src/server/**` from
 *      importing the Prisma client at all. Catches the mistake while it is being written.
 *   2. **Runtime** — this guard. A Prisma client extension that refuses any write to a
 *      revisioned model unless it is happening inside the revision service's own context.
 *      Catches code that got hold of a client some other way: a dynamic import, a seed
 *      script, a future package, a clever refactor.
 *   3. **Database** — triggers that refuse UPDATE and DELETE on revision tables outright.
 *      Catches everything else, including psql.
 *
 * A single layer would be a convention. Three make it a property.
 *
 * The context is deliberately not a parameter threaded through call sites: a parameter can
 * be passed by anyone, which would make the guard decorative. Async-local storage means the
 * only way to be inside the context is to have gone through the service.
 */

export interface RevisionWriteContext {
  /** Who is making the change. Null only for system/seed writes, which must say so. */
  readonly actorId: string | null
  /** Why, in the contributor's words. Carried onto every revision row. */
  readonly reason: string | null
  /** Set when the write is a system operation rather than a person's contribution. */
  readonly system: boolean
}

const storage = new AsyncLocalStorage<RevisionWriteContext>()

/** Opens the sanctioned write context. Only the revision service calls this. */
export function runInRevisionWrite<T>(context: RevisionWriteContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn)
}

export function currentRevisionWrite(): RevisionWriteContext | undefined {
  return storage.getStore()
}

export class WriteBoundaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WriteBoundaryError'
  }
}

/** Operations that change data. Reads are unrestricted. */
const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
])

/** Operations that destroy rather than append. Never permitted on shared knowledge. */
const DESTRUCTIVE_OPERATIONS = new Set(['delete', 'deleteMany'])

/**
 * Decides whether one operation is allowed. Extracted from the extension so it can be
 * unit-tested without a database.
 */
export function checkWrite(
  model: string | undefined,
  operation: string,
  inContext: boolean,
): { allowed: true } | { allowed: false; reason: string } {
  if (model === undefined) return { allowed: true }
  if (!WRITE_OPERATIONS.has(operation)) return { allowed: true }
  if (!isRevisionedShared(model)) return { allowed: true }

  // Hard delete of shared knowledge is refused for everyone, in or out of context. Obsolete
  // content is challenged and archived, never erased (FR-19, FR-21, BR-02, invariants 1
  // and 4). Permanent removal for abuse or legal reasons is an administrative path that
  // deliberately does not exist yet; when Phase 9 adds it, it will be a separate, audited
  // surface rather than a flag on this one.
  if (DESTRUCTIVE_OPERATIONS.has(operation)) {
    return {
      allowed: false,
      reason:
        `${operation} on ${model} is refused: shared route knowledge is never hard-deleted. ` +
        `Archive it instead — archived content leaves current views and stays in history ` +
        `(FR-21, FR-45, CLAUDE.md invariants 1 and 4).`,
    }
  }

  // Revision rows are append-only. Updating one would rewrite history in place, which is the
  // same loss as deleting it (invariant 2, BR-03).
  if (isRevisionModel(model) && operation !== 'create' && operation !== 'createMany') {
    return {
      allowed: false,
      reason:
        `${operation} on ${model} is refused: revision rows are immutable once written. ` +
        `A correction is a new revision, never an edit of an old one (FR-20, BR-03, ` +
        `CLAUDE.md invariant 2).`,
    }
  }

  if (!inContext) {
    return {
      allowed: false,
      reason:
        `${operation} on ${model} must go through the revision service in ` +
        `src/server/revisions. Writing shared knowledge directly would skip the revision ` +
        `row, the actor attribution and the transaction that keeps them together ` +
        `(FR-20, BR-03, CLAUDE.md §9).`,
    }
  }

  return { allowed: true }
}

/**
 * The Prisma extension. Applied in `src/lib/prisma.ts` so every client carries it.
 *
 * Typed loosely at the boundary because Prisma's extension callback is generic over every
 * model and operation; the logic it delegates to is fully typed.
 */
export const writeGuardExtension = {
  name: 'vindeshi-write-guard',
  query: {
    $allModels: {
      $allOperations({
        model,
        operation,
        args,
        query,
      }: {
        model?: string
        operation: string
        args: unknown
        query: (args: unknown) => Promise<unknown>
      }): Promise<unknown> {
        const verdict = checkWrite(model, operation, currentRevisionWrite() !== undefined)
        if (!verdict.allowed) throw new WriteBoundaryError(verdict.reason)
        return query(args)
      },
    },
  },
} as const
