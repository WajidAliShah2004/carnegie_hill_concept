/**
 * The graph and the metadata for each route, built from the same records the
 * route renders.
 *
 * Every page file adds two things and nothing else: a `generateMetadata`
 * export from here, and one JSON-LD element from `JsonLd.tsx`.
 */

import type { Metadata } from 'next'
import type { Crumb } from '@/components/Breadcrumbs'
import { galleryHref, getGalleryRoute, getGalleryTabs } from '@/content/gallery'
import { getBusinessInfo, getPage, getServices } from '@/content/load'
import { labels } from '@/labels'
import { PAGE_KEY, ROUTES, type RouteKey } from '@/routes'
import { pageGraph, type Graph, type PageNodeType } from './jsonld'
import { buildMetadata, pageKeyMetadata } from './meta'

/* ------------------------------------------------------------------ */
/* The six singletons and the home page                                */
/* ------------------------------------------------------------------ */

/**
 * `AboutPage` and `ContactPage` are the only specialised page types the spec
 * allows. Everything else is a plain `WebPage`; the gallery is a
 * `CollectionPage`, handled below.
 */
const NODE_TYPE: Record<RouteKey, PageNodeType> = {
  home: 'WebPage',
  about: 'AboutPage',
  services: 'WebPage',
  gallery: 'CollectionPage',
  reviews: 'WebPage',
  contact: 'ContactPage',
  privacy: 'WebPage',
}

/** The routes whose page lists the services, so the catalogue is visible. */
const SHOWS_SERVICES: readonly RouteKey[] = ['home', 'services']

export function routeMetadata(route: RouteKey): () => Promise<Metadata> {
  return () => pageKeyMetadata(PAGE_KEY[route], ROUTES[route])
}

/** Home has no breadcrumbs on the page, so it gets no BreadcrumbList. */
function trailFor(route: RouteKey, heading: string): Crumb[] {
  if (route === 'home') return []
  return [
    { href: ROUTES.home, label: labels.nav.home },
    { href: ROUTES[route], label: heading },
  ]
}

export async function routeGraph(route: RouteKey): Promise<Graph> {
  const key = PAGE_KEY[route]
  const [business, page, services] = await Promise.all([
    getBusinessInfo(),
    getPage(key),
    SHOWS_SERVICES.includes(route) ? getServices() : Promise.resolve(undefined),
  ])
  const heading = page.h1 ?? labels.pageHeading[key]
  const trail = trailFor(route, heading)
  return pageGraph(business, {
    path: ROUTES[route],
    type: NODE_TYPE[route],
    name: heading,
    // Only the intro, because only the intro is on the page. A meta
    // description lives in a tag, not in the text a reader can see.
    ...(page.intro ? { description: page.intro } : {}),
    ...(trail.length > 0 ? { breadcrumbs: trail } : {}),
    ...(services ? { services } : {}),
  })
}

/* ------------------------------------------------------------------ */
/* Gallery tabs and their pages                                        */
/* ------------------------------------------------------------------ */

/**
 * A title for a gallery route, assembled from the page's sourced meta title,
 * the photo type's label, and the business name. Page one of the first tab is
 * the sourced title on its own.
 */
async function galleryTitle(slug: string, page: number): Promise<string> {
  const [doc, business, tabs] = await Promise.all([
    getPage('galleryPage'),
    getBusinessInfo(),
    getGalleryTabs(),
  ])
  if (slug === '' && page <= 1) return doc.metaTitle
  const tab = tabs.find((item) => item.slug === slug)
  const parts: string[] = [tab ? tab.label : (doc.h1 ?? labels.pageHeading.galleryPage)]
  if (page > 1) parts.push(`${labels.pagination.page} ${page}`)
  parts.push(business.name)
  return parts.join(' | ')
}

/** Each page of a list is its own canonical. No page points at page one. */
export function galleryMetadata(slug: string, page: number): () => Promise<Metadata> {
  return async () => {
    const [doc, title] = await Promise.all([getPage('galleryPage'), galleryTitle(slug, page)])
    return buildMetadata({
      path: galleryHref(slug, page),
      title,
      ...(doc.metaDescription ? { description: doc.metaDescription } : {}),
    })
  }
}

/** The same trail `GalleryView` renders. */
async function galleryTrail(slug: string): Promise<Crumb[]> {
  const [doc, tabs] = await Promise.all([getPage('galleryPage'), getGalleryTabs()])
  const heading = doc.h1 ?? labels.pageHeading.galleryPage
  const tab = tabs.find((item) => item.slug === slug)
  return [
    { href: ROUTES.home, label: labels.nav.home },
    { href: galleryHref(''), label: heading },
    ...(slug !== '' && tab ? [{ href: tab.href, label: tab.label }] : []),
  ]
}

export async function galleryGraph(slug: string, page: number): Promise<Graph | null> {
  const [business, doc, tabs, route, trail] = await Promise.all([
    getBusinessInfo(),
    getPage('galleryPage'),
    getGalleryTabs(),
    getGalleryRoute(slug, page),
    galleryTrail(slug),
  ])
  if (!route) return null
  const tab = tabs.find((item) => item.slug === slug)
  return pageGraph(business, {
    path: route.href,
    type: 'CollectionPage',
    name: tab ? tab.label : (doc.h1 ?? labels.pageHeading.galleryPage),
    ...(doc.intro ? { description: doc.intro } : {}),
    breadcrumbs: trail,
    photos: route.photos,
  })
}
