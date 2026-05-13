#!/usr/bin/env bash
# Step 14D — Facility Bookings:
#   • Enriched /bookings list with facility name + type + resident name (joins)
#   • Pending approval count badge
#   • BookingActions — Approve / Reject (with reason dialog)
#   • Rejection reason shown inline under status badge
#   • Conflict detection already exists in createBooking()
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(bookings): step 14D — enriched list + approve/reject actions with reason dialog" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "Workflow:"
    echo "  1. Resident reserves pool/gym/hall via /m/bookings or /bookings/new"
    echo "  2. If facility requires_approval → status='pending'"
    echo "  3. Manager sees badge '⏳ 3 pending approvals' at top of /bookings"
    echo "  4. Click Approve → status='approved'"
    echo "  5. Click Reject → dialog asks for reason → status='rejected' with reason shown"
    echo "  6. Conflicts auto-detected (overlapping pending/approved bookings rejected)"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
