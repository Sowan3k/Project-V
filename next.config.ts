import type { NextConfig } from 'next'

/**
 * Vercel + Neon, Node runtime, standard Prisma client (CLAUDE.md §4, decided 2026-09-02).
 * Cloudflare Workers and Prisma's edge driver are deliberately out of this architecture.
 */
const nextConfig: NextConfig = {
  /**
   * An escape hatch for builds that must not disturb a running dev server — Phase 12G.
   *
   * Two other sessions' dev servers have shared this checkout's `.next` and corrupted each
   * other's build manifests twice (Status.md, sessions 16 and 17). A review build now writes
   * somewhere of its own by setting `NEXT_DIST_DIR`, and every ordinary build is unchanged
   * because the default is the same `.next` it always was.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Off for an isolated review build, on everywhere else.
   *
   * `typedRoutes` writes a route registry into the dist directory, and `next build` adds that
   * path to `tsconfig.json`. A build with its own dist directory would therefore declare a
   * *second* registry beside the real one — `RouteImpl` twice — and hrefs that are perfectly
   * well typed start failing on the duplicate rather than on anything wrong with them. That
   * is an artifact of running two registries at once, so the isolated build does not create
   * one. The real registry is untouched: `NEXT_DIST_DIR` is unset for `npm run build` and
   * `npm run typecheck`, which are the steps that gate a release.
   *
   * The `tsconfig.json` rewrite itself is undone by `scripts/review/build.mjs`.
   */
  typedRoutes: process.env.NEXT_DIST_DIR === undefined,
  eslint: {
    // Linting is a separate CI step (`npm run lint`) so a lint failure is reported as a
    // lint failure, not as a confusing build failure.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
