import { robotsTxt } from '@/seo/files'

export const dynamic = 'force-static'

export function GET() {
  return new Response(robotsTxt(), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
