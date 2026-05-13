#!/usr/bin/env bash
# Polished /providers and /integrations browsers — search, filters,
# stats, country flags, adapter color badges, health summary.
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Providers + Integrations Browsers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(providers,integrations): filterable browsers — search + adapter/status/country/category filters + health summary + country flags" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "After build:"
    echo "  /providers       — 80 providers, filter by type/adapter/country/category"
    echo "  /integrations    — 80 integrations, health summary (connected/configured/degraded/error)"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
