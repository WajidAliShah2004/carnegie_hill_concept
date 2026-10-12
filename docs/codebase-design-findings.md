# Codebase design findings

Review of `site/` (`src/`, `scripts/`, `tests/ci/`) and the lists it shares with `studio/`, on branch `production-build` at `9601ffc`, 3 October 2026. No code was changed.

## Terms used

- **Module:** anything with an interface and an implementation: a function, a file, a folder.
- **Interface:** everything a caller has to know to use a module: types, rules, ordering, error cases.
- **Deep module:** a lot of behaviour behind a small interface. A **shallow** one makes callers learn nearly as much as it does.
- **Seam:** the place where a module's interface sits, where behaviour can change without editing the callers.
- **Deletion test:** imagine deleting the module. If the complexity disappears, it was a pass-through. If it reappears across many callers, it was earning its keep.

## Summary

The recurring problem is not shallow modules. It is the same knowledge written in two to six places and kept in agreement by hand, with CI catching a mismatch only after a full build and a browser run.

| # | Finding | Size | Risk | Order |
| --- | --- | --- | --- | --- |
| 1 | Page heading, breadcrumb trail, metadata and JSON-LD are each worked out separately for the same page | Medium | Low | First |
| 2 | Business display formats live in a React component and are copied into the string check | Small | Low | With 1 |
| 3 | Two copies of the reader for the built site in `out/`, already drifted | Small | Low | Third |
| 4 | Photo types, source kinds, page keys and platforms repeated across `site/` and `studio/` | Small inside `site/`, larger across packages | Deploy risk for the cross-package half | Last |
| 5 | Smaller items: two Sanity clients, a double import, dead scaffold code | Trivial | None | Any time |

## 1. One page model per route

### What is spread out now

| Fact | Where it is worked out |
| --- | --- |
| Heading (`h1`, else the label) | 12 copies of `h1 ?? labels.pageHeading...` in 10 files: every page file (`site/src/app/page.tsx:97`, `about/page.tsx:22`, `services/page.tsx:26`, `reviews/page.tsx:23`, `contact/page.tsx:21`, `privacy/page.tsx:18`), `site/src/components/GalleryView.tsx:29`, `site/src/components/StubPage.tsx:35`, and four times in `site/src/seo/pages.ts` (lines 60, 91, 112, 134) |
| Breadcrumb trail, fixed pages | `trailFor` in `site/src/components/StubPage.tsx:25` (used by five pages) and a second `trailFor` in `site/src/seo/pages.ts:45` |
| Breadcrumb trail, gallery | Inline in `site/src/components/GalleryView.tsx:31`, and again as `galleryTrail` in `site/src/seo/pages.ts:110`, whose comment says "The same trail `GalleryView` renders" |
| Which route is which | `ROUTES` and `PAGE_KEY` in `site/src/routes.ts:7` and `:22`; `PAGE_ROUTES` in `site/src/seo/routes.ts:21`; `NODE_TYPE` and `SHOWS_SERVICES` in `site/src/seo/pages.ts:27` and `:38` |
| Sitemap order | `site/src/seo/routes.ts:59` slots the gallery entries in after services as a special case inside the loop |
| JSON-LD | `PageJsonLd` (`site/src/seo/JsonLdScript.tsx:19`) fetches the page again and builds the graph apart from what the page rendered |

### Why it matters

The hard rule that every schema value is visible on the page holds only because these copies agree. If someone changes a breadcrumb label in a page file but not in `seo/pages.ts`, the page and its JSON-LD disagree. `check-jsonld` catches it, but only after `next build` and a Playwright run.

Search and AI visibility is the top functional priority of the build, and this is its main invariant.

### Proposed module

A data function per route, returning the frame of the page. Pages still fetch their own body content (services, reviews, photos).

```ts
// site/src/seo/pageModel.ts (sketch)
type PageModel = {
  path: string
  heading: string
  intro?: string
  /** Empty on home, which shows no breadcrumbs. */
  trail: Crumb[]
  metadata: Metadata
  graph: Graph
}

function pageModel(route: 'home' | 'about' | 'services' | 'reviews' | 'contact' | 'privacy'): Promise<PageModel>
function galleryModel(slug: string, page: number): Promise<(PageModel & { tabs: GalleryTab[]; route: GalleryRoute }) | null>
function indexableRoutes(): Promise<IndexableRoute[]>
```

- The graph is built from the same `trail` and `heading` objects the page renders, so the visible-schema rule holds by design.
- One route table (`key`, `path`, `pageKey`, `nodeType`, `listsServices`, in sitemap order) replaces `ROUTES`, `PAGE_KEY`, `PAGE_ROUTES`, `NODE_TYPE` and `SHOWS_SERVICES`. The sitemap walks the table, so the gallery special case goes away.
- `generateMetadata` returns `model.metadata`; the page renders `model.trail`, `model.heading`, `model.intro` and `<JsonLd graph={model.graph} />`.
- Memoise `pageModel` per route the way the content getters already are, so metadata and page share one build of it.

### What the deletion test removes

Both `trailFor` functions, `galleryTrail`, the inline gallery trail, the 12 heading fallbacks, `NODE_TYPE`, `SHOWS_SERVICES`, `PAGE_ROUTES`, `PAGE_KEY`, and all of `StubPage.tsx`.

`StubPage` and `pageMetadata` are already unused. Only `trailFor` is imported from that file. `pageMetadata` also sets no `robots`, so a page built with it would be indexable on staging, and `site/README.md:160` still says to keep it.

### How to test

Everything it depends on runs in memory over the seed files, so it can be tested directly through its interface, with no build:

- For every route, every non-URL string value in `graph` appears in `heading`, `intro` or `trail`.
- The breadcrumb list in `graph` matches `trail` item for item.
- `indexableRoutes()` lists exactly the paths in the route table plus the gallery routes that have photos.

This covers part of what `check-jsonld` checks today, in seconds instead of after a build. `check-jsonld` stays as the end-to-end gate.

### Open questions

- An alternative shape is a wrapper component, `<PageFrame route>`, that renders the breadcrumbs, `h1`, intro and JSON-LD itself so a page cannot forget one. It is deeper for callers but fixes the markup: the home `h1` sits inside the hero and the contact `h1` sits inside a two-column layout, so it would need escape hatches. The data function is the safer first step. Both shapes could be sketched and compared before building.
- `galleryModel` returns `null` for a missing tab or page; `GalleryView` turns that into `notFound()` as it does now.

## 2. Take business formatting out of the React component

### What is spread out now

| What | Where |
| --- | --- |
| `time24` ("7:30 PM" to "19:30") | `site/src/components/BusinessFacts.tsx:17`, and again in `site/scripts/lib/content.mjs:213` |
| Hours line ("Monday to Saturday, 10:00 AM to 7:30 PM") | `DayRange` in `site/src/components/BusinessFacts.tsx:28`, and again in `derivedBusinessStrings` at `site/scripts/lib/content.mjs:172` |
| Address line | `site/src/components/BusinessFacts.tsx:55`, and again in `site/scripts/lib/content.mjs:183` |
| JSON-LD opening hours | `site/src/seo/jsonld.ts:14` imports `time24` from the React component file |

The comment on `derivedBusinessStrings` says these forms "have to be derived the same way the components derive them, or the visible-string check would reject the address line it built itself."

### Why it matters

- If someone changes the hours format in the component, `check-strings` reports the shop's own hours as invented text.
- The copy in `content.mjs` also allows forms such as the address with the country appended and the phone number with spaces instead of hyphens. I did not trace whether the site prints each of these. Any form the site never prints is a string the check allows for no reason.
- SEO code depends on a component file for a pure function.

### Proposed module

```ts
// site/src/content/businessDisplay.ts (sketch). Imports nothing at runtime.
export type HoursLine = { days: string; opens: string; closes: string; opens24: string; closes24: string }

export function businessDisplay(
  business: BusinessFields,
  joinWord: string,
): { addressLine: string; hoursLines: HoursLine[]; phoneDisplay: string }

export function time24(value: string): string
```

`BusinessFacts`, `jsonld.ts` and `check-strings` all call it. The allowed strings for the business become exactly what the site renders.

### Constraint

The check scripts are plain Node. They can import this file the way `site/scripts/lib/content.mjs:225` already imports `labels.ts`, because Node strips TypeScript types on import. That only works if the file uses no path aliases (`@/`), writes runtime imports with a `.ts` extension, and uses `import type` for types. `labels.ts` has no imports at all and works today.

### How to test

Unit tests on `businessDisplay` with the seed business info. `check-strings` then needs no business-specific logic of its own.

## 3. One reader for the built site in `out/`

### What is spread out now

| What | `site/scripts/lib/out.mjs` | `site/tests/ci/routes.ts` |
| --- | --- | --- |
| Walk `out/` for `index.html` files | `discoverRoutes`, line 17 | `routes`, line 16 |
| Folders to skip | Inline, lines 23 to 24 | `SKIP_DIRS`, line 13 |
| Is this a redirect stub | `isRedirectStub`, line 103 | `isRedirectStub`, line 41 |
| Routes to load in a browser | `renderableRoutes`, line 113 | `renderableRoutes`, line 65 |
| Adds `/404.html` | Yes, lines 34 to 40 | No |
| Error pages, stub destination, pages a visitor can stay on | No | `isErrorPage`, `stubDestination`, `pageRoutes` |

Who uses which:

- `check-strings` and `check-jsonld` use `out.mjs`.
- The axe, reflow, links, indexing and sitemap tests use `tests/ci/routes.ts`.

`deployEnv` and `isProduction` are also defined twice: `site/tests/ci/routes.ts:100` and `site/src/content/load.ts:45`.

### Why it matters

The two copies have already drifted. The current `out/` holds `/404/`, `/404.html` and `/_not-found/`. The script checks cover all three. The Playwright checks cover `/404/` and `/_not-found/` but not `/404.html`.

`/404.html` is the file the host actually serves for a missing page (`ErrorDocument 404 /404.html`, checked in `site/tests/ci/redirects.spec.ts:43`). It is probably the same HTML as `/404/index.html`, but nothing checks that, so the page a lost visitor sees gets no accessibility or reflow check.

### Proposed module

```js
// site/scripts/lib/out.mjs, with out.d.mts beside it as deploy.d.mts already is
readOut(outDir = OUT_DIR) => ({
  pages,       // routes a visitor can stay on
  errorPages,  // including /404.html
  stubs,       // [{ route, destination }]
  renderable,  // pages and error pages
  read(path),
  resolves(urlPath),
})
```

`scanForLeaks` stays as it is. Both the scripts and the Playwright tests import this one reader, and `tests/ci/routes.ts` goes away. The environment flags move to one place both sides import.

### How to test

Against a small fixture folder that holds a page, a stub with a meta refresh, `404.html` and `404/index.html`. No real build is needed.

## 4. Content lists repeated across `site/` and `studio/`

### What is spread out now

| List | Places |
| --- | --- |
| Photo types | `site/src/content/types.ts` (`PHOTO_TYPES`), `site/src/content/gallery.ts` (`SLUGS`), `site/src/labels.ts`, `studio/schemas/photoTypes.ts` (which says the values "must stay identical to the ones site/ uses") |
| Source kinds | `site/src/content/types.ts:16`, `site/src/content/sourced.ts:12`, `site/scripts/lib/content.mjs:21`, the leak patterns in `site/scripts/lib/out.mjs:48`, `site/tests/shell.spec.ts:90`, `studio/schemas/objects/sourced.ts:16` |
| Page keys | `site/src/content/types.ts`, `site/src/routes.ts:22`, `site/scripts/lib/content.mjs:23`, `labels.pageHeading` in `site/src/labels.ts`, `studio/schemas/documents/pages.ts` |
| Social platforms and `platformFromUrl` | `site/src/content/load.ts:206`, `studio/lib/platformFromUrl.ts` (which opens with "One rule, two copies") |

Inside the site's TypeScript, some drift is caught: `labels.photoTypes` and `SLUGS` are keyed by the `PhotoType` type. The `.mjs` scripts, the tests and the Studio are outside that check.

### Proposed change, inside `site/`

One `site/src/content/model.ts` that owns these lists and imports nothing at runtime, so the scripts can import it the same way they import `labels.ts`. `types.ts`, `sourced.ts`, `content.mjs`, `out.mjs` and the shell test read from it.

### Across `site/` and `studio/`

This is the real seam: the Sanity schema on one side, the site's loader on the other. Sharing a folder outside both packages affects deploys:

- The Vercel preview project `carnegie-hill-site` has its Root Directory set to `site/`.
- The Studio deploys from `studio/`.
- Next would need its project root widened to compile a file from outside `site/`.

Recommendation: do the `site/` half now. Leave the cross-package half until the owner actually asks for a new photo type or platform, and at that point either share the folder or add a CI check that compares the two copies.

## 5. Smaller items

- **Two Sanity clients with the same settings:** `site/src/content/load.ts:64` and `site/scripts/lib/content.mjs:68`, each with its own `usingSanity` (`load.ts:44`, `content.mjs:40`). The two queries are different on purpose (the checks need the private `source` field), so only the client settings and the environment reading could be shared. Low value.
- **`loadLabels()` called twice:** `site/scripts/lib/content.mjs:235` and `:236` import `labels.ts` twice in a row. Trivial.
- **Dead scaffold code:** `StubPage` and `pageMetadata` in `site/src/components/StubPage.tsx` are unused, and `site/README.md:160` still tells the reader to keep them. Part of finding 1, but it can be fixed on its own by moving `trailFor` out and deleting the rest.

## Already in good shape

- `site/src/content/load.ts` reads from either the seed files or Sanity behind the same getter functions. That is a real seam with two adapters, the right shape.
- `site/scripts/lib/match.mjs` puts the whole string-matching logic behind one `judge` call.
- `site/src/content/gallery.ts` decides once which gallery tabs and pages exist, and both the pages and the sitemap read from it. Finding 1 extends the same idea to every page.
- `site/src/seo/jsonld.ts` is the single JSON-LD generator, with no code path that could emit the forbidden types.

## Suggested order

1. Finding 1, the page model, since it protects the main SEO rule.
2. Finding 2 alongside it, since `jsonld.ts` is touched by both.
3. Finding 3.
4. The `site/` half of finding 4.
5. Finding 5 whenever the files are open anyway.
