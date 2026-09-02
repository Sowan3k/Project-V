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
 * Dropping the vowels **reduces the likelihood** that a random suffix reads as a recognisable
 * word. It does not eliminate it, and should not be described as if it does: consonant runs
 * can still resemble initialisms, abbreviations or words in other languages, and the check is
 * about English letters rather than meaning. Treat it as a cheap risk reduction, not a proof.
 *
 * It is worth doing because every generated handle is attached to a real person who did not
 * choose it. If an offensive handle is ever reported, the answer is to let that person change
 * it — not to claim the generator made it impossible.
 *
 * `0/1/l/o` are excluded for a different and more certain reason: they are misread and
 * mistyped, and a handle is something people copy by hand.
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
