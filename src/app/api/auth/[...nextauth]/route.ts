import { handlers } from '@/server/auth'

/**
 * Auth.js callback and sign-in endpoints.
 *
 * The only route in the application that handles credentials, and it hands them straight to
 * Google — nothing here stores or inspects a password, because there is no password.
 */
export const { GET, POST } = handlers
