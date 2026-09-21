import { test, expect } from '@playwright/test'
import { renderableRoutes, pageRoutes, resolvesInOut } from './routes'

/**
 * Gate 7, link check: every internal link on every built page resolves to a
 * file in `out/`, and every in-page anchor target exists.
 *
 * External links are listed but not fetched: CI must not depend on somebody
 * else's server, and the budget is zero.
 */

type Link = { href: string; text: string }

const SCHEME = /^(https?:|mailto:|tel:|sms:|geo:|data:|javascript:)/i

test.describe('internal links resolve', () => {
  for (const route of renderableRoutes()) {
    test(`links on ${route}`, async ({ page }) => {
      await page.goto(route)
      const links: Link[] = await page.evaluate(() =>
        [...document.querySelectorAll('a[href]')].map((a) => ({
          href: a.getAttribute('href') ?? '',
          text: (a.textContent ?? '').trim().slice(0, 60),
        })),
      )

      const broken: string[] = []
      const anchors = new Set(
        await page.evaluate(() => [...document.querySelectorAll('[id]')].map((node) => node.id)),
      )

      for (const link of links) {
        const href = link.href.trim()
        if (href === '' || SCHEME.test(href)) continue

        if (href.startsWith('#')) {
          const id = decodeURIComponent(href.slice(1))
          if (id !== '' && !anchors.has(id)) broken.push(`${href} (no element with that id)`)
          continue
        }

        // Resolve relative links against the current route.
        const resolved = new URL(href, `http://localhost${route}`)
        const path = resolved.pathname
        if (!resolvesInOut(path)) broken.push(`${href} resolves to ${path}, which is not in out/`)
        if (resolved.hash !== '' && path === route) {
          const id = decodeURIComponent(resolved.hash.slice(1))
          if (!anchors.has(id)) broken.push(`${href} (no element with id ${id} on this page)`)
        }
      }

      expect(broken, `broken internal links on ${route}:\n  ${broken.join('\n  ')}`).toEqual([])
    })
  }
})

test('every page is reachable from the home page within two steps', async ({ page }) => {
  const reachable = new Set<string>(['/'])
  const frontier = ['/']

  for (let depth = 0; depth < 2; depth += 1) {
    const next: string[] = []
    for (const route of frontier) {
      await page.goto(route)
      const hrefs: string[] = await page.evaluate(() =>
        [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''),
      )
      for (const href of hrefs) {
        if (href === '' || SCHEME.test(href) || href.startsWith('#')) continue
        const path = new URL(href, `http://localhost${route}`).pathname
        if (reachable.has(path)) continue
        reachable.add(path)
        next.push(path)
      }
    }
    frontier.length = 0
    frontier.push(...next)
  }

  const orphans = pageRoutes().filter((route) => !reachable.has(route))
  expect(orphans, `pages nothing links to: ${orphans.join(', ')}`).toEqual([])
})
