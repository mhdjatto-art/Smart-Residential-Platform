#!/usr/bin/env bash
# Push all fixes to GitHub with retry on network failures.

set -e
cd "$(dirname "$0")"

echo ""
echo "▸ Staging all changes..."
git add -A
git status --short

echo ""
echo "▸ Committing..."
git commit -m "fix: split env-server, use .select(*) for cleaner type inference" || echo "  (no new changes to commit)"

echo ""
echo "▸ Pushing to GitHub (up to 5 retries on network errors)..."

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "✓ Push succeeded on attempt $i"
    echo ""
    echo "Vercel will auto-rebuild in ~30s."
    echo "Watch at: https://vercel.com/cetomarius-4628s-projects/smart-residential-platform/deployments"
    echo ""
    echo "Then test (wait ~2min): curl -sS -o /dev/null -w 'Status: %{http_code}\n' -L https://smart-residential-platform.vercel.app/login"
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5 seconds..."
  sleep 5
done

echo ""
echo "✗ All 5 push attempts failed. Network is unstable."
echo "  Run the script again: bash push-fix.sh"
exit 1
