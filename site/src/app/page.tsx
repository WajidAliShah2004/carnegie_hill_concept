import Link from 'next/link'
import {
  getBusinessInfo,
  getFeaturedReviews,
  getFeaturedSocialPosts,
  getHomeSliderPhotos,
  getPage,
  getPhotosByType,
  getServices,
} from '@/content/load'
import { altText, photoView, photoViews, sources } from '@/content/view'
import { labels } from '@/labels'
import { ROUTES } from '@/routes'
import { Actions, ButtonLink } from '@/components/Button'
import { BusinessFacts } from '@/components/BusinessFacts'
import { HangRow } from '@/components/HangRow'
import { Picture } from '@/components/Picture'
import { ReviewCard } from '@/components/ReviewCard'
import { Section, SectionHeading } from '@/components/Section'
import { SocialPostCard } from '@/components/SocialPostCard'
import { VisitSection } from '@/components/VisitSection'
import { PageJsonLd } from '@/seo/JsonLdScript'
import { routeMetadata } from '@/seo/pages'
import styles from './home.module.css'

export const generateMetadata = routeMetadata('home')

export default async function HomePage() {
  const [business, page, sliderPhotos, services, reviews, socialPosts, shopPhotos] = await Promise.all([
    getBusinessInfo(),
    getPage('homePage'),
    getHomeSliderPhotos(),
    getServices(),
    getFeaturedReviews(),
    getFeaturedSocialPosts(),
    getPhotosByType('theShop'),
  ])

  const slider = photoViews(sliderPhotos)
  const about = page.sections.find((section) => section.key === 'about')
  const visitPhoto = shopPhotos.find((photo) => photo.caption) ?? shopPhotos[0]
  // A second shop photo for the About teaser, so the page never shows the
  // same picture twice. Nothing renders here when there is only one.
  const aboutPhoto = shopPhotos.find((photo) => photo.id !== visitPhoto?.id)
  const hasRail = reviews.length > 0 || socialPosts.length > 0

  return (
    <main id="main">
      <PageJsonLd route="home" />

      {/*
        2. split hero. One hairline runs the width of the page under the
        headline; the contact details hang from it on the left and the
        storefront hangs from it on the right, its foot on the same line as
        the buttons. It is the hang line of the row below, used once more.
      */}
      <section className={styles.hero}>
        <div className={`wrap ${styles.heroInner}`}>
          <div className={`${styles.heroLead} settle settle-1`}>
            <h1 className={styles.heroTitle}>{page.h1 ?? labels.pageHeading.homePage}</h1>
            {page.intro ? <p className={`lede ${styles.heroIntro}`}>{page.intro}</p> : null}
          </div>

          <span className={`${styles.heroRule} settle settle-2`} aria-hidden="true" />

          <div className={`${styles.heroContact} settle settle-3`}>
            <BusinessFacts business={business} fields={['address', 'hours', 'phone']} />
            <Actions className={styles.heroButtons}>
              <ButtonLink href={`tel:${business.phone}`}>{labels.actions.callTheShop}</ButtonLink>
              <ButtonLink href={business.directionsUrl} variant="line" rel="noopener">
                {labels.actions.getDirections}
              </ButtonLink>
            </Actions>
          </div>

          <figure className={`${styles.heroFigure} settle settle-2`}>
            <Picture
              image={sources(business.storefrontImage)}
              alt={labels.photoTypes.theShop}
              sizes="(max-width: 900px) calc(100vw - 40px), (max-width: 1500px) 52vw, 760px"
              priority
            />
          </figure>
        </div>
      </section>

      {/* 3. sliding gallery: starts on the content gutter, runs off the right */}
      {slider.length > 0 ? (
        <div className={styles.slider}>
          <HangRow items={slider} label={labels.photoTypes.completedWork} controls>
            <Link href={ROUTES.gallery}>{labels.actions.seeTheFullGallery}</Link>
          </HangRow>
        </div>
      ) : null}

      {/* 4. about teaser */}
      {about && about.paragraphs.length > 0 ? (
        <Section tight id="about">
          <div className={`wrap ${styles.about} reveal`}>
            {aboutPhoto ? (
              <figure className={styles.aboutFigure}>
                <Picture
                  image={sources(aboutPhoto.image)}
                  alt={altText(aboutPhoto)}
                  sizes="(max-width: 860px) calc(100vw - 40px), (max-width: 1500px) 40vw, 540px"
                />
              </figure>
            ) : null}
            <div className={styles.aboutText}>
              <h2 className={styles.aboutHeading}>{about.heading ?? labels.nav.about}</h2>
              {about.paragraphs.map((paragraph, index) => (
                <p key={paragraph} className={index === 0 ? styles.aboutStatement : 'prose'}>
                  {paragraph}
                </p>
              ))}
              <p className={styles.aboutMore}>
                <Link href={ROUTES.about}>{labels.actions.aboutTheShop}</Link>
              </p>
            </div>
          </div>
        </Section>
      ) : null}

      {/* 5. what we frame */}
      {services.length > 0 ? (
        <Section id="services">
          <div className="wrap">
            <SectionHeading
              heading={labels.sections.whatWeFrame}
              aside={{ href: ROUTES.services, label: labels.nav.services }}
            />
            <ul className={`${styles.services} reveal`}>
              {services.map((service) => (
                <li key={service.id} className={styles.service}>
                  <Link className={styles.serviceLink} href={`${ROUTES.services}#${service.anchor}`}>
                    <span className={styles.serviceName}>{service.title}</span>
                    {service.body ? <span className={styles.serviceBody}>{service.body}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}

      {/* 6. reviews and social */}
      {hasRail ? (
        <Section tight id="reviews">
          <div className="wrap">
            <SectionHeading
              heading={labels.sections.whatCustomersSay}
              aside={{ href: ROUTES.reviews, label: labels.actions.readAllReviews }}
            />
          </div>
          {/*
            Full bleed, padded to the content gutter on both sides, so the
            next card peeks past the right gutter instead of being sliced off
            at the edge of the screen.
          */}
          <div
            className={styles.rail}
            tabIndex={0}
            role="group"
            aria-label={labels.sections.whatCustomersSay}
          >
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} className={styles.railItem} />
            ))}
            {socialPosts.map((post) => (
              <SocialPostCard key={post.id} post={post} className={styles.railItem} />
            ))}
          </div>
        </Section>
      ) : null}

      {/* 7. visit the shop */}
      <VisitSection
        business={business}
        id="visit"
        {...(visitPhoto ? { photo: photoView(visitPhoto, 0) } : {})}
      />
    </main>
  )
}
