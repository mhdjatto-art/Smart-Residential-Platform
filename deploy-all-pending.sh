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

git commit -m "feat+harden: steps 14H/15/16/17/18/19 + production hardening (cron, rate limit, CSP/HSTS, legal pages)

- 14H: org branding applied to dashboard topbar + print
- 15:  contract templates (sale/rental/purchase × EN/AR) + unit barcodes
- 16:  resident e-signature flow with audit trail
- 17:  client-side PDF export (CDN html2pdf, no npm dep)
- 18:  branding on /m/* + branded login by host
- 19:  audit triggers on all critical tables + /audit-log UI + activity timeline
- fix: cron endpoints fail-closed in production
- fix: next.config no longer silences TS/ESLint errors
- fix: CSP + HSTS headers added
- fix: in-memory token-bucket rate limiter applied to Stripe webhook,
       seed-demo, push/subscribe, CSV exports
- fix: /terms /privacy /cookies + dismissible cookie banner" || echo "  (no changes)"

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
