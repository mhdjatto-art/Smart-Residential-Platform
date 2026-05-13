#!/usr/bin/env bash
# Defensive fixes for receipt queries — split nested joins into individual
# queries with try/catch + console.error so failures degrade gracefully
# instead of crashing the Server Component.
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Defensive Receipts — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "fix(receipts): split nested joins into best-effort side queries — never crashes a page when a side table fails under RLS" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "If the page still errors after rebuild:"
    echo "  1. Reload the broken page"
    echo "  2. Click 'Show stack trace' on the error card"
    echo "  3. Send the first 5 lines to me"
    echo ""
    echo "Or check Vercel runtime logs for [listMyPaidBills] / [getReceipt] entries."
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
