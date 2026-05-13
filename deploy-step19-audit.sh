#!/usr/bin/env bash
# Step 19 — Audit log extension.
#
# The audit_log table + audit_row() trigger function were created back in
# migration 003. Existing triggers cover: organizations, compounds, buildings,
# units, residents, user_roles. This step:
#
# Database (one-time SQL):
#   • install-audit-log.sql — attaches the existing audit_row() trigger to:
#       installment_contracts, installment_schedules, payments, receipts,
#       utility_bills, utility_subscriptions, contract_templates,
#       contract_signatures, organization_branding, organization_domains,
#       subscription_plans, documents, tickets, visitors, facility_bookings,
#       announcements
#     Also widens the RLS policy so compound_manager / finance_officer can see
#     org-scoped audit rows (previously super_admin-only).
#
# App:
#   • src/lib/api/audit.ts            — listAuditLog, getRecordActivity, diffKeys
#   • /audit-log                       — full timeline with table + action filters,
#                                         paginated, RLS-enforced
#   • src/components/audit/activity-timeline.tsx — inline activity card
#   • Contract detail + unit detail pages now show Activity timeline at bottom
#
# Sidebar nav entry /audit-log was already wired in Phase 8 (just hadn't had
# a page behind it).
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(audit): step 19 — audit triggers on all critical tables + /audit-log UI + inline activity timeline" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "Post-deploy checklist:"
    echo "  1. Run install-audit-log.sql in Supabase SQL editor (one time — safe to re-run)"
    echo "  2. Visit /audit-log — see every change across the system"
    echo "  3. Visit /contracts/<id> or /units/<id> — Activity timeline appears at bottom"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
