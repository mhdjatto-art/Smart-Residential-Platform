#!/usr/bin/env bash
# Step 14H — Organization Branding (white-label) — application layer.
# (The organization_branding table + API + edit form already existed from Phase 9.)
#
# Newly wired:
#   • src/components/layout/branding-provider.tsx
#       - <BrandingProvider> emits CSS vars + favicon for the active org
#       - getActiveBranding(orgId) helper used by other pages
#   • Dashboard layout wraps content in <BrandingProvider> and passes logo_url to Topbar
#   • Topbar shows the org logo to the left of the org name badge
#   • Contract print page renders:
#       - Branded banner (logo + colored border on top)
#       - h1/h2 in primary color
#       - email_footer as a printed footer
#
# Existing pieces (no changes needed):
#   • /settings/branding edit form (colors, logo URLs, custom CSS, email footer)
#   • organization_branding table + RLS already created in Phase 9 migration
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(branding): step 14H — apply org branding to topbar + contract print (white-label)" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "Try it:"
    echo "  1. /settings/branding   — set primary color + paste a logo URL"
    echo "  2. Refresh the dashboard — logo shows in topbar"
    echo "  3. /contracts/<id>/print — logo + brand color appear on the printable contract"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
