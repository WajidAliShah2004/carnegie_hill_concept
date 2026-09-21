/**
 * Content types shared by the Sanity path and the seed path.
 *
 * Two shapes exist for every document:
 *   - a `Raw*` type: exactly what Sanity (or `content/seed/*.json`) holds,
 *     including the private `source` on every statement.
 *   - a plain type: what `load.ts` returns to pages and components, with
 *     every `Sourced` value collapsed to a `string`. `source` never leaves
 *     this folder, so it cannot reach the HTML or `out/`.
 */

/* ------------------------------------------------------------------ */
/* Sourced text                                                        */
/* ------------------------------------------------------------------ */

export type SourceKind = 'liveSite' | 'ownerWritten' | 'reviewUrl' | 'observedInPhoto'

/** `detail` is the page, date, link, or photo name the text came from. */
export type Source = { kind: SourceKind; detail: string }

export type Sourced = { text: string; source: Source }

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

/**
 * A reduced copy in the repo's `/assets` folder, used only until the
 * originals arrive from the WordPress media library. A production build
 * refuses to ship one.
 */
export type LocalImage = {
  _type: 'localImage'
  path: string
  width: number
  height: number
}

/** A Sanity image asset reference, resolved through `cdn.sanity.io`. */
export type SanityImage = {
  _type: 'image'
  asset: { _ref: string; url?: string }
  hotspot?: { x: number; y: number }
  metadata?: { dimensions: { width: number; height: number } }
}

export type ContentImage = LocalImage | SanityImage

export function isLocalImage(image: ContentImage): image is LocalImage {
  return image._type === 'localImage'
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export const PHOTO_TYPES = ['completedWork', 'frameOptions', 'matsGlassDisplay', 'theShop'] as const
export type PhotoType = (typeof PHOTO_TYPES)[number]

/**
 * Sanity's own last-published timestamp, used for a true `lastmod` in the
 * sitemap. The seed files have none, so `lastmod` is left out rather than
 * filled with today's date.
 */
export type Timestamped = { _updatedAt?: string | null }

/**
 * Drag-to-sort order.
 *
 * The Studio uses `@sanity/orderable-document-list`, which is the free way to
 * give the owner drag ordering, and that plugin hardcodes a string field named
 * `orderRank` sorted lexicographically. The seed files predate it and carry a
 * numeric `order`. Both are read; the Sanity path sorts on `orderRank`.
 */
export type Ordered = { order?: number | null; orderRank?: string | null }

export type RawPhoto = Timestamped &
  Ordered & {
    _id: string
    _type: 'photo'
    image: ContentImage
    type: PhotoType
    caption?: Sourced | null
    onHomeSlider: boolean
  }

export type Photo = {
  id: string
  image: ContentImage
  type: PhotoType
  /** The owner's caption, when he wrote one. Never generated. */
  caption?: string
  onHomeSlider: boolean
  order: number
  /** Present only when the CMS supplied one. */
  updatedAt?: string
}

export type Platform = 'google' | 'yelp' | 'other'

export type RawReview = Timestamped &
  Ordered & {
    _id: string
    _type: 'review'
    quote: Sourced
    displayName: string
    platform: Platform
    /** Empty until we have per-review links. No rating field exists anywhere. */
    sourceUrl: string
    date?: string | null
    featured: boolean
  }

export type Review = {
  id: string
  quote: string
  displayName: string
  platform: Platform
  sourceUrl?: string
  date?: string
  featured: boolean
  order: number
}

export type SocialPlatform = 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'youtube' | 'other'

export type RawSocialPost = Timestamped &
  Ordered & {
    _id: string
    _type: 'socialPost'
    url: string
    caption?: Sourced | null
    featured: boolean
  }

export type SocialPost = {
  id: string
  url: string
  /** Derived from the url, never typed by hand. */
  platform: SocialPlatform
  caption?: string
  featured: boolean
  order: number
}

export type RawService = Timestamped &
  Ordered & {
    _id: string
    _type: 'service'
    title: Sourced
    anchor: string
    body?: Sourced | null
    image?: ContentImage | null
    galleryType?: PhotoType | null
  }

export type Service = {
  id: string
  title: string
  anchor: string
  body?: string
  image?: ContentImage
  galleryType?: PhotoType
  order: number
}

export type OpeningHours = { days: string[]; opens: string; closes: string }

export type SocialLink = { platform: SocialPlatform; url: string; confirmed: boolean }

export type RawBusinessInfo = {
  _id: string
  _type: 'businessInfo'
  name: string
  alternateName?: string
  street: string
  crossStreets?: string
  city: string
  region: string
  postcode: string
  country: string
  phone: string
  /** Display form of the phone, as the live site writes it. */
  phoneDisplay: string
  email: string
  hours: OpeningHours[]
  /** Live site wording. Never "open 7 days a week". */
  sundayNote: Sourced
  appointmentNote: Sourced
  directionsUrl: string
  googleReviewsUrl?: string
  googleWriteReviewUrl?: string
  yelpUrl?: string
  socialLinks: SocialLink[]
  logo: ContentImage
  storefrontImage: ContentImage
  shareImage?: ContentImage | null
  geo?: { lat: number; lng: number } | null
  foundingYear?: number | null
}

export type BusinessInfo = Omit<RawBusinessInfo, '_id' | '_type' | 'sundayNote' | 'appointmentNote'> & {
  sundayNote: string
  appointmentNote: string
}

export type PageKey =
  | 'homePage'
  | 'aboutPage'
  | 'servicesPage'
  | 'galleryPage'
  | 'reviewsPage'
  | 'contactPage'
  | 'privacyPage'

export type RawPageSection = { key: string; heading?: Sourced | null; paragraphs: Sourced[] }
export type PageSection = { key: string; heading?: string; paragraphs: string[] }

export type RawPage = Timestamped & {
  _id: string
  _type: PageKey
  /**
   * Omitted when no sourced wording exists. The page then falls back to the
   * matching key in `labels.pageHeading`, which is an interface word, not a
   * statement about the business.
   */
  h1?: Sourced | null
  intro?: Sourced | null
  metaTitle: Sourced
  metaDescription?: Sourced | null
  sections: RawPageSection[]
}

export type Page = {
  key: PageKey
  h1?: string
  intro?: string
  metaTitle: string
  metaDescription?: string
  sections: PageSection[]
  /** Present only when the CMS supplied one. Used for a true sitemap lastmod. */
  updatedAt?: string
}
