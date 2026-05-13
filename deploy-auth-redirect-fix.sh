#!/usr/bin/env bash
# Auth fix: requireRole redirects instead of throws.
# Residents → /m, others → /dashboard. No more "Something went wrong"
# when a user navigates to a page they don't have a role for.
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Auth Redirect Fix — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "fix(auth): requireRole redirects to /m or /dashboard instead of throwing AuthorizationError" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "After build:"
    echo "  • Residents who hit /buildings/new etc. → silently redirected to /m"
    echo "  • Staff missing a role → redirected to /dashboard"
    echo "  • No more 'Something went wrong' for auth-gated pages"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
