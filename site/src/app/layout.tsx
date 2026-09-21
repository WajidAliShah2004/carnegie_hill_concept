import type { Metadata, Viewport } from 'next'
import { Schibsted_Grotesk } from 'next/font/google'
import { getBusinessInfo, getPage, isProduction } from '@/content/load'
import { sources } from '@/content/view'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { labels } from '@/labels'
import styles from './layout.module.css'
import './globals.css'

const face = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-face',
})

const siteUrl = process.env.SITE_URL ?? 'https://nyframing.com'

/**
 * Only what every page shares. No description here: Next hands a missing
 * description down from the layout, and a page with no approved sentence of
 * its own must not borrow the home page's.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [business, home] = await Promise.all([getBusinessInfo(), getPage('homePage')])
  return {
    metadataBase: new URL(siteUrl),
    title: { default: home.metaTitle, template: `%s | ${business.name}` },
    applicationName: business.name,
    manifest: '/manifest.webmanifest',
    /*
      The icons are the logo's monogram on the ink token, written by
      scripts/prebuild-assets.mjs. No new artwork was drawn for them.
    */
    icons: {
      icon: [
        { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
        { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    ...(isProduction ? {} : { robots: { index: false, follow: false } }),
  }
}

/** The ink token from globals.css, so the browser chrome matches the page. */
export const viewport: Viewport = {
  themeColor: '#13161f',
  colorScheme: 'dark',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const business = await getBusinessInfo()
  return (
    <html lang="en" className={face.variable}>
      <body>
        <a className={styles.skip} href="#main">
          {labels.skipToContent}
        </a>
        <Header
          logo={sources(business.logo)}
          name={business.name}
          phone={business.phone}
          phoneDisplay={business.phoneDisplay}
        />
        {children}
        <Footer business={business} />
      </body>
    </html>
  )
}
