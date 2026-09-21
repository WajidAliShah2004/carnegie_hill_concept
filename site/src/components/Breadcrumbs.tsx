import Link from 'next/link'
import { labels } from '@/labels'
import styles from './Breadcrumbs.module.css'

export type Crumb = { href: string; label: string }

export type BreadcrumbsProps = {
  /** Every step including the current page, which is rendered without a link. */
  trail: readonly Crumb[]
}

/**
 * Visible breadcrumbs. The JSON-LD BreadcrumbList generator reads the same
 * trail, so the schema cannot say something the page does not.
 */
export function Breadcrumbs({ trail }: BreadcrumbsProps) {
  if (trail.length === 0) return null
  return (
    <nav className={`wrap ${styles.crumbs}`} aria-label={labels.breadcrumbs.label}>
      <ol className={styles.list}>
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1
          return (
            <li key={crumb.href} className={styles.item}>
              {last ? (
                <span className={styles.current} aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href}>{crumb.label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
