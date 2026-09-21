import { test } from '@playwright/test'

/**
 * Not an assertion. These are the pictures we look at when judging the design.
 * They land in `site/.shots/`, which is gitignored.
 *
 * `SHOT_TAG=before npx playwright test tests/shots.spec.ts` writes
 * `.shots/before/...` so two passes can be compared side by side.
 */
const SIZES = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '375', width: 375, height: 812 },
]

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/about/' },
  { name: 'services', path: '/services/' },
  { name: 'gallery', path: '/gallery/' },
  { name: 'reviews', path: '/reviews/' },
  { name: 'contact', path: '/contact/' },
  { name: 'privacy', path: '/privacy/' },
  { name: 'notfound', path: '/no-such-page/' },
]

const dir = process.env.SHOT_TAG ? `.shots/${process.env.SHOT_TAG}` : '.shots'

for (const target of PAGES) {
  for (const size of SIZES) {
    test(`screenshot ${target.name}-${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.goto(target.path)
      // walk the page so every lazy image has loaded before the full-page shot
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
          window.scrollTo(0, y)
          await new Promise((resolve) => setTimeout(resolve, 60))
        }
        window.scrollTo(0, 0)
      })
      await page.evaluate(() => {
        for (const image of Array.from(document.images)) image.loading = 'eager'
      })
      await page.waitForLoadState('networkidle')
      // Grow the viewport to the whole document rather than using fullPage, so
      // every picture is really painted in the shot.
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewportSize({ width: size.width, height: Math.min(height, 12000) })
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${dir}/${target.name}-${size.name}.png` })
    })
  }
}
