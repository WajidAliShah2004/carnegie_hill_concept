'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Picture } from './Picture'
import { labels } from '@/labels'
import type { PhotoView } from '@/content/view'
import styles from './GalleryGrid.module.css'

export type GalleryGridProps = {
  items: readonly PhotoView[]
  /** Mark the first picture as the LCP candidate. One row per page may. */
  priorityFirst?: boolean
  /**
   * `columns` is the gallery wall: equal columns, pictures flowing down them.
   * `composed` is the arrangement the About page uses, where a short set of
   * shop photographs is laid out in deliberate rows of two and three rather
   * than left to flow.
   */
  layout?: 'columns' | 'composed'
}

const SIZES: Record<'columns' | 'composed', string> = {
  columns:
    '(max-width: 560px) calc(100vw - 40px), (max-width: 1000px) 45vw, (max-width: 1500px) 27vw, 380px',
  composed:
    '(max-width: 620px) calc(100vw - 40px), (max-width: 1000px) 46vw, (max-width: 1500px) 32vw, 440px',
}

/**
 * Pictures at their own shape on the ink ground. No cards, no shadows, no
 * cropping: the work decides the proportion, the way it does on a wall.
 *
 * Without JavaScript every thumbnail is a plain link to the full size photo.
 * With JavaScript the same link opens a native modal dialog, which traps
 * focus and closes on Escape for free, and returns focus to the thumbnail.
 */
export function GalleryGrid({ items, priorityFirst = false, layout = 'columns' }: GalleryGridProps) {
  const [index, setIndex] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const thumbs = useRef<(HTMLAnchorElement | null)[]>([])
  const shown = useRef<number | null>(null)

  useEffect(() => {
    shown.current = index
    const node = dialog.current
    if (!node) return
    if (index !== null && !node.open) node.showModal()
  }, [index])

  const open = useCallback((position: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    setIndex(position)
  }, [])

  const move = useCallback(
    (direction: 1 | -1) => {
      setIndex((current) => {
        if (current === null || items.length === 0) return current
        return (current + direction + items.length) % items.length
      })
    },
    [items.length],
  )

  const onClose = useCallback(() => {
    const position = shown.current
    setIndex(null)
    if (position !== null) thumbs.current[position]?.focus()
  }, [])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDialogElement>) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        move(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        move(-1)
      }
    },
    [move],
  )

  const current = index === null ? null : items[index] ?? null

  /*
    In the composed arrangement each cell grows in proportion to its own
    aspect ratio, so every picture in a row comes out the same height and the
    row has no hole in it. Nothing is cropped to achieve that: the widths
    change, not the pictures.
  */
  const cellStyle = (item: PhotoView) => {
    if (layout !== 'composed') return undefined
    const ratio = item.image.height === 0 ? 1 : item.image.width / item.image.height
    return { flexGrow: ratio, flexBasis: `${Math.round(ratio * 260)}px` }
  }

  return (
    <>
      <ul
        className={[styles.grid, layout === 'composed' ? styles.composed : null]
          .filter(Boolean)
          .join(' ')}
        data-gallery-grid=""
      >
        {items.map((item, position) => (
          <li key={item.id} className={styles.cell} style={cellStyle(item)}>
            <figure className={styles.figure}>
              <a
                ref={(node) => {
                  thumbs.current[position] = node
                }}
                className={styles.thumb}
                href={item.image.src}
                onClick={open(position)}
                data-gallery-thumb={position}
              >
                <Picture
                  image={item.image}
                  alt={item.alt}
                  sizes={SIZES[layout]}
                  priority={priorityFirst && position === 0}
                />
              </a>
              {item.caption ? <figcaption className={styles.caption}>{item.caption}</figcaption> : null}
            </figure>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className={styles.lightbox}
        aria-label={labels.lightbox.label}
        onClose={onClose}
        onKeyDown={onKeyDown}
        data-gallery-lightbox=""
      >
        {current ? (
          <div className={styles.viewer}>
            <div className={styles.viewerBar}>
              <button
                type="button"
                className={styles.viewerButton}
                onClick={() => dialog.current?.close()}
                data-gallery-close=""
              >
                {labels.lightbox.close}
              </button>
            </div>

            <figure className={styles.viewerFigure}>
              <img
                className={styles.viewerImage}
                src={current.image.src}
                {...(current.image.srcSet ? { srcSet: current.image.srcSet } : {})}
                sizes="92vw"
                width={current.image.width}
                height={current.image.height}
                alt={current.alt}
              />
              {current.caption ? (
                <figcaption className={styles.viewerCaption}>{current.caption}</figcaption>
              ) : null}
            </figure>

            {items.length > 1 ? (
              <div className={styles.viewerNav}>
                <button
                  type="button"
                  className={styles.viewerButton}
                  onClick={() => move(-1)}
                  data-gallery-previous=""
                >
                  {labels.lightbox.previous}
                </button>
                <button
                  type="button"
                  className={styles.viewerButton}
                  onClick={() => move(1)}
                  data-gallery-next=""
                >
                  {labels.lightbox.next}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  )
}
