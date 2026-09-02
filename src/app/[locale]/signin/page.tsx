import { notFound, redirect } from 'next/navigation'

import { ContentColumn } from '@/components/layout'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'
import { currentViewer, signIn } from '@/server/auth'

/**
 * Sign in — Phase 7, FR-12, §24.2, §24.3.
 *
 * Deliberately says what it keeps, on the page itself, before anyone clicks. "We store your
 * email so we recognise you, and nothing else" is a promise worth making where it can be
 * read rather than in a policy nobody opens.
 *
 * Reading the platform never needs this page. It gates contribution and private tracking,
 * and nothing else (FR-01, FR-12, D-03).
 */
export const dynamic = 'force-dynamic'

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getDictionary(locale)

  const query = await searchParams
  const requested = Array.isArray(query.next) ? query.next[0] : query.next
  // Only same-site paths. An open redirect on a sign-in page is how a phishing link borrows
  // somebody else's domain, and this platform warns readers about exactly that (FR-64).
  const next = requested?.startsWith('/') && !requested.startsWith('//') ? requested : `/${locale}`

  if (await currentViewer()) redirect(next)

  const configured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)

  return (
    <ContentColumn width="reading">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{t.auth.signInTitle}</h1>
      <p className="mt-3 text-base leading-7 text-ink-700">{t.auth.signInLede}</p>

      {configured ? (
        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: next })
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white"
          >
            {t.auth.withGoogle}
          </button>
        </form>
      ) : (
        <p className="mt-6 rounded-lg border border-hairline bg-surface p-4 text-sm text-ink-700">
          {t.auth.notConfigured}
        </p>
      )}

      <section className="mt-8 rounded-xl border border-hairline bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink-900">{t.auth.whatWeStore}</h2>
        <p className="mt-1 text-sm leading-6 text-ink-700">{t.auth.whatWeStoreBody}</p>
      </section>
    </ContentColumn>
  )
}
