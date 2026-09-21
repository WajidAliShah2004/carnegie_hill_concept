#!/usr/bin/env node
/**
 * Lighthouse without `lhci autorun`.
 *
 * `lhci autorun` crashes on Windows after every run: it kills Chrome and then
 * cannot delete Chrome's temporary profile, so the whole run reports
 * `EPERM ... \\?\C:\Users\...\Temp\lighthouse.NNNN` and no report is written.
 * The measurement itself is fine; only the cleanup fails.
 *
 * So this runs the Lighthouse CLI itself against `scripts/serve-out.mjs`, with
 * the settings from `lighthouserc.cjs`, writes the reports into
 * `.lighthouseci/`, prints the numbers, and then `lhci assert` grades them:
 *
 *   npm run build
 *   npm run lh:direct
 *   npx lhci assert --config=lighthouserc.cjs
 *
 * `--runs=N` repeats each page; the median is what `lhci assert` grades.
 */

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { OUT_DIR, SITE_ROOT } from './lib/content.mjs'

const config = (await import('../lighthouserc.cjs')).default ?? (await import('../lighthouserc.cjs'))
const collect = (config.default ?? config).ci.collect

const PORT = Number(process.env.LH_PORT ?? 4187)
const runs = Number((process.argv.find((a) => a.startsWith('--runs=')) ?? '').split('=')[1] || collect.numberOfRuns || 3)
const reportDir = join(SITE_ROOT, '.lighthouseci')

/** `http://localhost/gallery/index.html` becomes `/gallery/index.html`. */
const paths = collect.url.map((url) => new URL(url).pathname)

function serve() {
  const child = spawn(process.execPath, [join(SITE_ROOT, 'scripts', 'serve-out.mjs'), String(PORT)], {
    cwd: SITE_ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('serve-out did not start')), 15_000)
    child.stdout.on('data', () => {
      clearTimeout(timer)
      resolve(child)
    })
    child.on('error', reject)
  })
}

const settings = collect.settings
const flags = [
  '--quiet',
  '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
  `--form-factor=${settings.formFactor}`,
  `--throttling-method=${settings.throttlingMethod}`,
  `--screenEmulation.mobile=${settings.screenEmulation.mobile}`,
  `--screenEmulation.width=${settings.screenEmulation.width}`,
  `--screenEmulation.height=${settings.screenEmulation.height}`,
  `--screenEmulation.deviceScaleFactor=${settings.screenEmulation.deviceScaleFactor}`,
  ...(settings.skipAudits ?? []).map((audit) => `--skip-audits=${audit}`),
  '--output=json',
]

const number = (report, id) => report.audits[id]?.numericValue
const fmt = (value, unit) => (value === undefined ? 'n/a' : unit === 's' ? `${(value / 1000).toFixed(2)}s` : `${(value / 1024 / 1024).toFixed(2)} MB`)

function main() {
  if (!readdirSync(OUT_DIR).length) throw new Error('out/ is empty. Run npm run build first.')
  rmSync(reportDir, { recursive: true, force: true })
  mkdirSync(reportDir, { recursive: true })

  const rows = []
  let index = 0
  for (const path of paths) {
    for (let run = 0; run < runs; run += 1) {
      const file = join(reportDir, `lhr-${String(index).padStart(3, '0')}.json`)
      index += 1
      // The CLI entry point is run with this Node directly, so there is no
      // shell and no `npx` wrapper to go wrong on Windows.
      const result = spawnSync(
        process.execPath,
        [
          join(SITE_ROOT, 'node_modules', 'lighthouse', 'cli', 'index.js'),
          `http://127.0.0.1:${PORT}${path}`,
          ...flags,
          `--output-path=${file}`,
        ],
        { cwd: SITE_ROOT, stdio: ['ignore', 'inherit', 'inherit'] },
      )
      /*
        The report is written before Chrome is killed, so a failure in that
        cleanup leaves a complete report behind and a non-zero exit code. The
        file is therefore the test, not the exit code. A missing or unparsable
        file is a real failure and still stops the run.
      */
      let report
      try {
        report = JSON.parse(readFileSync(file, 'utf8'))
      } catch {
        throw new Error(
          `lighthouse exited with ${result.status} on ${path} and wrote no readable report`,
        )
      }
      rows.push({
        path,
        run: run + 1,
        performance: report.categories.performance.score,
        accessibility: report.categories.accessibility.score,
        lcp: number(report, 'largest-contentful-paint'),
        cls: number(report, 'cumulative-layout-shift'),
        tbt: number(report, 'total-blocking-time'),
        bytes: number(report, 'total-byte-weight'),
        lcpElement: report.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet,
      })
    }
  }

  console.log('')
  console.log('page                 run  perf  a11y     LCP     CLS     TBT     weight')
  for (const row of rows) {
    console.log(
      `${row.path.padEnd(20)} ${String(row.run).padEnd(4)} ` +
        `${String(Math.round((row.performance ?? 0) * 100)).padStart(4)}  ` +
        `${String(Math.round((row.accessibility ?? 0) * 100)).padStart(4)}  ` +
        `${fmt(row.lcp, 's').padStart(6)}  ${(row.cls ?? 0).toFixed(3).padStart(6)}  ` +
        `${fmt(row.tbt, 's').padStart(6)}  ${fmt(row.bytes, 'MB').padStart(9)}`,
    )
  }
  console.log('')
  for (const path of paths) {
    const first = rows.find((row) => row.path === path)
    if (first?.lcpElement) console.log(`LCP element on ${path}: ${first.lcpElement}`)
  }
  console.log('')
  console.log(`${rows.length} report(s) in .lighthouseci/. Grade them with:`)
  console.log('  npx lhci assert --config=lighthouserc.cjs')
}

const server = await serve()
try {
  main()
} catch (error) {
  console.error(`lighthouse-direct: ${error.message}`)
  process.exitCode = 1
} finally {
  server.kill()
}
