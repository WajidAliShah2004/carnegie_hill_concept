# Deploying nyframing.com

Plain language. Read it top to bottom once, then use the sections you need.

Everything here is free: GitHub Actions minutes on a public repository,
Cloudflare Pages on the free plan, or the client's existing Hostinger shared
hosting. Production never runs on Vercel, because the Hobby plan does not allow
commercial use and there is no budget for a paid one.

## What happens when the owner publishes a photo

1. He taps Publish in the Studio on his phone.
2. Sanity sends a webhook to GitHub. See `studio/README.md` for the exact
   settings.
3. The Deploy workflow starts. If he publishes four more photos while it runs,
   the run is cancelled and restarted with the newer content, so ten quick
   uploads make one build.
4. Every gate runs. If one fails, nothing is deployed and the old site stays up.
5. The new site goes to Cloudflare Pages or Hostinger, whichever
   `DEPLOY_TARGET` says.
6. The changed URLs go to IndexNow, which is how Bing and ChatGPT search hear
   about them.

Target: live within three minutes of the tap.

## The two hosts

`DEPLOY_TARGET` picks one. It is a repository variable, not a secret.

### Cloudflare Pages

`scripts/deploy.mjs` runs `wrangler pages deploy out`. The rules come from two
files the build copies into `out/`:

- `site/public/_redirects`: the moved pages, the old sitemap path, the www to
  apex hop, and a generated block of payload rewrites (see below).
- `site/public/_headers`: HTML is never cached, hashed files under
  `/_next/static/` are cached for a year.

Rollback: open the Pages project, find the previous deployment, use
"Rollback to this deployment". That is faster than the Rollback workflow.

One thing to check by hand after setting the project up: in the Cloudflare
dashboard, under the zone's Security settings, make sure "Block AI bots" is
**off**. Blocking them would undo the whole AI visibility plan in section 9 of
the spec.

### Hostinger

`scripts/deploy.mjs` renders `site/deploy/htaccess.template` into
`out/.htaccess` and rsyncs `out/` over SSH into `public_html`.

The `.htaccess` does the work Cloudflare would do for free:

- `Cache-Control: no-cache` on every HTML file. Hostinger currently caches HTML
  for seven days, which would hide a photo the owner just added. This is the
  single most important line in the file.
- A year of immutable cache on `/_next/static/`.
- 301 from `/order-online/` and `/appointment/` to `/contact/`.
- 301 from the old WordPress sitemap paths to `/sitemap.xml`.
- HTTPS and one canonical host.
- `ErrorDocument 404 /404.html`.
- The generated payload rewrites.

After the rsync the script removes the LiteSpeed cache directory over SSH.

**The one step that may need a human.** Hostinger also runs an edge CDN
("hcdn") in front of shared hosting, and it has no shell command and no API on
the shared plans. If the site still serves an old page a minute after a deploy,
purge it by hand: hPanel, Websites, nyframing.com, Performance, CDN, Purge
cache. After the first real production deploy, write down here whether that
step was actually needed, so nobody has to guess again.

Rollback: run the Rollback workflow. It downloads the `out` artifact from an
earlier deploy run and rsyncs it back. Artifacts are kept for 30 days.

## The payload rewrite, and why it exists

**Only builds made on Windows need it.** Next names each payload by taking
`path.relative` of the segment file and turning its slashes into dots. On
Linux that gives the flat file the browser asks for. On Windows
`path.relative` returns backslashes, which survive and become folders. CI and
both hosts build on Linux, where `rscRewrites` finds nothing to rewrite and
returns no rules. The rules matter for a build made on a Windows machine and
for `scripts/serve-out.mjs` there. Found when CI first ran, 3 October 2026.

On Windows, Next 16's static export writes each route's React payload at
`dir/__next.<route>/__PAGE__.txt`, but the browser prefetches
`dir/__next.<route>.__PAGE__.txt`, with a dot where the last slash is. The
catch-all gallery route is worse: the file is at
`gallery/__next.gallery/$oc$parts/__PAGE__.txt` and the request is for
`gallery/__next.gallery.$oc$parts.__PAGE__.txt`.

Without a rewrite every prefetch is a 404. Navigation still works, because the
browser falls back to fetching the page, but every hover costs a wasted request
and a console error, and `errors-in-console` is a Lighthouse assertion.

Neither host can express "turn a slash into a dot" as a pattern, so
`scripts/deploy.mjs` walks the built tree and writes one rule per payload file:
a `200` rewrite in `_redirects`, a `RewriteRule` in `.htaccess`. On the current
build that is 13 rules. A new page adds its rule automatically.

The alternative is to turn prefetching off in the pages, which removes the
problem at the cost of slower navigation. That is a decision for whoever owns
`site/src`. The rewrite costs nothing, so it is the default.

`site/scripts/serve-out.mjs` imports the same `rscRewrites` function from
`scripts/deploy.mjs` and answers from the same list, so the local server, the
Cloudflare rules and the `.htaccess` rules cover exactly the same paths,
including the catch-all gallery payloads that used to 404 locally.

## The JavaScript weight

Spec 9.6 sets the budget at 150 KB of compressed first-party JavaScript. Run
`npm run js-weight` after a build for the current figure. Measured on this
build:

| Route | Total gzip | Next and React | Our own code | Inline |
| --- | --- | --- | --- | --- |
| `/` | 181.6 KB | 165.8 KB | 10.3 KB | 5.5 KB |
| `/contact/` | 180.2 KB | 168.1 KB | 8.7 KB | 3.4 KB |
| `/gallery/` | 179.7 KB | 166.9 KB | 8.7 KB | 4.0 KB |
| `/services/` | 178.6 KB | 165.8 KB | 8.7 KB | 4.1 KB |
| `/privacy/` | 177.4 KB | 165.8 KB | 8.7 KB | 2.9 KB |

Every route is about 30 KB over the budget, and about 166 KB of that is the
Next and React baseline that arrives whether or not a page needs it. Our own
client code, the mobile menu and the sliding row, is under 11 KB.

So the budget is not missed by carelessness; it is missed by the choice of
framework. Three honest options:

1. **Accept 180 KB and change the number in the spec.** The site is a static
   export: the JavaScript is not needed to read anything, it downloads after
   first paint, and the measured effect on LCP is small. Cheapest.
2. **Drop hydration.** The only interactive parts are a menu toggle and a
   scrolling row, both of which are a few lines of plain JavaScript. Building
   those two as small scripts and turning React hydration off would put every
   route under 20 KB. This is the only route to actually meeting 150 KB, and it
   means leaving Next's client runtime behind.
3. **Wait.** Next's baseline shrinks between releases and some of this is
   development scaffolding that a future version drops.

Recommendation: option 1 for launch, with the assertion in
`site/lighthouserc.cjs` kept at `warn` and this section as the record, and
option 2 raised with the client only if real field data shows a problem. Do not
quietly delete the assertion.

## Environment variables and secrets

Repository **variables** (not secret, visible in the Actions log):

| Name | What it is |
| --- | --- |
| `DEPLOY_TARGET` | `cloudflare` or `hostinger` |
| `SITE_URL` | `https://nyframing.com` |
| `SANITY_PROJECT_ID` | Unset until the Sanity project exists. Unset means build from `site/content/seed/`. |
| `SANITY_DATASET` | `production` |
| `CLOUDFLARE_PROJECT_NAME` | The Pages project name |
| `NEXT_PUBLIC_WEB3FORMS_KEY` | Public by design, restricted to nyframing.com in the Web3Forms dashboard |
| `NEXT_PUBLIC_HCAPTCHA_SITEKEY` | Public by design |

Repository **secrets**:

| Name | What it is |
| --- | --- |
| `SANITY_READ_TOKEN` | Not needed while the dataset is public, which the free plan requires. Leave unset. |
| `CLOUDFLARE_API_TOKEN` | Scoped to Cloudflare Pages edit on one account |
| `CLOUDFLARE_ACCOUNT_ID` | |
| `HOSTINGER_HOST` | |
| `HOSTINGER_USER` | |
| `HOSTINGER_SSH_PORT` | Hostinger shared hosting uses a non-standard port |
| `HOSTINGER_PATH` | Usually `/home/<user>/domains/nyframing.com/public_html` |
| `HOSTINGER_SSH_KEY` | Private half of a key added to the Hostinger account |
| `INDEXNOW_KEY` | 8 to 128 characters, letters, digits and dashes. Generate it in Bing Webmaster Tools. |

The GitHub token the Sanity webhook uses is not in this list on purpose. It
lives in the webhook's Authorization header in the Sanity dashboard and nowhere
else.

Nothing is read from a plain environment variable in a workflow file. Every
value comes through `secrets.*` or `vars.*`.

## Running the gates on your own machine

From `site/`:

```bash
npm ci
npx playwright install chromium

npm run lint
npm run typecheck
npm run check:sources      # every statement has a source, no "7 days a week", no em dash
npm run claims:check       # docs/claims-register.md matches the content
npm run build
npm run check:strings      # every word on the built site traces to content or labels
npm run check:jsonld       # structured data says nothing the page does not
npm run test:e2e           # Playwright: shell, reflow, axe, links, sitemap, redirects
npm run js-weight          # the table above, for the current build

npm run lh                 # Lighthouse CI, Linux and macOS
npm run lh:direct          # Windows: the same runs without lhci autorun
npm run lh:assert          # grade whatever is in .lighthouseci/
```

### Lighthouse on Windows

`lhci autorun` fails on Windows at the end of every run. It kills Chrome and
then cannot delete Chrome's temporary profile, so the run ends in
`EPERM ... \?\C:\Users\...\Temp\lighthouse.NNNN` and no report is kept. The
measurement itself is fine; only the cleanup fails.

`npm run lh:direct` runs the Lighthouse CLI itself, with the settings out of
`lighthouserc.cjs`, against `scripts/serve-out.mjs`. It writes the reports into
`.lighthouseci/`, prints a table of the numbers and the LCP element of each
page, and tolerates that same non-zero exit code because the report is written
before the cleanup runs. Then `npm run lh:assert` grades the reports exactly as
`autorun` would. `--runs=N` changes the number of runs per page.

`npm run check:strings -- --fixture` runs only the self-test: it proves the
matcher rejects an invented sentence and catches a leaked source key, without
needing a build.

To see what a deploy would do without doing it:

```bash
DEPLOY_TARGET=cloudflare npm run deploy:dry
DEPLOY_TARGET=hostinger  npm run deploy:dry
```

## The workflows

| File | When it runs | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Every push and pull request | Every gate. Deploys nothing. |
| `.github/workflows/deploy.yml` | Sanity publish, push to `master`, or by hand | Every gate, then deploy, then IndexNow. |
| `.github/workflows/rollback.yml` | By hand only | Re-uploads the `out` artifact from an earlier deploy run. Defaults to a dry run. |

Staging is any branch that is not `master`. Staging builds emit `noindex` and a
`robots.txt` that disallows everything, and the gates check that both are the
right way round for the environment.

## Launch gates

From spec section 11 and the master brief. None of these is a code change; all
of them are blocked on the client or on a human.

- [ ] The owner has confirmed the business facts: name, address, cross streets,
      phone, hours, the Sunday wording, and the founding year.
- [ ] The live site's contradiction is resolved. It says both "Sun by
      appointment only" and that the shop is open every day. Until he says which
      is true, only the first publishes.
- [ ] `site/src/labels.ts` has one written sign-off from the client through
      Juko.
- [ ] `docs/claims-register.md` is fully approved. Every row currently says
      `pending owner confirmation`.
- [ ] The contact form delivers to the real inbox, tested end to end, and
      somebody has confirmed which inbox that is.
- [ ] The redirect map is tested against the live URL list, not just the two we
      know about.
- [ ] A full backup of the WordPress site and database exists and is kept.
- [ ] Rollback has been proven once on the real host, not just in a dry run.
- [ ] The owner has passed the phone acceptance test: add a photo, set its type,
      publish, see it on the site.
- [ ] Account ownership is settled for Sanity, Cloudflare, GitHub, and
      Web3Forms. The client owns them, not the agency.
- [ ] Manual keyboard and screen reader pass. The axe scan is automated; this is
      not.
- [ ] Original photos are in Sanity. A production build refuses the reduced
      copies in `/assets`.
- [ ] Google Search Console and Bing Webmaster Tools are verified, the sitemap
      is submitted, and the IndexNow key is generated.
- [ ] Google Business Profile and Yelp show the same name, address, and phone as
      the site.
- [ ] Production has been checked for a stray `noindex`, in the HTML and in the
      response headers.

## Known problems, honestly

- **Lighthouse still fails on LCP. Page weight now passes.** The seed used to
  ship one full size JPEG per picture with no `srcset`, because a local image
  had no image pipeline behind it. `scripts/prebuild-assets.mjs` now generates
  the same four widths the Sanity CDN would, as WebP, with `sharp`, and the
  `sizes` attributes were corrected page by page. Medians of three mobile runs
  against the built `out/`:

  | Route | Weight before | Weight after | LCP before | LCP after |
  | --- | --- | --- | --- | --- |
  | `/` | 2.6 MB | 1.02 MB | 7.2s | 3.7s |
  | `/gallery/` | 2.4 MB | 1.28 MB | 8.0s | 6.8s |
  | `/contact/` | 0.7 MB | 0.65 MB | 4.7s | 4.7s |

  All three are now inside the 1.5 MB budget, which is why
  `total-byte-weight` stopped failing. CLS is 0.000 and total blocking time is
  under 200ms everywhere. LCP is still over 2.5s on all three, and on this
  build it is bandwidth, not code: the throttled run is queueing 0.65 to
  1.3 MB, of which about 0.48 MB is the framework JavaScript. The remaining
  image weight is the reduced copies in `/assets` re-encoded, and re-encoding
  an already compressed JPEG gains little. Re-measure once the originals are in
  Sanity and the CDN is serving them, and do not loosen the budget before that.
- **The LCP element on mobile is the header mark, not the storefront photo.**
  Spec section 4 wants the storefront photo to be the LCP element and it is
  preloaded, but section 4 also sets the mobile stacking order to text, then
  contact details, then photo, which puts the photo below the fold on a phone.
  An element outside the first viewport cannot be the LCP element, so on mobile
  the two halves of that paragraph cannot both hold. The order was kept and the
  preload was kept. On a desktop viewport the photo is the largest element in
  the first screen and is the LCP element. If the client would rather have the
  photo above the contact details on a phone, that is a one line change to
  `home.module.css` and it is the only way to satisfy both.
- **Reviews have no permalinks**, so a production build leaves every review out.
  The Reviews page would ship empty. Blocked on Google Business Profile access.
- **The sitemap has no `lastmod`**, because seed documents carry no date and the
  rule is to leave a field out rather than invent one. It appears once the
  content comes from Sanity, which has `_updatedAt`.
- **No share image**, so Open Graph has no picture.
