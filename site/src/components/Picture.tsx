import type { ImageSources } from '@/content/image'

export type PictureProps = {
  image: ImageSources
  /** The owner's caption, or the photo type label. Never written by us. */
  alt: string
  sizes?: string
  /**
   * The one image above the fold. Preloaded, decoded eagerly, never lazy,
   * and marked high priority so it can be the LCP element.
   */
  priority?: boolean
  /**
   * Load at once without preloading. For an image that is certainly on screen
   * but is not the one the page should be judged on, such as the mark in the
   * header. `priority` implies this.
   */
  eager?: boolean
  className?: string
}

/**
 * Every image on the site goes through here, so width and height are always
 * set and nothing shifts while the page loads.
 */
export function Picture({ image, alt, sizes, priority = false, eager = false, className }: PictureProps) {
  return (
    <>
      {priority ? (
        <link
          rel="preload"
          as="image"
          href={image.src}
          {...(image.srcSet ? { imageSrcSet: image.srcSet } : {})}
          {...(sizes ? { imageSizes: sizes } : {})}
          fetchPriority="high"
        />
      ) : null}
      <img
        className={className}
        src={image.src}
        {...(image.srcSet ? { srcSet: image.srcSet } : {})}
        {...(sizes ? { sizes } : {})}
        width={image.width}
        height={image.height}
        alt={alt}
        loading={priority || eager ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority || eager ? 'high' : 'auto'}
      />
    </>
  )
}
