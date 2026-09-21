/**
 * Works out which site a social post link belongs to.
 *
 * One rule, two copies: this mirrors `platformFromUrl` in
 * `site/src/content/load.ts` exactly, value for value and host for host. The
 * site is what renders, and it can only name a platform that has a word in
 * `site/src/labels.ts`, so the Studio must not offer a platform the site
 * cannot name. Adding one means adding a label and getting it signed off.
 */

export const SOCIAL_PLATFORMS = [
  {value: 'instagram', title: 'Instagram'},
  {value: 'facebook', title: 'Facebook'},
  {value: 'twitter', title: 'Twitter'},
  {value: 'linkedin', title: 'LinkedIn'},
  {value: 'youtube', title: 'YouTube'},
  {value: 'other', title: 'Somewhere else'},
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]['value']

export function platformFromUrl(url: string | undefined): SocialPlatform | undefined {
  if (!url) return undefined
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return undefined
  }
  if (host.endsWith('instagram.com')) return 'instagram'
  if (host.endsWith('facebook.com') || host.endsWith('fb.com')) return 'facebook'
  if (host.endsWith('twitter.com') || host.endsWith('x.com')) return 'twitter'
  if (host.endsWith('linkedin.com')) return 'linkedin'
  if (host.endsWith('youtube.com') || host.endsWith('youtu.be')) return 'youtube'
  return 'other'
}

export function platformTitle(value: string | undefined): string | undefined {
  return SOCIAL_PLATFORMS.find((p) => p.value === value)?.title
}
