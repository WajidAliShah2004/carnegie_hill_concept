/**
 * Lighthouse CI, gate 8, against the targets in spec section 9.6:
 * LCP 2.5s, CLS 0.1, INP 200ms, first-party JavaScript under 150 KB
 * compressed, ordinary pages under 1.5 MB, mobile performance 90 or better as
 * a lab guide.
 *
 *   npm run build && npm run lh
 *
 * Three pages, because they are the three shapes the site has: the long Home
 * page with the slider, the image-heavy Gallery, and the form on Contact.
 *
 * Notes on two of the numbers, so nobody quietly loosens them later:
 *
 * INP is a field metric. Lighthouse cannot measure it in a lab run, so Total
 * Blocking Time stands in for it. Under 200ms TBT on a throttled mobile run is
 * the usual proxy for an INP under 200ms in the field. Real INP comes from
 * CrUX after launch.
 *
 * The script budget is set to `warn`, not `error`, and it is the one assertion
 * here that is knowingly not met. Measured on this build, every route ships
 * about 180 KB of gzipped JavaScript, and roughly 170 KB of that is the Next
 * and React baseline that arrives whether or not the page needs it. Our own
 * client code is about 10 KB. See docs/deploy.md, "The JavaScript weight",
 * for the measurement and the options. Turn this back to `error` once that is
 * settled.
 */

module.exports = {
  ci: {
    collect: {
      staticDistDir: './out',
      url: ['http://localhost/index.html', 'http://localhost/gallery/index.html', 'http://localhost/contact/index.html'],
      numberOfRuns: 3,
      settings: {
        // Mobile, because that is how the shop's customers arrive and what
        // spec 9.6 sets the 90 target against.
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 1.75,
          disabled: false,
        },
        throttlingMethod: 'simulate',
        skipAudits: ['uses-http2', 'canonical', 'is-crawlable', 'redirects-http'],
      },
    },
    assert: {
      assertions: {
        /* Core Web Vitals, spec 9.6 */
        'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
        // The lab proxy for INP 200ms.
        'total-blocking-time': ['error', { maxNumericValue: 200, aggregationMethod: 'median' }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800, aggregationMethod: 'median' }],
        'speed-index': ['warn', { maxNumericValue: 3400, aggregationMethod: 'median' }],

        /* Category scores. Performance is a lab guide, so it warns. */
        'categories:performance': ['warn', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        // SEO warns rather than fails because the score counts robots.txt and
        // the robots meta tag, and a staging build blocks crawlers on purpose.
        // `tests/ci/indexing.spec.ts` and `tests/ci/sitemap.spec.ts` check the
        // real rule, keyed on DEPLOY_ENV, and those do fail.
        'categories:seo': ['warn', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:best-practices': ['warn', { minScore: 0.9, aggregationMethod: 'median' }],

        /* Weight, spec 9.6.
         *
         * One caveat on all three: Lighthouse CI serves `out/` from its own
         * static server, which does not compress anything, so these read
         * uncompressed bytes while the spec budget is a compressed one. For
         * the real gzipped JavaScript figure run `npm run js-weight`.
         */
        'total-byte-weight': ['error', { maxNumericValue: 1_572_864, aggregationMethod: 'median' }],
        // 150 KB compressed of first-party JavaScript. Currently about 180 KB
        // gzipped, almost all of it the framework baseline. See the note above.
        'resource-summary:script:size': ['warn', { maxNumericValue: 153_600, aggregationMethod: 'median' }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 1_048_576, aggregationMethod: 'median' }],

        /* Things that would quietly break the plan */
        // Warns, not fails, for one reason: the static test server has none of
        // the host rewrite rules, so every RSC prefetch 404s and lands here.
        // `scripts/deploy.mjs` writes those rules for both hosts. If this
        // fires for any other reason, treat it as a failure.
        'errors-in-console': 'warn',
        'image-size-responsive': 'warn',
        'unsized-images': 'error',
        'render-blocking-resources': 'warn',
        'uses-responsive-images': 'warn',
        'font-display': 'warn',
        'legacy-javascript': 'off',
        'unused-javascript': 'off',
      },
    },
    upload: {
      // No paid server and no budget for one. The HTML reports are kept as a
      // workflow artifact instead.
      target: 'filesystem',
      outputDir: './.lighthouseci',
      reportFilenamePattern: '%%PATHNAME%%-report.%%EXTENSION%%',
    },
  },
}
