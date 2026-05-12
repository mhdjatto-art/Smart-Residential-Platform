#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP Phase 9 — White-Label SaaS & Commercialization — deploy
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP Phase 9 — Commercial SaaS — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▸ Step 1/3: Apply Phase 9 migrations (schema + functions + seeds + RLS)"
supabase db push
echo ""

echo "▸ Step 2/3: Regenerate TypeScript types"
supabase gen types typescript --linked --schema public > src/types/database.ts.new
if ! grep -q "Database" src/types/database.ts.new; then
  echo "  ✗ Generated types look invalid"
  rm -f src/types/database.ts.new
  exit 1
fi
mv src/types/database.ts.new src/types/database.ts
echo "  ✓ Types regenerated ($(wc -l < src/types/database.ts) lines)"
echo ""

echo "▸ Step 3/3: Commit and push"
git add -A
git commit -m "feat(phase9): white-label SaaS — plans, features, branding, domains, billing, usage, i18n, multi-tenant routing" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✓ Phase 9 pushed on attempt $i"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Next steps in the live app:"
    echo "  1. Open /saas-console (super-admin only) — see overview + MRR/ARR."
    echo "  2. Click 'Provision tenant' to create your first commercial customer."
    echo "  3. Inside that tenant, /settings/branding sets the white-label theme."
    echo "  4. /settings/domains attaches custom hostnames."
    echo "  5. /settings/billing shows the tenant's subscription + invoices."
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "✗ All push attempts failed. Run 'git push origin main' manually."
exit 1
