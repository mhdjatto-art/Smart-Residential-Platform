#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP — Push the three provider seed SQL files
# ─────────────────────────────────────────────────────────────────────────────
#   • seed-iraqi-providers.sql           24 Iraqi providers
#   • seed-international-providers.sql   26 regional/global providers
#   • seed-gates-parking-providers.sql   30 gate/parking/access providers
# = 80 providers total covering every adapter protocol the platform supports.
#
# After git push, the FILES are in the repo. To actually SEED the data,
# open Supabase SQL Editor and run each file. The git push itself does NOT
# touch your database — these are seed scripts you control manually.
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Provider Seed Files — Push"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add seed-iraqi-providers.sql seed-international-providers.sql seed-gates-parking-providers.sql
git commit -m "seed(providers): 80 providers — Iraqi utilities + regional/GCC + gates/parking/access/intercom/ANPR/EV" || echo "  (no changes to commit)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "  Files now in the repo. To SEED the data into Supabase, open"
    echo "  Supabase Dashboard → SQL Editor and run each of:"
    echo "    1. seed-iraqi-providers.sql           → 24 providers"
    echo "    2. seed-international-providers.sql   → 26 providers"
    echo "    3. seed-gates-parking-providers.sql   → 30 providers"
    echo ""
    echo "  After seeding, browse them at:"
    echo "    /providers       — full list"
    echo "    /integrations    — adapter config per provider"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
