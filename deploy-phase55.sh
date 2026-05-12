#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP Phase 5.5 — Dynamic Service Fees & API Integration Layer
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP Phase 5.5 — Pricing + Integrations — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▸ Step 1/3: Apply Phase 5.5 migrations"
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
git commit -m "feat(phase5.5): dynamic pricing engine + provider integrations (Mikrotik/UniFi/Modbus adapter layer)" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Phase 5.5 pushed on attempt $i — Vercel will rebuild in ~30s"
    echo ""
    echo "After build:"
    echo "  /pricing-rules     — create dynamic fee rules per service"
    echo "  /integrations      — connect Mikrotik / UniFi / Modbus / REST adapters"
    echo "  /integrations/logs — see every adapter call"
    echo ""
    echo "From SQL: select public.compute_dynamic_fee(org_id, 'electricity', unit_id, 250) returns the price."
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
