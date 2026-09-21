/**
 * Types for `scripts/deploy.mjs`, so `tsc --noEmit` stays clean where a test
 * imports the rule generator. The script itself stays plain JavaScript: it
 * runs in CI with no build step in front of it.
 */

export declare function rscRewrites(outDir?: string): { from: string; to: string }[]
