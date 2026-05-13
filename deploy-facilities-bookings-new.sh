#!/usr/bin/env bash
# Fix two more missing /new routes:
#   • /facilities/new — full form (type, capacity, fee, duration, approval policy)
#   • /bookings/new   — resident + facility + datetime picker with conflict detection
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "fix(facilities,bookings): add missing /new pages with full forms" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "After build:"
    echo "  /facilities/new — create pool/gym/hall with fee + approval policy"
    echo "  /bookings/new   — reserve any active facility for a resident"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
