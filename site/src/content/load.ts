/**
 * The one way to read content.
 *
 * When `SANITY_PROJECT_ID` is set the getters query Sanity with GROQ, published
 * perspective, CDN off, at build time only. Otherwise they read
 * `content/seed/*.json`. Both paths return the same types, so everything builds
 * and every check passes from the seed alone, before a Sanity project exists.
 *
 * Every getter is memoised for the life of the build, so one build makes at
 * most one request per document type.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { optionalText, text, textList } from './sourced'
import type {
  BusinessInfo,
  Ordered,
  Page,
  PageKey,
  Photo,
  PhotoType,
  RawBusinessInfo,
  RawPage,
  RawPhoto,
  RawReview,
  RawService,
  RawSocialPost,
  Review,
  Service,
  SocialPlatform,
  SocialPost,
} from './types'

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

const projectId = process.env.SANITY_PROJECT_ID ?? ''
const dataset = process.env.SANITY_DATASET ?? 'production'
const readToken = process.env.SANITY_READ_TOKEN
const apiVersion = '2024-10-01'

export const usingSanity = projectId !== ''
export const deployEnv = process.env.DEPLOY_ENV ?? 'development'
export const isProduction = deployEnv === 'production'

/** Staging can preview links the owner has not confirmed yet. Default hidden. */
export const showUnconfirmed = process.env.SHOW_UNCONFIRMED === '1'

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

const SEED_DIR = join(process.cwd(), 'content', 'seed')

function readSeed<T>(file: string): T {
  return JSON.parse(readFileSync(join(SEED_DIR, `${file}.json`), 'utf8')) as T
}

type SanityClient = { fetch: <T>(query: string, params?: Record<string, unknown>) => Promise<T> }
let client: SanityClient | null = null

async function sanity(): Promise<SanityClient> {
  if (client) return client
  const { createClient } = await import('@sanity/client')
  client = createClient({
    projectId,
    dataset,
    apiVersion,
    token: readToken,
    useCdn: false,
    perspective: 'published',
  }) as unknown as SanityClient
  return client
}

const IMAGE_PROJECTION = `{
  _type,
  hotspot,
  "asset": asset->{ _ref, url },
  "metadata": asset->{ "dimensions": metadata.dimensions }
}`

/**
 * Drag ordering in the Studio comes from `@sanity/orderable-document-list`,
 * the free plugin, and that plugin hardcodes a string field called `orderRank`
 * that sorts lexicographically. So the Sanity path orders on `orderRank` and
 * the seed files, which predate the Studio, keep their numeric `order`.
 * `_createdAt` breaks ties for documents saved before a first drag.
 */
const ORDER_RANK = `| order(orderRank asc, _createdAt asc)`

export const QUERIES = {
  photos: `*[_type == "photo" && defined(image)] ${ORDER_RANK} {
    _id, _type, _updatedAt, type, caption, onHomeSlider, orderRank, standIn, "image": image ${IMAGE_PROJECTION}
  }`,
  reviews: `*[_type == "review"] ${ORDER_RANK} {
    _id, _type, _updatedAt, quote, displayName, platform, sourceUrl, date, featured, orderRank
  }`,
  socialPosts: `*[_type == "socialPost"] ${ORDER_RANK} {
    _id, _type, _updatedAt, url, caption, featured, orderRank
  }`,
  services: `*[_type == "service"] ${ORDER_RANK} {
    _id, _type, _updatedAt, title, anchor, body, galleryType, orderRank, "image": image ${IMAGE_PROJECTION}
  }`,
  businessInfo: `*[_type == "businessInfo"][0] {
    ...,
    "logo": logo ${IMAGE_PROJECTION},
    "storefrontImage": storefrontImage ${IMAGE_PROJECTION},
    "shareImage": shareImage ${IMAGE_PROJECTION}
  }`,
  page: `*[_type == $pageKey][0] { ... }`,
} as const

/**
 * Put raw documents in the order the site shows them.
 *
 * Sanity has already sorted by `orderRank`, so that order is kept as it is.
 * The seed path sorts on its numeric `order`. Either way the position in this
 * list becomes the `order` the site works with, so nothing downstream has to
 * know which field the ordering came from.
 */
function inOrder<T extends Ordered>(docs: readonly T[]): T[] {
  if (usingSanity) return [...docs]
  return [...docs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** `_updatedAt` when the CMS gave one. Never a made-up date. */
function updatedAt(doc: { _updatedAt?: string | null }): { updatedAt?: string } {
  return doc._updatedAt ? { updatedAt: doc._updatedAt } : {}
}

async function load<T>(seedFile: string, query: string, params?: Record<string, unknown>): Promise<T> {
  if (!usingSanity) return readSeed<T>(seedFile)
  const c = await sanity()
  return c.fetch<T>(query, params)
}

function memo<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null
  return () => (pending ??= fn())
}

/* ------------------------------------------------------------------ */
/* Photos                                                             */
/* ------------------------------------------------------------------ */

export const getPhotos = memo(async (): Promise<Photo[]> => {
  const raw = await load<RawPhoto[]>('photos', QUERIES.photos)
  // Stand-ins are the reduced copies put into Sanity for testing, and they
  // never ship. studio/scripts/stand-in-photos.mjs --remove takes them out.
  const standIns = raw.filter((doc) => doc.standIn)
  if (isProduction && standIns.length > 0) {
    throw new Error(
      `${standIns.length} photo(s) in Sanity are stand-in copies, not originals. ` +
        'Upload the originals, then run `npx sanity exec scripts/stand-in-photos.mjs --with-user-token -- --remove` in studio/.',
    )
  }
  return inOrder(raw).map((doc, index) => ({
    id: doc._id,
    image: doc.image,
    type: doc.type,
    caption: optionalText(doc.caption, doc._id, 'caption'),
    onHomeSlider: Boolean(doc.onHomeSlider),
    order: index + 1,
    ...updatedAt(doc),
  }))
})

export async function getPhotosByType(type: PhotoType): Promise<Photo[]> {
  return (await getPhotos()).filter((photo) => photo.type === type)
}

export async function getHomeSliderPhotos(): Promise<Photo[]> {
  return (await getPhotos()).filter((photo) => photo.onHomeSlider)
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

/**
 * We have no per-review links yet, and we will not invent one. A review with
 * no `sourceUrl` still renders in development and on staging, without a link.
 * A production build leaves it out entirely until the links arrive.
 */
export const getReviews = memo(async (): Promise<Review[]> => {
  const raw = await load<RawReview[]>('reviews', QUERIES.reviews)
  return inOrder(raw)
    .map((doc, index) => ({
      id: doc._id,
      quote: text(doc.quote, doc._id, 'quote'),
      displayName: doc.displayName,
      platform: doc.platform,
      sourceUrl: doc.sourceUrl?.trim() ? doc.sourceUrl.trim() : undefined,
      date: doc.date?.trim() ? doc.date.trim() : undefined,
      featured: Boolean(doc.featured),
      order: index + 1,
    }))
    .filter((review) => (isProduction ? Boolean(review.sourceUrl) : true))
})

export async function getFeaturedReviews(): Promise<Review[]> {
  return (await getReviews()).filter((review) => review.featured)
}

/* ------------------------------------------------------------------ */
/* Social posts                                                        */
/* ------------------------------------------------------------------ */

/** A video file that ships with the site: `/video/name.mp4`, poster beside it. */
const OWN_VIDEO = /^\/video\/[a-z0-9-]+\.mp4$/

export function platformFromUrl(url: string): SocialPlatform {
  if (OWN_VIDEO.test(url)) return 'video'
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    } catch {
      return ''
    }
  })()
  if (host.endsWith('instagram.com')) return 'instagram'
  if (host.endsWith('facebook.com') || host.endsWith('fb.com')) return 'facebook'
  if (host.endsWith('twitter.com') || host.endsWith('x.com')) return 'twitter'
  if (host.endsWith('linkedin.com')) return 'linkedin'
  if (host.endsWith('youtube.com') || host.endsWith('youtu.be')) return 'youtube'
  return 'other'
}

export const getSocialPosts = memo(async (): Promise<SocialPost[]> => {
  const raw = await load<RawSocialPost[]>('socialPosts', QUERIES.socialPosts)
  return inOrder(raw).map((doc, index) => ({
    id: doc._id,
    url: doc.url,
    platform: platformFromUrl(doc.url),
    caption: optionalText(doc.caption, doc._id, 'caption'),
    featured: Boolean(doc.featured),
    order: index + 1,
  }))
})

export async function getFeaturedSocialPosts(): Promise<SocialPost[]> {
  return (await getSocialPosts()).filter((post) => post.featured)
}

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

export const getServices = memo(async (): Promise<Service[]> => {
  const raw = await load<RawService[]>('services', QUERIES.services)
  return inOrder(raw).map((doc, index) => ({
    id: doc._id,
    title: text(doc.title, doc._id, 'title'),
    anchor: doc.anchor,
    body: optionalText(doc.body, doc._id, 'body'),
    image: doc.image ?? undefined,
    galleryType: doc.galleryType ?? undefined,
    order: index + 1,
  }))
})

/* ------------------------------------------------------------------ */
/* Business info                                                       */
/* ------------------------------------------------------------------ */

/**
 * Every page needs the logo and the shop front photo, but the Studio leaves
 * them optional so the business facts can be published before the original
 * photos arrive. Until then a staging build shows the seed's reduced copy and
 * says so. A production build stops, because the reduced copies never ship.
 */
const REQUIRED_IMAGES = ['logo', 'storefrontImage'] as const

function withRequiredImages(doc: RawBusinessInfo): RawBusinessInfo {
  const missing = REQUIRED_IMAGES.filter((field) => !doc[field])
  if (missing.length === 0) return doc
  if (isProduction) {
    throw new Error(
      `Business info in Sanity has no ${missing.join(' and no ')}. ` +
        'Upload the original in the Studio: Business info, Pictures.',
    )
  }
  const seed = readSeed<RawBusinessInfo>('businessInfo')
  const filled = { ...doc }
  for (const field of missing) {
    console.warn(`Business info in Sanity has no ${field}. Using the reduced copy from the seed.`)
    filled[field] = seed[field]
  }
  return filled
}

export const getBusinessInfo = memo(async (): Promise<BusinessInfo> => {
  const doc = withRequiredImages(await load<RawBusinessInfo>('businessInfo', QUERIES.businessInfo))
  const { _id, _type, sundayNote, appointmentNote, ...rest } = doc
  void _type
  return {
    ...rest,
    sundayNote: text(sundayNote, _id, 'sundayNote'),
    appointmentNote: text(appointmentNote, _id, 'appointmentNote'),
    socialLinks: (rest.socialLinks ?? []).filter((link) => link.confirmed || showUnconfirmed),
  }
})

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

const pageCache = new Map<PageKey, Promise<Page>>()

export function getPage(key: PageKey): Promise<Page> {
  const cached = pageCache.get(key)
  if (cached) return cached
  const pending = (async (): Promise<Page> => {
    const doc = await load<RawPage>(`pages/${key}`, QUERIES.page, { pageKey: key })
    return {
      key,
      ...updatedAt(doc),
      h1: optionalText(doc.h1, doc._id, 'h1'),
      intro: optionalText(doc.intro, doc._id, 'intro'),
      metaTitle: text(doc.metaTitle, doc._id, 'metaTitle'),
      metaDescription: optionalText(doc.metaDescription, doc._id, 'metaDescription'),
      sections: (doc.sections ?? []).map((section) => ({
        key: section.key,
        heading: optionalText(section.heading, doc._id, `sections.${section.key}.heading`),
        paragraphs: textList(section.paragraphs, doc._id, `sections.${section.key}.paragraphs`),
      })),
    }
  })()
  pageCache.set(key, pending)
  return pending
}
