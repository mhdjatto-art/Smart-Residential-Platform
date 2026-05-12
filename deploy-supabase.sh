#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP — Auto-deploy Supabase migrations
# ─────────────────────────────────────────────────────────────────────────────
# This script:
#   1. Installs Supabase CLI if missing
#   2. Logs you into Supabase (browser opens)
#   3. Links the project gecrhvblnzrsvxectfhz
#   4. Pushes the 5 migrations
#   5. Verifies tables exist
#
# Run from project root:
#   bash deploy-supabase.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

PROJECT_REF="gecrhvblnzrsvxectfhz"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Supabase migration deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. CLI install ──────────────────────────────────────────────────────────────
echo "▸ Step 1/5: Checking Supabase CLI"
if ! command -v supabase >/dev/null 2>&1; then
  echo "  • Not installed. Installing via Homebrew..."
  if ! command -v brew >/dev/null 2>&1; then
    echo "  ✗ Homebrew is required. Install from https://brew.sh first."
    exit 1
  fi
  brew install supabase/tap/supabase
  echo "  ✓ Installed"
else
  echo "  ✓ Already installed: $(supabase --version)"
fi
echo ""

# 2. Login ────────────────────────────────────────────────────────────────────
echo "▸ Step 2/5: Login to Supabase"
echo "  • A browser window will open. Sign in with the account that owns"
echo "    project $PROJECT_REF"
echo ""
read -p "  Press Enter to continue..." -r
supabase login || true
echo ""

# 3. Link ─────────────────────────────────────────────────────────────────────
echo "▸ Step 3/5: Linking to project $PROJECT_REF"
echo "  • You'll be prompted for the database password."
echo "  • Find it in Supabase Dashboard → Settings → Database → Connection string"
echo "  • Or click 'Reset database password' there if you forgot it."
echo ""
read -p "  Press Enter to continue..." -r
supabase link --project-ref "$PROJECT_REF"
echo ""

# 4. Push migrations ──────────────────────────────────────────────────────────
echo "▸ Step 4/5: Pushing migrations"
echo "  • This will apply the 5 SQL files in supabase/migrations/ to the cloud DB."
echo ""
supabase db push
echo ""

# 5. Verify ───────────────────────────────────────────────────────────────────
echo "▸ Step 5/5: Verifying"
echo "  • Listing migrations on the remote..."
supabase migration list
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Done"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next: go to Supabase Dashboard → Table Editor and verify these tables exist:"
echo "  - organizations"
echo "  - compounds"
echo "  - buildings"
echo "  - units"
echo "  - residents"
echo "  - user_roles"
echo "  - audit_log"
echo ""
