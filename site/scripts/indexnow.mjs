#!/usr/bin/env node
/**
 * Tell Bing and its partners what changed, after a production deploy.
 *
 *   node scripts/indexnow.mjs [--previous-sitemap path] [--dry-run]
 *
 * It writes the key file into `out/` so the host serves it, works out which
 * URLs changed by comparing this build's `sitemap.xml` with the previous
 * build's (kept as a workflow artifact), and posts that list to IndexNow. With
 * no previous sitemap it posts every URL.
 *
 * It does nothing, quietly, when `INDEXNOW_KEY` is unset or when
 * `DEPLOY_ENV` is not `production`. Staging must never be submitted anywhere.
 *
 * ChatGPT search draws on Bing's index, so Bing coverage is part of the AI
 * visibility plan, not an afterthought.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { OUT_DIR } from './lib/content.mjs'

const dryRun = process.argv.includes('--dry-run')
const key = process.env.INDEXNOW_KEY ?? ''
const environment = process.env.DEPLOY_ENV ?? 'development'
const siteUrl = (process.env.SITE_URL ?? 'https://nyframing.com').replace(/\/$/, '')
const host = new URL(siteUrl).host
const ENDPOINT = 'https://api.indexnow.org/IndexNow'

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1])
}

function entriesWithLastmod(xml) {
  const map = new Map()
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(block)?.[1]
    if (!loc) continue
    map.set(loc, /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/.exec(block)?.[1] ?? '')
  }
  return map
}

async function main() {
  if (key.trim() === '') {
    console.log('indexnow: INDEXNOW_KEY is not set. Skipping.')
    return
  }
  if (environment !== 'production') {
    console.log(`indexnow: DEPLOY_ENV is "${environment}", not production. Skipping.`)
    return
  }
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    console.error('indexnow: INDEXNOW_KEY must be 8 to 128 characters of a-z, A-Z, 0-9 and dashes.')
    process.exitCode = 1
    return
  }

  // The key file proves we own the host. It has to be reachable before the
  // submission, so it is written into out/ and goes up with the deploy.
  const keyFile = join(OUT_DIR, `${key}.txt`)
  if (!dryRun) writeFileSync(keyFile, key)
  console.log(`indexnow: key file ${key}.txt ${dryRun ? 'would be' : ''} written into out/`)

  const sitemapPath = join(OUT_DIR, 'sitemap.xml')
  if (!existsSync(sitemapPath)) {
    console.error('indexnow: out/sitemap.xml is missing. Nothing to submit.')
    process.exitCode = 1
    return
  }

  const current = readFileSync(sitemapPath, 'utf8')
  const currentEntries = entriesWithLastmod(current)
  const previousPath = argValue('--previous-sitemap') ?? process.env.PREVIOUS_SITEMAP ?? ''

  let urls
  if (previousPath !== '' && existsSync(previousPath)) {
    const previousEntries = entriesWithLastmod(readFileSync(previousPath, 'utf8'))
    urls = [...currentEntries.entries()]
      .filter(([loc, lastmod]) => previousEntries.get(loc) !== lastmod)
      .map(([loc]) => loc)
    console.log(
      `indexnow: ${urls.length} of ${currentEntries.size} URL(s) changed since the previous build.`,
    )
  } else {
    urls = sitemapUrls(current)
    console.log(`indexnow: no previous sitemap, submitting all ${urls.length} URL(s).`)
  }

  if (urls.length === 0) {
    console.log('indexnow: nothing changed. Not submitting.')
    return
  }

  const body = { host, key, keyLocation: `${siteUrl}/${key}.txt`, urlList: urls }

  if (dryRun) {
    console.log(`indexnow: would POST ${urls.length} URL(s) to ${ENDPOINT}`)
    for (const url of urls.slice(0, 10)) console.log(`  ${url}`)
    if (urls.length > 10) console.log(`  ... and ${urls.length - 10} more`)
    return
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })

  // 200 and 202 both mean accepted. A failure here must not fail the deploy:
  // the site is already live and correct.
  if (response.ok) {
    console.log(`indexnow: submitted ${urls.length} URL(s). ${response.status}`)
  } else {
    console.warn(
      `indexnow: ${response.status} ${response.statusText}. The deploy is fine; the ping is not.`,
    )
  }
}

main().catch((error) => {
  console.warn('indexnow: failed to run. The deploy is fine; the ping is not.')
  console.warn(error.message)
})
