import { getBusinessInfo, getPage, getServices } from '@/content/load'
import { labels } from '@/labels'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Actions, ButtonLink } from '@/components/Button'
import { BusinessFacts } from '@/components/BusinessFacts'
import { ContactForm } from '@/components/ContactForm'
import { Section } from '@/components/Section'
import { trailFor } from '@/components/StubPage'
import styles from './contact.module.css'
import { PageJsonLd } from '@/seo/JsonLdScript'
import { routeMetadata } from '@/seo/pages'

export const generateMetadata = routeMetadata('contact')

export default async function Page() {
  const [doc, business, services] = await Promise.all([
    getPage('contactPage'),
    getBusinessInfo(),
    getServices(),
  ])
  const heading = doc.h1 ?? labels.pageHeading.contactPage

  return (
    <main id="main">
      <PageJsonLd route="contact" />
      <Breadcrumbs trail={trailFor('contact', heading)} />
      <Section tight>
        <div className={`wrap ${styles.layout}`}>
          <div className={styles.details}>
            <h1>{heading}</h1>
            {doc.intro ? <p className={`lede ${styles.intro}`}>{doc.intro}</p> : null}

            <BusinessFacts business={business} className={styles.facts} />
            <p className={styles.note}>{business.appointmentNote}</p>

            <Actions className={styles.buttons}>
              <ButtonLink href={`tel:${business.phone}`}>{labels.actions.callTheShop}</ButtonLink>
              <ButtonLink href={business.directionsUrl} variant="line" rel="noopener">
                {labels.actions.getDirections}
              </ButtonLink>
            </Actions>
          </div>

          <div className={styles.formSide}>
            <h2 className={styles.formHeading}>{labels.actions.discussYourProject}</h2>
            <ContactForm
              phone={business.phone}
              phoneDisplay={business.phoneDisplay}
              projectTypes={services.map((service) => service.title)}
            />
          </div>
        </div>
      </Section>
    </main>
  )
}
