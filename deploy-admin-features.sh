#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP — Three admin features
#   • Visible logout button in topbar
#   • Subscription plans CRUD (new / edit / delete) at /saas-console/plans
#   • Users & permissions admin at /admin/users
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Admin Features — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(admin): dynamic plans CRUD + user permissions admin + visible logout button" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "After build (super-admin only):"
    echo "  /saas-console/plans              — list, with + New plan button"
    echo "  /saas-console/plans/new          — create plan with all fields"
    echo "  /saas-console/plans/<id>/edit    — edit or delete a plan"
    echo "  /admin/users                     — list every user, grant/revoke roles, reset passwords, delete"
    echo ""
    echo "Logout: now visible as a button in the topbar (next to the avatar)."
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
