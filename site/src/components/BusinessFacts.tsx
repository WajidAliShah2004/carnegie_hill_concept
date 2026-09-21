import { labels } from '@/labels'
import type { BusinessInfo, OpeningHours } from '@/content/types'
import styles from './BusinessFacts.module.css'

export type FactKey = 'address' | 'hours' | 'phone' | 'email'

export type BusinessFactsProps = {
  business: BusinessInfo
  /** Which rows to show, in order. Defaults to all four. */
  fields?: readonly FactKey[]
  className?: string
}

const DEFAULT_FIELDS: readonly FactKey[] = ['address', 'hours', 'phone', 'email']

/** "10:00 AM" to the machine-readable "10:00" a <time> element needs. */
export function time24(value: string): string {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value.trim())
  if (!match) return value
  const minutes = match[2] as string
  const suffix = match[3]?.toUpperCase()
  let hours = Number(match[1])
  if (suffix === 'PM' && hours < 12) hours += 12
  if (suffix === 'AM' && hours === 12) hours = 0
  return `${String(hours).padStart(2, '0')}:${minutes}`
}

function DayRange({ hours }: { hours: OpeningHours }) {
  const first = hours.days[0]
  const last = hours.days[hours.days.length - 1]
  const days = first === last || last === undefined ? first : `${first} ${labels.facts.to} ${last}`
  return (
    <>
      {days}, <time dateTime={time24(hours.opens)}>{hours.opens}</time> {labels.facts.to}{' '}
      <time dateTime={time24(hours.closes)}>{hours.closes}</time>
    </>
  )
}

/**
 * Address, hours, phone, and email as a description list inside an
 * <address> element, with tel: and mailto: links. Every value is a
 * businessInfo field. Nothing here is written by us.
 */
export function BusinessFacts({ business, fields = DEFAULT_FIELDS, className }: BusinessFactsProps) {
  return (
    <address className={className}>
      <dl className={styles.facts}>
        {fields.map((field) => {
          if (field === 'address') {
            return (
              <div key={field} className={styles.row}>
                <dt className={styles.term}>{labels.facts.address}</dt>
                <dd className={styles.value}>
                  {business.street}, {business.city}, {business.region} {business.postcode}
                  {business.crossStreets ? (
                    <>
                      <br />
                      <span className={styles.note}>{business.crossStreets}</span>
                    </>
                  ) : null}
                </dd>
              </div>
            )
          }
          if (field === 'hours') {
            return (
              <div key={field} className={styles.row}>
                <dt className={styles.term}>{labels.facts.hours}</dt>
                <dd className={styles.value}>
                  {business.hours.map((hours) => (
                    <span key={hours.days.join('-')}>
                      <DayRange hours={hours} />
                      <br />
                    </span>
                  ))}
                  <span className={styles.note}>{business.sundayNote}</span>
                </dd>
              </div>
            )
          }
          if (field === 'phone') {
            return (
              <div key={field} className={styles.row}>
                <dt className={styles.term}>{labels.facts.phone}</dt>
                <dd className={styles.value}>
                  <a href={`tel:${business.phone}`}>{business.phoneDisplay}</a>
                </dd>
              </div>
            )
          }
          return (
            <div key={field} className={styles.row}>
              <dt className={styles.term}>{labels.facts.email}</dt>
              <dd className={styles.value}>
                <a href={`mailto:${business.email}`}>{business.email}</a>
              </dd>
            </div>
          )
        })}
      </dl>
    </address>
  )
}
