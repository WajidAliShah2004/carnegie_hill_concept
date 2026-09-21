import Link from 'next/link'
import { getBusinessInfo, getPage, getServices } from '@/content/load'
import { gallerySlug, galleryHref, getGalleryTabs } from '@/content/gallery'
import { sources } from '@/content/view'
import { labels } from '@/labels'
import { ROUTES } from '@/routes'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ButtonLink } from '@/components/Button'
import { BusinessFacts } from '@/components/BusinessFacts'
import { Picture } from '@/components/Picture'
import { Section } from '@/components/Section'
import { trailFor } from '@/components/StubPage'
import styles from './services.module.css'
import { PageJsonLd } from '@/seo/JsonLdScript'
import { routeMetadata } from '@/seo/pages'

export const generateMetadata = routeMetadata('services')

export default async function Page() {
  const [doc, services, tabs, business] = await Promise.all([
    getPage('servicesPage'),
    getServices(),
    getGalleryTabs(),
    getBusinessInfo(),
  ])
  const heading = doc.h1 ?? labels.pageHeading.servicesPage
  const shown = new Set(tabs.map((tab) => tab.slug))

  return (
    <main id="main">
      <PageJsonLd route="services" />
      <Breadcrumbs trail={trailFor('services', heading)} />
      <Section tight>
        <div className={`wrap ${styles.layout}`}>
          <div className={styles.rail}>
            <h1>{heading}</h1>
            {doc.intro ? <p className={`lede ${styles.intro}`}>{doc.intro}</p> : null}

            {services.length > 0 ? (
              <nav className={styles.index} aria-label={labels.services.index}>
                <h2 className={styles.indexHeading}>{labels.services.index}</h2>
                <ul className={styles.indexList}>
                  {services.map((service) => (
                    <li key={service.id}>
                      <a href={`#${service.anchor}`}>{service.title}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            <ButtonLink className={styles.railButton} href={ROUTES.contact}>
              {labels.actions.discussYourProject}
            </ButtonLink>

            <BusinessFacts
              business={business}
              fields={['phone', 'hours']}
              className={styles.railFacts}
            />
          </div>

          <div className={styles.list}>
            {services.map((service) => {
              const slug = service.galleryType ? gallerySlug(service.galleryType) : null
              const tabLabel = service.galleryType ? labels.photoTypes[service.galleryType] : null
              const linkToGallery = slug !== null && shown.has(slug)
              return (
                <section key={service.id} id={service.anchor} className={styles.item}>
                  <h2 className={styles.itemHeading}>{service.title}</h2>
                  {service.body ? <p className={`prose ${styles.itemBody}`}>{service.body}</p> : null}
                  {service.image ? (
                    <figure className={styles.itemFigure}>
                      <Picture
                        image={sources(service.image)}
                        alt={service.title}
                        sizes="(max-width: 960px) calc(100vw - 40px), (max-width: 1500px) 58vw, 840px"
                      />
                    </figure>
                  ) : null}
                  {/*
                    One contact route per section, as the spec asks, but set
                    quietly: on a pointer device it fades in with the row it
                    belongs to, and on touch and keyboard it is simply there.
                    It is never removed from the page or from the tab order.
                  */}
                  <p className={styles.itemLinks}>
                    {linkToGallery && tabLabel ? (
                      <Link className={styles.itemGallery} href={galleryHref(slug)}>
                        {tabLabel}
                      </Link>
                    ) : null}
                    <Link className={styles.itemContact} href={ROUTES.contact}>
                      {labels.actions.discussYourProject}
                    </Link>
                  </p>
                </section>
              )
            })}
          </div>
        </div>
      </Section>
    </main>
  )
}
