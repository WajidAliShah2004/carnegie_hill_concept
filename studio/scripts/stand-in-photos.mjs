/**
 * Puts the reduced copies in /assets into Sanity as stand-in photos, so a
 * staging build shows the whole site before the originals arrive, or takes
 * every stand-in out again.
 *
 * The copies were pulled off the old site at reduced size and must never ship.
 * Each photo written here carries `standIn: true`, the Studio labels it, and a
 * production build of the site refuses to run while any photo has it.
 *
 * Each photo keeps its seed id, type, caption (with the caption's own source),
 * slider setting and order, so staging looks like the seed build.
 *
 * Run from studio/:
 *   npx sanity exec scripts/stand-in-photos.mjs --with-user-token
 *   npx sanity exec scripts/stand-in-photos.mjs --with-user-token -- --remove
 */

import {createReadStream, existsSync, readFileSync} from 'node:fs'
import {basename, dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {getCliClient} from 'sanity/cli'
import {LexoRank} from 'lexorank'

const studioDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = resolve(studioDir, '..', 'assets')
const seedFile = resolve(studioDir, '..', 'site', 'content', 'seed', 'photos.json')

const client = getCliClient({apiVersion: '2024-10-01'})

async function add() {
  const seed = JSON.parse(readFileSync(seedFile, 'utf8'))
  const photos = [...seed].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Ranked the way the drag to order plugin's reset does it, as in seed-to-ndjson.mjs.
  let rank = LexoRank.min()
  const tx = client.transaction()
  for (const photo of photos) {
    rank = rank.genNext().genNext()
    const file = resolve(assetsDir, photo.image.path)
    if (!existsSync(file)) throw new Error(`Missing ${file}`)
    const asset = await client.assets.upload('image', createReadStream(file), {
      filename: basename(file),
    })
    const doc = {
      _id: photo._id,
      _type: 'photo',
      image: {_type: 'image', asset: {_type: 'reference', _ref: asset._id}},
      type: photo.type,
      onHomeSlider: Boolean(photo.onHomeSlider),
      orderRank: rank.toString(),
      standIn: true,
    }
    if (photo.caption?.text) doc.caption = {_type: 'ownerCaption', ...photo.caption}
    tx.createOrReplace(doc)
    console.log(`${photo._id}: ${photo.image.path}`)
  }
  await tx.commit()
  console.log(`\nWrote ${photos.length} stand-in photos. Remove them with --remove once the originals are in.`)
}

async function remove() {
  const found = await client.fetch(
    `*[_type == "photo" && standIn == true]{_id, "asset": image.asset._ref}`,
    {},
    {perspective: 'raw'},
  )
  if (found.length === 0) {
    console.log('No stand-in photos found.')
    return
  }
  const tx = client.transaction()
  for (const doc of found) tx.delete(doc._id)
  await tx.commit()
  console.log(`Deleted ${found.length} stand-in photo document(s).`)

  // An asset another document still uses stays.
  const assets = [...new Set(found.map((doc) => doc.asset).filter(Boolean))]
  let removed = 0
  for (const id of assets) {
    const users = await client.fetch(`count(*[references($id)])`, {id}, {perspective: 'raw'})
    if (users === 0) {
      await client.delete(id)
      removed += 1
    }
  }
  console.log(`Deleted ${removed} image(s) nothing else uses.`)
}

const mode = process.argv.includes('--remove') ? remove : add
mode().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
