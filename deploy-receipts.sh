#!/usr/bin/env bash
# Receipt page + payment history:
#   • Server query getReceipt(billId) with ownership check
#   • /m/payments/[bill_id]/receipt — branded, printable receipt
#   • /m/payments/history            — list of paid bills with Receipt link
#   • Receipt link on success page
#   • Download button uses window.print() → Save as PDF (no npm dep)
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Receipts + History — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(receipts): branded receipt page + payment history + print-to-PDF button + Stripe success link" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "Try it:"
    echo "  1. Log in as tenant1@bonyan.demo / Demo!2026"
    echo "  2. Pay any utility bill (any method)"
    echo "  3. From the success page → 'View receipt'"
    echo "  4. Or from /m/payments/history → 'Receipt' next to each paid bill"
    echo "  5. Click 'Download / Print PDF' → browser Save-as-PDF dialog"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
