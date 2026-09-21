/**
 * One `<script type="application/ld+json">` per page. Server only, so the
 * graph is in the initial HTML for the crawlers that do not run scripts.
 *
 * The serialiser escapes `<`, so no content value can close the script early.
 */

import { serialiseGraph, type Graph } from './jsonld'
import { galleryGraph, routeGraph } from './pages'
import type { RouteKey } from '@/routes'

export function JsonLd({ graph }: { graph: Graph }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseGraph(graph) }} />
  )
}

/** The graph for one of the seven fixed routes. */
export async function PageJsonLd({ route }: { route: RouteKey }) {
  return <JsonLd graph={await routeGraph(route)} />
}

/** The graph for one gallery tab and page. Nothing when that route is empty. */
export async function GalleryJsonLd({ slug, page }: { slug: string; page: number }) {
  const graph = await galleryGraph(slug, page)
  if (!graph) return null
  return <JsonLd graph={graph} />
}
