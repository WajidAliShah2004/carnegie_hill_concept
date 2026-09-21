import { test, expect } from '@playwright/test'
import { labels } from '../src/labels'

const ROUTES = ['/', '/about/', '/services/', '/gallery/', '/reviews/', '/contact/', '/privacy/']

test.describe('no horizontal overflow', () => {
  for (const width of [320, 375]) {
    for (const route of ROUTES) {
      test(`${route} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await page.goto(route)
        const overflow = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }))
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client)
      })
    }
  }
})

test.describe('mobile menu', () => {
  test('opens, closes, and Escape returns focus to the button', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    const button = page.getByRole('button', { name: labels.menu.open })
    const nav = page.getByRole('navigation', { name: labels.nav.label })

    await expect(nav).toBeHidden()
    await button.click()
    await expect(nav).toBeVisible()
    await expect(page.getByRole('button', { name: labels.menu.close })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    await page.keyboard.press('Escape')
    await expect(nav).toBeHidden()
    await expect(button).toBeFocused()

    await button.click()
    await expect(nav).toBeVisible()
    await page.getByRole('button', { name: labels.menu.close }).click()
    await expect(nav).toBeHidden()
  })
})

test.describe('home slider', () => {
  test('previous and next buttons move the row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const row = page.locator('[data-hang-row]').first()
    const next = page.locator('[data-hang-next]').first()
    const previous = page.locator('[data-hang-previous]').first()

    await expect(previous).toBeDisabled()
    const start = await row.evaluate((node) => node.scrollLeft)

    await next.click()
    await expect.poll(() => row.evaluate((node) => node.scrollLeft)).toBeGreaterThan(start)
    await expect(previous).toBeEnabled()

    const moved = await row.evaluate((node) => node.scrollLeft)
    await previous.click()
    await expect.poll(() => row.evaluate((node) => node.scrollLeft)).toBeLessThan(moved)
  })

  test('arrow keys move the row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const row = page.locator('[data-hang-row]').first()
    await row.focus()
    const start = await row.evaluate((node) => node.scrollLeft)
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => row.evaluate((node) => node.scrollLeft)).toBeGreaterThan(start)
    const moved = await row.evaluate((node) => node.scrollLeft)
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => row.evaluate((node) => node.scrollLeft)).toBeLessThan(moved)
  })
})

test.describe('source metadata never ships', () => {
  test('no source kind appears in the built HTML', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route)
      const html = await page.content()
      for (const needle of ['liveSite', 'ownerWritten', 'observedInPhoto', 'reviewUrl', '7 days']) {
        expect(html, `${needle} found on ${route}`).not.toContain(needle)
      }
      // built as a code point so this repo holds no em dash character at all
      const emDash = String.fromCharCode(0x2014)
      expect(html, `em dash found on ${route}`).not.toContain(emDash)
    }
  })
})
