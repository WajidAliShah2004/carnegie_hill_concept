import { getPage } from '@/content/load'
import { labels } from '@/labels'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Section } from '@/components/Section'
import { trailFor } from '@/components/StubPage'
import { PageJsonLd } from '@/seo/JsonLdScript'
import { routeMetadata } from '@/seo/pages'

export const generateMetadata = routeMetadata('privacy')

/**
 * Whatever the privacy notice ends up saying has to be drafted, approved, and
 * recorded in docs/copy-sources.md first. Until then this page renders its
 * heading and any sections that exist, and nothing else.
 */
export default async function Page() {
  const doc = await getPage('privacyPage')
  const heading = doc.h1 ?? labels.pageHeading.privacyPage

  return (
    <main id="main">
      <PageJsonLd route="privacy" />
      <Breadcrumbs trail={trailFor('privacy', heading)} />
      <Section tight>
        <div className="wrap measure">
          <h1>{heading}</h1>
          {doc.intro ? <p className="lede stack-top">{doc.intro}</p> : null}
          {doc.sections.map((section) => (
            <section key={section.key} className="stack-top">
              {section.heading ? <h2>{section.heading}</h2> : null}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="prose stack-top">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </Section>
    </main>
  )
}
