# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Client work for Carnegie Hill Gallery & Custom Framing (nyframing.com), a picture framing shop at 1374 Lexington Ave, New York. The agency contact is Matthew. The client contact is Juko Haque, the owner's brother, who collects family feedback. The owner is not technical and will manage photos from his phone.

The repo is in two phases:

1. **Design concepts (done).** Eight static HTML concepts plus a chooser page, deployed on Vercel for client review.
2. **Production build (next).** A Next.js static export in `site/` and a Sanity Studio in `studio/`. Neither folder exists yet. The design spec is `docs/superpowers/specs/2026-09-19-production-site-design.md`. That path is gitignored, so it exists only on machines where it was written. If it is missing, the "Production build decisions" section below is the summary of record.

## Hard rules (these override convenience)

**Invent nothing.** Not a fact, not a caption, not an alt text, not a single word about the business. Every line of copy must trace to a source recorded in `docs/copy-sources.md`: copied from the live site, written by the owner, a real review, or plainly visible in a named photo. If a source is missing, leave the content out or ask. Never fill a gap.

- Before writing a caption that names what is in a photo, open the image and look. A previous caption called `work-24.jpg` a record sleeve; it is a pen in a gilt frame.
- Restoring old files from git brings back wording that was deliberately removed. Recheck against `docs/copy-sources.md` after any restore.
- Business facts are in `docs/current-site-facts.md`. They come from the live site and still need the owner's confirmation. The live site contradicts itself on Sundays ("by appointment only" and "open 7 days a week"); do not publish the second.
- Reviews are verbatim. Do not fix typos or trim in a way that changes meaning.
- No AI-written text ships on the site, including alt text and meta descriptions.

**No em dashes** anywhere in site content or client-facing documents. Plain words, no jargon. Grep for the character before finishing.

**Colours are measured, never picked by eye.** Take the median pixel of a named region of a photo in `assets/`, build light and dark steps in OKLCH holding the hue, and record the anchor, photo, and region in `docs/colour-sources.md`. Avoid default AI looks: cream with terracotta, dark with one acid accent, SaaS card kits, soft grey shadows, tracked-out uppercase eyebrow labels, monospace micro labels, arrows appended to link text.

**Budget is zero.** Propose only free-tier services. Vercel Hobby does not permit commercial use, so production will not run on Vercel.

## Concepts phase: structure and commands

No build step, no package.json. Each concept folder (`mat-board`, `the-hang`, `heritage-craft`, `shop-front`, `gilt-and-linen`, `yellow-facade`, `familiar-evolution`, `gallery-led`) holds `index.html`, `gallery.html`, and its own CSS. All of them share `assets/` (photos, logo, `reviews.txt`) and `shared/nav.js` (mobile menu toggle and the gallery mode tabs driven by `.modes button[data-target]` and `[data-mode]`). Root `index.html` is the chooser, numbered 1 to 8, with thumbnails in `thumbs/`.

The client refers to concepts by chooser number: 1 Mat board, 2 The hang, 3 Heritage craft, 4 Shop front, 5 Gilt and linen, 6 Yellow facade, 7 Familiar evolution, 8 Gallery-led.

Serve locally:

```bash
python -m http.server 8000
```

Drive the pages with the Playwright MCP tools. The Claude in Chrome extension fails in this repo with an OAuth account mismatch.

After any change to banner text or captions, regenerate the affected thumbnail: screenshot the concept's `index.html` at a 1280x800 viewport, crop to 1264x790 to drop the scrollbar strip, save to `thumbs/<concept>.jpg`.

Check mobile overflow by comparing `document.documentElement.scrollWidth` with `clientWidth` at 375px, not by eyeballing screenshots.

Deployment is the Vercel GitHub integration: `master` is production, every branch gets a preview. Every concept page carries `noindex`. Preview protection is currently off; `docs/vercel-preview-access.md` has the commands to turn it back on. In Git Bash on Windows, `vercel api` paths need `MSYS_NO_PATHCONV=1`.

## Production build decisions (19 September 2026)

Client feedback chose The hang (concept 2) as the base. Carry over: contact details directly under the intro (from Mat board), storefront photo near the top with contact info (from Shop front, without the awning), and the stacked Visit the shop section (from Gilt and linen). Concepts 6 to 8 are dropped. The hang's neutral skin stays as is.

Architecture:

- `site/`: Next.js App Router, TypeScript, `output: 'export'`. Sanity is read at build time only. Images come from Sanity's CDN with `srcset`.
- `studio/`: Sanity Studio on a free `*.sanity.studio` host. The owner role sees only Photos with a three step add flow: photo, one of four types (Completed work, Frame options, Mats glass and display, The shop), publish. Optional caption and a home slider toggle.
- Publish in Sanity fires a webhook to GitHub Actions, which builds, runs the checks, and deploys. Staging is Cloudflare Pages. Production is Cloudflare Pages or the client's existing Hostinger shared hosting, selected by one `DEPLOY_TARGET` variable. Hostinger currently caches HTML for 7 days, so that path must set no-cache on HTML and purge on deploy.
- Reviews and social or video posts are curated by hand in Sanity (pasted links, lazy facades). No review APIs, widgets, feeds, or video hosting.
- Contact form posts to Web3Forms from the browser, with a honeypot and hCaptcha. There is no server.
- Six pages: Home, About, Services, Gallery, Reviews, Contact, plus privacy and 404. `/order-online/` and `/appointment/` redirect to `/contact/`.

Zero invention is enforced in code, not by habit:

- Text comes from exactly two places: Sanity fields and one `labels.ts` of interface words. Components hold no sentences.
- Every statement field in Sanity has a required private `source`. A missing source fails the build.
- A CI Playwright pass extracts every visible string, alt, aria-label, title, meta description, and JSON-LD value from the built site and fails the deploy if any is not in Sanity or `labels.ts`.

Search and AI visibility is the top functional priority:

- One JSON-LD generator producing a connected `@graph` from the same records the page renders: `Store` reusing `@id` `https://nyframing.com/#organization`, `WebSite`, a page node per page (`AboutPage`, `ContactPage`, `CollectionPage` for gallery tabs), `BreadcrumbList`, `hasOfferCatalog` with `Service` nodes, `ImageObject` for photos. Hours in schema are Monday to Saturday only. `geo` and `foundingDate` only once verified.
- Never emit `Review`, `AggregateRating`, `FAQPage`, a Wikidata `additionalType`, or `ArtGallery`. The master brief explains why for each.
- `robots.txt` allows all crawlers, including AI training bots. `sitemap.xml` uses real `lastmod`. `llms.txt` is generated from Sanity facts. IndexNow is pinged after each production deploy.
- Every schema value must also be visible on the page, checked in CI.
- Targets: LCP 2.5s, CLS 0.1, INP 200ms, under 150 KB first-party JS, WCAG 2.2 AA, reflow at 320px.

Blocked on the client: Hostinger and WordPress logins, original photos from the WordPress media library (files in `assets/` are reduced copies and must not ship), Google Business Profile, Yelp, and Search Console access, owner confirmation of business facts, account ownership.

## Reference documents

- `docs/superpowers/specs/2026-09-19-production-site-design.md` (gitignored, local only): the production design spec and the source of truth for the build. Read it before any work in `site/` or `studio/`. Covers the consolidated layout, Sanity content model, owner phone flow, page specs, zero-invention system, full SEO and JSON-LD plan, CI gates, launch gates, and open client items. The "Production build decisions" section above is only its summary; where they differ, the spec wins.
- `docs/superpowers/specs/2026-09-11-four-design-concepts-design.md` (gitignored, local only): the spec for the concepts phase.
- `Carnegie_Hill_Merged_Developer_Master_Brief.docx` (gitignored, local only): the full requirements, page specs, form fields, crawler matrix, and acceptance matrix. It prefers WordPress; the Sanity decision above supersedes that. Extract text with Python's `zipfile` on `word/document.xml`; `unzip -p` hangs in this shell.
- `docs/copy-sources.md`: where every line of copy came from, and what was removed and why.
- `docs/colour-sources.md`: measured colour anchors.
- `docs/current-site-facts.md`: facts read from the live site on 12 September 2026.
- `assets/README.md`: what each photo is and which were cropped.
