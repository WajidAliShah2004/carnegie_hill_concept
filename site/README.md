# site

The production front end for nyframing.com. Next.js App Router, TypeScript,
`output: 'export'`, `trailingSlash: true`. No runtime server. No Tailwind, no UI
kit: plain CSS with one global stylesheet of tokens and a CSS module per
component.

Read `CLAUDE.md` and `docs/production-build-contract.md` at the repo root before
changing anything here. The hard rules fail builds, not code review.

## Commands

```bash
npm run dev         # prebuild assets, then next dev
npm run build       # prebuild runs first; writes out/
npm run lint
npm run typecheck
npm run test:e2e    # Playwright against out/, builds nothing
node scripts/serve-out.mjs 4173   # serve out/ the way a static host does
```

`npm run test:e2e` needs a matching browser build: `npx playwright install chromium`.

## What exists now

All seven pages, the gallery with its four tabs and paging, the lightbox, the
contact form, the 404, the SEO generators (JSON-LD, sitemap, robots,
`llms.txt`, web manifest), every CI script, and the Playwright suite.

## Content layer

### `src/content/types.ts`

`Raw*` types are what Sanity and `content/seed/*.json` hold, including the
private `source` on every statement. The plain types are what pages see, with
every `Sourced` value collapsed to a `string`. `source` never leaves
`src/content/`.

### `src/content/sourced.ts`

`text(value, documentId, field)`, `optionalText(...)`, `textList(...)`. They
validate and strip. A missing or empty source throws `MissingSourceError`
naming the document and the field, which fails the build.

### `src/content/load.ts`

Async getters. When `SANITY_PROJECT_ID` is set they query Sanity with GROQ
(published perspective, CDN off). Otherwise they read `content/seed/*.json`.
Both paths return the same types. Each getter is memoised for the build.

```ts
getBusinessInfo(): Promise<BusinessInfo>
getPage(key: PageKey): Promise<Page>
getPhotos(): Promise<Photo[]>
getPhotosByType(type: PhotoType): Promise<Photo[]>
getHomeSliderPhotos(): Promise<Photo[]>
getReviews(): Promise<Review[]>
getFeaturedReviews(): Promise<Review[]>
getSocialPosts(): Promise<SocialPost[]>
getFeaturedSocialPosts(): Promise<SocialPost[]>
getServices(): Promise<Service[]>
platformFromUrl(url: string): SocialPlatform
QUERIES            // the GROQ strings, exported so the Studio work can check them
usingSanity, deployEnv, isProduction, showUnconfirmed
```

### `src/content/image.ts`

```ts
imageSources(image: ContentImage): { src, srcSet?, width, height }
intrinsicSize(image): { width, height }
localVariantWidths(width): number[]
localVariantPath(path, width): string
WIDTHS             // 480, 768, 1200, 1600
```

Sanity images get `?w=&fm=webp&q=78&auto=format`, plus focal-point crop
parameters when a hotspot is set. Widths above the original are dropped, so
nothing is upscaled.

A `localImage` gets the same four widths, as WebP files written by
`scripts/prebuild-assets.mjs` and named `<name>-<width>.webp`, so staging
measures the way the Sanity CDN path will. The naming rule lives in two places
that must agree: `localVariantWidths` and `localVariantPath` here, and
`variantWidths` and `variantName` in the prebuild script, which carries the
comment of record.

### `src/content/view.ts`

Turns documents into the plain, serialisable shapes components take, so no
client component holds content logic or build-time environment.

```ts
sources(image): ImageSources
altText(photo): string        // the owner's caption, else the photo type label
photoView(photo, index): PhotoView
photoViews(photos): PhotoView[]
```

`PhotoView` is `{ id, image, alt, caption?, size }` where `size` is one of the
four hang heights `s | m | l | xl`, assigned from a fixed rhythm so a row never
reads as a grid.

### `scripts/prebuild-assets.mjs`

Three jobs, all into gitignored folders, all needing `sharp`:

1. Copies every `/assets` file the seed refers to into `public/dev-assets/`.
2. Writes the resized WebP variants at 480, 768, 1200 and 1600, never wider
   than the original, which is what gives a local image a real `srcset`. This
   took the Home page from 2.6 MB to 1.0 MB and the Gallery from 2.4 MB to
   1.3 MB.
3. Derives the icon set into `public/icons/` from the left 153 by 153 pixels of
   `logo.png`, which is the wordmark's monogram, painted solid white on `--ink`
   the way the header paints it. Sixteen through 512 pixels, plus an Apple
   touch icon and a maskable one. No new artwork is drawn. Because they come
   from a `localImage`, they exist only while the seed does; once the logo is in
   Sanity this step needs pointing at the Sanity asset.

With `DEPLOY_ENV=production` the whole step fails instead, because the files in
`/assets` are reduced copies from the live site and must not ship.

## Labels

`src/labels.ts` holds the only interface words on the site. Nothing there is a
statement about the business. Import the nested object directly:

```ts
import { labels } from '@/labels'
labels.actions.callTheShop
labels.photoTypes.frameOptions
```

`t('actions.callTheShop')` does the same by dotted path. `labelEntries()`
returns the flat `{ path: text }` map and `labelList()` the deduplicated list of
strings, which is what the CI visible-string check should read.

Components hold no string literals. Every word comes from content or from here.

## Components

All live in `src/components/`. Props are plain data.

| Component | Props |
|---|---|
| `Picture` | `{ image: ImageSources, alt, sizes?, priority?, eager?, className? }`. Always sets width and height. `priority` emits a preload link, `fetchpriority=high`, eager loading and sync decode; use it once per page. `eager` is the same minus the preload, for an image that is certainly on screen but is not what the page should be judged on, such as the mark in the header. |
| `Header` | `{ logo, name, phone, phoneDisplay, current? }`. Client. Derives `aria-current` from the path. Mobile menu button with `aria-expanded`, Escape closes it and returns focus. Tap-to-call button beside it on mobile. |
| `Footer` | `{ business }`. Facts in an `<address>`, six links, confirmed social links only, privacy notice. |
| `HangRow` | `{ items: PhotoView[], label, controls?, priorityFirst?, children? }`. Client. The signature row: one centre line, four picture heights, native scroll with scroll-snap, previous and next, arrow keys. `children` sits at the left of the controls bar. The row starts on the content gutter and runs off the right. Each picture's `sizes` is its hang height times its own aspect ratio, because height is what decides its size. |
| `GalleryGrid` | `{ items, priorityFirst?, layout? }`. Client. `layout: 'columns'` is the gallery wall. `layout: 'composed'` is the About arrangement: each cell's `flex-grow` and `flex-basis` are its own aspect ratio, so a row lines up along its foot as well as its head and nothing is cropped. |
| `Picture`/`HangRow` sizing | The four heights come from `--h-s`, `--h-m`, `--h-l`, `--h-xl`. |
| `Button`, `ButtonLink`, `Actions` | `variant: 'solid' \| 'line'`. `Actions` wraps a row of them. |
| `Section` | `{ id?, tight?, invert?, className?, children }`. |
| `SectionHeading` | `{ heading, id?, note?, aside?: { href, label } }`. |
| `BusinessFacts` | `{ business, fields?: ('address'\|'hours'\|'phone'\|'email')[], className? }`. `<address>` with a `<dl>`, `<time>` elements, `tel:` and `mailto:` links. Also exports `time24()`. |
| `Breadcrumbs` | `{ trail: { href, label }[] }`. The last step is the current page. Feed the same trail to the `BreadcrumbList` generator. |
| `ReviewCard` | `{ review, className? }`. No rating anywhere. The source link renders only when one exists. |
| `SocialPostCard` | `{ post, className? }`. Client facade: no third-party script on load, the embed loads on tap, and it stays a plain link when there is no embed or the embed fails. |
| `VisitSection` | `{ business, photo?, id? }`. The one inverted section. Never side by side below 900px. |
| `StubPage`, `pageMetadata(route)`, `trailFor(route, heading)` | Placeholders for the interior pages. Keep the metadata factory and the trail, replace the body. |

## CSS conventions

- `src/app/globals.css` holds the tokens, lifted unchanged from
  `the-hang/style.css`, plus the element defaults and four utilities: `.wrap`,
  `.measure`, `.prose`, `.lede`, `.quiet`, `.two`, `.invert`, `.sr-only`,
  `.stack-top`.
- Everything else is a CSS module next to its component. Class names are
  camelCase.
- Colours are only ever the tokens. `--quiet` (`#8E929D`) measures 5.8:1 on
  `--ink` and is safe for body text; `--ink-quiet` (`#4C5058`) measures 6.7:1 on
  `--mat`. `--rule` is a hairline and carries no meaning on its own.
- `.invert` on a section switches the buttons, rules, and quiet text to the
  inverted set. Modules hook it with `:global(.invert)`.
- Spacing uses `--s2` to `--s10`. Section padding is `--s9`, or `--s8` with
  `tight`.
- Transitions are 140ms and are cancelled under `prefers-reduced-motion`.
- `--rail` is the distance from the edge of a full bleed element to the content
  column. It is only meaningful on padding and margin, where the percentage in
  it resolves against the element's own containing block. It is what lets the
  slider and the reviews row start on the same line as every heading and still
  run off the right of the screen.
- Two pieces of motion, both CSS only, both inside
  `@media (prefers-reduced-motion: no-preference)`. `.settle` with
  `.settle-1`/`-2`/`-3` is the one page load moment, on the hero. `.reveal`
  fades a section the last of the way in using `animation-timeline: view()`,
  behind an `@supports`, so a browser without scroll-driven animation simply
  shows the content. The reduced-motion block is a separate query rather than
  the usual duration override, because a scroll-driven animation runs on
  progress and ignores a duration.
- `@view-transition { navigation: auto }` is declared for cross-document
  navigation. It costs no JavaScript and a browser without it just navigates.
- The header is `position: sticky` with a hairline that fades in over the first
  64 pixels of scroll, driven by `animation-timeline: scroll(root)`. The
  hairline is an absolutely positioned pseudo element, so it cannot shift the
  layout. `body` uses `overflow-x: clip` rather than `hidden`, because `hidden`
  would make the body a scroll container and break the sticky header.
- `@media print` gives white ground, black text, no underlines, and hides the
  navigation and the slider controls.

## Icons and the manifest

`generateMetadata` in `src/app/layout.tsx` declares the favicon set and the
Apple touch icon, `viewport` sets `theme-color` to the `--ink` token, and
`src/app/manifest.webmanifest/route.ts` builds the manifest from `businessInfo`
alone: `name` and `short_name` are the business name and its alternate name,
and there is no description because no approved sentence fits one. The icon
files themselves come from the prebuild step described above.

## Environment variables

| Name | Effect |
|---|---|
| `SANITY_PROJECT_ID` | Set: read Sanity. Unset: read `content/seed/`. |
| `SANITY_DATASET` | Defaults to `production`. |
| `SANITY_READ_TOKEN` | Build-time read token. |
| `SITE_URL` | Defaults to `https://nyframing.com`. |
| `DEPLOY_ENV` | `staging` or `production`. Anything but `production` emits `noindex` and keeps reviews that have no source link. `production` also refuses any `localImage`. |
| `SHOW_UNCONFIRMED` | `1` renders social links the owner has not confirmed. Staging only. Default hidden. |
| `DEPLOY_TARGET` | `cloudflare` or `hostinger`. Read by the deploy script, not by the site. |

## Open items

1. **Review source links.** We have no per-review URL and will not invent one.
   Seed `sourceUrl` is empty. In development and staging a review renders
   without a link; a `DEPLOY_ENV=production` build leaves it out entirely. Get
   the eight Google permalinks from the owner before launch, or the Reviews page
   ships empty.
2. **`googleReviewsUrl`, `googleWriteReviewUrl`, `yelpUrl`** are empty, so the
   three buttons on the Reviews page do not render. They need the real profile
   URLs, which is blocked on Google Business Profile and Yelp access.
3. **Social links are unconfirmed.** All four carry `confirmed: false`, so the
   footer Follow column does not render at all. Ask the owner which profiles he
   controls today. They also stay out of schema `sameAs` until then.
4. **Privacy page has an h1 and nothing else.** The spec says it describes only
   what the site really does, and no sourced wording for that exists. Do not
   write privacy prose here: it has to be drafted, approved, and recorded in
   `docs/copy-sources.md` first.
5. **Captions.** Only four photos carry one: `work-02` (a felt pennant),
   `work-24` (a framed pen), `samples` and `hero`. Those are the only photo
   observations recorded in `docs/copy-sources.md`. Everything else has an empty
   caption, so its alt text is the photo type label. Do not describe a photo
   without opening it and recording what you saw.
6. **No `matsGlassDisplay` photos exist.** That gallery tab has nothing to show
   and must not be rendered or listed in the sitemap until it does.
7. **No social posts exist.** `content/seed/socialPosts.json` is an empty list,
   so the Home reviews row currently holds review cards only. `SocialPostCard`
   is built and ready.
8. **No share image.** `businessInfo.shareImage` is null, so Open Graph has no
   picture yet. One approved image is needed.
9. **`geo` and `foundingYear` are null** and stay null until verified, per the
   spec.
10. **Photos are reduced copies.** Everything in `/assets` came off the live
    site at reduced size. A production build refuses them. The originals have to
    come out of the WordPress media library and into Sanity.
11. **Meta titles and descriptions** are assembled from the live site headline,
    the live site page names, the business name, and the one approved intro
    sentence. Services, Gallery, Reviews, Contact and Privacy have no
    description yet, because no approved sentence fits them.
12. **RSC payload paths.** Next writes `dir/__next.route/__PAGE__.txt` but
    prefetches `dir/__next.route.__PAGE__.txt`. `scripts/serve-out.mjs` now
    imports `rscRewrites` from `scripts/deploy.mjs`, so local serving,
    Cloudflare and Hostinger answer exactly the same set of paths, including
    the catch-all gallery payloads that used to 404 locally. Navigation works
    either way.
13. **`alternateName` is still not in the JSON-LD.** "Carnegie Hill Framing" is
    the wordmark in `logo.png`, and the header's logo carries the business name
    as its alt text, but `scripts/check-jsonld.mjs` treats only rendered text as
    visible (`document.body.innerText` plus `document.title`), and an `alt`
    attribute is neither. Emitting `alternateName` would fail that gate, and
    loosening the gate to let it through is not the same as the page saying it.
    It stays out until the shorter name appears as text somewhere.
14. **Playwright browser pinning.** `@playwright/test` is pinned to 1.62.0
    because that is the browser build available on this machine. CI can move it
    forward.

## Checks that already pass

`npm run lint`, `npx tsc --noEmit`, `npm run check:sources`, `npm run build`,
`npm run check:strings`, `npm run check:jsonld`, `npm run claims:check`, and
220 Playwright tests, which include the design screenshots in
`tests/shots.spec.ts`.

`npm run js-weight` reports 182 KB gzipped on the heaviest route against a
150 KB budget. 166 KB of that is the Next and React baseline and 10 KB is our
own client code. See docs/deploy.md, "The JavaScript weight".

Lighthouse: run it with `npm run lh:direct` and then `npm run lh:assert`.
`npm run lh` (`lhci autorun`) crashes on Windows when it cleans up Chrome's
temporary profile; the numbers it took are fine but no report survives. The one
assertion still failing is LCP.
