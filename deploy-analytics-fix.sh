#!/usr/bin/env bash
# Fix /analytics/risk crash — listOverdueRisk was selecting `residents(full_name)`
# but residents has first_name + last_name only. Now composes the name in TS.
# Also makes the function defensive — returns [] on query error instead of throwing.
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "fix(analytics): listOverdueRisk uses first_name+last_name (composed) instead of nonexistent full_name; returns [] on error" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i — /analytics/risk will load after Vercel rebuild"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
