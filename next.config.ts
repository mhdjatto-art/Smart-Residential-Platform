import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Production builds fail on TS and ESLint errors.
   *
   * If a Supabase typed-client call collapses into `never`, suppress *that
   * specific call site* with `// @ts-expect-error supabase narrow` or cast
   * via `as unknown as <Row>` rather than globally disabling type-checking.
   * The build is now the safety net the codebase relies on.
   */
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // In Next.js 15, typedRoutes moved out of experimental.
  typedRoutes: true,
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
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.qrserver.com",
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

export default nextConfig;
