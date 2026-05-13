#!/usr/bin/env bash
# Web Push (PWA) notifications:
#   • Service worker already has push + notificationclick handlers
#   • push_subscriptions table (RLS-protected)
#   • PushSubscribeButton on /m/notifications
#   • POST/DELETE /api/push/subscribe
#   • sendPushToUser() via dynamic `web-push` import (graceful fallback)
#   • Wired into notifyPaymentReceived / notifyNewBill / notifyPenaltyApplied
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Web Push (PWA) — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(push): Web Push PWA — service worker + subscribe UI + API + dynamic web-push sender wired to bill events" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "To activate Web Push (see PUSH_SETUP.md):"
    echo "  1. npm install web-push @types/web-push     (locally + push to git)"
    echo "  2. npx web-push generate-vapid-keys         (one-time)"
    echo "  3. Set Vercel env vars:"
    echo "       VAPID_PUBLIC_KEY"
    echo "       VAPID_PRIVATE_KEY"
    echo "       VAPID_SUBJECT  (e.g. mailto:admin@bonyan.app)"
    echo "       NEXT_PUBLIC_VAPID_PUBLIC_KEY  (same as VAPID_PUBLIC_KEY)"
    echo "  4. Run install-push-subscriptions.sql in Supabase SQL Editor"
    echo "  5. Resident opens /m/notifications → 'Enable push notifications'"
    echo ""
    echo "Without env vars: payments/billing still work. Push silently no-ops."
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
