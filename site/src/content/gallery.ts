/**
 * Every gallery route, with the photos on it.
 *
 * One place decides which tabs exist, which pages each tab has, and which
 * twelve photos sit on a page. The gallery pages render from this, and the
 * sitemap and the CollectionPage JSON-LD read the same list, so a route that
 * is not rendered is never listed either.
 *
 * A photo type with no photos produces no tab and no route.
 */

import { labels } from '@/labels'
import { getPhotos } from './load'
import { PHOTO_TYPES, type Photo, type PhotoType } from './types'

export const GALLERY_PAGE_SIZE = 12

export const GALLERY_ROOT = '/gallery/'

/** The first tab lives at the gallery root, so its slug is empty. */
const SLUGS: Record<PhotoType, string> = {
  completedWork: '',
  frameOptions: 'frame-options',
  matsGlassDisplay: 'mats-glass-display',
  theShop: 'the-shop',
}

export type GalleryTab = {
  type: PhotoType
  /** `''` for the tab that lives at `/gallery/`. */
  slug: string
  /** Page one of this tab. */
  href: string
  /** The photo type's label. Never a sentence. */
  label: string
  photos: Photo[]
  pageCount: number
}

export type GalleryRoute = {
  type: PhotoType
  slug: string
  /** 1-based. Page one lives at the tab root, never at `/page/1/`. */
  page: number
  pageCount: number
  href: string
  /** The photos on this page, at most `GALLERY_PAGE_SIZE`. */
  photos: Photo[]
}

/** `('', 1)` to `/gallery/`, `('the-shop', 2)` to `/gallery/the-shop/page/2/`. */
export function galleryHref(slug: string, page = 1): string {
  const base = slug === '' ? GALLERY_ROOT : `${GALLERY_ROOT}${slug}/`
  return page <= 1 ? base : `${base}page/${page}/`
}

export function gallerySlug(type: PhotoType): string {
  return SLUGS[type]
}

/** Only the tabs that have photos, in the fixed photo type order. */
export async function getGalleryTabs(): Promise<GalleryTab[]> {
  const photos = await getPhotos()
  return PHOTO_TYPES.map((type) => {
    const own = photos.filter((photo) => photo.type === type)
    const slug = SLUGS[type]
    return {
      type,
      slug,
      href: galleryHref(slug),
      label: labels.photoTypes[type],
      photos: own,
      pageCount: Math.max(1, Math.ceil(own.length / GALLERY_PAGE_SIZE)),
    }
  }).filter((tab) => tab.photos.length > 0)
}

/** Every gallery page that exists, in order. Page one first for each tab. */
export async function getGalleryRoutes(): Promise<GalleryRoute[]> {
  const tabs = await getGalleryTabs()
  return tabs.flatMap((tab) =>
    Array.from({ length: tab.pageCount }, (_unused, index) => {
      const page = index + 1
      return {
        type: tab.type,
        slug: tab.slug,
        page,
        pageCount: tab.pageCount,
        href: galleryHref(tab.slug, page),
        photos: tab.photos.slice((page - 1) * GALLERY_PAGE_SIZE, page * GALLERY_PAGE_SIZE),
      }
    }),
  )
}

/** One route, or null when that tab or page does not exist. */
export async function getGalleryRoute(slug: string, page = 1): Promise<GalleryRoute | null> {
  const routes = await getGalleryRoutes()
  return routes.find((route) => route.slug === slug && route.page === page) ?? null
}
