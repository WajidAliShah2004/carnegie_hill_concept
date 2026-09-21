import { labels } from '@/labels'
import type { BusinessInfo } from '@/content/types'
import type { PhotoView } from '@/content/view'
import { Actions, ButtonLink } from './Button'
import { BusinessFacts } from './BusinessFacts'
import { Picture } from './Picture'
import styles from './VisitSection.module.css'

export type VisitSectionProps = {
  business: BusinessInfo
  photo?: PhotoView
  id?: string
}

/** The one inverted section on the site. Never side by side at 900px or below. */
export function VisitSection({ business, photo, id }: VisitSectionProps) {
  return (
    <section {...(id ? { id } : {})} className={`invert ${styles.visit}`}>
      <div className={`wrap ${styles.inner}`}>
        <div className={styles.stack}>
          <span className={styles.rule} aria-hidden="true" />
          <h2>{labels.sections.visitTheShop}</h2>
          <p className={styles.note}>{business.appointmentNote}</p>
          <BusinessFacts business={business} className={styles.factsBlock} />
          <Actions className={styles.buttons}>
            <ButtonLink href={business.directionsUrl} rel="noopener">
              {labels.actions.getDirections}
            </ButtonLink>
            <ButtonLink href={`tel:${business.phone}`} variant="line">
              {labels.actions.callTheShop}
            </ButtonLink>
          </Actions>
        </div>

        {photo ? (
          <figure className={styles.figure}>
            <Picture image={photo.image} alt={photo.alt} sizes="(max-width: 900px) calc(100vw - 40px), (max-width: 1500px) 44vw, 610px" />
            {photo.caption ? <figcaption className={styles.caption}>{photo.caption}</figcaption> : null}
          </figure>
        ) : null}
      </div>
    </section>
  )
}
