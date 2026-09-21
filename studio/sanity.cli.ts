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
  deployment: {autoUpdates: true},
})
