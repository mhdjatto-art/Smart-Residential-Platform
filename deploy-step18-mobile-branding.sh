#!/usr/bin/env bash
# Step 18 — White-label on mobile resident pages + branded login.
#
# Changes:
#   • src/app/m/layout.tsx wraps /m/* in <BrandingProvider> and renders a
#     centered logo bar above every mobile page.
#   • /m hero balance card uses primary→accent gradient from the org's
#     branding (falls back to emerald when not configured).
#   • branding-provider.tsx gains getBrandingByHost() — looks up
#     organization_domains by request host. Used on the unauthenticated login
#     page so tenant-domain visitors see the org's logo before login.
#   • /login renders the org logo above the form when the host matches a
#     known tenant domain.
#
# No SQL changes. The organization_domains + organization_branding tables
# were already created in Phase 9.
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(branding): step 18 — white-label /m/* mobile shell + branded login by host" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "Try it:"
    echo "  1. /settings/branding — upload a logo + set primary/accent colors"
    echo "  2. Open /m as a resident — logo appears top center; hero card uses brand colors"
    echo "  3. (Optional) Add a custom domain on /settings/domains and visit /login from it — logo shows above the form"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
