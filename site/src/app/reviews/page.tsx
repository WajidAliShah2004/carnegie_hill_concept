import { getBusinessInfo, getPage, getReviews, getSocialPosts } from '@/content/load'
import { labels } from '@/labels'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Actions, ButtonLink } from '@/components/Button'
import { ReviewCard } from '@/components/ReviewCard'
import { Section } from '@/components/Section'
import { SocialPostCard } from '@/components/SocialPostCard'
import { trailFor } from '@/components/StubPage'
import styles from './reviews.module.css'
import { PageJsonLd } from '@/seo/JsonLdScript'
import { routeMetadata } from '@/seo/pages'

export const generateMetadata = routeMetadata('reviews')

export default async function Page() {
  const [doc, business, reviews, posts] = await Promise.all([
    getPage('reviewsPage'),
    getBusinessInfo(),
    getReviews(),
    getSocialPosts(),
  ])
  const heading = doc.h1 ?? labels.pageHeading.reviewsPage

  return (
    <main id="main">
      <PageJsonLd route="reviews" />
      <Breadcrumbs trail={trailFor('reviews', heading)} />
      <Section tight>
        <div className="wrap">
          <div className={styles.head}>
            <h1>{heading}</h1>
            {doc.intro ? <p className={`lede ${styles.intro}`}>{doc.intro}</p> : null}
          </div>

          {reviews.length > 0 ? (
            <ul className={styles.grid}>
              {reviews.map((review) => (
                <li key={review.id} className={styles.cell}>
                  <ReviewCard review={review} />
                </li>
              ))}
            </ul>
          ) : null}

          {posts.length > 0 ? (
            <ul className={`${styles.grid} ${styles.posts}`}>
              {posts.map((post) => (
                <li key={post.id} className={styles.cell}>
                  <SocialPostCard post={post} />
                </li>
              ))}
            </ul>
          ) : null}

          {business.googleReviewsUrl || business.googleWriteReviewUrl || business.yelpUrl ? (
            <Actions className={styles.outbound}>
              {business.googleReviewsUrl ? (
                <ButtonLink href={business.googleReviewsUrl} rel="noopener">
                  {labels.actions.readOurReviewsOnGoogle}
                </ButtonLink>
              ) : null}
              {business.googleWriteReviewUrl ? (
                <ButtonLink href={business.googleWriteReviewUrl} variant="line" rel="noopener">
                  {labels.actions.leaveAGoogleReview}
                </ButtonLink>
              ) : null}
              {business.yelpUrl ? (
                <ButtonLink href={business.yelpUrl} variant="line" rel="noopener">
                  {labels.actions.findUsOnYelp}
                </ButtonLink>
              ) : null}
            </Actions>
          ) : null}
        </div>
      </Section>
    </main>
  )
}
