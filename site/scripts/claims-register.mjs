#!/usr/bin/env node
/**
 * Generate `docs/claims-register.md` from the content, so it cannot drift.
 *
 *   npm run claims            # write the file
 *   npm run claims -- --check # fail if the file is out of date
 *
 * Spec 3.4: one row per claim, with text, page, source, approved by, date, and
 * status. A claim that is not approved does not publish. Approvals come back
 * from the owner through Juko; this script never invents one, and it carries
 * forward any approval already recorded in the file.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SITE_ROOT, loadRawDocuments, walkSourced } from './lib/content.mjs'

const REGISTER = join(SITE_ROOT, '..', 'docs', 'claims-register.md')
const check = process.argv.includes('--check')

/** Where a claim appears, in the owner's language rather than a document id. */
const WHERE = {
  businessInfo: 'Every page (header, contact block, footer)',
  homePage: 'Home',
  aboutPage: 'About',
  servicesPage: 'Services',
  galleryPage: 'Gallery',
  reviewsPage: 'Reviews',
  contactPage: 'Contact',
  privacyPage: 'Privacy notice',
  review: 'Reviews, and the row on Home',
  service: 'Services, and the row on Home',
  photo: 'Gallery',
  socialPost: 'Home',
}

const KIND = {
  liveSite: 'Live site',
  ownerWritten: 'Owner wrote it',
  reviewUrl: 'Customer review',
  observedInPhoto: 'Visible in the photo',
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
}

/** Read approvals already in the file so a rerun never loses one. */
function existingApprovals() {
  const approvals = new Map()
  if (!existsSync(REGISTER)) return approvals
  for (const line of readFileSync(REGISTER, 'utf8').split('\n')) {
    if (!line.startsWith('|') || line.startsWith('| ---')) continue
    const cells = line.split('|').map((cell) => cell.trim())
    // '' | claim | page | field | source | approved by | date | status | ''
    if (cells.length < 9) continue
    const claim = cells[1]
    if (claim === '' || claim === 'Claim') continue
    approvals.set(claim, { approvedBy: cells[5], date: cells[6], status: cells[7] })
  }
  return approvals
}

async function build() {
  const documents = await loadRawDocuments()
  const previous = existingApprovals()

  const rows = []
  const seen = new Set()

  for (const document of documents) {
    walkSourced(document.body, (path, value) => {
      const text = typeof value.text === 'string' ? value.text.trim() : ''
      if (text === '') return
      const claim = escapeCell(text)
      if (seen.has(claim)) return
      seen.add(claim)

      const kind = KIND[value.source?.kind] ?? 'Unsourced'
      const detail = escapeCell(value.source?.detail ?? '')
      const carried = previous.get(claim)

      rows.push({
        claim,
        page: WHERE[document.type] ?? document.type,
        field: path,
        source: `${kind}. ${detail}`,
        approvedBy: carried?.approvedBy ?? '',
        date: carried?.date ?? '',
        status: carried?.status ?? 'pending owner confirmation',
      })
    })
  }

  rows.sort((a, b) => a.page.localeCompare(b.page) || a.claim.localeCompare(b.claim))

  const lines = [
    '# Claims register',
    '',
    'Every statement this site makes about Carnegie Hill Gallery & Custom Framing,',
    'one row each, with where it came from and whether the owner has confirmed it.',
    '',
    '`docs/copy-sources.md` records where wording came from. This file records who',
    'has agreed it is true. A claim that is not approved does not publish.',
    '',
    '**This file is generated.** Run `npm run claims` in `site/` after any content',
    'change. Approvals already recorded here are carried forward, so filling in the',
    '"Approved by" and "Date" columns is safe and is the point of the file.',
    '',
    `Generated from ${documents.length} content document(s). ${rows.length} claim(s).`,
    '',
    '| Claim | Page | Field | Source | Approved by | Date | Status |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ]

  for (const row of rows) {
    lines.push(
      `| ${row.claim} | ${row.page} | \`${row.field}\` | ${row.source} | ${row.approvedBy} | ${row.date} | ${row.status} |`,
    )
  }

  lines.push(
    '',
    '## How to use this',
    '',
    'Send the Claim column to Juko, one page at a time. When the owner confirms a',
    'line, put his name in "Approved by", the date in "Date", and change "Status" to',
    '`approved`. When he corrects a line, change the wording in Sanity, record the',
    'new source, and rerun this script: the claim text changes, so the old approval',
    'does not carry over by accident.',
    '',
    '## Still open',
    '',
    '- The live site says both "Sun by appointment only" and that the shop stays open',
    '  every day. The second line is withheld from the site until the owner resolves it.',
    '- "Since 2007", "Museum Quality", and "Over 2000 Frames" are the owner\'s own',
    '  published words. They still need his confirmation that they are current.',
    '- The eight reviews are verbatim and have no permalinks yet, so a production',
    '  build leaves them out. The links are blocked on Google Business Profile access.',
    '',
  )

  return lines.join('\n')
}

async function main() {
  const next = await build()

  if (check) {
    const current = existsSync(REGISTER) ? readFileSync(REGISTER, 'utf8') : ''
    if (current.trim() !== next.trim()) {
      console.error(
        'claims-register: docs/claims-register.md is out of date. Run `npm run claims` and commit the result.',
      )
      process.exitCode = 1
      return
    }
    console.log('claims-register: docs/claims-register.md matches the content.')
    return
  }

  writeFileSync(REGISTER, next)
  const count = next.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| ---')).length - 1
  console.log(`claims-register: wrote docs/claims-register.md with ${count} claim(s).`)
}

main().catch((error) => {
  console.error('claims-register: failed to run.')
  console.error(error)
  process.exitCode = 1
})
