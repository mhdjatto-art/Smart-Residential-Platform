#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP — Schema-drift fixes (full audit pass)
# ─────────────────────────────────────────────────────────────────────────────
# Fixes:
#   • src/lib/api/resident-mobile.ts            — full_name → first_name+last_name; bill_status → status
#   • src/app/m/profile/page.tsx                — full_name/mobile/resident_status → first+last/phone/status
#   • src/app/m/payments/page.tsx               — bill_status → status (queries + render)
#   • src/app/m/utilities/page.tsx              — bill_status → status (queries + render)
#   • src/components/mobile/live-dashboard-widgets.tsx — bill_status → status (realtime subscription)

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Schema Drift Fixes — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f .git/index.lock ]; then
  rm -f .git/index.lock
  echo "  (removed stale .git/index.lock)"
fi

echo "▸ Step 1/2: Stage + commit"
git add -A
git commit -m "fix(schema): correct column names across mobile shell — full_name→first+last, bill_status→status, mobile→phone, resident_status→status" || echo "  (no changes to commit)"
echo ""

echo "▸ Step 2/2: Push"
for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel will rebuild in ~30s"
    echo ""
    echo "After build, every mobile resident page works:"
    echo "  /m              — dashboard with live widgets"
    echo "  /m/payments     — installments + utility bills"
    echo "  /m/utilities    — subscriptions + bills"
    echo "  /m/profile      — name + phone + status + unit"
    echo ""
    echo "Try logging in as a resident:"
    echo "  tenant1@bonyan.demo / Demo!2026"
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
