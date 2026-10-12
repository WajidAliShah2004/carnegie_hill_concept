#!/usr/bin/env node
/**
 * Turns the site's seed documents into an NDJSON file that `sanity dataset import`
 * can read.
 *
 * Input:  site/content/seed/*.json  (written by the site build, one document or an
 *         array of documents per file)
 * Output: studio/seed/seed.ndjson
 *
 * Photos are deliberately left out when they point at a local file. The copies in
 * /assets are reduced versions pulled off the live site and must never ship. The
 * real photos are the originals, uploaded by hand through the Studio.
 *
 * Run: npm run seed:ndjson
 */

import {readdir, readFile, mkdir, writeFile} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {LexoRank} from 'lexorank'

const studioDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const seedDir = resolve(studioDir, '..', 'site', 'content', 'seed')
const outFile = resolve(studioDir, 'seed', 'seed.ndjson')

/* ------------------------------------------------------------------ */
/* What the Studio would refuse                                        */
/* ------------------------------------------------------------------ */

/**
 * The required fields in studio/schemas, listed here so importing a seed
 * document tells you up front what an editor would see as an error rather
 * than leaving it to be discovered in the Studio.
 *
 * `reviewsPage` and `privacyPage` are absent from this list on purpose: their
 * H1 is an interface word in site/src/labels.ts, so the Studio marks it
 * optional. See PAGE_TYPES in studio/schemas/documents/pages.ts.
 */
const REQUIRED = {
  businessInfo: ['name', 'street', 'city', 'region', 'postcode', 'country', 'phone', 'email'],
  photo: ['image', 'type'],
  review: ['quote', 'displayName', 'platform', 'sourceUrl'],
  socialPost: ['url'],
  service: ['title', 'anchor'],
  homePage: ['h1', 'metaTitle'],
  aboutPage: ['h1', 'metaTitle'],
  servicesPage: ['h1', 'metaTitle'],
  galleryPage: ['h1', 'metaTitle'],
  contactPage: ['h1', 'metaTitle'],
  reviewsPage: ['metaTitle'],
  privacyPage: ['metaTitle'],
}

/** A value counts as filled in when it has a string, a number, or entries. */
function isEmpty(value) {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') {
    // A sourced object is empty when it holds no text.
    if ('text' in value) return typeof value.text !== 'string' || value.text.trim() === ''
    return Object.keys(value).length === 0
  }
  return false
}

/** Every sourced object with text but no complete source. */
function unsourced(value, path = [], found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => unsourced(item, [...path, index], found))
    return found
  }
  if (!value || typeof value !== 'object') return found
  if (typeof value.text === 'string' && value.text.trim() !== '') {
    const source = value.source
    if (!source || !source.kind || !source.detail) found.push(path.join('.') || 'text')
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'source') continue
    unsourced(child, [...path, key], found)
  }
  return found
}

/** Warnings for one document. Never fatal: the file is still written. */
function validationWarnings(doc) {
  const problems = []
  for (const field of REQUIRED[doc._type] ?? []) {
    if (isEmpty(doc[field])) problems.push(`"${field}" is empty and the Studio requires it`)
  }
  for (const path of unsourced(doc)) {
    problems.push(`"${path}" has text but no source, so the Studio would refuse to publish it`)
  }
  return problems
}

/** Finds every { _type: 'localImage' } anywhere in a document. */
function localImagePaths(value, path = [], found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => localImagePaths(item, [...path, index], found))
    return found
  }
  if (value && typeof value === 'object') {
    if (value._type === 'localImage') {
      found.push({path, value})
      return found
    }
    for (const [key, child] of Object.entries(value)) {
      localImagePaths(child, [...path, key], found)
    }
  }
  return found
}

function unsetAt(doc, path) {
  let node = doc
  for (let i = 0; i < path.length - 1; i += 1) {
    node = node?.[path[i]]
    if (!node) return
  }
  const last = path[path.length - 1]
  if (Array.isArray(node)) node.splice(Number(last), 1)
  else delete node[last]
}

/** Every .json file in the seed folder and its subfolders, as paths relative to it. */
/**
 * The seed writes an empty field as `null`. Sanity leaves an empty field out,
 * and the Studio reports a stored `null` as a value of the wrong type. The site
 * treats a missing field and `null` the same way.
 */
function dropNulls(value) {
  if (Array.isArray(value)) {
    for (const item of value) dropNulls(item)
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (child === null) delete value[key]
      else dropNulls(child)
    }
  }
}

/**
 * The types the drag to order plugin sorts. It keeps its own string field,
 * `orderRank`, and the site sorts on that. The seed carries a numeric `order`
 * instead, which no Studio schema knows, so it is turned into a rank here the
 * same way the plugin's reset order action does it, and then removed.
 */
const ORDERABLE = new Set(['photo', 'review', 'service', 'socialPost'])

function rankByOrder(docs) {
  const byType = new Map()
  for (const doc of docs) {
    if (!ORDERABLE.has(doc._type)) continue
    if (!byType.has(doc._type)) byType.set(doc._type, [])
    byType.get(doc._type).push(doc)
  }
  for (const list of byType.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    let rank = LexoRank.min()
    for (const doc of list) {
      rank = rank.genNext().genNext()
      doc.orderRank = rank.toString()
      delete doc.order
    }
  }
}

async function collectJsonFiles(dir, prefix = '') {
  const entries = await readdir(dir, {withFileTypes: true})
  const found = []
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      found.push(...(await collectJsonFiles(join(dir, entry.name), relative)))
    } else if (entry.name.endsWith('.json')) {
      found.push(relative)
    }
  }
  return found
}

async function main() {
  if (!existsSync(seedDir)) {
    console.error(`No seed folder at ${seedDir}.`)
    console.error('The site build writes it. Run this again once site/content/seed exists.')
    process.exitCode = 1
    return
  }

  const files = (await collectJsonFiles(seedDir)).sort()
  if (files.length === 0) {
    console.error(`No .json files in ${seedDir}.`)
    process.exitCode = 1
    return
  }

  const kept = []
  let skipped = 0
  let stripped = 0
  let flagged = 0

  for (const file of files) {
    const raw = await readFile(join(seedDir, file), 'utf8')
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      console.error(`${file} is not valid JSON. ${error.message}`)
      process.exitCode = 1
      return
    }
    const docs = Array.isArray(parsed) ? parsed : [parsed]

    docs.forEach((doc, index) => {
      if (!doc || typeof doc !== 'object' || !doc._type) {
        console.warn(`Skipped an entry in ${file} at position ${index} because it has no _type.`)
        skipped += 1
        return
      }
      const copy = structuredClone(doc)
      dropNulls(copy)
      if (!copy._id) {
        copy._id = `${copy._type}-${file.replace(/\.json$/, '').replace(/[^a-zA-Z0-9]+/g, '-')}-${index}`
      }

      const locals = localImagePaths(copy)
      if (locals.length > 0) {
        if (copy._type === 'photo') {
          console.warn(
            `Left out ${copy._id}: it points at a local file (${locals[0].value.path}). ` +
              'Photos have to be the originals, uploaded by hand in the Studio.',
          )
          skipped += 1
          return
        }
        for (const local of locals.reverse()) {
          console.warn(
            `Removed the local picture ${local.value.path} from ${copy._id}. ` +
              'Upload the original by hand in the Studio.',
          )
          unsetAt(copy, local.path)
          stripped += 1
        }
      }

      const problems = validationWarnings(copy)
      if (problems.length > 0) {
        flagged += 1
        console.warn(`${copy._id} would not validate in the Studio as it stands:`)
        for (const problem of problems) console.warn(`  ${problem}`)
      }

      kept.push(copy)
    })
  }

  rankByOrder(kept)
  const lines = kept.map((doc) => JSON.stringify(doc))

  await mkdir(dirname(outFile), {recursive: true})
  await writeFile(outFile, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8')

  console.log(`Wrote ${lines.length} documents to ${outFile}.`)
  if (stripped) console.log(`Removed ${stripped} local picture references.`)
  if (skipped) console.log(`Left out ${skipped} documents. See the warnings above.`)
  if (flagged) {
    console.log(
      `${flagged} document(s) import, but an editor opening them will see a validation error. ` +
        'Those gaps are real and are listed in site/README.md under "Open items".',
    )
  }
  console.log('Import it with:')
  console.log('  npx sanity datasets import seed/seed.ndjson --dataset production')
  console.log('Add --replace to overwrite documents that are already there.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
