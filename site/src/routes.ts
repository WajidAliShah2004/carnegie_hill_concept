/** Every route the shell links to. Interior pages are added by other workers. */

import type { PageKey } from '@/content/types'

export type RouteKey = 'home' | 'about' | 'services' | 'gallery' | 'reviews' | 'contact' | 'privacy'

export const ROUTES: Record<RouteKey, string> = {
  home: '/',
  about: '/about/',
  services: '/services/',
  gallery: '/gallery/',
  reviews: '/reviews/',
  contact: '/contact/',
  privacy: '/privacy/',
}

/** The six links in the header and the footer, in order. */
export const NAV_ITEMS: readonly { key: RouteKey; href: string }[] = (
  ['home', 'about', 'services', 'gallery', 'reviews', 'contact'] as const
).map((key) => ({ key, href: ROUTES[key] }))

export const PAGE_KEY: Record<RouteKey, PageKey> = {
  home: 'homePage',
  about: 'aboutPage',
  services: 'servicesPage',
  gallery: 'galleryPage',
  reviews: 'reviewsPage',
  contact: 'contactPage',
  privacy: 'privacyPage',
}
