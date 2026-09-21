#!/usr/bin/env node
/**
 * Serve `out/` the way a static host does: a directory maps to its
 * `index.html`, a missing path returns `404.html`. Used by the Playwright
 * checks so they run against the real exported files, not a dev server.
 *
 *   node scripts/serve-out.mjs [port]
 */

import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, resolve, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rscRewrites } from './deploy.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'out')
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173)

/**
 * The RSC payload rewrites, from the same enumeration the deploy script writes
 * into `_redirects` and `.htaccess`. Local serving, Cloudflare, and Hostinger
 * therefore answer the same set of paths, including the catch-all gallery
 * route, whose payload lives two directories deep.
 */
const payloadRewrites = new Map(
  existsSync(root) ? rscRewrites(root).map((rule) => [rule.from, rule.to]) : [],
)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
}

async function readIfFile(path) {
  try {
    const info = await stat(path)
    if (!info.isFile()) return null
    return await readFile(path)
  } catch {
    return null
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  const candidates = [join(root, path), join(root, path, 'index.html'), `${join(root, path)}.html`]

  // Next writes RSC payloads at `dir/__next.route/__PAGE__.txt` but asks for
  // `dir/__next.route.__PAGE__.txt`. A real host needs the same rewrite, so
  // the rules come from the deploy script rather than a second guess at them.
  if (path.endsWith('.txt')) {
    const asked = `/${path.split(/[\\/]/).filter(Boolean).join('/')}`
    const rewritten = payloadRewrites.get(asked)
    if (rewritten) candidates.push(join(root, rewritten))
  }

  for (const candidate of candidates) {
    if (!resolve(candidate).startsWith(root)) continue
    const body = await readIfFile(candidate)
    if (body) {
      response.writeHead(200, {
        'content-type': TYPES[extname(candidate)] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
      })
      response.end(body)
      return
    }
  }

  const notFound = await readIfFile(join(root, '404.html'))
  response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
  response.end(notFound ?? 'Not found')
}).listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port}`)
})
