import { ContentColumn, PageCanvas } from '@/components/layout'
import { DEFAULT_LOCALE } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'

/**
 * One of the few screens that genuinely is only reading matter, so a centred reading measure
 * is right here — and is the exception the layout primitives exist to make deliberate rather
 * than accidental.
 */
export default async function NotFound() {
  const t = await getDictionary(DEFAULT_LOCALE)

  return (
    <PageCanvas className="py-24">
      <ContentColumn width="reading" centred>
        <h1 className="text-2xl font-semibold text-ink-900">{t.notFound.title}</h1>
        <p className="mt-4 text-ink-700">{t.notFound.body}</p>
      </ContentColumn>
    </PageCanvas>
  )
}
