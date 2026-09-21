import { test, expect, type Page } from '@playwright/test'
import { labels } from '../src/labels'

/**
 * The interior pages: overflow at the two narrow widths, the gallery tabs and
 * paging links, the lightbox, and every state of the contact form against a
 * mocked endpoint. Runs against the exported files in `out/`.
 */

const PAGES = [
  '/',
  '/about/',
  '/services/',
  '/gallery/',
  '/gallery/page/2/',
  '/gallery/page/3/',
  '/gallery/frame-options/',
  '/gallery/the-shop/',
  '/reviews/',
  '/contact/',
  '/privacy/',
]

/** Old WordPress URLs. They move the browser on, so they are checked as files. */
const REDIRECTS = ['/order-online/', '/appointment/']

test.describe('no horizontal overflow', () => {
  for (const width of [320, 375]) {
    for (const route of PAGES) {
      test(`${route} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await page.goto(route)
        const size = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }))
        expect(size.scroll).toBeLessThanOrEqual(size.client)
      })
    }
  }
})

test.describe('gallery routes', () => {
  test('every page of every tab answers', async ({ request }) => {
    for (const route of PAGES.filter((path) => path.startsWith('/gallery'))) {
      const response = await request.get(route)
      expect(response.status(), route).toBe(200)
    }
  })

  test('the empty photo type has no tab and no page', async ({ page, request }) => {
    await page.goto('/gallery/')
    const tabs = page.getByRole('navigation', { name: labels.gallery.tabs })
    await expect(tabs.getByRole('link', { name: labels.photoTypes.matsGlassDisplay })).toHaveCount(0)
    expect((await request.get('/gallery/mats-glass-display/')).status()).toBe(404)
  })

  test('tab links resolve and mark the current tab', async ({ page }) => {
    await page.goto('/gallery/')
    const tabs = page.getByRole('navigation', { name: labels.gallery.tabs })
    await expect(tabs.getByRole('link', { name: labels.photoTypes.completedWork })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await tabs.getByRole('link', { name: labels.photoTypes.theShop }).click()
    await expect(page).toHaveURL(/\/gallery\/the-shop\/$/)
    await expect(
      page.getByRole('navigation', { name: labels.gallery.tabs }).getByRole('link', {
        name: labels.photoTypes.theShop,
      }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('paging links move between pages', async ({ page }) => {
    await page.goto('/gallery/')
    await expect(page.locator('[data-gallery-thumb]')).toHaveCount(12)

    await page.locator('[data-page-next]').click()
    await expect(page).toHaveURL(/\/gallery\/page\/2\/$/)
    await expect(page.locator('[data-gallery-thumb]')).toHaveCount(12)

    await page.locator('[data-page-previous]').click()
    await expect(page).toHaveURL(/\/gallery\/$/)
  })

  test('a thumbnail is a plain link to the photo without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/gallery/')
    const href = await page.locator('[data-gallery-thumb="0"]').getAttribute('href')
    expect(href).toBeTruthy()
    expect(await page.locator('dialog[open]').count()).toBe(0)
    await context.close()
  })
})

test.describe('lightbox', () => {
  const open = async (page: Page, position = 0) => {
    await page.goto('/gallery/')
    await page.locator(`[data-gallery-thumb="${position}"]`).click()
    await expect(page.locator('[data-gallery-lightbox]')).toBeVisible()
  }

  test('opens, traps focus, and closes on Escape back to the thumbnail', async ({ page }) => {
    await open(page)

    // A modal dialog cycles through its own controls and the document root.
    // What must never happen is focus reaching the page behind it.
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press('Tab')
      const where = await page.evaluate(() => {
        const node = document.activeElement
        if (!node || node === document.body) return 'root'
        return node.closest('[data-gallery-lightbox]') ? 'dialog' : 'behind'
      })
      expect(where, `focus reached the page after ${step + 1} tabs`).not.toBe('behind')
    }

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-gallery-lightbox]')).toBeHidden()
    await expect(page.locator('[data-gallery-thumb="0"]')).toBeFocused()
  })

  test('the close button closes it', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: labels.lightbox.close }).click()
    await expect(page.locator('[data-gallery-lightbox]')).toBeHidden()
    await expect(page.locator('[data-gallery-thumb="0"]')).toBeFocused()
  })

  test('arrow keys and the buttons move between photos', async ({ page }) => {
    await open(page)
    const image = page.locator('[data-gallery-lightbox] img')
    const first = await image.getAttribute('src')

    await page.keyboard.press('ArrowRight')
    await expect.poll(() => image.getAttribute('src')).not.toBe(first)

    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => image.getAttribute('src')).toBe(first)

    await page.getByRole('button', { name: labels.lightbox.next }).click()
    await expect.poll(() => image.getAttribute('src')).not.toBe(first)

    await page.getByRole('button', { name: labels.lightbox.previous }).click()
    await expect.poll(() => image.getAttribute('src')).toBe(first)
  })
})

test.describe('contact form', () => {
  const form = '[data-contact-form]'
  const status = '[data-form-status]'

  const fill = async (page: Page) => {
    await page.getByLabel(labels.form.name, { exact: false }).fill('Test Person')
    await page.getByRole('textbox', { name: labels.form.email }).fill('test@example.com')
    await page.getByLabel(labels.form.projectDetails, { exact: false }).fill('One framed print.')
  }

  test('loads no third-party script', async ({ page }) => {
    const third: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('hcaptcha.com') || url.includes('web3forms.com')) third.push(url)
    })
    await page.goto('/contact/')
    await expect(page.locator(form)).toBeVisible()
    expect(third).toEqual([])
  })

  test('invalid: reports the missing fields and focuses the first one', async ({ page }) => {
    await page.goto('/contact/')
    await page.getByRole('button', { name: labels.form.submit }).click()

    await expect(page.locator(form)).toHaveAttribute('data-form-state', 'invalid')
    await expect(page.getByText(labels.formStates.needName)).toBeVisible()
    await expect(page.getByText(labels.formStates.needContact)).toBeVisible()
    await expect(page.getByText(labels.formStates.needDetails)).toBeVisible()
    await expect(page.getByLabel(labels.form.name, { exact: false })).toBeFocused()
  })

  test('invalid: checks the email address', async ({ page }) => {
    await page.goto('/contact/')
    await page.getByLabel(labels.form.name, { exact: false }).fill('Test Person')
    await page.getByRole('textbox', { name: labels.form.email }).fill('not-an-address')
    await page.getByLabel(labels.form.projectDetails, { exact: false }).fill('One framed print.')
    await page.getByRole('button', { name: labels.form.submit }).click()

    await expect(page.locator(form)).toHaveAttribute('data-form-state', 'invalid')
    await expect(page.getByText(labels.formStates.invalidEmail)).toBeVisible()
  })

  test('submitting, then sent', async ({ page }) => {
    await page.route('**/api.web3forms.com/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })
    await page.goto('/contact/')
    await fill(page)
    await page.getByRole('button', { name: labels.form.submit }).click()

    await expect(page.locator(form)).toHaveAttribute('data-form-state', 'submitting')
    await expect(page.locator(status)).toContainText(labels.formStates.submitting)
    await expect(page.locator(form)).toHaveAttribute('data-form-state', 'sent')
    await expect(page.locator(status)).toContainText(labels.formStates.sent)
  })

  test('failed: offers the phone number', async ({ page }) => {
    await page.route('**/api.web3forms.com/**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    )
    await page.goto('/contact/')
    await fill(page)
    await page.getByRole('button', { name: labels.form.submit }).click()

    await expect(page.locator(form)).toHaveAttribute('data-form-state', 'failed')
    await expect(page.locator(status)).toContainText(labels.formStates.failed)
    await expect(page.locator(`${status} a[href^="tel:"]`)).toBeVisible()
  })

  test('rate limited: offers the phone number', async ({ page }) => {
    await page.route('**/api.web3forms.com/**', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: '{}' }),
    )
    await page.goto('/contact/')
    await fill(page)
    await page.getByRole('button', { name: labels.form.submit }).click()

    await expect(page.locator(form)).toHaveAttribute('data-form-state', 'rateLimited')
    await expect(page.locator(status)).toContainText(labels.formStates.rateLimited)
    await expect(page.locator(`${status} a[href^="tel:"]`)).toBeVisible()
  })

  test('a refused answer with no success flag counts as failed', async ({ page }) => {
    await page.route('**/api.web3forms.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' }),
    )
    await page.goto('/contact/')
    await fill(page)
    await page.getByRole('button', { name: labels.form.submit }).click()
    await expect(page.locator(form)).toHaveAttribute('data-form-state', 'failed')
  })

  test('the project type options are the published service names', async ({ page }) => {
    await page.goto('/contact/')
    const options = await page
      .getByLabel(labels.form.projectType, { exact: false })
      .locator('option')
      .allTextContents()
    expect(options[0]).toBe(labels.form.choose)
    expect(options.length).toBeGreaterThan(1)
  })
})

test.describe('old urls', () => {
  for (const route of REDIRECTS) {
    test(`${route} points at the contact page`, async ({ request }) => {
      const response = await request.get(route)
      expect(response.status()).toBe(200)
      const html = await response.text()
      expect(html).toContain('http-equiv="refresh"')
      expect(html).toContain('/contact/')
      expect(html).toContain('noindex')
    })
  }
})

test.describe('services', () => {
  test('every service has a section with its anchor', async ({ page }) => {
    await page.goto('/services/')
    const index = page.getByRole('navigation', { name: labels.services.index })
    const links = await index.getByRole('link').all()
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      const href = await link.getAttribute('href')
      expect(href).toMatch(/^#/)
      await expect(page.locator(`section${href}`)).toHaveCount(1)
    }
  })
})
