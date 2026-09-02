import type { DefaultSession } from 'next-auth'

/**
 * Widens the Auth.js session with the two things this platform actually uses.
 *
 * `handle` is the pseudonymous public identity (§24.3). It is on the session so a component
 * never has to reach for the user row — and so the email, which is on that row, stays out of
 * reach by default rather than by discipline (§24.2).
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      handle: string
    } & DefaultSession['user']
  }
}
