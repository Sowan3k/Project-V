import type { NextConfig } from 'next'

/**
 * Vercel + Neon, Node runtime, standard Prisma client (CLAUDE.md §4, decided 2026-09-02).
 * Cloudflare Workers and Prisma's edge driver are deliberately out of this architecture.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  eslint: {
    // Linting is a separate CI step (`npm run lint`) so a lint failure is reported as a
    // lint failure, not as a confusing build failure.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
