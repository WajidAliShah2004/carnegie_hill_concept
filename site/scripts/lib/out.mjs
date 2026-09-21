/**
 * Reading the built site: which routes exist, and whether any private source
 * metadata leaked into a published file.
 *
 * Routes are discovered from `out/` rather than listed, so a page another
 * worker adds is covered by every gate without anyone editing a list.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { OUT_DIR } from './content.mjs'

/* ------------------------------------------------------------------ */
/* Route discovery                                                     */
/* ------------------------------------------------------------------ */

export function discoverRoutes(outDir = OUT_DIR) {
  const routes = new Set()
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '_next' || entry.name === 'dev-assets') continue
        if (entry.name.startsWith('__next')) continue
        walk(full)
        continue
      }
      if (entry.name !== 'index.html') continue
      const rel = relative(outDir, dir).split(sep).filter(Boolean).join('/')
      routes.add(rel === '' ? '/' : `/${rel}/`)
    }
  }
  walk(outDir)
  // The exported 404 is reachable only as a file, never as a directory.
  try {
    statSync(join(outDir, '404.html'))
    routes.add('/404.html')
  } catch {
    /* no 404 page built yet */
  }
  return [...routes].sort()
}

/* ------------------------------------------------------------------ */
/* Leaked source metadata                                              */
/* ------------------------------------------------------------------ */

const LEAK_PATTERNS = [
  { name: 'liveSite', re: /liveSite/ },
  { name: 'ownerWritten', re: /ownerWritten/ },
  { name: 'observedInPhoto', re: /observedInPhoto/ },
  { name: 'reviewUrl', re: /reviewUrl/ },
  // React's own void-element table contains case"source": for the <source>
  // tag, so this one pattern is not applied to the framework bundles. Our
  // content never reaches those files; it reaches HTML and RSC payloads.
  { name: '"source"', re: /"source"\s*:/, skipFramework: true },
]

const FRAMEWORK_PREFIX = '_next/static/'

const TEXTUAL = new Set(['.html', '.txt', '.json', '.js', '.css', '.xml', '.map'])

export function scanForLeaks(outDir = OUT_DIR) {
  const leaks = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'dev-assets') continue
        walk(full)
        continue
      }
      const dot = entry.name.lastIndexOf('.')
      const ext = dot === -1 ? '' : entry.name.slice(dot)
      if (!TEXTUAL.has(ext)) continue
      const name = relative(outDir, full).split(sep).join('/')
      const body = readFileSync(full, 'utf8')
      for (const pattern of LEAK_PATTERNS) {
        if (pattern.skipFramework && name.startsWith(FRAMEWORK_PREFIX)) continue
        if (pattern.re.test(body)) leaks.push({ file: name, key: pattern.name })
      }
    }
  }
  walk(outDir)
  return leaks
}


/* ------------------------------------------------------------------ */
/* Redirect stubs                                                      */
/* ------------------------------------------------------------------ */

/**
 * `/order-online/` and `/appointment/` exist only to send a visitor to
 * `/contact/`. A static export cannot answer 301, so each carries a meta
 * refresh, a canonical pointing at the destination, and `noindex`. The host
 * rules do the real 301; the stub is the belt to that pair of braces.
 *
 * They are not pages of the site, and the refresh tears down the browsing
 * context mid-check, so the page gates skip them and the redirect test covers
 * them instead.
 */
export function isRedirectStub(route, outDir = OUT_DIR) {
  const file = join(outDir, route.replace(/^\//, '').split('/').join(sep), 'index.html')
  try {
    return /http-equiv=["']?refresh/i.test(readFileSync(file, 'utf8'))
  } catch {
    return false
  }
}

/** Routes worth loading in a browser: everything that is not a redirect stub. */
export function renderableRoutes(outDir = OUT_DIR) {
  return discoverRoutes(outDir).filter((route) => !isRedirectStub(route, outDir))
}
