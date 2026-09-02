import NextAuth from 'next-auth'

import { authConfig } from './config'

/**
 * The single Auth.js instance.
 *
 * `auth()` is how every server component and route handler learns who is asking. It returns
 * `null` for an anonymous visitor, which is the normal case: reading this platform never
 * requires an account (FR-01, D-03), and Phase 5's read layer still takes no session at all.
 *
 * Nothing outside `src/server/auth` and the sign-in surfaces imports NextAuth directly.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

/**
 * The signed-in user, reduced to what the application is allowed to know about them.
 *
 * There is no email here and no real name. A component that wanted to render one would have
 * to go and fetch it deliberately, which is the point (§24.2, §24.3).
 */
export interface Viewer {
  readonly id: string
  readonly handle: string
}

/** `null` when nobody is signed in. Never throws — anonymous is a valid state everywhere. */
export async function currentViewer(): Promise<Viewer | null> {
  const session = await auth()
  const user = session?.user
  if (!user?.id) return null
  return { id: user.id, handle: user.handle ?? '' }
}
