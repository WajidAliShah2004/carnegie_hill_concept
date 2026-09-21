import { getBusinessInfo } from '@/content/load'

export const dynamic = 'force-static'

/**
 * The web manifest. Every name in it is a `businessInfo` field, so installing
 * the site to a home screen cannot put a word on the device that the site does
 * not say. There is no description, because no approved sentence fits here.
 * The icons come from the logo's monogram, written by the prebuild step.
 */
export async function GET() {
  const business = await getBusinessInfo()
  const manifest = {
    name: business.name,
    short_name: business.alternateName ?? business.name,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#13161f',
    theme_color: '#13161f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  })
}
