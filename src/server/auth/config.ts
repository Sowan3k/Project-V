import { PrismaAdapter } from '@auth/prisma-adapter'
import type { Adapter, AdapterUser } from 'next-auth/adapters'
import Google from 'next-auth/providers/google'
import type { NextAuthConfig } from 'next-auth'

import { UserRole } from '@/domain/enums'
import { DEFAULT_LOCALE } from '@/i18n/config'
import { prisma } from '@/server/db/client'

import { generateHandle } from './handle'
import { safeInternalRedirect } from './safe-redirect'

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

    /**
     * Store the link, and none of the credentials that came with it — audit F13.
     *
     * `PrismaAdapter.linkAccount` is `p.account.create({ data })` with the *whole*
     * `AdapterAccount`: Google's access token, its id token (a signed JWT carrying the
     * profile we went to some trouble not to keep), the granted scope, the token type and
     * the expiry. A refresh token joins them if `access_type=offline` is ever configured.
     * The `User` row was minimised at the door; the `Account` row was not, so the sign-in
     * page's "your email address … nothing else" was materially wider than the truth.
     *
     * Four columns are written, and each is load-bearing:
     *
     *   `userId`             whose account this is
     *   `provider`           which provider
     *   `providerAccountId`  Google's stable subject id
     *   `type`               Auth.js's own account kind, `oidc` here
     *
     * `getUserByAccount` looks a person up by `(provider, providerAccountId)` alone, and that
     * is the entire mechanism by which somebody signing in again is recognised as themselves.
     * Nothing else is read. The tokens exist so an application can call the provider's API on
     * a user's behalf later; this one never does, and never will — it wants an email address
     * to recognise a returning student and nothing more (§24.2).
     *
     * OAuth token material is sensitive at rest, and the cheapest protection for a secret is
     * not to hold one. The columns were dropped from the schema in the same change, so this
     * and the database say the same thing rather than one relying on the other.
     */
    async linkAccount(account) {
      await prisma.account.create({
        data: {
          userId: account.userId,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      })
      // Auth.js ignores the return value; returning the account unchanged keeps the adapter
      // contract honest without implying that any more of it was stored.
      return account
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
     * Where Auth.js is allowed to send somebody afterwards — audit F14.
     *
     * The sign-in *page* validates its own `?next=`, but that page is not the only door:
     * `/api/auth/signin/google?callbackUrl=…` and `/api/auth/signout?callbackUrl=…` are
     * reachable directly, and a phishing link would use them precisely because they skip the
     * page. Auth.js's default callback permits any URL on the configured origin, which is
     * wider than this application should allow and — depending on how the value is parsed —
     * wider than it looks.
     *
     * So the same validator decides both, and it is the parser rather than a prefix that
     * decides. Anything that is not an internal page of this application lands on the default
     * locale home, which is where an unauthenticated visitor would have started anyway.
     */
    redirect({ url, baseUrl }) {
      // `baseUrl` is Auth.js's own view of this site's origin, including the
      // `AUTH_TRUST_HOST` case where nothing is configured. Measuring against it rather than
      // recomputing means the two cannot disagree about where "here" is.
      return safeInternalRedirect(url, DEFAULT_LOCALE, baseUrl)
    },

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
        select: { handle: true, role: true },
      })
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          handle: stored?.handle ?? '',
          /**
           * The safety role, on the session — Phase 12E, audit F12.
           *
           * The administrator queues existed with nothing linking to them, so the only way in
           * was to know the URL. Putting a link in the header needs the role at render time,
           * and the header renders on every page — a role lookup there would be a database
           * query per page view for a link almost nobody sees.
           *
           * This callback already reads the user row for the handle, so the role rides along
           * in the same query and costs nothing. It is a *safety* role and gates nothing
           * editorial (§22, §23.3): ordinary contribution is deliberately outside its reach,
           * and every administrator surface re-checks it server-side anyway. A hidden link is
           * not a permission (CLAUDE.md §9), so this only decides what is *shown*.
           */
          role: stored?.role ?? UserRole.member,
          email: '',
        },
      }
    },
  },
}
