import {defineCliConfig} from 'sanity/cli'
import {dataset, projectId} from './lib/env'

export default defineCliConfig({
  api: {projectId, dataset},
  /** The free plan hosts the Studio at <name>.sanity.studio. */
  studioHost: process.env.SANITY_STUDIO_HOST,
  /**
   * Sanity keeps the deployed Studio up to date by itself, so nobody has to
   * redeploy it for a patch. Set this to false to check that the whole Studio
   * still bundles locally.
   */
  deployment: {autoUpdates: true, appId: 'd6v0t4snn65qgl8bqe05x79f'},
  /**
   * `sanity deploy` reads the schema by running the config through Vite in
   * Node with every dependency inlined. `lexorank`, which the drag to order
   * plugin uses, is CommonJS only and fails there with "exports is not
   * defined", which stops the deploy. Listing it here lets Node load it
   * directly. The browser bundle is not affected.
   */
  vite: {ssr: {external: ['lexorank']}},
})
