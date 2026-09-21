import type { Metadata } from 'next'
import { getGalleryRoutes } from '@/content/gallery'
import { GalleryView } from '@/components/GalleryView'
import { GalleryJsonLd } from '@/seo/JsonLdScript'
import { galleryMetadata } from '@/seo/pages'

/**
 * Every gallery URL in one place: `/gallery/`, `/gallery/page/2/`,
 * `/gallery/<tab>/`, and `/gallery/<tab>/page/2/`.
 *
 * One route rather than four, because a static export needs every dynamic
 * route to produce at least one page, and a tab only has a second page once
 * the owner has uploaded a thirteenth photo of that type. Splitting these
 * apart makes the build fail on the day a tab is short, and makes page two
 * of a tab unreachable until someone remembers to add the folder back.
 */

type Params = { parts?: string[] }

/** `['the-shop', 'page', '2']` to the tab slug and the page number. */
function read(parts: readonly string[] | undefined): { slug: string; page: number } {
  const path = parts ?? []
  if (path.length === 0) return { slug: '', page: 1 }
  if (path[0] === 'page') return { slug: '', page: Number(path[1]) }
  if (path[1] === 'page') return { slug: path[0] as string, page: Number(path[2]) }
  return { slug: path[0] as string, page: 1 }
}

function write(slug: string, page: number): string[] {
  const parts: string[] = []
  if (slug !== '') parts.push(slug)
  if (page > 1) parts.push('page', String(page))
  return parts
}

export async function generateStaticParams(): Promise<Params[]> {
  const routes = await getGalleryRoutes()
  const params = routes.map((route) => ({ parts: write(route.slug, route.page) }))
  // The gallery root exists even before a single photo does.
  return params.some((entry) => entry.parts.length === 0) ? params : [{ parts: [] }, ...params]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug, page } = read((await params).parts)
  return galleryMetadata(slug, page)()
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug, page } = read((await params).parts)
  return (
    <>
      <GalleryJsonLd slug={slug} page={page} />
      <GalleryView slug={slug} page={page} />
    </>
  )
}
