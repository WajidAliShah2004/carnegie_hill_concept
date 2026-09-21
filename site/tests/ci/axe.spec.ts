import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { renderableRoutes } from './routes'

/**
 * Gate 6: zero serious or critical accessibility issues on every built page.
 *
 * Moderate and minor findings are printed but do not fail, so a real blocker
 * is never lost in noise. The manual keyboard and screen reader pass before
 * launch is a separate, human step.
 */

const BLOCKING = new Set(['serious', 'critical'])

for (const route of renderableRoutes()) {
  test(`axe: ${route}`, async ({ page }, testInfo) => {
    // The hero fades in on load. Measuring contrast mid-fade reports text at
    // partial opacity, so the scan runs with the motion switched off.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(route)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()

    const blocking = results.violations.filter((violation) => BLOCKING.has(violation.impact ?? ''))
    const rest = results.violations.filter((violation) => !BLOCKING.has(violation.impact ?? ''))

    if (rest.length > 0) {
      testInfo.annotations.push({
        type: 'axe (not blocking)',
        description: rest.map((violation) => `${violation.impact}: ${violation.id}`).join(', '),
      })
    }

    const report = blocking
      .map(
        (violation) =>
          `${violation.impact} ${violation.id}: ${violation.help}\n` +
          violation.nodes
            .slice(0, 4)
            .map((node) => `    ${node.target.join(' ')}`)
            .join('\n'),
      )
      .join('\n')

    expect(blocking, `serious or critical axe violations on ${route}\n${report}`).toEqual([])
  })
}
