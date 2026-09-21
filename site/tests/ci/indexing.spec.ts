import { test, expect } from '@playwright/test'
import { pageRoutes, deployEnv, isProduction } from './routes'

/**
 * Gate 7, indexing: staging tells crawlers to stay away, production does not.
 *
 * A stray `noindex` on production is the one deploy mistake that quietly
 * undoes the whole search plan, so it is checked on every page, in the HTML.
 * Header-level `X-Robots-Tag` is a host setting and is checked by hand against
 * the launch gates in `docs/deploy.md`.
 */

const NOINDEX = /noindex/i

for (const route of pageRoutes()) {
  test(`robots meta on ${route} (DEPLOY_ENV=${deployEnv})`, async ({ page }) => {
    await page.goto(route)
    const content = await page.evaluate(
      () => document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '',
    )

    if (isProduction) {
      expect(
        NOINDEX.test(content),
        `${route} carries a noindex meta tag in a production build: "${content}"`,
      ).toBe(false)
    } else if (deployEnv === 'staging') {
      expect(
        NOINDEX.test(content),
        `${route} has no noindex meta tag, and staging must never be indexed`,
      ).toBe(true)
    }
  })
}

test('every page declares one canonical URL', async ({ page }) => {
  const missing: string[] = []
  for (const route of pageRoutes()) {
    await page.goto(route)
    const canonicals = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="canonical"]')].map((link) =>
        link.getAttribute('href'),
      ),
    )
    if (canonicals.length !== 1 || !canonicals[0]?.startsWith('https://')) {
      missing.push(`${route}: ${JSON.stringify(canonicals)}`)
    }
  }
  expect(missing, `pages without exactly one absolute canonical:\n  ${missing.join('\n  ')}`).toEqual(
    [],
  )
})

test('every page declares one h1', async ({ page }) => {
  const wrong: string[] = []
  for (const route of pageRoutes()) {
    await page.goto(route)
    const count = await page.evaluate(() => document.querySelectorAll('h1').length)
    if (count !== 1) wrong.push(`${route}: ${count} h1 elements`)
  }
  expect(wrong, `pages without exactly one h1:\n  ${wrong.join('\n  ')}`).toEqual([])
})
