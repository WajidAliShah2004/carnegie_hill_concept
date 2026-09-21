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
import { isLocalImage, type ContentImage } from '@/content/types'
import { galleryHref, gallerySlug } from '@/content/gallery'
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

function pixelSize(image: ContentImage): { width: number; height: number } {
  if (isLocalImage(image)) return { width: image.width, height: image.height }
  return image.metadata?.dimensions ?? { width: 0, height: 0 }
}

export default async function HomePage() {
  const [
    business,
    page,
    sliderPhotos,
    services,
    reviews,
    socialPosts,
    shopPhotos,
    framePhotos,
    matPhotos,
  ] = await Promise.all([
    getBusinessInfo(),
    getPage('homePage'),
    getHomeSliderPhotos(),
    getServices(),
    getFeaturedReviews(),
    getFeaturedSocialPosts(),
    getPhotosByType('theShop'),
    getPhotosByType('frameOptions'),
    getPhotosByType('matsGlassDisplay'),
  ])

  const slider = photoViews(sliderPhotos)
  // The pictures for What we frame: every photo the owner files under Frame
  // options or Mats, glass and display, frames first.
  const options = photoViews([...framePhotos, ...matPhotos])
  const optionLinks = [
    { type: 'frameOptions' as const, count: framePhotos.length },
    { type: 'matsGlassDisplay' as const, count: matPhotos.length },
  ].filter((link) => link.count > 0)
  const about = page.sections.find((section) => section.key === 'about')
  const visitPhoto = shopPhotos.find((photo) => photo.caption) ?? shopPhotos[0]
  // A second shop photo for the About teaser, so the page never shows the
  // same picture twice. Nothing renders here when there is only one. Of the
  // ones left, the landscape photo with the most pixels: a small or square
  // file shown half the page wide came out soft and had to be cropped.
  const aboutPhoto = shopPhotos
    .filter((photo) => photo.id !== visitPhoto?.id)
    .map((photo) => ({ photo, ...pixelSize(photo.image) }))
    .sort((a, b) => Number(b.width > b.height) - Number(a.width > a.height) || b.width - a.width)[0]
    ?.photo
  // The first featured video that ships with the site leads the reviews
  // section at full size, with the featured reviews stacked beside it. Any
  // other featured post follows in the strip underneath.
  const leadVideo = socialPosts.find((post) => post.platform === 'video')
  const stripPosts = socialPosts.filter((post) => post.id !== leadVideo?.id)
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

      {/* 3. sliding gallery: edge to edge at every width, as in The hang */}
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
                  sizes="(max-width: 860px) calc(100vw - 40px), (max-width: 1500px) 46vw, 600px"
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
          {options.length > 0 ? (
            <div className={styles.options}>
              <HangRow items={options} label={labels.photoTypes.frameOptions} controls>
                <span className={styles.optionLinks}>
                  {optionLinks.map((link) => (
                    <Link key={link.type} href={galleryHref(gallerySlug(link.type))}>
                      {labels.photoTypes[link.type]}
                    </Link>
                  ))}
                </span>
              </HangRow>
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* 6. reviews and social */}
      {hasRail ? (
        <Section tight id="reviews">
          {leadVideo ? (
            <div className="wrap reveal">
              {/*
                The heading sits beside the video, not a review: a quote set
                next to a person talking reads as that person's words, and
                the reviews are by other people. They follow in their own
                row, each under its own name.
              */}
              <div className={styles.voices}>
                <div className={styles.voicesHead}>
                  <h2 className={styles.voicesTitle}>{labels.sections.whatCustomersSay}</h2>
                  <p className={styles.voicesMore}>
                    <Link href={ROUTES.reviews}>{labels.actions.readAllReviews}</Link>
                  </p>
                </div>
                <SocialPostCard post={leadVideo} />
              </div>
              {reviews.length > 0 ? (
                <div className={styles.voicesRest}>
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="wrap">
              <SectionHeading
                heading={labels.sections.whatCustomersSay}
                aside={{ href: ROUTES.reviews, label: labels.actions.readAllReviews }}
              />
            </div>
          )}
          {/*
            Full bleed, padded to the content gutter on both sides, so the
            next card peeks past the right gutter instead of being sliced off
            at the edge of the screen. With a lead video the reviews are
            already shown above, so only the remaining posts ride here.
          */}
          {(leadVideo ? stripPosts.length : 1) > 0 ? (
            <div
              className={`${styles.rail} ${leadVideo ? styles.railAfter : ''}`}
              tabIndex={0}
              role="group"
              aria-label={labels.sections.whatCustomersSay}
            >
              {leadVideo
                ? null
                : reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} className={styles.railItem} />
                  ))}
              {stripPosts.map((post) => (
                <SocialPostCard key={post.id} post={post} className={styles.railItem} />
              ))}
            </div>
          ) : null}
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
