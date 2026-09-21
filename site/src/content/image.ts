/**
 * Image URLs and srcsets.
 *
 * Sanity images go through the image pipeline (`?w=&fm=webp&q=`), honouring
 * the hotspot so a crop keeps the right part of the picture. Local images are
 * the reduced copies in `/assets`, served from `public/dev-assets/` during
 * development and refused by a production build.
 */

import { isLocalImage, type ContentImage } from './types'

export const WIDTHS = [480, 768, 1200, 1600] as const

const QUALITY = 78

const projectId = process.env.SANITY_PROJECT_ID ?? ''
const dataset = process.env.SANITY_DATASET ?? 'production'

/** `image-<id>-<width>x<height>-<format>` is Sanity's asset reference shape. */
function parseRef(ref: string): { id: string; width: number; height: number; format: string } | null {
  const parts = ref.split('-')
  if (parts.length < 4 || parts[0] !== 'image') return null
  const format = parts[parts.length - 1] as string
  const dimensions = (parts[parts.length - 2] ?? '').split('x')
  const id = parts.slice(1, parts.length - 2).join('-')
  const width = Number(dimensions[0])
  const height = Number(dimensions[1])
  if (!id || !Number.isFinite(width) || !Number.isFinite(height)) return null
  return { id, width, height, format }
}

export function intrinsicSize(image: ContentImage): { width: number; height: number } {
  if (isLocalImage(image)) return { width: image.width, height: image.height }
  const declared = image.metadata?.dimensions
  if (declared) return declared
  const parsed = parseRef(image.asset._ref)
  if (!parsed) throw new Error(`Image asset reference has no dimensions: ${image.asset._ref}`)
  return { width: parsed.width, height: parsed.height }
}

function sanityBase(image: Exclude<ContentImage, { _type: 'localImage' }>): string {
  if (image.asset.url) return image.asset.url
  const parsed = parseRef(image.asset._ref)
  if (!parsed) throw new Error(`Unreadable Sanity image reference: ${image.asset._ref}`)
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${parsed.id}-${parsed.width}x${parsed.height}.${parsed.format}`
}

function sanityUrl(image: Exclude<ContentImage, { _type: 'localImage' }>, width: number): string {
  const params = new URLSearchParams({
    w: String(width),
    fm: 'webp',
    q: String(QUALITY),
    auto: 'format',
  })
  if (image.hotspot) {
    params.set('fp-x', image.hotspot.x.toFixed(3))
    params.set('fp-y', image.hotspot.y.toFixed(3))
    params.set('fit', 'crop')
    params.set('crop', 'focalpoint')
  }
  return `${sanityBase(image)}?${params.toString()}`
}

export type ImageSources = {
  src: string
  srcSet?: string
  width: number
  height: number
}

/**
 * Build `src`, `srcset`, and the intrinsic size for one image.
 * Widths larger than the original are left out, so nothing is upscaled.
 */
/**
 * The widths a local image is rendered at. Nothing is ever upscaled, so a
 * picture narrower than the smallest step gets one variant at its own width.
 *
 * `scripts/prebuild-assets.mjs` writes exactly these files. The two copies of
 * this rule must agree; the script carries the comment of record.
 */
export function localVariantWidths(width: number): number[] {
  const fitting = WIDTHS.filter((w) => w <= width)
  return fitting.length > 0 ? [...fitting] : [width]
}

/** `work-09.jpg` at 768 is `work-09-768.webp`. */
export function localVariantPath(path: string, width: number): string {
  return `${path.replace(/\.[^./\\]+$/, '')}-${width}.webp`
}

export function imageSources(image: ContentImage): ImageSources {
  const { width, height } = intrinsicSize(image)

  if (isLocalImage(image)) {
    // The originals in /assets have no image pipeline behind them, so the
    // prebuild step generates the same four widths the Sanity CDN would, and
    // staging measures like production will.
    const widths = localVariantWidths(width)
    const url = (w: number) => `/dev-assets/${localVariantPath(image.path, w)}`
    return {
      src: url(widths[widths.length - 1] as number),
      srcSet: widths.map((w) => `${url(w)} ${w}w`).join(', '),
      width,
      height,
    }
  }

  const widths = WIDTHS.filter((w) => w <= width)
  if (widths.length === 0 || (widths[widths.length - 1] as number) < width) {
    widths.push(width as (typeof WIDTHS)[number])
  }
  const unique = Array.from(new Set(widths)).sort((a, b) => a - b)

  return {
    src: sanityUrl(image, unique[unique.length - 1] as number),
    srcSet: unique.map((w) => `${sanityUrl(image, w)} ${w}w`).join(', '),
    width,
    height,
  }
}
