#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP — Root-cause fix for Vercel build errors
# ─────────────────────────────────────────────────────────────────────────────
# This script:
#   1. Regenerates src/types/database.ts from the live Supabase schema
#   2. Reverts the typescript.ignoreBuildErrors workaround in next.config.ts
#   3. Commits + pushes
#
# After this runs, Vercel will rebuild with PROPER typed inference — no more
# `never` errors, no more workarounds.
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

PROJECT_REF="gecrhvblnzrsvxectfhz"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Root-cause type fix"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Regenerate types ─────────────────────────────────────────────────────────
echo "▸ Step 1/4: Regenerating types from live Supabase schema"
echo "  • Project: $PROJECT_REF"
echo ""

if ! supabase gen types typescript --linked --schema public > src/types/database.ts.new 2>/tmp/srp-types-err; then
  echo "  ✗ Type generation failed. Error:"
  cat /tmp/srp-types-err
  echo ""
  echo "  Possible fixes:"
  echo "    - Run 'supabase login' first"
  echo "    - Run 'supabase link --project-ref $PROJECT_REF' first"
  rm -f src/types/database.ts.new
  exit 1
fi

# Sanity check: file should not be empty and should contain 'Database'
if [ ! -s src/types/database.ts.new ] || ! grep -q "Database" src/types/database.ts.new; then
  echo "  ✗ Generated types look invalid. Aborting."
  cat src/types/database.ts.new
  rm -f src/types/database.ts.new
  exit 1
fi

mv src/types/database.ts.new src/types/database.ts
echo "  ✓ Types regenerated ($(wc -l < src/types/database.ts) lines)"
echo ""

# 2. Revert the next.config.ts workaround ─────────────────────────────────────
echo "▸ Step 2/4: Reverting ignoreBuildErrors workaround"

cat > next.config.ts <<'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
EOF

echo "  ✓ next.config.ts cleaned (TypeScript strict checking re-enabled)"
echo ""

# 3. Stage + commit ──────────────────────────────────────────────────────────
echo "▸ Step 3/4: Committing"
git add src/types/database.ts next.config.ts
git status --short
echo ""
git commit -m "fix: regenerate Supabase types from live schema, remove build workaround" || echo "  (no changes to commit)"
echo ""

# 4. Push with retry ──────────────────────────────────────────────────────────
echo "▸ Step 4/4: Pushing to GitHub (up to 5 retries)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✓ Pushed successfully on attempt $i"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Vercel will auto-rebuild in ~30s. Wait 2min, then test:"
    echo "  curl -sS -o /dev/null -w 'Status: %{http_code}\\n' -L https://smart-residential-platform.vercel.app/login"
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo ""
echo "✗ All 5 push attempts failed. Run the script again."
exit 1
