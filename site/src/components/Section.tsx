import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './Section.module.css'

export type SectionProps = {
  id?: string
  tight?: boolean
  invert?: boolean
  className?: string
  children: ReactNode
}

export function Section({ id, tight = false, invert = false, className, children }: SectionProps) {
  return (
    <section
      {...(id ? { id } : {})}
      className={[styles.sec, tight ? styles.tight : null, invert ? 'invert' : null, className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </section>
  )
}

export type SectionHeadingProps = {
  /** The heading text. Always a label or a content field, never a literal. */
  heading: string
  id?: string
  /** One optional line under the heading, from content. */
  note?: string
  /** An optional link on the same baseline, such as a link to the full page. */
  aside?: { href: string; label: string }
}

export function SectionHeading({ heading, id, note, aside }: SectionHeadingProps) {
  return (
    <div className={[styles.head, aside ? styles.headRow : null].filter(Boolean).join(' ')}>
      <div>
        <h2 {...(id ? { id } : {})}>{heading}</h2>
        {note ? <p>{note}</p> : null}
      </div>
      {aside ? (
        <Link className={styles.aside} href={aside.href}>
          {aside.label}
        </Link>
      ) : null}
    </div>
  )
}
