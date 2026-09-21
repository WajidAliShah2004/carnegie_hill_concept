import Link from 'next/link'
import { labels } from '@/labels'
import type { GalleryTab } from '@/content/gallery'
import styles from './GalleryTabs.module.css'

export type GalleryTabsProps = {
  tabs: readonly GalleryTab[]
  /** The slug of the tab being shown. `''` is the tab at the gallery root. */
  current: string
}

/**
 * Real links to real URLs, not JavaScript tabs. A photo type with no photos
 * never reaches this list, so an empty tab is never shown.
 */
export function GalleryTabs({ tabs, current }: GalleryTabsProps) {
  if (tabs.length < 2) return null
  return (
    <nav aria-label={labels.gallery.tabs} className={styles.tabs}>
      <ul className={styles.list}>
        {tabs.map((tab) => {
          const active = tab.slug === current
          return (
            <li key={tab.type}>
              <Link
                className={[styles.tab, active ? styles.active : null].filter(Boolean).join(' ')}
                href={tab.href}
                {...(active ? { 'aria-current': 'page' as const } : {})}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
