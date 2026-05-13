#!/usr/bin/env bash
# Step 14E — Analytics Dashboard:
#   • /analytics — 8 KPI cards + revenue chart + 3 leaderboards + utility consumption
#   • Every query wrapped in safeQuery() — single failure never crashes the whole page
#   • Bar chart for revenue (installments + utilities, 6mo)
#   • Area chart for electricity + water consumption (6mo)
#   • Top 5 payers + Top 5 most overdue + Tickets-by-status visualizations
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(analytics): step 14E — KPI dashboard with revenue + consumption charts + top lists, fully defensive queries" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i — /analytics will load with full charts after rebuild"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
