'use server'

import { redirect } from 'next/navigation'

import { DEFAULT_LOCALE, isLocale } from '@/i18n/config'
import { closeAccount } from '@/server/accounts/service'
import { currentViewer, signOut } from '@/server/auth'

/**
 * Close the signed-in account — Phase 13 (FR-26, BR-16, §24.1).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **Three things this deliberately does not do.**
 *
 * It takes **no user id from the form.** The only account this can close is the one the
 * request is authenticated as. An id in a hidden input would be an id somebody could change,
 * and the failure mode is closing a stranger's account — so the parameter does not exist
 * (CLAUDE.md §9: journey queries always take the session user id; the same rule applies to
 * anything that destroys).
 *
 * It requires the person to **type the confirmation phrase**, matched against the same
 * dictionary string the page displayed. A destructive, irreversible action reached by one
 * click is an action reached by a mis-click, and there is no undo here.
 *
 * It does **not** report failure back to a form. There is nothing useful a person could do
 * with "closing failed" on this screen, and the closure itself is one transaction — it either
 * happened or it did not.
 */
export async function closeAccountAction(formData: FormData): Promise<void> {
  const viewer = await currentViewer()
  if (viewer === null) redirect(`/${DEFAULT_LOCALE}/signin`)

  const rawLocale = formData.get('locale')
  const locale = typeof rawLocale === 'string' && isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE

  /*
   * The typed phrase, compared with the one the page showed. Both come from the dictionary, so
   * they cannot drift apart, and a translation changes the required phrase along with the
   * instruction rather than leaving somebody typing an English word into a Bangla form.
   */
  const { getDictionary } = await import('@/i18n/get-dictionary')
  const t = await getDictionary(locale)
  const typed = formData.get('confirmation')
  if (typeof typed !== 'string' || typed.trim() !== t.account.closeConfirmationPhrase) {
    redirect(`/${locale}/account?confirm=mismatch`)
  }

  await closeAccount({ userId: viewer.id })

  /*
   * `closeAccount` has already deleted every session row, so the account is signed out
   * everywhere. This clears the cookie in *this* browser as well, so the person is not left
   * holding a token for a session that no longer exists — and lands them on the home page,
   * anonymous, which is the state they just asked for.
   */
  await signOut({ redirectTo: `/${locale}?closed=1` })
}
