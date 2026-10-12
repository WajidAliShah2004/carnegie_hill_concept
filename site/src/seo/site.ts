/**
 * The one place that knows the site's own address.
 *
 * `SITE_URL` defaults to the production host. Every canonical, every `@id`,
 * every sitemap entry, and every Open Graph URL is built from here, so a
 * staging build never claims to be production.
 */

const raw = process.env.SITE_URL ?? 'https://www.carnegiehillframing.com'

/** No trailing slash, so `${SITE_URL}${path}` is always right. */
export const SITE_URL = raw.replace(/\/+$/, '')

/**
 * An absolute URL for a route path. Every path on this site starts and ends
 * with a slash (`trailingSlash: true`), the home page being just `/`.
 */
export function absUrl(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`
  const withTrailing = withLeading.endsWith('/') ? withLeading : `${withLeading}/`
  return `${SITE_URL}${withTrailing}`
}

/** The fixed identity of the shop. Reused so the entity carries over. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`
