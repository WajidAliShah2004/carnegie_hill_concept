import { labels } from '@/labels'
import type { Review } from '@/content/types'
import styles from './ReviewCard.module.css'

export type ReviewCardProps = { review: Review; className?: string }

/**
 * A customer review, verbatim. There is no rating anywhere in the schema or on
 * the page, and no Review or AggregateRating markup is ever emitted for it.
 * The source link is shown only when we actually have one.
 */
export function ReviewCard({ review, className }: ReviewCardProps) {
  return (
    <blockquote className={[styles.card, className].filter(Boolean).join(' ')}>
      <q className={styles.quote}>{review.quote}</q>
      <footer className={styles.by}>
        <span className={styles.name}>{review.displayName}</span>
        <span>{labels.platforms[review.platform]}</span>
        {review.date ? <span>{review.date}</span> : null}
        {review.sourceUrl ? (
          <a className={styles.link} href={review.sourceUrl} rel="noopener nofollow">
            {labels.actions.viewPost}
          </a>
        ) : null}
      </footer>
    </blockquote>
  )
}
