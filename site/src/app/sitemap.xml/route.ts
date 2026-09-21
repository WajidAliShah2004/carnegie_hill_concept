import { sitemapXml } from '@/seo/files'

export const dynamic = 'force-static'

export async function GET() {
  return new Response(await sitemapXml(), {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  })
}
