import Link from 'next/link'
import { labels } from '@/labels'
import styles from './Pagination.module.css'

export type PaginationProps = {
  /** 1-based. */
  page: number
  pageCount: number
  /** Builds the href for a page number. */
  href: (page: number) => string
}

/**
 * Ordinary links, so every page of the gallery is a URL a crawler can follow
 * and a reader can bookmark. The numeral is the visible text; the accessible
 * name adds the label so a screen reader hears more than a digit.
 */
export function Pagination({ page, pageCount, href }: PaginationProps) {
  if (pageCount < 2) return null
  const pages = Array.from({ length: pageCount }, (_unused, index) => index + 1)
  return (
    <nav aria-label={labels.pagination.label} className={styles.pages}>
      <ul className={styles.list}>
        <li>
          {page > 1 ? (
            <Link className={styles.step} href={href(page - 1)} rel="prev" data-page-previous="">
              {labels.pagination.previous}
            </Link>
          ) : (
            <span className={`${styles.step} ${styles.off}`}>{labels.pagination.previous}</span>
          )}
        </li>

        {pages.map((number) => (
          <li key={number}>
            {number === page ? (
              <span
                className={`${styles.number} ${styles.current}`}
                aria-current="page"
                aria-label={`${labels.pagination.page} ${number}`}
              >
                {number}
              </span>
            ) : (
              <Link
                className={styles.number}
                href={href(number)}
                aria-label={`${labels.pagination.page} ${number}`}
              >
                {number}
              </Link>
            )}
          </li>
        ))}

        <li>
          {page < pageCount ? (
            <Link className={styles.step} href={href(page + 1)} rel="next" data-page-next="">
              {labels.pagination.next}
            </Link>
          ) : (
            <span className={`${styles.step} ${styles.off}`}>{labels.pagination.next}</span>
          )}
        </li>
      </ul>
    </nav>
  )
}
