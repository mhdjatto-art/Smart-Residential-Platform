#!/usr/bin/env bash
# Utility bill payment + penalty flow:
#   • Pay-bill dialog per row on /utility-bills
#   • Apply-penalties button (top of page)
#   • SQL functions in install-utility-billing-actions.sql
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Payment + Penalty Flow — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(billing): utility bill payments + late penalties — SQL fns + pay dialog + penalties batch button + enriched bills page" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "Next steps:"
    echo "  1. Open Supabase SQL Editor and run install-utility-billing-actions.sql"
    echo "     (creates record_utility_bill_payment + apply_utility_bill_penalty[_all])"
    echo "  2. Visit /utility-bills:"
    echo "     • 'Pay' button on each unpaid row → cash/transfer/online/wallet/cheque"
    echo "     • 'Apply penalties' button → 2% per week after 7-day grace"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
