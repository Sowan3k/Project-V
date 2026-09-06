import type { DefaultSession } from 'next-auth'

import type { UserRole } from '@/domain/enums'

/**
 * Widens the Auth.js session with the two things this platform actually uses.
 *
 * `handle` is the pseudonymous public identity (§24.3). It is on the session so a component
 * never has to reach for the user row — and so the email, which is on that row, stays out of
 * reach by default rather than by discipline (§24.2).
 *
 * `role` is the safety role (§22, §23.3), added in Phase 12E so the header can show a link to
 * the administrator queues without a database query on every page render. It gates what is
 * *shown*; every administrator action re-checks it server-side (CLAUDE.md §9).
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      handle: string
      /** The safety role (§22, §23.3). Decides what is shown, never what is permitted. */
      role: UserRole
    } & DefaultSession['user']
  }
}
