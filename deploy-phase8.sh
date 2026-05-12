#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP Phase 8 — Analytics, AI, Automation & Enterprise Control Center — deploy
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP Phase 8 — Intelligence Layer — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▸ Step 1/4: Apply Phase 8 migrations"
supabase db push
echo ""

echo "▸ Step 2/4: Regenerate TypeScript types"
supabase gen types typescript --linked --schema public > src/types/database.ts.new
if ! grep -q "Database" src/types/database.ts.new; then
  echo "  ✗ Generated types look invalid"
  rm -f src/types/database.ts.new
  exit 1
fi
mv src/types/database.ts.new src/types/database.ts
echo "  ✓ Types regenerated ($(wc -l < src/types/database.ts) lines)"
echo ""

echo "▸ Step 3/4: Prime the analytics layer (compute today's KPI snapshot for every org)"
SUPABASE_PROJECT_URL=$(supabase status 2>/dev/null | awk -F': *' '/API URL/{print $2}' | tr -d ' ')
if [ -n "$SUPABASE_PROJECT_URL" ]; then
  echo "  (skipping — run \`select public.refresh_all_daily_kpi(current_date)\` manually if you want a snapshot)"
fi
echo ""

echo "▸ Step 4/4: Commit and push"
git add -A
git commit -m "feat(phase8): analytics, automation, alerts, audit, control center, AI-ready predictions" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✓ Phase 8 pushed on attempt $i"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Vercel rebuilds in ~30s. Then:"
    echo "  Open /control-center and click 'Refresh now' to compute the first snapshot."
    echo "  Open /analytics/risk and click 'Recompute risk' to seed the predictor."
    echo "  Open /automation to create your first rule."
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "✗ All push attempts failed. Run 'git push origin main' manually."
exit 1
