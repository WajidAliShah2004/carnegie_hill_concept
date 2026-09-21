/**
 * Every route a crawler may index, in the order the sitemap lists them.
 *
 * The 404 page and the two redirect stubs (`/order-online/`, `/appointment/`)
 * are not routes here: a redirect and an error page are not content. A gallery
 * tab with no photos is not here either, because it is not rendered.
 */

import { getGalleryRoutes } from '@/content/gallery'
import { getPage } from '@/content/load'
import type { PageKey } from '@/content/types'
import { ROUTES } from '@/routes'

export type IndexableRoute = {
  path: string
  /** Real `_updatedAt` from the CMS. Absent rather than invented. */
  lastmod?: string
}

/** Page singletons that own exactly one route, in sitemap order. */
const PAGE_ROUTES: readonly { key: PageKey; path: string }[] = [
  { key: 'homePage', path: ROUTES.home },
  { key: 'aboutPage', path: ROUTES.about },
  { key: 'servicesPage', path: ROUTES.services },
  { key: 'reviewsPage', path: ROUTES.reviews },
  { key: 'contactPage', path: ROUTES.contact },
  { key: 'privacyPage', path: ROUTES.privacy },
]

function newest(values: readonly (string | undefined)[]): string | undefined {
  const real = values.filter((value): value is string => Boolean(value))
  if (real.length === 0) return undefined
  return real.reduce((a, b) => (a > b ? a : b))
}

export async function indexableRoutes(): Promise<IndexableRoute[]> {
  const [pages, gallery, galleryPage] = await Promise.all([
    Promise.all(PAGE_ROUTES.map(async (route) => ({ route, page: await getPage(route.key) }))),
    getGalleryRoutes(),
    getPage('galleryPage'),
  ])

  const bySingleton = new Map(
    pages.map(({ route, page }) => [
      route.path,
      { path: route.path, ...(page.updatedAt ? { lastmod: page.updatedAt } : {}) } as IndexableRoute,
    ]),
  )

  const galleryEntries: IndexableRoute[] = gallery.map((route) => {
    const lastmod = newest([galleryPage.updatedAt, ...route.photos.map((photo) => photo.updatedAt)])
    return { path: route.href, ...(lastmod ? { lastmod } : {}) }
  })

  const ordered: IndexableRoute[] = []
  for (const { path } of PAGE_ROUTES) {
    const entry = bySingleton.get(path)
    if (entry) ordered.push(entry)
    if (path === ROUTES.services) ordered.push(...galleryEntries)
  }
  return ordered
}
