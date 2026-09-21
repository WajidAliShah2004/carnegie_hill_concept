import { test, expect } from '@playwright/test'
import { pageRoutes, outExists, readOut, isProduction, deployEnv } from './routes'

/**
 * Gate 7, sitemap and robots.
 *
 * The sitemap lists exactly the pages that were built: neither a missing page
 * nor an invented one passes. Redirect stubs and error pages are not pages, so
 * they are not in it.
 *
 * robots.txt is checked against the environment. Staging must keep crawlers
 * out. Production must let every crawler in, including the AI ones, and point
 * at the sitemap.
 */

function sitemapUrls(): string[] {
  const xml = readOut('sitemap.xml')
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1] as string)
}

const usingSanity = Boolean(process.env.SANITY_PROJECT_ID)

test('sitemap.xml exists', () => {
  expect(outExists('sitemap.xml'), 'out/sitemap.xml was not generated').toBe(true)
})

test('sitemap lists exactly the built pages', () => {
  test.skip(!outExists('sitemap.xml'), 'no sitemap yet')

  const paths = sitemapUrls().map((url) => new URL(url).pathname)
  const built = pageRoutes()

  const missing = built.filter((route) => !paths.includes(route))
  const extra = paths.filter((path) => !built.includes(path))

  expect(missing, `built pages missing from the sitemap: ${missing.join(', ')}`).toEqual([])
  expect(extra, `sitemap lists pages that were not built: ${extra.join(', ')}`).toEqual([])
})

test('sitemap entries are absolute https URLs', () => {
  test.skip(!outExists('sitemap.xml'), 'no sitemap yet')
  for (const url of sitemapUrls()) {
    expect(url.startsWith('https://'), `${url} is not an absolute https URL`).toBe(true)
  }
})

test('any lastmod in the sitemap is a real date', () => {
  test.skip(!outExists('sitemap.xml'), 'no sitemap yet')

  // A lastmod is never required. Seed content has no `_updatedAt` and the rule
  // is to leave the field out rather than write a date nobody can trace. When
  // the content comes from Sanity the generator has a true date and uses it;
  // either way, a value that is present has to be a real one.
  const xml = readOut('sitemap.xml')
  const lastmods = [...xml.matchAll(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/g)].map((m) => m[1] as string)
  for (const value of lastmods) {
    expect(Number.isNaN(Date.parse(value)), `lastmod ${value} is not a date`).toBe(false)
  }
  console.log(
    lastmods.length === 0
      ? `sitemap: no lastmod values (content source: ${usingSanity ? 'Sanity' : 'seed'})`
      : `sitemap: ${lastmods.length} lastmod value(s), all real dates`,
  )
})

test(`robots.txt suits DEPLOY_ENV=${deployEnv}`, () => {
  expect(outExists('robots.txt'), 'out/robots.txt was not generated').toBe(true)
  test.skip(!outExists('robots.txt'), 'no robots.txt yet')

  const robots = readOut('robots.txt')
  expect(robots).toMatch(/User-agent:\s*\*/i)

  if (isProduction) {
    expect(robots, 'production must allow every crawler, including the AI ones').toMatch(
      /Allow:\s*\/\s*$/im,
    )
    expect(robots, 'production robots.txt must not disallow anything on this site').not.toMatch(
      /Disallow:\s*\/\S/i,
    )
    expect(robots, 'production robots.txt must not block the whole site').not.toMatch(
      /Disallow:\s*\/\s*$/im,
    )
    expect(robots, 'production robots.txt must point at the sitemap').toMatch(
      /Sitemap:\s*https:\/\/\S+sitemap\.xml/i,
    )
  } else {
    expect(robots, `a ${deployEnv} build must keep crawlers out`).toMatch(/Disallow:\s*\//i)
  }
})

test('llms.txt is generated and says nothing new', () => {
  test.skip(!outExists('llms.txt'), 'no llms.txt yet')
  const body = readOut('llms.txt')
  expect(body.trim().length, 'llms.txt is empty').toBeGreaterThan(0)
  expect(body, 'llms.txt must never carry the unresolved "7 days a week" line').not.toMatch(
    /7\s*days\s*a\s*week/i,
  )
  expect(body, 'no em dashes anywhere in site content').not.toContain(String.fromCharCode(0x2014))
})
