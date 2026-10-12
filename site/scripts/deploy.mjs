#!/usr/bin/env node
/**
 * One entry point for both hosts.
 *
 *   DEPLOY_TARGET=cloudflare node scripts/deploy.mjs [--dry-run]
 *   DEPLOY_TARGET=hostinger  node scripts/deploy.mjs [--dry-run]
 *
 * It never runs on Vercel. Vercel Hobby does not permit commercial use and the
 * budget is zero, so production is Cloudflare Pages or the client's existing
 * Hostinger shared hosting.
 *
 * Before uploading anything it writes the host rules into `out/`:
 *   - Cloudflare: appends the generated RSC payload rewrites to `_redirects`.
 *     `_headers` is authored in `public/` and copied by the build.
 *   - Hostinger: renders `deploy/htaccess.template` into `out/.htaccess` with
 *     the canonical host and the same generated rewrites.
 *
 * `--dry-run` prints every command and every generated rule and touches
 * nothing remote.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { OUT_DIR, SITE_ROOT } from './lib/content.mjs'

const dryRun = process.argv.includes('--dry-run') || process.env.DEPLOY_DRY_RUN === '1'
const target = (process.env.DEPLOY_TARGET ?? '').toLowerCase()
const environment = process.env.DEPLOY_ENV ?? 'staging'
const siteUrl = process.env.SITE_URL ?? 'https://www.carnegiehillframing.com'
const canonicalHost = new URL(siteUrl).host

const MARKER = '# --- generated: RSC payload rewrites ---'

function say(message) {
  console.log(message)
}

function run(command, args, options = {}) {
  const printable = `${command} ${args.join(' ')}`
  if (dryRun) {
    say(`  would run: ${printable}`)
    return { status: 0, dryRun: true }
  }
  say(`  running: ${printable}`)
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: SITE_ROOT, shell: false, ...options })
  if (result.status !== 0) {
    throw new Error(`${printable} exited with ${result.status ?? result.signal}`)
  }
  return result
}

function requireEnv(...names) {
  const missing = names.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variable(s): ${missing.join(', ')}. ` +
        'They come from GitHub Actions secrets. See docs/deploy.md.',
    )
  }
}

/* ------------------------------------------------------------------ */
/* The RSC payload path mismatch                                       */
/* ------------------------------------------------------------------ */

/**
 * Next 16's static export writes a route's payload at
 * `dir/__next.<route>/__PAGE__.txt`, but the client prefetches
 * `dir/__next.<route>.__PAGE__.txt`. The last dot has to become a slash.
 *
 * Neither host can express "turn the last dot of a segment into a slash" as a
 * pattern, so the rules are enumerated from the built tree. There is one per
 * route, they are stable, and a new page adds a new rule automatically.
 *
 * @returns {{from: string, to: string}[]}
 */
export function rscRewrites(outDir = OUT_DIR) {
  const rules = []

  /** Every .txt file under a `__next…` directory, however deep. */
  const collect = (dir, into) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) collect(full, into)
      else if (entry.name.endsWith('.txt')) into.push(full)
    }
  }

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const full = join(dir, entry.name)
      if (entry.name === '_next' || entry.name === 'dev-assets') continue
      if (entry.name.startsWith('__next')) {
        const files = []
        collect(full, files)
        for (const file of files) {
          const to = `/${relative(outDir, file).split(sep).join('/')}`
          // Everything from the `__next…` segment onwards becomes one segment
          // with dots where the slashes were:
          //   /gallery/__next.gallery/$oc$parts/__PAGE__.txt
          //   /gallery/__next.gallery.$oc$parts.__PAGE__.txt
          const prefix = `/${relative(outDir, dir).split(sep).filter(Boolean).join('/')}`
          const head = prefix === '/' ? '' : prefix
          const tail = relative(full, file).split(sep).join('.')
          const from = `${head}/${entry.name}${tail === '' ? '' : `.${tail}`}`
          rules.push({ from, to })
        }
        continue
      }
      walk(full)
    }
  }

  walk(outDir)
  return rules.sort((a, b) => a.from.localeCompare(b.from))
}

function writeCloudflareRules() {
  const file = join(OUT_DIR, '_redirects')
  if (!existsSync(file)) {
    throw new Error('out/_redirects is missing. It is authored in public/_redirects and copied by the build.')
  }
  const base = readFileSync(file, 'utf8')
  const head = base.includes(MARKER) ? base.slice(0, base.indexOf(MARKER)) : `${base}\n`
  const rules = rscRewrites()
  const body = rules.map((rule) => `${rule.from}  ${rule.to}  200`).join('\n')
  const next =
    `${head}${MARKER}\n` +
    '# Written by scripts/deploy.mjs from the built tree. Do not edit by hand.\n' +
    `${body}\n`

  say(`  ${rules.length} RSC payload rewrite(s) into out/_redirects`)
  for (const rule of rules.slice(0, 4)) say(`    ${rule.from}  ->  ${rule.to}`)
  if (rules.length > 4) say(`    ... and ${rules.length - 4} more`)

  if (dryRun) return
  writeFileSync(file, next)
}

function writeHtaccess() {
  const templatePath = join(SITE_ROOT, 'deploy', 'htaccess.template')
  const template = readFileSync(templatePath, 'utf8')
  const rules = rscRewrites()
  // `$oc$parts` really is part of a catch-all route's payload path, so every
  // regular expression metacharacter has to be escaped, not just the dot.
  const escape = (value) => value.replace(/[.^$*+?()[\]{}|\\]/g, '\\$&')
  const block = rules
    .map((rule) => `  RewriteRule ^${escape(rule.from.replace(/^\//, ''))}$ ${rule.to} [L]`)
    .join('\n')

  const rendered = template
    .replaceAll('__CANONICAL_HOST__', canonicalHost)
    .replaceAll('__CANONICAL_HOST_ESCAPED__', canonicalHost.replace(/\./g, '\\.'))
    .replace('__RSC_REWRITES__', block === '' ? '  # none built' : block)

  say(`  .htaccess for ${canonicalHost} with ${rules.length} RSC payload rewrite(s)`)
  if (dryRun) return
  writeFileSync(join(OUT_DIR, '.htaccess'), rendered)
}

/* ------------------------------------------------------------------ */
/* Targets                                                             */
/* ------------------------------------------------------------------ */

function deployCloudflare() {
  requireEnv('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_PROJECT_NAME')
  writeCloudflareRules()
  const branch = environment === 'production' ? 'production' : 'staging'
  run('npx', [
    '--yes',
    'wrangler@4',
    'pages',
    'deploy',
    'out',
    `--project-name=${process.env.CLOUDFLARE_PROJECT_NAME}`,
    `--branch=${branch}`,
    `--commit-dirty=true`,
  ])
  say(`  Cloudflare Pages: rollback is redeploying the previous build from the dashboard.`)
}

function deployHostinger() {
  requireEnv('HOSTINGER_HOST', 'HOSTINGER_USER', 'HOSTINGER_SSH_PORT', 'HOSTINGER_PATH')
  writeHtaccess()

  const remote = `${process.env.HOSTINGER_USER}@${process.env.HOSTINGER_HOST}:${process.env.HOSTINGER_PATH}/`
  run('rsync', [
    '--archive',
    '--compress',
    '--delete',
    '--human-readable',
    '--exclude=_redirects',
    '--exclude=_headers',
    '--exclude=dev-assets',
    '-e',
    `ssh -p ${process.env.HOSTINGER_SSH_PORT} -o StrictHostKeyChecking=accept-new`,
    `${OUT_DIR}${sep}`.replace(/\\/g, '/'),
    remote,
  ])

  // LiteSpeed keeps its own copy of HTML. Removing the cache directory is the
  // documented way to purge it from the shell; the .htaccess above stops it
  // filling up again.
  run('ssh', [
    '-p',
    String(process.env.HOSTINGER_SSH_PORT),
    '-o',
    'StrictHostKeyChecking=accept-new',
    `${process.env.HOSTINGER_USER}@${process.env.HOSTINGER_HOST}`,
    `rm -rf ${process.env.HOSTINGER_PATH}/.lscache || true`,
  ])

  say(
    '  Hostinger hcdn: the CDN layer in front of shared hosting has no shell or API purge.\n' +
      '  If the site still serves an old page after this, purge it in hPanel:\n' +
      '  hPanel > Websites > nyframing.com > Performance > CDN > Purge cache.\n' +
      '  Record whether that step was needed in docs/deploy.md after the first real deploy.',
  )
  say('  Rollback: re-run the rollback workflow, which rsyncs the previous out/ artifact.')
}

/* ------------------------------------------------------------------ */

function main() {
  if (!existsSync(OUT_DIR)) throw new Error('out/ does not exist. Run npm run build first.')

  say(`deploy: target=${target || '(unset)'} env=${environment} site=${siteUrl}${dryRun ? ' [dry run]' : ''}`)

  if (target === 'cloudflare') {
    deployCloudflare()
  } else if (target === 'hostinger') {
    deployHostinger()
  } else {
    throw new Error(
      `DEPLOY_TARGET must be "cloudflare" or "hostinger". Got ${JSON.stringify(process.env.DEPLOY_TARGET ?? null)}. ` +
        'Production never runs on Vercel: Hobby does not permit commercial use.',
    )
  }

  say(dryRun ? 'deploy: dry run finished. Nothing was uploaded.' : 'deploy: finished.')
}

// Only deploy when run directly. Imported (by the redirect test) it just
// exports `rscRewrites`.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  try {
    main()
  } catch (error) {
    console.error(`deploy: ${error.message}`)
    process.exitCode = 1
  }
}
