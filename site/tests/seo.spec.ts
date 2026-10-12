/**
 * The search, answer engine, and AI indexing checks.
 *
 * They run against the exported files in `out/`, served the way a static host
 * serves them. Build first.
 *
 * The rule the whole suite exists for: schema may never say something the page
 * does not. Every string in the graph is either on the page, a URL, or a
 * schema.org format value.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const OUT = resolve(process.cwd(), 'out')

/* ------------------------------------------------------------------ */
/* Which pages exist                                                   */
/* ------------------------------------------------------------------ */

function builtPages(): string[] {
  const found: string[] = []
  const walk = (dir: string, route: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('_') || entry === 'dev-assets' || entry === '404') continue
      const full = join(dir, entry)
      if (!statSync(full).isDirectory()) continue
      walk(full, `${route}${entry}/`)
    }
    try {
      if (statSync(join(dir, 'index.html')).isFile()) found.push(route)
    } catch {
      /* no page at this level */
    }
  }
  walk(OUT, '/')
  return found.sort()
}

/** A redirect stub is a page only in the sense that a host had to put a file there. */
function isRedirectStub(route: string): boolean {
  const html = readFileSync(join(OUT, route.slice(1), 'index.html'), 'utf8')
  return html.includes('http-equiv="refresh"')
}

const ALL_PAGES = builtPages()
const CONTENT_PAGES = ALL_PAGES.filter((route) => !isRedirectStub(route))

test('the export contains the pages this check expects', () => {
  expect(CONTENT_PAGES).toContain('/')
  expect(CONTENT_PAGES).toContain('/contact/')
  expect(CONTENT_PAGES.length).toBeGreaterThanOrEqual(7)
})

/* ------------------------------------------------------------------ */
/* What counts as visible                                              */
/* ------------------------------------------------------------------ */

const NORMALISE = (value: string) => value.replace(/\s+/g, ' ').trim()

/**
 * Everything a reader or an assistive technology can reach: the text, plus the
 * attributes the zero-invention check in the spec also reads.
 */
async function visibleText(page: Page): Promise<string[]> {
  const parts = await page.evaluate(() => {
    const collected: string[] = [document.body.innerText]
    const attributes = ['alt', 'aria-label', 'title', 'datetime', 'href', 'src', 'content']
    for (const element of Array.from(document.querySelectorAll('*'))) {
      for (const name of attributes) {
        const value = element.getAttribute(name)
        if (value) collected.push(value)
      }
    }
    return collected
  })
  return parts.map(NORMALISE)
}

const URL_LIKE = /^(https?:\/\/|tel:|mailto:|\/)/
const TIME_24 = /^([01]\d|2[0-3]):[0-5]\d$/
const COUNTRY = /^[A-Z]{2}$/
const YEAR = /^\d{4}$/

/** Keys whose values are identifiers or type tokens, never prose. */
const TOKEN_KEYS = new Set(['@type', '@id', '@context', 'inLanguage'])

function stringValues(node: unknown, key = ''): { key: string; value: string }[] {
  if (typeof node === 'string') return [{ key, value: node }]
  if (Array.isArray(node)) return node.flatMap((item) => stringValues(item, key))
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([name, value]) => stringValues(value, name))
  }
  return []
}

/* ------------------------------------------------------------------ */
/* Reading the graph                                                   */
/* ------------------------------------------------------------------ */

async function graphOf(page: Page): Promise<Record<string, unknown>[]> {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
  expect(scripts, 'exactly one JSON-LD script per page').toHaveLength(1)
  const parsed = JSON.parse(scripts[0] as string) as {
    '@context': string
    '@graph': Record<string, unknown>[]
  }
  expect(parsed['@context']).toBe('https://schema.org')
  expect(Array.isArray(parsed['@graph'])).toBe(true)
  return parsed['@graph']
}

/* ------------------------------------------------------------------ */
/* Per page                                                            */
/* ------------------------------------------------------------------ */

const FORBIDDEN = [
  'Review',
  'AggregateRating',
  'FAQPage',
  'ArtGallery',
  'additionalType',
  'ratingValue',
  'reviewRating',
  'bestRating',
]

for (const route of CONTENT_PAGES) {
  test(`${route} has one h1, one canonical, a title, and one graph`, async ({ page }) => {
    await page.goto(route)

    await expect(page.locator('h1')).toHaveCount(1)
    expect(NORMALISE(await page.title())).not.toBe('')

    const canonical = page.locator('link[rel="canonical"]')
    await expect(canonical).toHaveCount(1)
    const href = await canonical.getAttribute('href')
    expect(href).toBe(`https://www.carnegiehillframing.com${route}`)

    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')

    await graphOf(page)
  })

  test(`${route} carries the shop, the website, and one page node`, async ({ page }) => {
    await page.goto(route)
    const graph = await graphOf(page)

    const store = graph.find((node) => node['@type'] === 'Store')
    expect(store, 'a Store node').toBeTruthy()
    expect(store?.['@id']).toBe('https://www.carnegiehillframing.com/#organization')
    for (const field of ['name', 'url', 'telephone', 'email', 'address', 'openingHoursSpecification']) {
      expect(store?.[field], `Store.${field}`).toBeTruthy()
    }
    const address = store?.address as Record<string, string>
    for (const field of ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry']) {
      expect(address[field], `PostalAddress.${field}`).toBeTruthy()
    }

    const hours = store?.openingHoursSpecification as { dayOfWeek: string[] }[]
    const days = new Set(hours.flatMap((row) => row.dayOfWeek))
    expect(days.size, 'Monday to Saturday, and never Sunday').toBe(6)
    expect(days.has('https://schema.org/Sunday')).toBe(false)

    const website = graph.find((node) => node['@type'] === 'WebSite')
    expect(website?.publisher).toEqual({ '@id': 'https://www.carnegiehillframing.com/#organization' })

    const pageNodes = graph.filter((node) =>
      ['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage'].includes(String(node['@type'])),
    )
    expect(pageNodes, 'one page node').toHaveLength(1)
    expect(pageNodes[0]?.url).toBe(`https://www.carnegiehillframing.com${route}`)
    expect(pageNodes[0]?.isPartOf).toEqual({ '@id': 'https://www.carnegiehillframing.com/#website' })
    expect(pageNodes[0]?.about).toEqual({ '@id': 'https://www.carnegiehillframing.com/#organization' })
  })

  test(`${route} emits none of the forbidden schema`, async ({ page }) => {
    await page.goto(route)
    const raw = (await page.locator('script[type="application/ld+json"]').allTextContents()).join('')
    for (const banned of FORBIDDEN) {
      expect(raw, `${banned} must never be emitted`).not.toContain(banned)
    }
  })

  test(`${route} says nothing in schema that the page does not show`, async ({ page }) => {
    await page.goto(route)
    const graph = await graphOf(page)
    const shown = await visibleText(page)

    const unseen: string[] = []
    for (const { key, value } of stringValues(graph)) {
      if (TOKEN_KEYS.has(key)) continue
      const trimmed = value.trim()
      if (trimmed === '') continue
      if (URL_LIKE.test(trimmed) || TIME_24.test(trimmed) || COUNTRY.test(trimmed) || YEAR.test(trimmed)) {
        continue
      }
      const wanted = NORMALISE(trimmed)
      if (!shown.some((part) => part.includes(wanted))) unseen.push(`${key}: ${trimmed}`)
    }
    expect(unseen, 'schema values that are not on the page').toEqual([])
  })

  test(`${route} matches its visible breadcrumbs`, async ({ page }) => {
    await page.goto(route)
    const graph = await graphOf(page)
    const list = graph.find((node) => node['@type'] === 'BreadcrumbList') as
      | { itemListElement: { position: number; name: string; item: string }[] }
      | undefined

    const crumbs = await page.locator('nav[aria-label="Breadcrumb"] li').allTextContents()
    if (crumbs.length === 0) {
      expect(list, 'no visible breadcrumbs, so no BreadcrumbList').toBeUndefined()
      return
    }
    expect(list, 'visible breadcrumbs, so a BreadcrumbList').toBeTruthy()
    expect(list?.itemListElement.map((item) => item.name)).toEqual(crumbs.map(NORMALISE))
    expect(list?.itemListElement.map((item) => item.position)).toEqual(
      crumbs.map((_unused, index) => index + 1),
    )
  })
}

/* ------------------------------------------------------------------ */
/* The three files                                                     */
/* ------------------------------------------------------------------ */

test('robots.txt is served and says what this environment should say', async ({ request }) => {
  const response = await request.get('/robots.txt')
  expect(response.status()).toBe(200)
  const body = await response.text()
  expect(body).toContain('User-agent: *')
  if (process.env.DEPLOY_ENV === 'production') {
    expect(body).toContain('Allow: /')
    expect(body).toContain('Sitemap: https://www.carnegiehillframing.com/sitemap.xml')
    expect(body).not.toContain('Disallow: /')
  } else {
    expect(body).toContain('Disallow: /')
  }
})

test('llms.txt is served and holds only facts, titles, and service names', async ({ request }) => {
  const response = await request.get('/llms.txt')
  expect(response.status()).toBe(200)
  const body = await response.text()
  expect(body).toContain('Carnegie Hill Gallery & Custom Framing')
  expect(body).toContain('1374 Lexington Ave')
  expect(body).toContain('https://www.carnegiehillframing.com/contact/')
  expect(body).not.toContain('7 days')
  // built as a code point so this repo holds no em dash character at all
  expect(body).not.toContain(String.fromCharCode(0x2014))
})

test('sitemap.xml lists every indexable page, and only pages that exist', async ({ request }) => {
  const response = await request.get('/sitemap.xml')
  expect(response.status()).toBe(200)
  const body = await response.text()

  const listed = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] as string)
  expect(listed.length).toBeGreaterThan(0)
  expect(new Set(listed).size, 'no duplicate URLs').toBe(listed.length)

  const paths = listed.map((url) => new URL(url).pathname)
  for (const path of paths) {
    expect(path.endsWith('/'), `${path} keeps the trailing slash`).toBe(true)
    expect(CONTENT_PAGES, `${path} resolves to a built page`).toContain(path)
  }
  for (const route of CONTENT_PAGES) {
    expect(paths, `${route} is in the sitemap`).toContain(route)
  }

  // A tab with no photos is never listed.
  expect(paths).not.toContain('/gallery/mats-glass-display/')
  // Redirect stubs and the 404 are not content.
  expect(paths).not.toContain('/order-online/')
  expect(paths).not.toContain('/appointment/')
})
