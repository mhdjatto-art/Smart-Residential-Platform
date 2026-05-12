#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP — Demo data seed system
# ─────────────────────────────────────────────────────────────────────────────
# Adds:
#   • /admin/seed-demo            — super-admin only UI page
#   • POST /api/admin/seed-demo    — wipes demo data and reseeds
#   • src/lib/seed/demo.ts         — seed module (deletes @bonyan.demo users,
#                                    recreates org/compound/buildings/units,
#                                    auth users for every role, residents,
#                                    contracts, payments, bills, tickets,
#                                    notifications)

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Demo Seed System — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Clear any stale git lock from earlier interrupted writes
if [ -f .git/index.lock ]; then
  rm -f .git/index.lock
  echo "  (removed stale .git/index.lock)"
fi

echo "▸ Step 1/2: Stage + commit"
git add -A
git commit -m "feat(admin): demo data seed — wipe @bonyan.demo users + reseed 12 users covering every role with realistic business data" || echo "  (no changes to commit)"
echo ""

echo "▸ Step 2/2: Push"
for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Seed system pushed on attempt $i — Vercel will rebuild in ~30s"
    echo ""
    echo "After build (super-admin only):"
    echo "  https://<your-domain>/admin/seed-demo"
    echo ""
    echo "Demo users (all password: Demo!2026):"
    echo "  super@bonyan.demo        super_admin (platform)"
    echo "  dev@bonyan.demo          developer_admin (org)"
    echo "  manager@bonyan.demo      compound_manager"
    echo "  finance@bonyan.demo      finance_officer"
    echo "  maintenance@bonyan.demo  maintenance_staff"
    echo "  security@bonyan.demo     security_staff"
    echo "  owner1@bonyan.demo       resident — A-101 (owner)"
    echo "  owner2@bonyan.demo       resident — A-201 (owner)"
    echo "  tenant1@bonyan.demo      resident — A-102 (tenant)"
    echo "  tenant2@bonyan.demo      resident — B-101 (tenant)"
    echo "  tenant3@bonyan.demo      resident — B-102 (tenant)"
    echo "  tenant4@bonyan.demo      resident — C-101 (tenant)"
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
