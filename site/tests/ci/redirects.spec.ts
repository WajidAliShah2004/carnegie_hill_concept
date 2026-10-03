import { test, expect } from '@playwright/test'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import { OUT_DIR, SITE_ROOT, outExists, readOut, isRedirectStub, stubDestination } from './routes'

/**
 * Gate 7, redirect map.
 *
 * A static export cannot answer 301 by itself, so the redirect lives in the
 * host rules: `_redirects` on Cloudflare Pages, `.htaccess` on Hostinger. Both
 * are checked here, plus the stub page that catches anyone who lands on the
 * old URL with the rules misconfigured.
 */

const MOVED = ['/order-online/', '/appointment/']
const DESTINATION = '/contact/'

test('Cloudflare _redirects covers both moved pages and the old sitemap path', () => {
  expect(outExists('_redirects'), 'out/_redirects is missing').toBe(true)
  const rules = readOut('_redirects')
  for (const from of MOVED) {
    const bare = from.replace(/\/$/, '')
    expect(rules, `no _redirects rule for ${from}`).toMatch(
      new RegExp(`^${bare}/?\\s+${DESTINATION}\\s+301`, 'm'),
    )
  }
  expect(rules, 'no rule for the old WordPress sitemap path').toMatch(
    /sitemap_index\.xml\s+\/sitemap\.xml\s+301/,
  )
  expect(rules, 'no canonical host rule').toMatch(/https:\/\/www\./)
})

test('the Hostinger .htaccess template covers the same ground', () => {
  const template = join(SITE_ROOT, 'deploy', 'htaccess.template')
  expect(existsSync(template), 'deploy/htaccess.template is missing').toBe(true)
  const body = readFileSync(template, 'utf8')

  expect(body, 'no order-online rule').toMatch(/RewriteRule \^order-online.*\/contact\/ \[R=301/)
  expect(body, 'no appointment rule').toMatch(/RewriteRule \^appointment.*\/contact\/ \[R=301/)
  expect(body, 'no old sitemap rule').toMatch(/sitemap_index/)
  expect(body, 'HTML must never be cached on Hostinger').toMatch(/Cache-Control "no-cache/)
  expect(body, 'hashed assets must be cached for a year').toMatch(/max-age=31536000, immutable/)
  expect(body, 'no 404 document').toMatch(/ErrorDocument 404 \/404\.html/)
  expect(body, 'no HTTPS redirect').toMatch(/RewriteCond %\{HTTPS\} !=on/)
  expect(body, 'LiteSpeed cache is not disabled').toMatch(/LiteSpeed/)
})

test('_headers never caches HTML and caches hashed assets for a year', () => {
  expect(outExists('_headers'), 'out/_headers is missing').toBe(true)
  const headers = readOut('_headers')
  expect(headers).toMatch(/\/_next\/static\/\*\s*\n\s*Cache-Control: public, max-age=31536000, immutable/)
  expect(headers).toMatch(/max-age=0, must-revalidate/)
})

test.describe('the moved URLs still land on Contact without host rules', () => {
  for (const route of MOVED) {
    // Read the stub off disk rather than loading it: the meta refresh fires
    // immediately and tears the browsing context down mid-evaluate.
    test(`${route} stub`, () => {
      const file = `${route.replace(/^\//, '')}index.html`
      expect(outExists(file), `${route} has no stub page in out/`).toBe(true)
      const html = readOut(file)

      expect(isRedirectStub(route), `${route} carries no meta refresh`).toBe(true)
      expect(stubDestination(route), `${route} refreshes somewhere other than ${DESTINATION}`).toBe(
        DESTINATION,
      )
      expect(html, `${route} must not be indexed in its own right`).toMatch(
        /<meta name="robots" content="[^"]*noindex/i,
      )
      expect(html, `${route} must declare ${DESTINATION} as its canonical`).toMatch(
        new RegExp(`rel="canonical" href="https://[^"]+${DESTINATION}"`),
      )
      expect(html, `${route} should offer a plain link for anyone the refresh fails`).toMatch(
        new RegExp(`href="${DESTINATION}"`),
      )
    })
  }
})

/**
 * Next 16 names each payload `__next.<route>.__PAGE__.txt`, the name the
 * browser asks for, by turning the slashes of a `path.relative` result into
 * dots. On Linux that gives one flat file. On Windows `path.relative` returns
 * backslashes, which survive and become folders, `__next.<route>/__PAGE__.txt`,
 * and the rewrites map the flat name back to them. So a Linux build, which is
 * what CI and both hosts run, has no rewrites, and a Windows build has some.
 * Either way the browser's name must resolve, and there must be payloads.
 */
test('every RSC payload resolves at the name the browser asks for', async () => {
  const { rscRewrites } = await import('../../scripts/deploy.mjs')
  const rules = rscRewrites()
  const flat = readdirSync(OUT_DIR, { recursive: true, encoding: 'utf8' })
    .map((file) => file.split(sep).join('/'))
    .filter((file) => !file.startsWith('_next/') && /(^|\/)__next\.[^/]*\.txt$/.test(file))
  expect(flat.length + rules.length, 'the build wrote no RSC payloads at all').toBeGreaterThan(0)
  for (const rule of rules) {
    expect(outExists(rule.to.replace(/^\//, '')), `${rule.to} is not in out/`).toBe(true)
    expect(outExists(rule.from.replace(/^\//, '')), `${rule.from} exists, so no rewrite is needed`).toBe(
      false,
    )
  }
})
