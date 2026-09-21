import type { Metadata } from 'next'
import { CONTACT_REDIRECT, RedirectPage } from '@/components/RedirectPage'

// SEO: metadata wired by seo worker. The canonical and the noindex below are
// part of the redirect itself, so they live here until that work lands.
export const metadata: Metadata = {
  alternates: { canonical: CONTACT_REDIRECT.to },
  robots: { index: false, follow: true },
}

export default function Page() {
  return <RedirectPage {...CONTACT_REDIRECT} />
}
