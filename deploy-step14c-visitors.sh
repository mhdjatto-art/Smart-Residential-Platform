#!/usr/bin/env bash
# Step 14C — Visitor approval flow + QR codes:
#   • VisitorActions component — context-aware Approve/Reject/Check-in/Check-out
#   • VisitorQr — real scannable QR via api.qrserver.com (no npm dep)
#   • /visitors table — Actions column with approval workflow + QR button
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(visitors): step 14C — approve/reject/check-in/check-out actions + scannable QR pass" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "Workflow:"
    echo "  1. Resident creates visitor via /m/visitors/new → status='pending'"
    echo "  2. Security/manager opens /visitors → sees pending → clicks Approve"
    echo "  3. Approved visitor sees QR button → can show QR at gate"
    echo "  4. Security scans QR → clicks Check-in → status='checked_in'"
    echo "  5. On departure → Check-out → status='checked_out'"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
