#!/usr/bin/env node
/**
 * Copy every `/assets` file the seed content refers to into
 * `site/public/dev-assets/`, generate the resized WebP variants that give a
 * local image a real `srcset`, and derive the icon set from the logo.
 *
 * The files in `/assets` are reduced copies pulled off the live site. They are
 * not the originals and must never ship. A build with `DEPLOY_ENV=production`
 * fails here if any `localImage` is still referenced.
 *
 * Variants: `<name>-<width>.webp` at 480, 768, 1200 and 1600, never wider than
 * the original, so staging behaves like the Sanity CDN path rather than
 * shipping one full size JPEG per picture. `src/content/image.ts` names the
 * same files from the same rule; the two must agree, and `variantWidths` below
 * is the copy of record.
 *
 * Icons: the logo's monogram is the left 153 by 153 pixels of `logo.png`. It is
 * painted solid white on the ink token and written at the sizes a browser, a
 * home screen, and a web manifest ask for. No new artwork is drawn.
 */

import { readdirSync, readFileSync, mkdirSync, copyFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const seedDir = join(siteDir, 'content', 'seed')
const assetsDir = resolve(siteDir, '..', 'assets')
const outDir = join(siteDir, 'public', 'dev-assets')
const iconDir = join(siteDir, 'public', 'icons')

/** Must stay identical to `WIDTHS` in src/content/image.ts. */
const WIDTHS = [480, 768, 1200, 1600]
const QUALITY = 74

/** The ink token from src/app/globals.css. Measured, never picked by eye. */
const INK = { r: 0x13, g: 0x16, b: 0x1f, alpha: 1 }

/**
 * The widths a local image is rendered at. Nothing is ever upscaled, so a
 * picture narrower than 480 gets one variant at its own width.
 *
 * Must stay identical to `localVariantWidths` in src/content/image.ts.
 */
function variantWidths(width) {
  const fitting = WIDTHS.filter((w) => w <= width)
  return fitting.length > 0 ? fitting : [width]
}

/** Must stay identical to `localVariantPath` in src/content/image.ts. */
function variantName(path, width) {
  return `${path.replace(/\.[^./\\]+$/, '')}-${width}.webp`
}

function seedFiles(dir) {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...seedFiles(full))
    else if (entry.name.endsWith('.json')) found.push(full)
  }
  return found
}

function collectLocalImages(node, into) {
  if (Array.isArray(node)) {
    for (const item of node) collectLocalImages(item, into)
    return
  }
  if (node && typeof node === 'object') {
    if (node._type === 'localImage' && typeof node.path === 'string') into.add(node.path)
    for (const value of Object.values(node)) collectLocalImages(value, into)
  }
}

const referenced = new Set()
if (existsSync(seedDir)) {
  for (const file of seedFiles(seedDir)) {
    collectLocalImages(JSON.parse(readFileSync(file, 'utf8')), referenced)
  }
}

if (process.env.DEPLOY_ENV === 'production' && referenced.size > 0) {
  console.error(
    `\nProduction build refused.\n\n` +
      `${referenced.size} localImage reference(s) still point at the reduced copies in /assets:\n` +
      `  ${[...referenced].sort().join(', ')}\n\n` +
      `Those files were pulled off the live site at reduced size for the concepts.\n` +
      `Production must use the originals from the WordPress media library, uploaded to Sanity.\n`,
  )
  process.exit(1)
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const missing = []
const work = []
for (const path of referenced) {
  const from = join(assetsDir, path)
  if (!existsSync(from) || !statSync(from).isFile()) {
    missing.push(path)
    continue
  }
  work.push({ path, from })
}

if (missing.length > 0) {
  console.error(`\nMissing files in ${assetsDir}:\n  ${missing.sort().join(', ')}\n`)
  process.exit(1)
}

/* ------------------------------------------------------------------ */
/* Variants                                                           */
/* ------------------------------------------------------------------ */

let copied = 0
let variants = 0
let bytesIn = 0
let bytesOut = 0

async function renderOne({ path, from }) {
  // The original stays available: the lightbox and the no-JavaScript
  // thumbnail link both point at a real file, and `src` falls back to it.
  copyFileSync(from, join(outDir, path))
  copied += 1
  bytesIn += statSync(from).size

  const source = sharp(from)
  const meta = await source.metadata()
  const width = meta.width ?? 0
  if (width === 0) throw new Error(`Could not read the width of ${path}`)

  for (const target of variantWidths(width)) {
    const file = join(outDir, variantName(path, target))
    const info = await sharp(from)
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6, smartSubsample: true })
      .toFile(file)
    variants += 1
    bytesOut += info.size
  }
}

async function renderIcons() {
  const logo = join(assetsDir, 'logo.png')
  if (!existsSync(logo)) {
    console.warn('prebuild-assets: no logo.png in /assets, so no icons were written.')
    return 0
  }
  rmSync(iconDir, { recursive: true, force: true })
  mkdirSync(iconDir, { recursive: true })

  // The monogram is the left square of the wordmark.
  const meta = await sharp(logo).metadata()
  const side = Math.min(meta.height ?? 0, meta.width ?? 0)
  const square = await sharp(logo).extract({ left: 0, top: 0, width: side, height: side }).toBuffer()

  // The artwork is dark with an alpha channel. The header paints it solid
  // white rather than inverting it, so an icon does the same: take the alpha
  // as a stencil and fill it white.
  const alpha = await sharp(square).ensureAlpha().extractChannel(3).raw().toBuffer()
  const white = await sharp({
    create: { width: side, height: side, channels: 3, background: '#ffffff' },
  })
    .joinChannel(alpha, { raw: { width: side, height: side, channels: 1 } })
    .png()
    .toBuffer()

  /** One icon: the white monogram centred on ink, at `content` of the canvas. */
  const write = async (name, size, content) => {
    const inner = Math.round(size * content)
    const mark = await sharp(white).resize({ width: inner, height: inner, fit: 'inside' }).toBuffer()
    const marked = await sharp(mark).metadata()
    await sharp({ create: { width: size, height: size, channels: 4, background: INK } })
      .composite([
        {
          input: mark,
          left: Math.round((size - (marked.width ?? inner)) / 2),
          top: Math.round((size - (marked.height ?? inner)) / 2),
        },
      ])
      .png({ compressionLevel: 9 })
      .toFile(join(iconDir, name))
  }

  await write('favicon-16.png', 16, 0.86)
  await write('favicon-32.png', 32, 0.8)
  await write('favicon-48.png', 48, 0.78)
  await write('apple-touch-icon.png', 180, 0.72)
  await write('icon-192.png', 192, 0.76)
  await write('icon-512.png', 512, 0.76)
  // A maskable icon is cropped to a circle on some launchers, so the mark
  // sits inside the safe zone.
  await write('maskable-512.png', 512, 0.54)
  return 7
}

async function main() {
  // sharp is happy in parallel, but a long queue of full size JPEGs is not
  // worth the memory, so the pictures go through in small batches.
  const batch = 6
  for (let index = 0; index < work.length; index += batch) {
    await Promise.all(work.slice(index, index + batch).map(renderOne))
  }
  const icons = await renderIcons()

  const mb = (value) => `${(value / 1024 / 1024).toFixed(1)} MB`
  console.log(
    `prebuild-assets: ${copied} file(s) into public/dev-assets/, ` +
      `${variants} WebP variant(s) (${mb(bytesIn)} of originals, ${mb(bytesOut)} of variants), ` +
      `${icons} icon(s) into public/icons/.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
