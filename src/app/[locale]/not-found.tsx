import { DEFAULT_LOCALE } from '@/i18n/config'
import { getDictionary } from '@/i18n/get-dictionary'

export default async function NotFound() {
  const t = await getDictionary(DEFAULT_LOCALE)

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-24">
      <h1 className="text-2xl font-semibold text-ink-900">{t.notFound.title}</h1>
      <p className="mt-4 text-ink-700">{t.notFound.body}</p>
    </div>
  )
}
