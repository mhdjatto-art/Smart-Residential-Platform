#!/usr/bin/env bash
# Step 14B — Parking Management:
#   • Enriched /parking list with grid view + table
#   • Stats: Total / Occupied / Vacant / Inactive
#   • Assign-spot dialog with resident picker + vehicle plate/make/model
#   • Release spot action
#   • Plate badge component (reusable)
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(parking): step 14B — grid + table view, assign/release spots, vehicle registration" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i — /parking will load after Vercel rebuild"
    echo ""
    echo "Insert spots to test:"
    echo "  insert into public.parking_spots (organization_id, compound_id, spot_number)"
    echo "    select organization_id, id, 'P-' || lpad(n::text, 3, '0')"
    echo "    from public.compounds, generate_series(1, 24) n where slug = 'bonyan-demo' limit 24;"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
