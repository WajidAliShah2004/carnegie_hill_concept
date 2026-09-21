import { llmsTxt } from '@/seo/files'

export const dynamic = 'force-static'

export async function GET() {
  return new Response(await llmsTxt(), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
