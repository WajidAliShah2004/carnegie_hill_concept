import { notFound } from 'next/navigation'
import { galleryHref, getGalleryRoute, getGalleryTabs } from '@/content/gallery'
import { getPage } from '@/content/load'
import { photoViews } from '@/content/view'
import { labels } from '@/labels'
import { ROUTES } from '@/routes'
import { Breadcrumbs } from './Breadcrumbs'
import { GalleryGrid } from './GalleryGrid'
import { GalleryTabs } from './GalleryTabs'
import { Pagination } from './Pagination'
import { Section } from './Section'
import styles from './GalleryView.module.css'

export type GalleryViewProps = {
  /** `''` is the tab at `/gallery/`. */
  slug: string
  page: number
}

/** One gallery page: the tabs, twelve pictures, and the paging links. */
export async function GalleryView({ slug, page }: GalleryViewProps) {
  const [tabs, route, doc] = await Promise.all([
    getGalleryTabs(),
    getGalleryRoute(slug, page),
    getPage('galleryPage'),
  ])
  if (!route) notFound()

  const heading = doc.h1 ?? labels.pageHeading.galleryPage
  const tab = tabs.find((item) => item.slug === slug)
  const trail = [
    { href: ROUTES.home, label: labels.nav.home },
    { href: galleryHref(''), label: heading },
    ...(slug !== '' && tab ? [{ href: tab.href, label: tab.label }] : []),
  ]

  return (
    <main id="main">
      <Breadcrumbs trail={trail} />
      <Section tight>
        <div className="wrap">
          <div className={styles.head}>
            <h1>{heading}</h1>
            {doc.intro ? <p className="lede">{doc.intro}</p> : null}
          </div>
          <GalleryTabs tabs={tabs} current={slug} />
        </div>

        <div className={`wrap ${styles.wall}`}>
          <h2 className="sr-only">{tab ? tab.label : heading}</h2>
          <GalleryGrid items={photoViews(route.photos)} priorityFirst />
        </div>

        <div className="wrap">
          <Pagination
            page={route.page}
            pageCount={route.pageCount}
            href={(number) => galleryHref(slug, number)}
          />
        </div>
      </Section>
    </main>
  )
}
