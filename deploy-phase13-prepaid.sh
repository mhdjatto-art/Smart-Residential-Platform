#!/usr/bin/env bash
# Phase 13 — Prepaid Wallet System (full deploy).
#
# CODE deployed by this push:
#   • src/lib/api/wallets.ts              — 7 wallet server actions
#   • src/lib/meter-adapters/             — adapter framework (5 adapters + worker)
#   • src/app/m/wallet/                   — resident wallet + topup pages
#   • src/app/(dashboard)/wallets/        — manager wallet list + detail
#   • src/components/wallet/              — topup forms + manager topup button
#   • src/app/api/cron/meter-sync/        — every-15-min sync cron
#   • src/app/api/meters/[id]/sync/       — manual "Sync now" endpoint
#   • src/components/meters/sync-now-button.tsx
#   • vercel.json                         — new cron entry
#
# SQL to run in Supabase SQL Editor (after the push completes):
#   1. supabase/migrations/20260514000000_phase13_prepaid_wallets.sql
#      — 5 new tables (utility_wallets, wallet_topups, wallet_deductions,
#        prepaid_tokens, wallet_alerts) + 8 RPCs + RLS + audit triggers
#
# After deploy:
#   • Each resident-utility pair needs a wallet row created.
#   • Set utility_subscriptions.billing_mode = 'prepaid' to enable wallet flow.
#   • Configure CRON_SECRET in Vercel (already done from previous step).
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A

git commit -m "feat(prepaid): Phase 13 — wallet system + meter adapters + sync worker

- 13.1: utility_wallets / wallet_topups / wallet_deductions / prepaid_tokens / wallet_alerts
        + 8 RPCs (topup_wallet, deduct_for_consumption, check_balance_and_cutoff,
        restore_after_topup, generate_sts_token, get_wallet_summary,
        transfer_wallet_balance, refund_wallet_topup)
- 13.2: 5 adapters (HTTP_REST, MIKROTIK full, STS_TOKEN/MANUAL/MQTT/MODBUS stubs)
        + worker that pulls readings, deducts from wallet, cuts off at zero
        + /api/cron/meter-sync (every 15 min)
        + /api/meters/[id]/sync (manual trigger)
        + Sync now button component
- 13.3: /m/wallet (resident dashboard) + /m/wallet/topup (resident self-service)
        + /wallets (manager list) + /wallets/[id] (detail with topups/deductions/audit)
        + manager-topup-button + topup-form components
        + Wallet tile on mobile home" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "─── Post-deploy checklist ────────────────────────────────"
    echo ""
    echo "1. Run in Supabase SQL Editor:"
    echo "     supabase/migrations/20260514000000_phase13_prepaid_wallets.sql"
    echo ""
    echo "2. Optional — create a sample wallet for testing:"
    echo "   insert into public.utility_wallets ("
    echo "     organization_id, compound_id, resident_id, utility_type,"
    echo "     balance, currency, low_balance_threshold"
    echo "   ) values ("
    echo "     '<org-id>', '<compound-id>', '<resident-id>', 'electricity',"
    echo "     50000, 'IQD', 5000"
    echo "   );"
    echo ""
    echo "3. Test the resident UI:"
    echo "     /m/wallet  →  shows the wallet card"
    echo "     /m/wallet/topup?wallet=<id>  →  pick amount + method"
    echo ""
    echo "4. Test the manager UI:"
    echo "     /wallets  →  table of all wallets with low-balance filter"
    echo "     /wallets/<id>  →  topups + deductions + audit timeline"
    echo "─────────────────────────────────────────────────────────"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
