#!/usr/bin/env bash
# In-app realtime notifications:
#   • Desktop topbar bell with live unread badge + toast on new notification
#   • createNotification() helper using service-role client
#   • bill-events.ts: notifyPaymentReceived / notifyNewBill / notifyPenaltyApplied
#   • Wired into Stripe webhook + direct-pay + auto-billing + penalty batch
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Realtime In-App Notifications — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(notifications): desktop topbar bell + realtime toast + create-on payment/billing/penalty" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "Try it:"
    echo "  1. Open the dashboard in two browser windows side by side"
    echo "  2. In window A: log in as super_admin → /admin/billing-run → Generate bills"
    echo "  3. In window B: log in as tenant1@bonyan.demo → /m"
    echo "  4. Window B should: badge increments + toast popup + /m/notifications refreshes"
    echo ""
    echo "Or: pay a bill → toast '\"Payment received\"' appears for the resident instantly."
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
