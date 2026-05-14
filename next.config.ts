import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Phase 15b — Production Hardening:
   * Build gates are now ACTIVE. TypeScript and ESLint errors will fail the
   * build. Types are regenerated from the live DB schema and @supabase/ssr
   * is on a version that handles PostgrestVersion correctly, so `.from(X)`
   * no longer collapses to `never`.
   *
   * If you ever need to temporarily disable a gate to ship a hotfix, set
   * `ignoreBuildErrors: true` here AND open a follow-up issue — never let
   * the gates stay off in `main`.
   */
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // In Next.js 15, typedRoutes moved out of experimental.
  // Disabled for now — many DB-driven hrefs (notifications.href, dynamic routes)
  // fail strict typing. Re-enable after a dedicated pass that casts/narrows
  // every dynamic Link target. Doesn't affect runtime behaviour.
  typedRoutes: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async headers() {
    // Content Security Policy. We allow Supabase (DB + Storage + realtime),
    // Stripe (checkout + webhooks), QR/PDF CDNs we actually use, and the
    // org's own logo URLs (Supabase Storage already covered by *.supabase.co).
    // `'unsafe-inline'` for style is required by Tailwind / Radix; we'd
    // need nonces to drop it, which is a bigger refactor.
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://js.stripe.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.qrserver.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HSTS — 1 year, include subdomains, opt into preload list
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

/**
 * Wrap with Sentry only when fully configured.
 *
 * When SENTRY_DSN is absent we export the bare config so local dev and
 * unconfigured deploys behave exactly as before (no Sentry boot, no source
 * map upload). When DSN + auth token + org + project are all present the
 * wrapper enables:
 *   - source map upload at build time (so stack traces are readable)
 *   - automatic instrumentation of route handlers and React Server Components
 *   - tunneling of events through /monitoring to bypass ad-blockers
 *
 * Required env vars (only at build time, on Vercel):
 *   SENTRY_AUTH_TOKEN  — for uploading source maps (sentry.io → Settings → Auth Tokens)
 *   SENTRY_ORG         — your Sentry org slug
 *   SENTRY_PROJECT     — your Sentry project slug
 *
 * Required env vars at runtime (already in sentry.*.config.ts):
 *   SENTRY_DSN              — server runtime
 *   NEXT_PUBLIC_SENTRY_DSN  — browser runtime (can be the same DSN)
 */
const hasSentryBuildEnv =
  !!process.env.SENTRY_AUTH_TOKEN && !!process.env.SENTRY_ORG && !!process.env.SENTRY_PROJECT;

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { withSentryConfig } = hasSentryBuildEnv ? require("@sentry/nextjs") : { withSentryConfig: null };

export default hasSentryBuildEnv && withSentryConfig
  ? withSentryConfig(nextConfig, {
      org:       process.env.SENTRY_ORG,
      project:   process.env.SENTRY_PROJECT,
      silent:    !process.env.CI,
      widenClientFileUpload: true,
      // Tunnel events through this path to bypass ad-blockers.
      tunnelRoute: "/monitoring",
      // Strip source map files from the public client bundle after upload.
      hideSourceMaps: true,
      // Don't fail the build if Sentry upload itself fails.
      errorHandler: (err: Error) => { console.warn("[sentry build]", err.message); },
      disableLogger: true,
    })
  : nextConfig;

