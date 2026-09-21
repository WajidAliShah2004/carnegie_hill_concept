/**
 * Shared reading of raw content for the CI gates.
 *
 * "Raw" means the documents exactly as Sanity or `content/seed/*.json` hold
 * them, with the private `source` object still attached. The site's own loader
 * strips `source` before a component ever sees it; the gates need it, so they
 * read the raw form here instead of going through `src/content/load.ts`.
 *
 * When `SANITY_PROJECT_ID` is set the documents come from Sanity. Otherwise
 * they come from the seed. Both paths return the same shape.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SEED_DIR = join(SITE_ROOT, 'content', 'seed')
export const OUT_DIR = join(SITE_ROOT, 'out')

export const SOURCE_KINDS = ['liveSite', 'ownerWritten', 'reviewUrl', 'observedInPhoto']

export const PAGE_KEYS = [
  'homePage',
  'aboutPage',
  'servicesPage',
  'galleryPage',
  'reviewsPage',
  'contactPage',
  'privacyPage',
]

export const COLLECTION_FILES = {
  photos: 'photo',
  reviews: 'review',
  socialPosts: 'socialPost',
  services: 'service',
}

export const usingSanity = Boolean(process.env.SANITY_PROJECT_ID)

/** Keys whose string values are identifiers or machine values, not content. */
const METADATA_KEYS = new Set([
  '_id',
  '_type',
  '_key',
  '_ref',
  'key',
  'anchor',
  'path',
  'galleryType',
  'type',
  'platform',
  'order',
])

/** A document as the gates see it: an id, a type, where it came from, the body. */
function doc(id, type, origin, body) {
  return { id, type, origin, body }
}

function readSeedFile(relative) {
  const file = join(SEED_DIR, relative)
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8'))
}

async function sanityClient() {
  const { createClient } = await import('@sanity/client')
  return createClient({
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET ?? 'production',
    apiVersion: '2024-10-01',
    token: process.env.SANITY_READ_TOKEN,
    useCdn: false,
    perspective: 'published',
  })
}

/**
 * Every raw document, in a stable order.
 *
 * @returns {Promise<{id: string, type: string, origin: string, body: object}[]>}
 */
export async function loadRawDocuments() {
  if (usingSanity) {
    const client = await sanityClient()
    const types = [...Object.values(COLLECTION_FILES), 'businessInfo', ...PAGE_KEYS]
    const docs = await client.fetch(
      `*[!(_id in path("drafts.**")) && _type in $types] | order(_type asc, _id asc)`,
      { types },
    )
    return docs.map((body) => doc(body._id, body._type, 'sanity', body))
  }

  const documents = []

  const business = readSeedFile('businessInfo.json')
  if (business) {
    documents.push(doc(business._id ?? 'businessInfo', 'businessInfo', 'content/seed/businessInfo.json', business))
  }

  for (const pageKey of PAGE_KEYS) {
    const page = readSeedFile(join('pages', `${pageKey}.json`))
    if (page) documents.push(doc(page._id ?? pageKey, pageKey, `content/seed/pages/${pageKey}.json`, page))
  }

  for (const [file, type] of Object.entries(COLLECTION_FILES)) {
    const list = readSeedFile(`${file}.json`)
    if (!Array.isArray(list)) continue
    for (const body of list) {
      documents.push(doc(body._id ?? `${type}?`, body._type ?? type, `content/seed/${file}.json`, body))
    }
  }

  return documents
}

/** True when a value looks like a `Sourced` object, sourced or not. */
export function looksSourced(value) {
  return Boolean(
    value && typeof value === 'object' && !Array.isArray(value) && typeof value.text === 'string',
  )
}

/**
 * Call back once for every `Sourced`-shaped value in a document, with a dotted
 * path so a failure can name the exact field.
 */
export function walkSourced(body, visit, path = '') {
  if (Array.isArray(body)) {
    body.forEach((item, index) => walkSourced(item, visit, `${path}[${index}]`))
    return
  }
  if (!body || typeof body !== 'object') return
  if (looksSourced(body)) {
    visit(path === '' ? '(root)' : path, body)
    return
  }
  for (const [key, value] of Object.entries(body)) {
    walkSourced(value, visit, path === '' ? key : `${path}.${key}`)
  }
}

/**
 * Every plain string in a document once `source` has been stripped: the words
 * that may legitimately appear on the page. Identifier fields are left out so
 * the allowed set stays tight.
 */
export function contentStrings(body, into = new Set(), key = '') {
  if (typeof body === 'string') {
    if (!METADATA_KEYS.has(key)) into.add(body)
    return into
  }
  if (Array.isArray(body)) {
    for (const item of body) contentStrings(item, into, key)
    return into
  }
  if (!body || typeof body !== 'object') return into
  for (const [childKey, value] of Object.entries(body)) {
    if (childKey === 'source') continue
    contentStrings(value, into, childKey)
  }
  return into
}

/**
 * Display forms the site composes from `businessInfo`. They are not fields, so
 * they have to be derived the same way the components derive them, or the
 * visible-string check would reject the address line it built itself.
 */
export function derivedBusinessStrings(business, joinWord) {
  const out = new Set()
  if (!business) return out
  const b = business
  const plain = (value) => (typeof value === 'string' ? value.trim() : '')

  const street = plain(b.street)
  const city = plain(b.city)
  const region = plain(b.region)
  const postcode = plain(b.postcode)

  if (city && region && postcode) out.add(`${city}, ${region} ${postcode}`)
  if (street && city && region && postcode) {
    out.add(`${street}, ${city}, ${region} ${postcode}`)
    out.add(`${street}, ${city}, ${region} ${postcode}, ${plain(b.country)}`.replace(/, $/, ''))
  }

  for (const hours of b.hours ?? []) {
    const days = hours.days ?? []
    const first = days[0]
    const last = days[days.length - 1]
    if (first && last) {
      out.add(first === last ? first : `${first} ${joinWord} ${last}`)
      out.add(`${hours.opens} ${joinWord} ${hours.closes}`)
      out.add(
        `${first === last ? first : `${first} ${joinWord} ${last}`}, ${hours.opens} ${joinWord} ${hours.closes}`,
      )
      out.add(time24(hours.opens))
      out.add(time24(hours.closes))
    }
  }

  const phoneDisplay = plain(b.phoneDisplay)
  if (phoneDisplay) {
    out.add(phoneDisplay)
    out.add(phoneDisplay.replace(/-/g, ' '))
  }
  return out
}

/** The same conversion `BusinessFacts.time24` does, for schema and <time>. */
export function time24(value) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(value ?? '').trim())
  if (!match) return String(value ?? '')
  const minutes = match[2]
  const suffix = match[3]?.toUpperCase()
  let hours = Number(match[1])
  if (suffix === 'PM' && hours < 12) hours += 12
  if (suffix === 'AM' && hours === 12) hours = 0
  return `${String(hours).padStart(2, '0')}:${minutes}`
}

/** Labels are TypeScript; Node strips the types on import. */
export async function loadLabels() {
  return import(new URL('../../src/labels.ts', import.meta.url).href)
}

/**
 * The full allowed set: content plus labels plus derived display forms.
 * `extra` lets a caller (the string-check fixture test) add strings.
 */
export async function allowedStrings(extra = []) {
  const documents = await loadRawDocuments()
  const { labelList } = await loadLabels()
  const labels = await loadLabels()
  const joinWord = labels.labels?.facts?.to ?? 'to'

  const allowed = new Set()
  for (const document of documents) contentStrings(document.body, allowed)
  for (const label of labelList()) allowed.add(label)

  const business = documents.find((document) => document.type === 'businessInfo')
  for (const value of derivedBusinessStrings(business?.body, joinWord)) allowed.add(value)
  for (const value of extra) allowed.add(value)

  const cleaned = new Set()
  for (const value of allowed) {
    const trimmed = String(value).replace(/\s+/g, ' ').trim()
    if (trimmed !== '') cleaned.add(trimmed)
  }
  return { allowed: cleaned, documents, business: business?.body ?? null }
}
