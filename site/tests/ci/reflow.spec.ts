import { test, expect } from '@playwright/test'
import { renderableRoutes } from './routes'

/**
 * Gate 5, reflow: no horizontal scrolling at 320 or 375 CSS px, on every route
 * discovered in `out/`.
 *
 * `tests/shell.spec.ts` checks the same thing against the seven routes it knows
 * by name. This file finds the routes instead, so gallery pages, gallery tabs,
 * and anything else another worker adds are covered without anyone editing a
 * list. Overlap on the seven is deliberate and costs a few seconds.
 */

for (const width of [320, 375]) {
  for (const route of renderableRoutes()) {
    test(`reflow: ${route} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(route)
      const box = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        widest: (() => {
          let worst = { tag: '', right: 0 }
          for (const element of document.querySelectorAll('body *')) {
            const rect = element.getBoundingClientRect()
            if (rect.right > worst.right) {
              worst = {
                tag: `${element.tagName.toLowerCase()}.${(element.className || '').toString().split(' ')[0]}`,
                right: Math.round(rect.right),
              }
            }
          }
          return worst
        })(),
      }))
      expect(
        box.scroll,
        `${route} overflows at ${width}px. Widest element: ${box.widest.tag} reaching ${box.widest.right}px.`,
      ).toBeLessThanOrEqual(box.client)
    })
  }
}
