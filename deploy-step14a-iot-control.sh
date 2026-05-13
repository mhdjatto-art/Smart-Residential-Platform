#!/usr/bin/env bash
# Step 14A — IoT Device Control & Access Zones:
#   • /devices — grouped by kind, stats strip, realtime row pulse on events
#   • DeviceActions — Open / Lock / Unlock / Restart / Sync buttons per kind
#   • /access-logs — live feed via Supabase Realtime with outcome colors
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Step 14A — IoT Control — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(iot): step 14A — device control panel with open/lock/restart + realtime access logs feed" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "After build:"
    echo "  /devices       — grouped by kind (gate, smart_lock, router, camera) + Open/Lock buttons"
    echo "  /access-logs   — live feed via realtime, colored by outcome (granted/denied/tailgate)"
    echo ""
    echo "Try it: open /devices in two tabs, click Open on a gate_controller in tab A,"
    echo "        watch /access-logs in tab B pulse with the new event live."
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
