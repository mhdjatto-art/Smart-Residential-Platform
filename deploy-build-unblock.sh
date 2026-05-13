#!/usr/bin/env bash
# Helper to push the build-unblock commit from the user's host machine
# (the workspace sandbox doesn't have GitHub credentials).
set -e
cd "$(dirname "$0")"

# Clean up any stale git locks left by background processes
for f in .git/index.lock .git/index.lock.bak .git/index.lock.bak2 .git/HEAD.lock .git/objects/maintenance.lock; do
  [ -f "$f" ] && rm -f "$f" 2>/dev/null || true
done

# Verify commit exists locally
HEAD_SHA=$(git rev-parse HEAD)
echo "Current HEAD: $HEAD_SHA"
git log --oneline -1

echo ""
echo "Pushing to origin/main..."
for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  Pushed on attempt $i"
    break
  fi
  echo "  retry $i..."
  sleep 2
done

echo ""
echo "Done. Vercel should pick up the build."
echo "If it still fails, run from the project root:"
echo "  npm run build"
echo "to see the live error list."
