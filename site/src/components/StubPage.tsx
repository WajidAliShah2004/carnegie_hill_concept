import type { Metadata } from 'next'
import { getPage } from '@/content/load'
import { labels } from '@/labels'
import { PAGE_KEY, ROUTES, type RouteKey } from '@/routes'
import { Breadcrumbs } from './Breadcrumbs'
import { Section } from './Section'

/**
 * Placeholder for an interior page: the shell, breadcrumbs, and the page's
 * sourced h1. Another worker replaces the body of each of these. The
 * metadata factory and the breadcrumb trail are meant to be kept.
 */

export function pageMetadata(route: RouteKey): () => Promise<Metadata> {
  return async () => {
    const page = await getPage(PAGE_KEY[route])
    return {
      title: { absolute: page.metaTitle },
      ...(page.metaDescription ? { description: page.metaDescription } : {}),
      alternates: { canonical: ROUTES[route] },
    }
  }
}

export function trailFor(route: RouteKey, heading: string) {
  return [
    { href: ROUTES.home, label: labels.nav.home },
    { href: ROUTES[route], label: heading },
  ]
}

export async function StubPage({ route }: { route: RouteKey }) {
  const key = PAGE_KEY[route]
  const page = await getPage(key)
  const heading = page.h1 ?? labels.pageHeading[key]
  return (
    <main id="main">
      <Breadcrumbs trail={trailFor(route, heading)} />
      <Section tight>
        <div className="wrap">
          <h1>{heading}</h1>
          {page.intro ? <p className="lede">{page.intro}</p> : null}
        </div>
      </Section>
    </main>
  )
}
