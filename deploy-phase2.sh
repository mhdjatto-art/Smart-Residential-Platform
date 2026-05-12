#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP Phase 2 — full deploy
# ─────────────────────────────────────────────────────────────────────────────
# 1. supabase db push (applies the 3 new Phase 2 migrations)
# 2. supabase gen types typescript (regenerates src/types/database.ts)
# 3. git add + commit + push (Vercel auto-deploys)
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP Phase 2 — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▸ Step 1/3: Apply Phase 2 migrations to Supabase"
supabase db push
echo ""

echo "▸ Step 2/3: Regenerate TypeScript types from live schema"
supabase gen types typescript --linked --schema public > src/types/database.ts.new
if ! grep -q "Database" src/types/database.ts.new; then
  echo "  ✗ Generated types look invalid. Aborting."
  rm -f src/types/database.ts.new
  exit 1
fi
mv src/types/database.ts.new src/types/database.ts
echo "  ✓ Types regenerated ($(wc -l < src/types/database.ts) lines)"
echo ""

echo "▸ Step 3/3: Commit and push"
git add -A
git commit -m "feat(phase2): property & resident management — full CRUD, floors, assignments, documents, dashboard" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✓ Phase 2 pushed on attempt $i"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Vercel will rebuild in ~30s. Test in 2min:"
    echo "  curl -sS -o /dev/null -w 'Status: %{http_code}\\n' -L https://smart-residential-platform.vercel.app/dashboard"
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "✗ All push attempts failed. Run 'git push origin main' manually."
exit 1
