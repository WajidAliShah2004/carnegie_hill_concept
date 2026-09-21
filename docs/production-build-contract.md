# Production build contract

Working agreement for everyone building `site/` and `studio/`. The design spec
(`docs/superpowers/specs/2026-09-19-production-site-design.md`) is the source of
truth. This file only fixes the shared interfaces so parallel work fits together.
Where this file and the spec differ, the spec wins.

## Hard rules (from CLAUDE.md, repeated because they fail builds)

- Invent nothing. Every business statement traces to `docs/copy-sources.md`,
  `docs/current-site-facts.md`, or `assets/reviews.txt`. If a source is missing the
  content is left out and the UI hides that element. Never fill a gap.
- No em dashes anywhere. No AI-written alt text, captions, or meta descriptions.
- Components hold no sentences. Text is a Sanity field or a `labels.ts` key.
- Never publish "open 7 days a week". Never emit Review, AggregateRating, FAQPage,
  ArtGallery, or a Wikidata additionalType. No rating field anywhere.
- Colours are The hang's measured tokens, lifted unchanged from `the-hang/style.css`.
- Zero budget. Free tiers only. Production does not run on Vercel.

## Layout of the repo

```
site/                     Next.js App Router, TypeScript, output: 'export', trailingSlash: true
  content/seed/*.json     Sanity-shaped documents. Seeds the dataset and is the offline build source.
  src/labels.ts           The only interface words
  src/content/            types.ts, load.ts (Sanity or seed), sourced.ts (validate and strip source)
  src/seo/                jsonld.ts, meta.ts, and the generators for sitemap, robots, llms.txt
  src/components/         UI, no string literals
  src/app/                routes
  scripts/                check-sources, check-strings, check-jsonld, deploy, indexnow
  tests/                  Playwright
studio/                   Sanity Studio v3
.github/workflows/        build, check, deploy
```

## Content source switch

`site/src/content/load.ts` exports async getters. When `SANITY_PROJECT_ID` is set it
queries Sanity (GROQ, published perspective, no CDN at build time). When it is not
set it reads `site/content/seed/*.json`. Both paths return the same types. No Sanity
project exists yet, so everything must build and pass checks from seed alone.

Seed photos point at the reduced copies in `/assets` through
`{ "_type": "localImage", "path": "work-09.jpg", "width": n, "height": n }`.
`site/scripts/prebuild-assets.mjs` copies the referenced files into
`site/public/dev-assets/` (gitignored), writes WebP variants at 480, 768, 1200
and 1600 next to them as `<name>-<width>.webp` so a local image gets a real
`srcset`, and derives the icon set in `site/public/icons/` from the monogram in
`logo.png`. It needs `sharp`, which is a devDependency. A build with
`DEPLOY_ENV=production` fails if any `localImage` remains, because those files
must not ship.

## Sourced text

```ts
type SourceKind = 'liveSite' | 'ownerWritten' | 'reviewUrl' | 'observedInPhoto'
type Sourced = { text: string; source: { kind: SourceKind; detail: string } }
```

`detail` is the page, date, link, or photo name. The loader validates every Sourced
value, throws on an empty source, then returns plain strings. `source` never reaches
a component, the HTML, or any file in `out/`.

## Document types (Studio schema and site types must match exactly)

- `photo`: image, type (`completedWork` | `frameOptions` | `matsGlassDisplay` | `theShop`),
  caption? (Sourced, ownerWritten set automatically), onHomeSlider, order
- `review`: quote (Sourced, verbatim), displayName, platform (`google` | `yelp` | `other`),
  sourceUrl, date?, featured, order. No rating.
- `socialPost`: url, platform (derived from url in `site/`, and read only and
  display only in the Studio: nothing is stored in that field and the GROQ query
  does not select it), caption? (Sourced), featured, order
- `service`: title (Sourced), anchor, body? (Sourced), image?, galleryType?, order
- `businessInfo` singleton: name, alternateName, street, crossStreets, city, region,
  postcode, country, phone, email, hours[] ({days, opens, closes}), sundayNote (Sourced),
  appointmentNote (Sourced), directionsUrl, googleReviewsUrl?, googleWriteReviewUrl?,
  yelpUrl?, socialLinks[] ({platform, url, confirmed}), logo, storefrontImage, shareImage,
  geo?, foundingYear?
- Page singletons `homePage`, `aboutPage`, `servicesPage`, `galleryPage`, `reviewsPage`,
  `contactPage`, `privacyPage`: h1 (Sourced), intro? (Sourced), metaTitle (Sourced),
  metaDescription? (Sourced), sections[] ({key, heading? (Sourced), paragraphs: Sourced[]}).
  `h1` is required except on `reviewsPage` and `privacyPage`, whose visible
  heading is a `labels.ts` interface word because the live site has no wording of
  its own for either. `section.heading` is Sourced, not a plain string: a heading
  on a page of statements can be a statement.

Anything optional that is empty is not rendered, not in JSON-LD, not in the sitemap.
Unconfirmed social links are not rendered and not in `sameAs`. `alternateName` is
not emitted either: `check-jsonld` counts only rendered text as visible, and the
shorter name appears on the site only inside the logo artwork.

The four photo types are titled "Completed work", "Frame options",
"Mats, glass and display" and "The shop", spelled that way in both
`labels.photoTypes` and `studio/schemas/photoTypes.ts`.

## Alt text

The owner's caption when present. Otherwise the label for the photo's type from
`labels.ts`. Nothing else describes a photo.

## Routes

`/`, `/about/`, `/services/`, `/gallery/`, `/gallery/frame-options/`,
`/gallery/mats-glass-display/`, `/gallery/the-shop/`, `/gallery/page/N/` and
`/gallery/<tab>/page/N/` (12 per page), `/reviews/`, `/contact/`, `/privacy/`, 404.
Redirects: `/order-online/` and `/appointment/` to `/contact/`. Also generated:
`/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/manifest.webmanifest`.

Next's static export writes a route's React payload at a path the client does
not ask for. `site/scripts/deploy.mjs` exports `rscRewrites`, which enumerates
the rules from the built tree; `_redirects`, the `.htaccess` template and
`site/scripts/serve-out.mjs` all read that one function, so local serving and
both hosts answer the same paths.

## Environment variables

`SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_READ_TOKEN`, `SITE_URL`
(default `https://nyframing.com`), `DEPLOY_ENV` (`staging` | `production`),
`DEPLOY_TARGET` (`cloudflare` | `hostinger`), `NEXT_PUBLIC_WEB3FORMS_KEY`,
`NEXT_PUBLIC_HCAPTCHA_SITEKEY`, `INDEXNOW_KEY`. Staging emits `noindex`.
