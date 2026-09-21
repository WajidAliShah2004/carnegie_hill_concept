import Link from 'next/link'
import { labels } from '@/labels'
import { NAV_ITEMS, ROUTES } from '@/routes'
import { imageSources } from '@/content/image'
import type { BusinessInfo } from '@/content/types'
import { time24 } from './BusinessFacts'
import { Picture } from './Picture'
import styles from './Footer.module.css'

export type FooterProps = { business: BusinessInfo }

/**
 * Four columns that fill the width: the mark with the shop's name and where
 * it is, the hours, the six pages, and the confirmed social links. Both fact
 * blocks are <address> elements. An unconfirmed social link is not rendered
 * and does not reach `sameAs`, so the last column often does not exist, which
 * is why the first three carry the width between them.
 */
export function Footer({ business }: FooterProps) {
  const social = business.socialLinks
  return (
    <footer className={styles.foot}>
      <div className={`wrap ${styles.inner}`}>
        <div className={styles.brandCol}>
          {/* The mark is decoration here: the name is set beside it as text. */}
          <Picture image={imageSources(business.logo)} alt="" className={styles.mark} sizes="220px" />
          <h2 className={styles.name}>{business.name}</h2>
          <address className={styles.addr}>
            {business.street}
            <br />
            {business.city}, {business.region} {business.postcode}
            {business.crossStreets ? (
              <>
                <br />
                <span className={styles.quiet}>{business.crossStreets}</span>
              </>
            ) : null}
            <br />
            <a href={`tel:${business.phone}`}>{business.phoneDisplay}</a>
            <br />
            <a href={`mailto:${business.email}`}>{business.email}</a>
          </address>
        </div>

        <div className={styles.factCol}>
          <h2 className={styles.heading}>{labels.facts.hours}</h2>
          <address className={styles.addr}>
            {business.hours.map((hours) => (
              <span key={hours.days.join('-')}>
                {hours.days[0]} {labels.facts.to} {hours.days[hours.days.length - 1]}
                <br />
                <time dateTime={time24(hours.opens)}>{hours.opens}</time> {labels.facts.to}{' '}
                <time dateTime={time24(hours.closes)}>{hours.closes}</time>
                <br />
              </span>
            ))}
            <span className={styles.quiet}>{business.sundayNote}</span>
          </address>
        </div>

        <div className={styles.linkCol}>
          <h2 className={styles.heading}>{labels.footer.pages}</h2>
          <ul className={styles.list}>
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link href={item.href}>{labels.nav[item.key]}</Link>
              </li>
            ))}
          </ul>
        </div>

        {social.length > 0 ? (
          <div className={styles.linkCol}>
            <h2 className={styles.heading}>{labels.footer.follow}</h2>
            <ul className={styles.list}>
              {social.map((link) => (
                <li key={link.url}>
                  <a href={link.url} rel="noopener">
                    {labels.platforms[link.platform]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className={`wrap ${styles.legal}`}>
        <Link href={ROUTES.privacy}>{labels.nav.privacy}</Link>
      </div>
    </footer>
  )
}
