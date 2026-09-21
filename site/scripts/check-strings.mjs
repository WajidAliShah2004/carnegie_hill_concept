#!/usr/bin/env node
/**
 * Gate 3 (spec 3.5): every word on the built site traces to content or labels.
 *
 * Walks every page in `out/` with a real browser, JavaScript enabled, and
 * collects every visible text node, every `alt`, `title`, `aria-label` and
 * `placeholder`, the `<title>`, the meta description, the Open Graph and
 * Twitter text values, and every string inside every JSON-LD block. Each one
 * has to be an allowed string, or be cuttable end to end into allowed strings
 * and punctuation. Anything else prints with its page and fails the deploy.
 *
 * It then scans every file in `out/` for leaked source metadata, because the
 * private `source` object must never reach the public build.
 *
 *   npm run build && node scripts/check-strings.mjs
 *   node scripts/check-strings.mjs --fixture   # prove the matcher bites
 */

import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { SITE_ROOT, allowedStrings } from './lib/content.mjs'
import { buildIndex, judge, normalise } from './lib/match.mjs'
import { renderableRoutes, scanForLeaks } from './lib/out.mjs'

const PORT = Number(process.env.STRING_CHECK_PORT ?? 4183)
const BASE = `http://127.0.0.1:${PORT}`

/** Machine values that carry no words: card formats, locales, schema tokens. */
const FORMAT_TOKENS = new Set([
  'website',
  'article',
  'summary',
  'summary_large_image',
  'en_US',
  'en-US',
  'en',
  'index, follow',
  'noindex, nofollow',
  'noindex',
  'follow',
  'width=device-width, initial-scale=1',
])

/** schema.org vocabulary: type names, enumeration members, property tokens. */
const SCHEMA_TOKENS = new Set([
  'Store',
  'LocalBusiness',
  'Organization',
  'WebSite',
  'WebPage',
  'AboutPage',
  'ContactPage',
  'CollectionPage',
  'BreadcrumbList',
  'ListItem',
  'PostalAddress',
  'OpeningHoursSpecification',
  'OfferCatalog',
  'Offer',
  'Service',
  'ImageObject',
  'GeoCoordinates',
  'SearchAction',
  'EntryPoint',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'https://schema.org',
  'http://schema.org',
])

/** Keys in a JSON-LD graph whose string values are machine values. */
const SCHEMA_MACHINE_KEYS = new Set([
  '@context',
  '@type',
  '@id',
  'url',
  'sameAs',
  'contentUrl',
  'hasMap',
  'target',
  'urlTemplate',
  'telephone',
  'email',
  'opens',
  'closes',
  'dayOfWeek',
  'foundingDate',
  'addressCountry',
  'postalCode',
  'latitude',
  'longitude',
  'inLanguage',
  'identifier',
])

/* ------------------------------------------------------------------ */
/* Extraction, inside the page                                         */
/* ------------------------------------------------------------------ */

const EXTRACT = () => {
  const found = []
  const add = (kind, where, value) => {
    if (typeof value === 'string' && value.trim() !== '') found.push({ kind, where, value })
  }

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'HEAD'])
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (!parent || SKIP.has(parent.tagName)) continue
    const style = getComputedStyle(parent)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    add('text', parent.tagName.toLowerCase(), node.nodeValue)
  }

  for (const element of document.querySelectorAll('[alt],[title],[aria-label],[placeholder]')) {
    const tag = element.tagName.toLowerCase()
    add('alt', tag, element.getAttribute('alt'))
    add('title', tag, element.getAttribute('title'))
    add('aria-label', tag, element.getAttribute('aria-label'))
    add('placeholder', tag, element.getAttribute('placeholder'))
  }

  add('document.title', 'title', document.title)

  for (const meta of document.querySelectorAll('meta[name],meta[property]')) {
    const name = meta.getAttribute('name') ?? meta.getAttribute('property') ?? ''
    if (!/^(description|og:|twitter:)/i.test(name)) continue
    add('meta', name, meta.getAttribute('content'))
  }

  const jsonld = []
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    jsonld.push(script.textContent ?? '')
  }

  return { found, jsonld }
}

/* ------------------------------------------------------------------ */
/* JSON-LD strings                                                     */
/* ------------------------------------------------------------------ */

function jsonldStrings(node, key, into) {
  if (typeof node === 'string') {
    into.push({ key, value: node })
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) jsonldStrings(item, key, into)
    return
  }
  if (!node || typeof node !== 'object') return
  for (const [childKey, value] of Object.entries(node)) jsonldStrings(value, childKey, into)
}

/* ------------------------------------------------------------------ */
/* The fixture: prove the matcher bites                                */
/* ------------------------------------------------------------------ */

const FIXTURE_SENTENCE =
  'Our master framers have been perfecting their craft for three generations in the heart of Manhattan.'

async function runFixture(index) {
  const dir = join(SITE_ROOT, '.fixture-out')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'index.html'),
    `<!doctype html><html lang="en"><head><title>Fixture</title></head><body>` +
      `<p>${FIXTURE_SENTENCE}</p>` +
      `<img src="x.jpg" alt="A hand gilding a carved corner sample">` +
      `<script type="application/json">{"text":"x","source":{"kind":"liveSite"}}<\/script>` +
      `</body></html>`,
  )

  const invented = judge(FIXTURE_SENTENCE, index)
  const inventedAlt = judge('A hand gilding a carved corner sample', index)
  const leaks = scanForLeaks(dir)
  rmSync(dir, { recursive: true, force: true })

  const problems = []
  if (invented.ok) problems.push(`the invented sentence passed as "${invented.reason}"`)
  if (inventedAlt.ok) problems.push(`the invented alt text passed as "${inventedAlt.reason}"`)
  if (!leaks.some((leak) => leak.key === 'liveSite')) problems.push('the leaked source kind was not caught')
  if (!leaks.some((leak) => leak.key === '"source"')) problems.push('the leaked "source" key was not caught')

  // A composed line must still pass, or the matcher is uselessly strict.
  const composed = judge('Monday to Saturday, 10:00 AM to 7:30 PM', index)
  if (!composed.ok) problems.push('a legitimately composed hours line was rejected')

  if (problems.length > 0) {
    console.error('check-strings fixture: the matcher is wrong.')
    for (const problem of problems) console.error(`  ${problem}`)
    return false
  }
  console.log(
    'check-strings fixture: invented sentence rejected, invented alt text rejected, ' +
      'leaked source keys caught, composed hours line accepted.',
  )
  return true
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

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
  const fixtureOnly = process.argv.includes('--fixture')

  const { allowed } = await allowedStrings()
  const index = buildIndex(allowed)

  const fixtureOk = await runFixture(index)
  if (!fixtureOk) {
    process.exitCode = 1
    return
  }
  if (fixtureOnly) return

  const routes = renderableRoutes()
  if (routes.length === 0) {
    console.error('check-strings: no pages in out/. Run npm run build first.')
    process.exitCode = 1
    return
  }

  const failures = []
  let checked = 0
  const server = await serve()
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage({ javaScriptEnabled: true })
    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
      const { found, jsonld } = await page.evaluate(EXTRACT)

      for (const item of found) {
        if (item.kind === 'meta' && FORMAT_TOKENS.has(normalise(item.value))) continue
        checked += 1
        const verdict = judge(item.value, index)
        if (!verdict.ok) {
          failures.push({ route, kind: `${item.kind} <${item.where}>`, value: normalise(item.value) })
        }
      }

      for (const block of jsonld) {
        let parsed
        try {
          parsed = JSON.parse(block)
        } catch {
          failures.push({ route, kind: 'json-ld', value: 'the block does not parse as JSON' })
          continue
        }
        const strings = []
        jsonldStrings(parsed, '', strings)
        for (const { key, value } of strings) {
          if (SCHEMA_MACHINE_KEYS.has(key)) continue
          if (SCHEMA_TOKENS.has(normalise(value))) continue
          checked += 1
          const verdict = judge(value, index)
          if (!verdict.ok) {
            failures.push({ route, kind: `json-ld "${key}"`, value: normalise(value) })
          }
        }
      }
    }
  } finally {
    await browser.close()
    server.kill()
  }

  const leaks = scanForLeaks()
  for (const leak of leaks) {
    failures.push({ route: leak.file, kind: 'leaked source metadata', value: leak.key })
  }

  if (failures.length > 0) {
    const seen = new Set()
    console.error(`check-strings: ${failures.length} string(s) with no source.\n`)
    for (const failure of failures) {
      const line = `  ${failure.route}  [${failure.kind}]  ${JSON.stringify(failure.value)}`
      if (seen.has(line)) continue
      seen.add(line)
      console.error(line)
    }
    console.error(
      '\nEvery word on the site comes from a Sanity field or from src/labels.ts.\n' +
        'Add the wording to content with a source, or add an interface word to labels.ts.\n' +
        'Do not write a sentence into a component.',
    )
    process.exitCode = 1
    return
  }

  console.log(
    `check-strings: ${routes.length} page(s), ${checked} string(s) judged against ` +
      `${index.set.size} allowed string(s). ` +
      'No unsourced text, no leaked source metadata.',
  )
}

main().catch((error) => {
  console.error('check-strings: failed to run.')
  console.error(error)
  process.exitCode = 1
})
