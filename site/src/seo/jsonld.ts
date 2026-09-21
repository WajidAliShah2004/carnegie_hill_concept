/**
 * The one JSON-LD generator.
 *
 * Every page gets a single connected `@graph`, built from the same records the
 * page renders. Nothing is written here: every string value is either a field
 * the page shows, a URL, a schema.org type token, or a schema.org format value
 * (a 24 hour time, a day URL, a country code).
 *
 * Never emitted, and there is no code path that could emit them: `Review`,
 * `AggregateRating`, `FAQPage`, `ArtGallery`, `additionalType`, or any rating,
 * author, or date field we did not read off the source.
 */

import { time24 } from '@/components/BusinessFacts'
import type { Crumb } from '@/components/Breadcrumbs'
import { imageSources, type ImageSources } from '@/content/image'
import type { BusinessInfo, OpeningHours, Photo, Service } from '@/content/types'
import { altText } from '@/content/view'
import { ORGANIZATION_ID, SITE_URL, WEBSITE_ID, absUrl } from './site'

export type JsonLdNode = Record<string, unknown>

/**
 * Schema URLs have to be absolute. Sanity's CDN already gives an absolute one;
 * the reduced local copies used before the originals arrive do not.
 */
function absoluteImage(image: Parameters<typeof imageSources>[0]): ImageSources {
  const source = imageSources(image)
  if (/^https?:\/\//.test(source.src)) return source
  return { ...source, src: `${SITE_URL}${source.src}` }
}

export type Graph = {
  '@context': 'https://schema.org'
  '@graph': JsonLdNode[]
}

/** The four page node types the spec allows. Nothing else is ever emitted. */
export type PageNodeType = 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage'

export type PageGraphInput = {
  /** Route path, for example `/about/`. */
  path: string
  type: PageNodeType
  /** The page's visible h1. */
  name: string
  /**
   * Only ever a sentence the page itself shows, such as the intro. A meta
   * description is not visible text, so it never lands here.
   */
  description?: string
  /** The same trail the visible `Breadcrumbs` component is given. */
  breadcrumbs?: readonly Crumb[]
  /** Passed only on pages that actually list the services. */
  services?: readonly Service[]
  /** The gallery photos this page renders, in the order it renders them. */
  photos?: readonly Photo[]
}

/* ------------------------------------------------------------------ */
/* Opening hours                                                       */
/* ------------------------------------------------------------------ */

const DAY_URLS: Record<string, string> = {
  Monday: 'https://schema.org/Monday',
  Tuesday: 'https://schema.org/Tuesday',
  Wednesday: 'https://schema.org/Wednesday',
  Thursday: 'https://schema.org/Thursday',
  Friday: 'https://schema.org/Friday',
  Saturday: 'https://schema.org/Saturday',
  Sunday: 'https://schema.org/Sunday',
}

/**
 * Sunday never reaches the schema. The live site contradicts itself about it,
 * so it stays a visible note and nothing more.
 */
const SCHEMA_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function openingHours(hours: readonly OpeningHours[]): JsonLdNode[] {
  const rows: JsonLdNode[] = []
  for (const row of hours) {
    const days = (row.days ?? []).filter((day) => SCHEMA_DAYS.includes(day))
    if (days.length === 0) continue
    rows.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days.map((day) => DAY_URLS[day] as string),
      opens: time24(row.opens),
      closes: time24(row.closes),
    })
  }
  return rows
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

function offerCatalog(services: readonly Service[]): JsonLdNode | null {
  const published = services.filter((service) => service.title.trim() !== '')
  if (published.length === 0) return null
  return {
    '@type': 'OfferCatalog',
    itemListElement: published.map((service) => ({
      '@type': 'Service',
      '@id': `${absUrl('/services/')}#${service.anchor}`,
      name: service.title,
      url: `${absUrl('/services/')}#${service.anchor}`,
      ...(service.body ? { description: service.body } : {}),
    })),
  }
}

/**
 * The shop.
 *
 * `alternateName` is deliberately absent: the shorter name is not rendered
 * anywhere on the site, and schema may not say something the page does not.
 * `geo` and `foundingDate` stay absent until the owner confirms them.
 */
function storeNode(business: BusinessInfo, services?: readonly Service[]): JsonLdNode {
  const sameAs = business.socialLinks.filter((link) => link.confirmed).map((link) => link.url)
  const catalog = services ? offerCatalog(services) : null
  return {
    '@type': 'Store',
    '@id': ORGANIZATION_ID,
    name: business.name,
    url: `${SITE_URL}/`,
    telephone: business.phone,
    email: business.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.street,
      addressLocality: business.city,
      addressRegion: business.region,
      postalCode: business.postcode,
      addressCountry: business.country,
    },
    logo: absoluteImage(business.logo).src,
    image: absoluteImage(business.storefrontImage).src,
    ...(business.directionsUrl ? { hasMap: business.directionsUrl } : {}),
    openingHoursSpecification: openingHours(business.hours),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(business.geo ? { geo: { '@type': 'GeoCoordinates', latitude: business.geo.lat, longitude: business.geo.lng } } : {}),
    ...(business.foundingYear ? { foundingDate: String(business.foundingYear) } : {}),
    ...(catalog ? { hasOfferCatalog: catalog } : {}),
  }
}

function websiteNode(business: BusinessInfo): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: business.name,
    url: `${SITE_URL}/`,
    inLanguage: 'en',
    publisher: { '@id': ORGANIZATION_ID },
  }
}

/* ------------------------------------------------------------------ */
/* Page nodes                                                          */
/* ------------------------------------------------------------------ */

function breadcrumbNode(path: string, trail: readonly Crumb[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absUrl(path)}#breadcrumb`,
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: absUrl(crumb.href),
    })),
  }
}

/** `caption` only when the owner wrote one. Nothing else describes a photo. */
function imageNodes(path: string, photos: readonly Photo[]): JsonLdNode[] {
  return photos.map((photo) => {
    const source = absoluteImage(photo.image)
    return {
      '@type': 'ImageObject',
      '@id': `${absUrl(path)}#image-${photo.id}`,
      contentUrl: source.src,
      width: source.width,
      height: source.height,
      ...(photo.caption ? { caption: photo.caption } : {}),
      /** The alt rule already refuses to invent: caption, else the type label. */
      name: altText(photo),
    }
  })
}

function pageNode(input: PageGraphInput, images: JsonLdNode[]): JsonLdNode {
  const url = absUrl(input.path)
  return {
    '@type': input.type,
    '@id': `${url}#webpage`,
    url,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORGANIZATION_ID },
    ...(input.breadcrumbs && input.breadcrumbs.length > 0
      ? { breadcrumb: { '@id': `${url}#breadcrumb` } }
      : {}),
    ...(images.length > 0 ? { hasPart: images.map((node) => ({ '@id': node['@id'] })) } : {}),
  }
}

/* ------------------------------------------------------------------ */
/* The generator                                                       */
/* ------------------------------------------------------------------ */

/**
 * One connected graph for one page: the shop, the website, this page, its
 * breadcrumbs, and the images it shows.
 */
export function pageGraph(business: BusinessInfo, input: PageGraphInput): Graph {
  const images = input.photos ? imageNodes(input.path, input.photos) : []
  const graph: JsonLdNode[] = [
    storeNode(business, input.services),
    websiteNode(business),
    pageNode(input, images),
  ]
  if (input.breadcrumbs && input.breadcrumbs.length > 0) {
    graph.push(breadcrumbNode(input.path, input.breadcrumbs))
  }
  graph.push(...images)
  return { '@context': 'https://schema.org', '@graph': graph }
}

/**
 * Serialise for a `<script type="application/ld+json">`. `<` is escaped so a
 * value can never close the script element early.
 */
export function serialiseGraph(graph: Graph): string {
  return JSON.stringify(graph).replace(/</g, '\\u003c')
}
