#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP Phase 10 — Smart IoT & Access Control
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP Phase 10 — IoT + Access Control — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▸ Step 1/3: Apply Phase 10 migrations"
supabase db push
echo ""

echo "▸ Step 2/3: Regenerate TypeScript types"
supabase gen types typescript --linked --schema public > src/types/database.ts.new
if ! grep -q "Database" src/types/database.ts.new; then
  echo "  ✗ Generated types look invalid"
  rm -f src/types/database.ts.new
  exit 1
fi
mv src/types/database.ts.new src/types/database.ts
echo "  ✓ Types regenerated ($(wc -l < src/types/database.ts) lines)"
echo ""

echo "▸ Step 3/3: Commit and push"
git add -A
git commit -m "feat(phase10): IoT devices + access zones + access logs + parking + gate adapters" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Phase 10 pushed on attempt $i — Vercel will rebuild in ~30s"
    echo ""
    echo "After build:"
    echo "  /devices       — every IoT device (meters, gates, locks, cameras)"
    echo "  /access-zones  — gates, doors, parkings, amenities"
    echo "  /access-logs   — every entry/exit attempt"
    echo "  /parking       — spots + active assignments"
    echo ""
    echo "SQL helpers available:"
    echo "  select public.record_device_event(device_id, 'measurement', '{\"kwh\":4.2}'::jsonb, 4.2, 'kWh')"
    echo "  select public.evaluate_access(zone_id, 'qr', 'ABC12345')"
    echo "  select public.issue_device_command(device_id, 'unlock')"
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
