/**
 * Routes and files are read from `out/`, never from a hand-kept list, so a
 * page another worker adds is covered by every gate the moment it builds.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const OUT_DIR = join(SITE_ROOT, 'out')

const SKIP_DIRS = new Set(['_next', 'dev-assets'])

/** Every directory in `out/` that holds an `index.html`, as a URL path. */
export function routes(): string[] {
  const found = new Set<string>()
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('__next')) continue
        walk(join(dir, entry.name))
        continue
      }
      if (entry.name !== 'index.html') continue
      const rel = relative(OUT_DIR, dir).split(sep).filter(Boolean).join('/')
      found.add(rel === '' ? '/' : `/${rel}/`)
    }
  }
  walk(OUT_DIR)
  return [...found].sort()
}

/**
 * A route is a redirect stub when its page exists only to send the visitor
 * somewhere else: `/order-online/` and `/appointment/` both do. A static
 * export cannot answer 301, so the stub carries a meta refresh, a canonical
 * pointing at the destination, and `noindex`. It is not a page of the site, so
 * it is left out of the sitemap, the reachability check, and the page checks.
 */
export function isRedirectStub(route: string): boolean {
  const file = join(OUT_DIR, route.replace(/^\//, '').split('/').join(sep), 'index.html')
  if (!existsSync(file)) return false
  return /http-equiv=["']?refresh/i.test(readFileSync(file, 'utf8'))
}

/** Where a redirect stub sends the visitor. */
export function stubDestination(route: string): string | null {
  const file = join(OUT_DIR, route.replace(/^\//, '').split('/').join(sep), 'index.html')
  if (!existsSync(file)) return null
  const match = /content=["']\s*\d+\s*;\s*url=([^"'>]+)/i.exec(readFileSync(file, 'utf8'))
  return match ? (match[1] as string).trim() : null
}

export function isErrorPage(route: string): boolean {
  return /^\/(404|_not-found)\/$/.test(route)
}

/** Routes a person can actually navigate to and stay on. */
export function pageRoutes(): string[] {
  return routes().filter((route) => !isErrorPage(route) && !isRedirectStub(route))
}

/** Every route worth rendering in a browser, including the error pages. */
export function renderableRoutes(): string[] {
  return routes().filter((route) => !isRedirectStub(route))
}

export function outFile(relativePath: string): string {
  return join(OUT_DIR, relativePath.split('/').join(sep))
}

export function outExists(relativePath: string): boolean {
  return existsSync(outFile(relativePath))
}

export function readOut(relativePath: string): string {
  return readFileSync(outFile(relativePath), 'utf8')
}

/**
 * Does a URL path resolve to a file a static host would serve?
 * A directory resolves through its `index.html`; a file resolves directly.
 */
export function resolvesInOut(urlPath: string): boolean {
  const clean = urlPath.split('#')[0]?.split('?')[0] ?? ''
  const trimmed = clean.replace(/^\//, '')
  const candidates = [trimmed, join(trimmed, 'index.html'), `${trimmed}.html`]
  for (const candidate of candidates) {
    if (candidate === '' ) {
      if (existsSync(join(OUT_DIR, 'index.html'))) return true
      continue
    }
    const full = join(OUT_DIR, candidate.split('/').join(sep))
    if (existsSync(full) && statSync(full).isFile()) return true
  }
  return false
}

export const deployEnv = process.env.DEPLOY_ENV ?? 'development'
export const isProduction = deployEnv === 'production'
