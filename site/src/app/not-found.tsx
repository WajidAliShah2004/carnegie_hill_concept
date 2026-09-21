import type { Metadata } from 'next'
import Link from 'next/link'
import { getBusinessInfo } from '@/content/load'
import { labels } from '@/labels'
import { NAV_ITEMS, ROUTES } from '@/routes'
import { Actions, ButtonLink } from '@/components/Button'
import { BusinessFacts } from '@/components/BusinessFacts'
import { Section } from '@/components/Section'
import styles from './not-found.module.css'

/**
 * The 404 has no page record behind it, so its title is the interface word for
 * the state plus the shop's name. Without this it inherited the home page
 * title from the layout, which told a search engine the wrong thing.
 */
export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusinessInfo()
  return {
    title: { absolute: `${labels.errors.notFoundTitle} | ${business.name}` },
    robots: { index: false, follow: true },
  }
}

/**
 * Somebody who lands here was looking for something. The page says where they
 * are, gives them the six pages of the site, and gives them the shop's phone
 * number and address, which is what they would have been after anyway.
 */
export default async function NotFound() {
  const business = await getBusinessInfo()
  return (
    <main id="main">
      <Section tight>
        <div className={`wrap ${styles.inner}`}>
          <div className={styles.lead}>
            <h1 className={styles.title}>{labels.errors.notFoundTitle}</h1>
            <Actions className={styles.buttons}>
              <ButtonLink href={ROUTES.home}>{labels.errors.notFoundBack}</ButtonLink>
              <ButtonLink href={`tel:${business.phone}`} variant="line">
                {labels.actions.callTheShop}
              </ButtonLink>
            </Actions>
          </div>

          <nav className={styles.pages} aria-label={labels.nav.label}>
            <h2 className={styles.heading}>{labels.footer.pages}</h2>
            <ul className={styles.list}>
              {NAV_ITEMS.map((item) => (
                <li key={item.key}>
                  <Link href={item.href}>{labels.nav[item.key]}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <BusinessFacts
            business={business}
            fields={['address', 'hours', 'phone']}
            className={styles.facts}
          />
        </div>
      </Section>
    </main>
  )
}
