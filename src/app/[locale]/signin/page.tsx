import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { ContentColumn, GridRegion, PageCanvas, PageGrid } from '@/components/layout'
import { Button, Panel } from '@/components/ui'
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

/**
 * A title of this page's own - Phase 12.
 *
 * Before Phase 12 every page in the application shared one title, so a reader with three
 * routes open had three identical tabs and a useless history. The layout supplies the
 * "<subject> - Vindeshi Express" template; this supplies the subject.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getDictionary(locale)
  return {
    title: t.meta.signInTitle,
    // **noindex, and not only a robots.txt disallow.** A disallow asks a crawler not to
    // *fetch* the page; it does not stop the URL being indexed from a link elsewhere, and an
    // indexed journey URL would advertise that a private page exists at a guessable address.
    // This is the directive that actually keeps it out of a search index (invariant 5).
    robots: { index: false, follow: false },
  }
}

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

  /**
   * Two columns — Phase 12E.
   *
   * This was a narrow reading column alone on a 1440px page, which is the shape that made
   * the whole deployment read as unfinished. The fix is not to centre it: §7.2 keeps
   * `centred` for screens that are only reading matter, and re-centring a narrow column
   * inside a wide canvas is what breaks the shared left edge.
   *
   * So the right side carries something real instead — **what an account is actually for.**
   * A reader deciding whether to sign in wants to know what it buys and what it costs, and
   * the honest answers are unusually short: contribute, and keep a private journey; we store
   * an email address and generate a handle. Both are already product guarantees rather than
   * marketing (FR-12, FR-26, §24.2, §24.3, invariant 6).
   */
  const offers = [t.auth.offerContribute, t.auth.offerJourney]

  return (
    <PageCanvas className="py-12">
      <PageGrid>
        <GridRegion span={6}>
          <h1 className="text-title font-semibold tracking-tight text-ink-900">
            {t.auth.signInTitle}
          </h1>
          <ContentColumn width="reading">
            <p className="mt-3 text-base leading-7 text-ink-700">{t.auth.signInLede}</p>
          </ContentColumn>

          {configured ? (
            <form
              action={async () => {
                'use server'
                await signIn('google', { redirectTo: next })
              }}
              className="mt-6"
            >
              <Button type="submit">{t.auth.withGoogle}</Button>
            </form>
          ) : (
            <Panel tone="sunken" className="mt-6 text-sm text-ink-700">
              {t.auth.notConfigured}
            </Panel>
          )}

          <Panel as="section" className="mt-8">
            <h2 className="text-panel font-semibold text-ink-900">{t.auth.whatWeStore}</h2>
            <p className="mt-1 text-sm leading-6 text-ink-700">{t.auth.whatWeStoreBody}</p>
          </Panel>
        </GridRegion>

        <GridRegion span={6}>
          <Panel as="section" className="h-full">
            <h2 className="text-panel font-semibold text-ink-900">{t.auth.whatItIsFor}</h2>
            <ul className="mt-4 space-y-4">
              {offers.map((offer) => (
                <li key={offer.title}>
                  <p className="text-sm font-medium text-ink-900">{offer.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-700">{offer.body}</p>
                </li>
              ))}
            </ul>
            {/* Said here rather than only in the footer: this is the page where somebody is
                weighing up an account, and "you never needed one to read" is the single most
                useful thing we can tell them (FR-01, D-03). */}
            <p className="mt-6 border-t border-hairline pt-4 text-meta leading-6 text-ink-500">
              {t.auth.readingNeedsNoAccount}
            </p>
          </Panel>
        </GridRegion>
      </PageGrid>
    </PageCanvas>
  )
}
