/**
 * Turn content documents into the plain, serialisable shapes components take.
 *
 * Components never see a `Photo`, a `ContentImage`, or a `Sourced` value. They
 * see strings and numbers. That keeps every client component free of content
 * logic and free of the build-time environment.
 */

import { labels } from '@/labels'
import { imageSources, type ImageSources } from './image'
import type { ContentImage, Photo } from './types'

/** The four sizes a picture can be hung at, from the-hang/style.css. */
export type HangSize = 's' | 'm' | 'l' | 'xl'

export type PhotoView = {
  id: string
  image: ImageSources
  /** The owner's caption when he wrote one, otherwise the photo type's label. */
  alt: string
  caption?: string
  size: HangSize
}

export function sources(image: ContentImage): ImageSources {
  return imageSources(image)
}

/**
 * Alt text rule from the production build contract: the owner's caption when
 * present, otherwise the label for the photo's type. Nothing else ever
 * describes a photo.
 */
export function altText(photo: Photo): string {
  return photo.caption ?? labels.photoTypes[photo.type]
}

/** A fixed rhythm of picture heights, so a row never reads as a grid. */
const RHYTHM: readonly HangSize[] = ['xl', 'm', 'l', 's', 'm', 'l', 'xl', 's', 'm', 'l', 's', 'xl']

export function photoView(photo: Photo, index: number): PhotoView {
  return {
    id: photo.id,
    image: sources(photo.image),
    alt: altText(photo),
    caption: photo.caption,
    size: RHYTHM[index % RHYTHM.length] as HangSize,
  }
}

export function photoViews(photos: readonly Photo[]): PhotoView[] {
  return photos.map((photo, index) => photoView(photo, index))
}
