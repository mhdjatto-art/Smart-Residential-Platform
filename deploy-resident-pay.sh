#!/usr/bin/env bash
# Resident self-pay flow on mobile portal:
#   • Server action payMyUtilityBill (ownership check + restricted methods)
#   • Mobile PayBillButton dialog
#   • Updated /m/payments page with Pay button per row
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Resident Self-Pay — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(mobile): resident self-pay — payMyUtilityBill action (ownership-verified) + Pay button + dialog on /m/payments" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "Try it:"
    echo "  1. Log in as tenant1@bonyan.demo / Demo!2026"
    echo "  2. Open /m/payments — Pay button on each unpaid bill"
    echo "  3. Tap Pay → choose Card or Wallet → confirm amount → Pay"
    echo "  4. Bill status flips to 'paid' instantly"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
