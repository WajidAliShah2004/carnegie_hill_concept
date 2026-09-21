import Link from 'next/link'
import { galleryHref, gallerySlug, getGalleryTabs } from '@/content/gallery'
import { getPage, getPhotosByType } from '@/content/load'
import { photoViews } from '@/content/view'
import { labels } from '@/labels'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { GalleryGrid } from '@/components/GalleryGrid'
import { Section } from '@/components/Section'
import { trailFor } from '@/components/StubPage'
import styles from './about.module.css'
import { PageJsonLd } from '@/seo/JsonLdScript'
import { routeMetadata } from '@/seo/pages'

export const generateMetadata = routeMetadata('about')

export default async function Page() {
  const [doc, shopPhotos, tabs] = await Promise.all([
    getPage('aboutPage'),
    getPhotosByType('theShop'),
    getGalleryTabs(),
  ])
  const heading = doc.h1 ?? labels.pageHeading.aboutPage
  const shopSlug = gallerySlug('theShop')
  const shopTab = tabs.find((tab) => tab.slug === shopSlug)

  return (
    <main id="main">
      <PageJsonLd route="about" />
      <Breadcrumbs trail={trailFor('about', heading)} />
      <Section tight>
        <div className="wrap">
          <div className={styles.head}>
            <h1>{heading}</h1>
            {doc.intro ? <p className={`lede ${styles.intro}`}>{doc.intro}</p> : null}
          </div>

          {doc.sections.map((section) => (
            <section key={section.key} className={styles.block}>
              {section.heading ? <h2 className={styles.blockHeading}>{section.heading}</h2> : null}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="prose">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        {shopPhotos.length > 0 ? (
          <div className={`wrap ${styles.photos}`}>
            <div className={styles.photosHead}>
              <h2>{labels.photoTypes.theShop}</h2>
              {shopTab ? (
                <Link className={styles.photosLink} href={galleryHref(shopSlug)}>
                  {labels.actions.seeTheGallery}
                </Link>
              ) : null}
            </div>
            <GalleryGrid items={photoViews(shopPhotos)} layout="composed" priorityFirst />
          </div>
        ) : null}
      </Section>
    </main>
  )
}
