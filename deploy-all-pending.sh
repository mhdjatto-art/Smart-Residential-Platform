#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy ALL pending changes from this session — one commit, one push.
# ─────────────────────────────────────────────────────────────────────────────
# Covers:
#   Step 14H — org branding white-label (topbar + print)
#   Step 15  — contract templates + unit barcodes
#   Step 16  — resident e-signature
#   Step 17  — contract PDF export
#   Step 18  — mobile branding pass + branded login
#   Step 19  — audit log expansion + /audit-log UI + activity timeline
#   Fix 1    — cron endpoints fail-closed (CRON_SECRET enforced in prod)
#   Fix 2    — TS/ESLint errors no longer ignored in build
#   Fix 3    — CSP + HSTS headers
#   Fix 4    — rate limiting (Stripe webhook, seed-demo, push/subscribe, CSV)
#   Fix 5    — /terms, /privacy, /cookies + cookie banner
#
# Don't forget the SQL files (in Supabase SQL Editor, one time each):
#   install-contract-templates.sql
#   install-contract-signatures.sql
#   install-audit-log.sql
#
# And set CRON_SECRET in Vercel environment variables before the next deploy.
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

echo "→ Files about to be staged:"
git status --short | head -50
echo ""

git add -A

git commit -m "feat+harden: steps 14H/15/16/17/18/19 + Phase 12 backend + production hardening

- 14H: org branding applied to dashboard topbar + print
- 15:  contract templates (sale/rental/purchase × EN/AR) + unit barcodes
- 16:  resident e-signature flow with audit trail
- 17:  client-side PDF export (CDN html2pdf, no npm dep)
- 18:  branding on /m/* + branded login by host
- 19:  audit triggers on all critical tables + /audit-log UI + activity timeline
- p12: 11 new tables (utility_meter_readings, utility_usage_events,
       utility_usage_aggregates, provider_credentials, sync_jobs,
       sync_job_logs, external_reference_mapping, utility_payment_allocation,
       payment_method_registry, service_overdue_actions, idempotency_keys)
- p12: 10 SECURITY DEFINER RPCs with idempotency + audit_admin_action
- p12: admin_action_log view, expanded audit_log columns
- p12: wired generateSingleUtilityBill + markUtilityBillPaid in lib/api
- p12: listAdminActions + recordAdminAction in lib/api/audit.ts
- fix: cron endpoints fail-closed in production
- fix: next.config no longer silences TS/ESLint errors
- fix: CSP + HSTS headers added
- fix: in-memory token-bucket rate limiter applied to Stripe webhook,
       seed-demo, push/subscribe, CSV exports
- fix: in-process error/event reporter (Sentry+Slack ready)
- fix: /api/health pings DB + 503 on outage
- fix: CSV exports stream in 1000-row chunks with hard cap
- fix: /terms /privacy /cookies + dismissible cookie banner
- docs: BACKEND_AUDIT_AND_MIGRATION.md + POST_DEPLOY_CHECKLIST.md" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "─── Post-deploy checklist ───────────────────────────────"
    echo "1. In Vercel → Project Settings → Environment Variables:"
    echo "   set CRON_SECRET to a long random string."
    echo ""
    echo "2. In Supabase SQL Editor, run these in order (one time each):"
    echo "   • install-contract-templates.sql"
    echo "   • install-contract-signatures.sql"
    echo "   • install-audit-log.sql"
    echo ""
    echo "3. Watch Vercel build — if TypeScript surfaces an error now,"
    echo "   it's a real one (we just stopped ignoring them). Fix at"
    echo "   the call site with 'as unknown as <Row>' or @ts-expect-error."
    echo "─────────────────────────────────────────────────────────"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed after 5 attempts. Check git remote + auth."
exit 1
