#!/usr/bin/env bash
# Fill in missing maintenance sub-routes:
#   • /maintenance/new   — create job form (compound + unit + type + cost + schedule)
#   • /maintenance/[id]  — job detail with status-transition buttons (start/pause/complete/cancel)
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Maintenance Pages — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "fix(maintenance): add missing /new + /[id] routes — form + detail with status buttons" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "After build:"
    echo "  /maintenance        — list (already worked)"
    echo "  /maintenance/new    — create new job ← was 404"
    echo "  /maintenance/<id>   — job detail with start/pause/complete/cancel buttons ← was 404"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
