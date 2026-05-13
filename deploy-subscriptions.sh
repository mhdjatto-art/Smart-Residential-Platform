#!/usr/bin/env bash
# Subscription creation flow — pick unit + provider + service type + fee
# + cycle + dates → creates utility_subscriptions row that drives auto-billing.
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Subscription Flow — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(subscriptions): /subscriptions/new form (unit + provider + service + fee + cycle) + enriched list view with unit/provider/resident" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "After build:"
    echo "  /subscriptions/new   — pick unit + provider (auto-filtered by service type) + fee + cycle"
    echo "  /subscriptions       — list with unit, building, provider, resident names + status"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
