/**
 * Pseudonymous public handles — §24.3, FR-12.
 *
 * "Contributors need not expose their real identity publicly. The system may show an optional
 * public username or a neutral contributor identity."
 *
 * So a handle is **generated, never taken from the sign-in provider.** Deriving one from a
 * Google display name would publish somebody's real name the moment they signed in, by
 * default, without asking — which is the worst possible way to make that choice on their
 * behalf. It would also quietly make the platform a directory of who is emigrating, which is
 * not a thing a Bangladeshi student should have to opt out of.
 *
 * The handle carries no information about the person: not their name, not their email, not
 * their country, not when they joined. It is a label, and that is all it is.
 */

/**
 * Deliberately excludes vowels, and `0/1/l/o` besides.
 *
 * No vowels means no generated handle can spell a word — an alphabet that can produce a slur
 * or an insult by chance is one that eventually will, and every such handle is attached to a
 * real person who did not choose it.
 */
const ALPHABET = '23456789bcdfghjkmnpqrstvwxz'

const PREFIX = 'traveller'
const SUFFIX_LENGTH = 8

/**
 * A neutral handle such as `traveller-k7fq3mbn`.
 *
 * 27^8 ≈ 2.8e11 possibilities, so collisions are rare — but "rare" is not "never", and the
 * caller must treat the unique constraint on `User.handle` as the real authority and retry.
 * See `createUserWithHandle`.
 */
export function generateHandle(random: () => number = Math.random): string {
  let suffix = ''
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? ALPHABET[0]
  }
  return `${PREFIX}-${suffix}`
}

/** True for a string this module could have produced. Used by the tests, not by the app. */
export function isGeneratedHandle(handle: string): boolean {
  return new RegExp(`^${PREFIX}-[${ALPHABET}]{${SUFFIX_LENGTH}}$`).test(handle)
}
