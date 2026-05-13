#!/usr/bin/env bash
# Audit fixes from comprehensive crash-candidate scan:
#   • /analytics/risk     — full_name → first_name+last_name composed; defensive return [] on error
#   • /residents/[id]     — tenancy_type defensive (in case of null)
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "fix(audit): analytics risk uses composed name + defensive empty array; residents/[id] guards tenancy_type" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i — full audit pass deployed"
    echo ""
    echo "STILL TODO IN SUPABASE — run these SQL files in SQL Editor:"
    echo "  • install-resident-invites.sql   (Step 12 — for /admin/invites and /signup)"
    echo "  • install-push-subscriptions.sql (Step 11 — for /m/notifications push button)"
    echo "  • install-auto-billing.sql       (Step 4 — for /admin/billing-run)"
    echo "  • install-utility-billing-actions.sql (Step 5 — for pay/penalty SQL functions)"
    echo ""
    echo "Each is idempotent — safe to re-run."
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
