#!/usr/bin/env bash
# Step 14F — ERP push worker:
#   • src/lib/erp/worker.ts — picks queued JEs, dispatches via the matching adapter
#   • /api/cron/erp-push    — Vercel cron endpoint with CRON_SECRET auth
#   • /erp/push             — admin status page with "Run now" button + live result
#   • Idempotent (won't double-push), retries up to 5 times with backoff
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(erp): step 14F — push worker dispatches queued journal entries via Odoo/SAP/CSV adapters" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "Setup:"
    echo "  • Add to vercel.json: { \"path\": \"/api/cron/erp-push\", \"schedule\": \"*/15 * * * *\" }"
    echo "  • CRON_SECRET env var (you already set this for billing-run)"
    echo ""
    echo "Manual run: /erp/push → click 'Run push worker now'"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
