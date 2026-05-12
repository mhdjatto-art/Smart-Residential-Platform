#!/usr/bin/env bash
# Hot-fix: strip Supabase lookup from middleware (was causing prod crash),
# defensive try/catch around i18n in root + auth layouts.
set -e
cd "$(dirname "$0")"

echo "▸ Committing hotfix"
git add -A
git commit -m "fix: defer tenant resolution out of middleware, defensive i18n in root layouts" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Hotfix pushed on attempt $i — Vercel will rebuild in ~30s"
    echo ""
    echo "Verify:"
    echo "  curl -sS -o /dev/null -w 'Status: %{http_code}\\n' -L https://smart-residential-platform.vercel.app/"
    echo "  curl -sS -o /dev/null -w 'Status: %{http_code}\\n' -L https://smart-residential-platform.vercel.app/login"
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
