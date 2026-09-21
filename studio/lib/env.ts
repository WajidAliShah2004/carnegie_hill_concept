/**
 * Studio environment.
 *
 * No Sanity project exists yet, so the Studio has to build and type check
 * without one. Both values fall back to an obvious placeholder. A placeholder
 * project id cannot talk to Sanity, so `sanity dev` and `sanity deploy` will
 * fail until the real values are set. `sanity build` works either way.
 */

export const PLACEHOLDER_PROJECT_ID = 'placeholder-project-id'
export const PLACEHOLDER_DATASET = 'production'

export const projectId: string =
  process.env.SANITY_STUDIO_PROJECT_ID || PLACEHOLDER_PROJECT_ID

export const dataset: string = process.env.SANITY_STUDIO_DATASET || PLACEHOLDER_DATASET

export const usingPlaceholder: boolean = projectId === PLACEHOLDER_PROJECT_ID

/**
 * Email addresses that get the simplified Photos only desk.
 * Comma separated, for example: SANITY_STUDIO_OWNER_EMAILS=owner@example.com
 * Read the limits of this in README.md before relying on it.
 */
export const ownerEmails: string[] = (process.env.SANITY_STUDIO_OWNER_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)
