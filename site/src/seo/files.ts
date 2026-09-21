/**
 * The three text files crawlers fetch: `sitemap.xml`, `robots.txt`, `llms.txt`.
 *
 * Each body is built here from content, so the route handlers that write them
 * into `out/` stay three lines long. Nothing here writes a sentence: `llms.txt`
 * is business facts, page titles, and service names, with interface words from
 * `labels.ts` as the field names.
 */

import { getGalleryTabs } from '@/content/gallery'
import { getBusinessInfo, getPage, getServices, isProduction } from '@/content/load'
import type { PageKey } from '@/content/types'
import { labels } from '@/labels'
import { ROUTES } from '@/routes'
import { indexableRoutes } from './routes'
import { SITE_URL, absUrl } from './site'

/* ------------------------------------------------------------------ */
/* sitemap.xml                                                         */
/* ------------------------------------------------------------------ */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function sitemapXml(): Promise<string> {
  const routes = await indexableRoutes()
  const entries = routes
    .map((route) => {
      const loc = `    <loc>${escapeXml(absUrl(route.path))}</loc>`
      const lastmod = route.lastmod ? `\n    <lastmod>${escapeXml(route.lastmod)}</lastmod>` : ''
      return `  <url>\n${loc}${lastmod}\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

/* ------------------------------------------------------------------ */
/* robots.txt                                                          */
/* ------------------------------------------------------------------ */

/**
 * Production allows every crawler, search and training alike, because nothing
 * private lives on the public host. Anything that is not production refuses
 * the lot, because staging must never be indexed.
 */
export function robotsTxt(): string {
  if (!isProduction) {
    return `User-agent: *\nDisallow: /\n`
  }
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
}

/* ------------------------------------------------------------------ */
/* llms.txt                                                            */
/* ------------------------------------------------------------------ */

const LLMS_PAGE_KEYS: readonly { key: PageKey; path: string }[] = [
  { key: 'homePage', path: ROUTES.home },
  { key: 'aboutPage', path: ROUTES.about },
  { key: 'servicesPage', path: ROUTES.services },
  { key: 'galleryPage', path: ROUTES.gallery },
  { key: 'reviewsPage', path: ROUTES.reviews },
  { key: 'contactPage', path: ROUTES.contact },
  { key: 'privacyPage', path: ROUTES.privacy },
]

export async function llmsTxt(): Promise<string> {
  const [business, pages, services, gallery] = await Promise.all([
    getBusinessInfo(),
    Promise.all(LLMS_PAGE_KEYS.map(async (entry) => ({ ...entry, page: await getPage(entry.key) }))),
    getServices(),
    getGalleryTabs(),
  ])

  const address = `${business.street}, ${business.city}, ${business.region} ${business.postcode}`
  const hours = business.hours.map((row) => {
    const first = row.days[0]
    const last = row.days[row.days.length - 1]
    const days = first === last || last === undefined ? first : `${first} ${labels.facts.to} ${last}`
    return `${days}, ${row.opens} ${labels.facts.to} ${row.closes}`
  })

  const lines: string[] = [`# ${business.name}`, '', `${SITE_URL}/`, '']

  lines.push(`- ${labels.facts.address}: ${address}`)
  if (business.crossStreets) lines.push(`- ${business.crossStreets}`)
  lines.push(`- ${labels.facts.phone}: ${business.phoneDisplay}`)
  lines.push(`- ${labels.facts.email}: ${business.email}`)
  for (const row of hours) lines.push(`- ${labels.facts.hours}: ${row}`)
  lines.push(`- ${business.sundayNote}`)

  lines.push('', `## ${labels.footer.pages}`, '')
  for (const entry of pages) {
    lines.push(`- [${entry.page.metaTitle}](${absUrl(entry.path)})`)
  }
  for (const tab of gallery) {
    if (tab.href === ROUTES.gallery) continue
    lines.push(`- [${tab.label}](${absUrl(tab.href)})`)
  }

  if (services.length > 0) {
    lines.push('', `## ${labels.nav.services}`, '')
    for (const service of services) {
      lines.push(`- ${service.title}`)
    }
  }

  return `${lines.join('\n')}\n`
}
