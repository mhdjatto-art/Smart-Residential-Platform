#!/usr/bin/env bash
# Email notification system:
#   • Resend HTTP client (no npm dep)
#   • Branded HTML templates: receipt / reminder / penalty
#   • Auto-receipt after Stripe webhook + direct-pay
#   • /api/cron/send-reminders for daily reminders (3d / 1d / today)
#   • Falls back to no-op when RESEND_API_KEY missing
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Email Notifications — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(email): Resend integration — payment receipts + bill reminders + penalty notices (no npm dep)" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "Activate by setting Vercel env vars:"
    echo "  RESEND_API_KEY   re_...   (from resend.com → API Keys)"
    echo "  EMAIL_FROM       Bonyan <no-reply@yourdomain.com>"
    echo ""
    echo "Add the reminder cron to vercel.json:"
    echo '  { "path": "/api/cron/send-reminders", "schedule": "0 9 * * *" }'
    echo ""
    echo "See EMAIL_SETUP.md for the full guide."
    echo ""
    echo "Without env vars: payment flow still works, emails just don't go out."
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
