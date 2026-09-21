#!/usr/bin/env node
/**
 * Measure the compressed first-party JavaScript each built route loads.
 *
 *   npm run build && node scripts/js-weight.mjs
 *
 * Spec 9.6 sets the budget at 150 KB compressed. This prints the real figure
 * per route, split into the Next and React baseline and our own client code,
 * so the conversation about the budget is about numbers rather than guesses.
 * It always exits 0: Lighthouse CI owns the pass or fail.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, relative, sep } from 'node:path'
import { OUT_DIR } from './lib/content.mjs'

const BUDGET = 153_600

/** A chunk counts as ours when it mentions something only our code says. */
const OURS = [/data-hang-row/, /Skip to content/, /data-hang-next/, /aria-expanded/]

function htmlFiles(dir = OUT_DIR, into = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '_next' || entry.name === 'dev-assets') continue
      htmlFiles(full, into)
    } else if (entry.name.endsWith('.html')) into.push(full)
  }
  return into
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

const rows = []

for (const file of htmlFiles()) {
  const html = readFileSync(file, 'utf8')
  const route = `/${relative(OUT_DIR, file).split(sep).join('/')}`.replace(/\/index\.html$/, '/')

  const srcs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))]
  let baseline = 0
  let ours = 0
  for (const src of srcs) {
    const path = join(OUT_DIR, src.replace(/^\//, '').split('/').join(sep))
    try {
      statSync(path)
    } catch {
      continue
    }
    const body = readFileSync(path)
    const size = gzipSync(body).length
    if (OURS.some((pattern) => pattern.test(body.toString('utf8')))) ours += size
    else baseline += size
  }

  const inline = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .join('')
  const inlineSize = gzipSync(Buffer.from(inline)).length

  rows.push({ route, baseline, ours, inline: inlineSize, total: baseline + ours + inlineSize })
}

rows.sort((a, b) => b.total - a.total)

console.log('First-party JavaScript per route, gzipped:\n')
console.log(
  ['route'.padEnd(26), 'total'.padStart(10), 'framework'.padStart(11), 'ours'.padStart(9), 'inline'.padStart(9)].join(''),
)
for (const row of rows) {
  console.log(
    [
      row.route.padEnd(26),
      kb(row.total).padStart(10),
      kb(row.baseline).padStart(11),
      kb(row.ours).padStart(9),
      kb(row.inline).padStart(9),
    ].join(''),
  )
}

const worst = rows[0]
console.log(
  `\nBudget (spec 9.6): ${kb(BUDGET)} compressed.\n` +
    `Worst route: ${worst.route} at ${kb(worst.total)}, ` +
    `${worst.total > BUDGET ? `${kb(worst.total - BUDGET)} over` : 'inside the budget'}.\n` +
    `Of that, ${kb(worst.baseline)} is the Next and React baseline and ${kb(worst.ours)} is our own client code.`,
)
