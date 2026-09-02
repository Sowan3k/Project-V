import { PrismaAdapter } from '@auth/prisma-adapter'
import type { Adapter, AdapterUser } from 'next-auth/adapters'
import Google from 'next-auth/providers/google'
import type { NextAuthConfig } from 'next-auth'

import { prisma } from '@/server/db/client'

import { generateHandle } from './handle'

/**
 * Auth.js configuration — Phase 7, FR-12, §24.2, §24.3.
 *
 * Sign-in exists for exactly two reasons: to attribute a contribution, and to keep a private
 * journey attached to the same person tomorrow. Reading the platform never requires it
 * (FR-01, D-03), and Phase 5's guarantee that no read path touches a session still holds.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Database sessions, not JWTs.** Two things follow from that, and both were the reason:
 *
 *   1. Signing out, or deleting an account, revokes access *immediately* rather than whenever
 *      a token happens to expire. For a platform whose pitch is privacy, "your session is
 *      still valid for another 29 days" is not an acceptable answer.
 *   2. The E2E suite can create a session row directly. That means the application needs no
 *      test-only sign-in path — no credentials provider, no bypass flag, nothing that could
 *      ever be switched on in production by accident. The safest test hook is one that lives
 *      entirely outside the application.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **We keep the email and discard the rest.** §24.2: collect only what is necessary to
 * identify an account and preserve the private journey. Google offers a name and a profile
 * photograph with every sign-in; the adapter below drops both before they reach the database,
 * and there are no columns for them to land in either. §24.3 says a contributor need not
 * expose a real identity — the way to honour that is to not hold one.
 */

/**
 * The Prisma adapter, with user creation narrowed to what we are willing to store.
 *
 * `PrismaAdapter.createUser` writes the whole OAuth profile. Our `User` model has no `name`
 * or `image` column, so that would fail loudly rather than leak — but relying on a missing
 * column to enforce a privacy rule is relying on an accident. This states it.
 *
 * A handle is generated here rather than defaulted in the schema because it needs a retry:
 * `User.handle` is unique, and although a collision across 27^8 is vanishingly unlikely, the
 * database is the authority on that and not the odds.
 */
function privacyPreservingAdapter(): Adapter {
  const base = PrismaAdapter(prisma)

  return {
    ...base,

    async createUser(user) {
      const email = user.email ?? null

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const created = await prisma.user.create({
            // Note what is absent: name, image, locale, and the provider's own id. Nothing
            // here can be traced back to a person by anyone reading the database.
            data: { email, handle: generateHandle() },
          })
          return toAdapterUser(created)
        } catch (error) {
          if (!isHandleCollision(error) || attempt === 4) throw error
        }
      }

      throw new Error('could not allocate a unique handle')
    },

    /**
     * Auth.js calls this to write provider profile updates back. There is nothing we want
     * from them, so this is a deliberate no-op that returns the stored user unchanged.
     */
    async updateUser(user) {
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
      return toAdapterUser(stored)
    },
  }
}

/**
 * Bridges our deliberately smaller `User` row to the shape Auth.js expects.
 *
 * `emailVerified` is synthesised rather than stored. It exists in Auth.js's contract for the
 * email sign-in flow, which this platform does not use, so storing a column for it would be
 * keeping a field "for later" — exactly what invariant 7 warns against.
 */
function toAdapterUser(user: { id: string; email: string | null }): AdapterUser {
  return { id: user.id, email: user.email ?? '', emailVerified: null }
}

function isHandleCollision(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

export const authConfig: NextAuthConfig = {
  adapter: privacyPreservingAdapter(),
  session: { strategy: 'database' },
  providers: [
    Google({
      /**
       * Narrow the profile at the door, before Auth.js ever holds it.
       *
       * Google returns name, given_name, family_name, picture and locale alongside the
       * email. None of them are wanted, and the shortest path to not storing something is
       * to not carry it.
       */
      profile(profile: { sub: string; email?: string }) {
        return { id: profile.sub, email: profile.email ?? null }
      },
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  pages: {
    signIn: '/en/signin',
  },
  callbacks: {
    /**
     * Put the pseudonymous handle on the session, and nothing else.
     *
     * The session is what every server component reads. Keeping the email off it means a
     * component cannot accidentally render one, and a future logging mistake cannot leak
     * one — the value simply is not there to leak.
     */
    async session({ session, user }) {
      const stored = await prisma.user.findUnique({
        where: { id: user.id },
        select: { handle: true },
      })
      return {
        ...session,
        user: { ...session.user, id: user.id, handle: stored?.handle ?? '', email: '' },
      }
    },
  },
}
