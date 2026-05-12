#!/usr/bin/env bash
# Make /dashboard defensive — no single failing query can crash the page,
# and every failure is logged to Vercel runtime logs.
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Dashboard Defensive — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "fix(dashboard): isolate every stats query in try/catch + log to vercel; never crash from one bad widget" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "After build:"
    echo "  /dashboard       — loads even if individual stats queries fail"
    echo "  Vercel logs      — shows [dashboard-stats] / [dashboard] entries identifying which query crashed"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
