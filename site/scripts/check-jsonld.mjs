#!/usr/bin/env node
/**
 * Gate 4: the structured data says nothing the page does not.
 *
 * For every page in `out/`:
 *   - every `application/ld+json` block parses
 *   - the graph carries a `Store` node with the LocalBusiness required fields
 *     (name, address, telephone, url)
 *   - no forbidden type appears: Review, AggregateRating, FAQPage, ArtGallery,
 *     or any `additionalType`
 *   - every string value is visible on the page, or is a URL, an id, or a
 *     schema.org format token
 *
 * A page with no JSON-LD yet fails with a plain message naming the page. It
 * does not crash, so the generator can land page by page.
 *
 *   npm run build && node scripts/check-jsonld.mjs
 */

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { SITE_ROOT } from './lib/content.mjs'
import { normalise } from './lib/match.mjs'
import { renderableRoutes } from './lib/out.mjs'

const PORT = Number(process.env.JSONLD_CHECK_PORT ?? 4184)
const BASE = `http://127.0.0.1:${PORT}`

const FORBIDDEN_TYPES = new Set(['Review', 'AggregateRating', 'FAQPage', 'ArtGallery'])
const FORBIDDEN_KEYS = new Set(['additionalType', 'aggregateRating', 'review', 'ratingValue'])

const REQUIRED_STORE_FIELDS = ['name', 'address', 'telephone', 'url']

/** Keys whose values are machine values, never expected as visible words. */
const MACHINE_KEYS = new Set([
  '@context',
  '@type',
  '@id',
  'url',
  'sameAs',
  'contentUrl',
  'hasMap',
  'target',
  'urlTemplate',
  'opens',
  'closes',
  'dayOfWeek',
  'foundingDate',
  'addressCountry',
  'latitude',
  'longitude',
  'inLanguage',
  'identifier',
  'encodingFormat',
  'position',
  'logo',
  'image',
  'telephone',
  'email',
])

function flatten(node, into = []) {
  if (Array.isArray(node)) {
    for (const item of node) flatten(item, into)
    return into
  }
  if (!node || typeof node !== 'object') return into
  into.push(node)
  for (const [key, value] of Object.entries(node)) {
    if (key === '@context') continue
    flatten(value, into)
  }
  return into
}

function typesOf(node) {
  const type = node['@type']
  if (typeof type === 'string') return [type]
  if (Array.isArray(type)) return type.filter((value) => typeof value === 'string')
  return []
}

function strings(node, key, into) {
  if (typeof node === 'string') {
    into.push({ key, value: node })
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) strings(item, key, into)
    return
  }
  if (!node || typeof node !== 'object') return
  for (const [childKey, value] of Object.entries(node)) strings(value, childKey, into)
}

function isMachineValue(value) {
  const text = normalise(value)
  if (text === '') return true
  if (/^https?:\/\//i.test(text)) return true
  if (/^(mailto|tel|sms|geo):/i.test(text)) return true
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return true
  if (/^\+?[\d\s().-]{7,}$/.test(text)) return true
  if (/^#[A-Za-z][\w-]*$/.test(text)) return true
  if (/^\d{4}(-\d{2}-\d{2})?(T[\d:.+Z-]*)?$/.test(text)) return true
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return true
  if (/^[A-Z][A-Za-z]+$/.test(text) && text.length <= 24) {
    // A single capitalised token: a schema type name or a weekday. These are
    // vocabulary, not sentences, and are covered by the forbidden-type check.
    return true
  }
  return false
}

function serve() {
  const child = spawn(process.execPath, [join(SITE_ROOT, 'scripts', 'serve-out.mjs'), String(PORT)], {
    cwd: SITE_ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('serve-out did not start')), 15_000)
    child.stdout.on('data', () => {
      clearTimeout(timer)
      resolve(child)
    })
    child.on('error', reject)
  })
}

async function main() {
  const routes = renderableRoutes()
  if (routes.length === 0) {
    console.error('check-jsonld: no pages in out/. Run npm run build first.')
    process.exitCode = 1
    return
  }

  const failures = []
  const note = (route, message) => failures.push(`${route}: ${message}`)

  const server = await serve()
  const browser = await chromium.launch()
  let nodes = 0

  // The error pages have no page record behind them, so they carry no graph.
  const skip = (route) => /^\/(404|_not-found)(\/|\.html)?$/.test(route)

  try {
    const page = await browser.newPage()
    for (const route of routes) {
      if (skip(route)) continue
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
      const { blocks, visible } = await page.evaluate(() => ({
        blocks: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
          (script) => script.textContent ?? '',
        ),
        visible: (document.body.innerText ?? '') + ' ' + document.title,
      }))

      if (blocks.length === 0) {
        note(route, 'no JSON-LD block. The page has no structured data yet.')
        continue
      }

      const haystack = normalise(visible).toLowerCase()
      const graph = []

      for (const [index, block] of blocks.entries()) {
        let parsed
        try {
          parsed = JSON.parse(block)
        } catch (error) {
          note(route, `JSON-LD block ${index + 1} does not parse: ${error.message}`)
          continue
        }
        graph.push(...flatten(parsed['@graph'] ?? parsed))
      }

      nodes += graph.length

      for (const node of graph) {
        for (const type of typesOf(node)) {
          if (FORBIDDEN_TYPES.has(type)) note(route, `forbidden JSON-LD type "${type}"`)
        }
        for (const key of Object.keys(node)) {
          if (FORBIDDEN_KEYS.has(key)) note(route, `forbidden JSON-LD property "${key}"`)
        }
      }

      const store = graph.find((node) => typesOf(node).includes('Store'))
      if (!store) {
        note(route, 'the graph has no Store node')
      } else {
        for (const field of REQUIRED_STORE_FIELDS) {
          if (store[field] == null || store[field] === '') {
            note(route, `the Store node is missing the required LocalBusiness field "${field}"`)
          }
        }
        const address = store.address
        if (address && typeof address === 'object') {
          for (const field of ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode']) {
            if (!address[field]) note(route, `the Store address is missing "${field}"`)
          }
        }
      }

      const found = []
      for (const block of blocks) {
        try {
          strings(JSON.parse(block), '', found)
        } catch {
          /* already reported */
        }
      }
      for (const { key, value } of found) {
        if (MACHINE_KEYS.has(key)) continue
        if (isMachineValue(value)) continue
        if (!haystack.includes(normalise(value).toLowerCase())) {
          note(route, `schema value is not visible on the page: "${key}" = ${JSON.stringify(normalise(value))}`)
        }
      }
    }
  } finally {
    await browser.close()
    server.kill()
  }

  if (failures.length > 0) {
    console.error(`check-jsonld: ${failures.length} problem(s).\n`)
    for (const line of failures) console.error(`  ${line}`)
    console.error(
      '\nThe graph is generated from the same records the page renders, so it cannot say\n' +
        'something the page does not. Never emit Review, AggregateRating, FAQPage,\n' +
        'ArtGallery, or a Wikidata additionalType.',
    )
    process.exitCode = 1
    return
  }

  const covered = routes.filter((route) => !skip(route))
  console.log(`check-jsonld: ${covered.length} page(s), ${nodes} schema node(s), all valid.`)
}

main().catch((error) => {
  console.error('check-jsonld: failed to run.')
  console.error(error)
  process.exitCode = 1
})
