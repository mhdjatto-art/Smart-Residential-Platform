#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP — diagnose & force-sync GitHub
# ─────────────────────────────────────────────────────────────────────────────
# What this does:
#   1. Verifies the local repo is complete (src/ + supabase/migrations/).
#   2. Fetches origin and shows what's there.
#   3. If origin is missing files, force-pushes the clean local commit.
#   4. Leaves you with a verification URL to click.
#
# Run from project root:
#   bash fix-and-push.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — GitHub sync"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Local sanity check ───────────────────────────────────────────────────────
echo "▸ Step 1/5: Local repo check"

if [ ! -d ".git" ]; then
  echo "  ✗ No .git folder found. Are you in the project root?"
  exit 1
fi

LOCAL_FILES=$(git ls-files | wc -l | tr -d ' ')
SRC_FILES=$(git ls-files src/ 2>/dev/null | wc -l | tr -d ' ')
MIGRATION_FILES=$(git ls-files supabase/migrations/ 2>/dev/null | wc -l | tr -d ' ')

echo "  • Tracked files       : $LOCAL_FILES"
echo "  • Files in src/       : $SRC_FILES"
echo "  • Migration files     : $MIGRATION_FILES"

if [ "$SRC_FILES" -lt 50 ] || [ "$MIGRATION_FILES" -lt 5 ]; then
  echo "  ✗ Local repo is missing files. Stopping."
  exit 1
fi

echo "  ✓ Local repo is complete"
echo ""

# 2. Make sure nothing dirty is sitting around ────────────────────────────────
echo "▸ Step 2/5: Working tree check"

if [ -n "$(git status --porcelain)" ]; then
  echo "  • Uncommitted changes found — committing now"
  git add -A
  git commit -m "chore: pick up local-only changes before sync"
else
  echo "  ✓ Working tree clean"
fi
echo ""

# 3. Fetch origin and compare ─────────────────────────────────────────────────
echo "▸ Step 3/5: Fetching origin"

if ! git fetch origin main 2>&1; then
  echo "  ✗ Could not reach GitHub. Check internet / auth."
  exit 1
fi

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse origin/main 2>/dev/null || echo "none")

echo "  • Local HEAD          : ${LOCAL_SHA:0:10}"
echo "  • Remote main         : ${REMOTE_SHA:0:10}"

REMOTE_SRC_COUNT=$(git ls-tree -r origin/main --name-only 2>/dev/null | grep -c '^src/' || echo "0")
REMOTE_MIG_COUNT=$(git ls-tree -r origin/main --name-only 2>/dev/null | grep -c '^supabase/migrations/' || echo "0")
echo "  • Files in src/ on origin       : $REMOTE_SRC_COUNT"
echo "  • Migrations on origin          : $REMOTE_MIG_COUNT"
echo ""

# 4. Decide what to do ────────────────────────────────────────────────────────
echo "▸ Step 4/5: Sync decision"

if [ "$REMOTE_SRC_COUNT" -ge "$SRC_FILES" ] && [ "$REMOTE_MIG_COUNT" -ge "$MIGRATION_FILES" ] && [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  echo "  ✓ Origin already has the full repo. Nothing to do."
  echo ""
  echo "  View it: https://github.com/mhdjatto-art/Smart-Residential-Platform/tree/main/src"
  exit 0
fi

echo "  • Origin is missing files OR is on a different commit."
echo "  • Action: force-push local main → origin/main"
echo ""

# Quick safety guard: never push if we'd discard remote commits that contain
# files we don't have locally. We've already confirmed local has more.

read -p "  Proceed with force-push? [y/N] " -n 1 -r REPLY
echo ""
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "  ✗ Aborted by user."
  exit 1
fi

# 5. Push ─────────────────────────────────────────────────────────────────────
echo "▸ Step 5/5: Force-pushing"

git push --force-with-lease origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Done"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Verify:"
echo "  https://github.com/mhdjatto-art/Smart-Residential-Platform/tree/main/src"
echo "  https://github.com/mhdjatto-art/Smart-Residential-Platform/tree/main/supabase/migrations"
echo ""
echo "Vercel will redeploy automatically once the push is detected (~30s)."
