import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  // We build our own <picture> markup with an explicit srcset, so Next's
  // optimizer is off. It cannot run in a static export anyway.
  images: { unoptimized: true },
}

export default nextConfig
