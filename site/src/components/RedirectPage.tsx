import Link from 'next/link'
import { labels } from '@/labels'
import { ROUTES } from '@/routes'
import { Section } from './Section'
import styles from './RedirectPage.module.css'

export type RedirectPageProps = {
  /** Where the old URL now goes. Always a route on this site. */
  to: string
  heading: string
  linkLabel: string
}

/**
 * A static export cannot send a 301, so the old WordPress URLs get a tiny page
 * that moves the browser on straight away and offers a plain link for anyone
 * the refresh does not carry. The deploy worker adds the real 301 in
 * `_redirects` and `.htaccess`; this page is the fallback, and it is noindex
 * with a canonical pointing at the destination.
 */
export function RedirectPage({ to, heading, linkLabel }: RedirectPageProps) {
  return (
    <main id="main">
      <meta httpEquiv="refresh" content={`0; url=${to}`} />
      <Section tight>
        <div className={`wrap ${styles.body}`}>
          <h1>{heading}</h1>
          <p className={styles.link}>
            <Link href={to}>{linkLabel}</Link>
          </p>
        </div>
      </Section>
    </main>
  )
}

export const CONTACT_REDIRECT = {
  to: ROUTES.contact,
  heading: labels.pageHeading.contactPage,
  linkLabel: labels.redirects.toContact,
} as const
