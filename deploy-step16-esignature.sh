#!/usr/bin/env bash
# Step 16 — Resident e-signature on contracts.
#
# Database (one-time, run install-contract-signatures.sql in Supabase SQL editor):
#   • contract_signatures table — frozen rendered HTML + PNG signature + IP/UA audit trail
#   • RLS: resident sees + creates their own; staff can read all in their org
#
# App:
#   • /m/contracts                 — resident's contract list with signed/pending badge
#   • /m/contracts/[id]            — read-only contract render + signature pad
#   • Signature pad component (canvas, pointer events — works for finger/mouse/pen)
#   • Manager contract detail now shows signature image + audit row when signed
#   • "Contracts" tile added to mobile home grid
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(contracts): step 16 — resident e-signature flow with audit trail" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "Post-deploy checklist:"
    echo "  1. Run install-contract-signatures.sql in Supabase SQL editor (one time)"
    echo "  2. Log in as a resident → /m → tap Contracts → tap a contract → draw signature → submit"
    echo "  3. Log in as compound_manager → /contracts/<id> → green signature card appears"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
