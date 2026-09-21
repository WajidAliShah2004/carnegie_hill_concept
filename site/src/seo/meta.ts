/**
 * Titles, descriptions, canonicals, and share tags.
 *
 * Nothing here writes a sentence. A title is the page's sourced `metaTitle`, a
 * description its sourced `metaDescription`. Where a separator is needed it is
 * a character, never a new clause.
 *
 * `og:type` is `website` on every page. The old WordPress site wrongly used
 * `article` on interior pages.
 */

import type { Metadata } from 'next'
import { getBusinessInfo, getPage, isProduction } from '@/content/load'
import { imageSources } from '@/content/image'
import type { PageKey } from '@/content/types'
import { absUrl } from './site'

export type PageMetaInput = {
  /** Route path, for example `/gallery/frame-options/page/2/`. */
  path: string
  /** The page's sourced meta title. */
  title: string
  /** The page's sourced meta description, when one exists. */
  description?: string
  /**
   * A canonical different from `path`. Paginated gallery pages do not use it:
   * each page of a list is its own canonical.
   */
  canonical?: string
}

/** Staging and development must never be indexed. */
const robots = isProduction ? undefined : { index: false, follow: false, nocache: true }

export async function buildMetadata(input: PageMetaInput): Promise<Metadata> {
  const business = await getBusinessInfo()
  const url = absUrl(input.canonical ?? input.path)
  const share = business.shareImage ? imageSources(business.shareImage) : null

  /**
   * A page with no approved sentence gets no description at all. The root
   * layout deliberately sets none, so nothing is inherited into the gap.
   */
  const description = input.description

  return {
    title: { absolute: input.title },
    ...(description ? { description } : {}),
    alternates: { canonical: url },
    ...(robots ? { robots } : {}),
    openGraph: {
      type: 'website',
      title: input.title,
      ...(description ? { description } : {}),
      url,
      siteName: business.name,
      locale: 'en_US',
      ...(share
        ? { images: [{ url: share.src, width: share.width, height: share.height }] }
        : {}),
    },
    twitter: {
      card: share ? 'summary_large_image' : 'summary',
      title: input.title,
      ...(description ? { description } : {}),
      ...(share ? { images: [share.src] } : {}),
    },
  }
}

/**
 * Metadata for one of the seven page singletons at its own route.
 * `path` defaults to the route the page key belongs to.
 */
export async function pageKeyMetadata(key: PageKey, path: string): Promise<Metadata> {
  const page = await getPage(key)
  return buildMetadata({
    path,
    title: page.metaTitle,
    ...(page.metaDescription ? { description: page.metaDescription } : {}),
  })
}
