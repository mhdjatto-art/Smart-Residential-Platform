#!/usr/bin/env bash
# Auto-billing engine: SQL function + admin UI + Vercel cron endpoint.
# Pushes the code. After push, run install-auto-billing.sql in Supabase
# SQL Editor to create the database functions.
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Auto-Billing Engine — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(billing): auto-bill generator — SQL fn + /admin/billing-run UI + Vercel cron endpoint /api/cron/billing-run" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "Next steps:"
    echo "  1. Open Supabase SQL Editor and run install-auto-billing.sql"
    echo "     (creates generate_due_utility_bills + advance_billing_date)"
    echo "  2. Visit /admin/billing-run — preview + trigger billing manually"
    echo "  3. (Optional) Add to vercel.json for daily 01:00 UTC automation:"
    echo "       { \"crons\": [{ \"path\": \"/api/cron/billing-run\", \"schedule\": \"0 1 * * *\" }] }"
    echo "  4. (Optional) Set CRON_SECRET env var in Vercel for auth"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
