# SRP Post-Deploy Checklist

This file is the single source of truth for what to do after pushing the
code from this session to Vercel. Follow top to bottom.

---

## 1. Push the code to Vercel

In Terminal, from the project root:

```bash
cd "/Users/marius/Documents/Claude/Projects/SRP — Smart Residential Platform"
./deploy-all-pending.sh
```

The script will commit + push. Watch the Vercel dashboard until the build
goes green.

If `next.config.ts` now surfaces a real TypeScript error (we removed
`ignoreBuildErrors: true`), share the error and we'll fix the specific call
site with `as unknown as <Row>` or `// @ts-expect-error`.

---

## 2. Set Vercel environment variables

In **Vercel → Project Settings → Environment Variables**, set for all three
environments (Production + Preview + Development):

| Variable | How to generate | Why |
|----------|-----------------|-----|
| `CRON_SECRET` | `openssl rand -hex 32` | Required for the 3 cron endpoints. Without it the crons return 503. |
| `SENTRY_DSN` (optional) | from sentry.io project | Routes `reportError()` to Sentry. Works without it (falls back to console). |
| `SLACK_OPS_WEBHOOK_URL` (optional) | Slack incoming webhook | Critical errors fan out to an ops channel. |

Redeploy after setting variables (Vercel does this automatically when you
save).

---

## 3. Supabase SQL Editor — what was applied (for reference)

These ran successfully on the live database during this session:

| Order | File | Result |
|-------|------|--------|
| 1 | `install-contract-templates.sql` | ✅ 6 templates seeded |
| 2 | `install-contract-signatures.sql` | ✅ table created |
| 3 | `install-audit-log.sql` | ✅ triggers on 16 tables |
| 4 | `Phase 12 prelude` (in-chat) | ✅ enums + missing columns |
| 5 | `supabase/migrations/20260513000000_phase12_metering_billing_hardening.sql` | ✅ 11 new tables |
| 6 | `supabase/migrations/20260513000100_phase12_rpc_functions.sql` | ✅ 10 RPCs |

Re-running any of these is safe — every statement is idempotent
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.).

---

## 4. Smoke tests after deploy

Log in at the deployed URL as `super@bonyan.demo` / `Demo!2026` and try:

| URL | Expected |
|-----|----------|
| `/dashboard` | Loads with no console errors |
| `/admin/users` | Lists users; New User opens form |
| `/audit-log` | Shows entries (many from this session's migrations) |
| `/contracts/<any-id>` | Activity timeline appears at bottom |
| `/contracts/<any-id>/print` | Print + PDF buttons work |
| `/units/<any-id>/barcode` | QR code renders, download works |
| `/m/contracts` | Mobile resident sees their contracts |
| `/terms` `/privacy` `/cookies` | All render |
| Bottom of any page | Cookie banner appears once, dismisses |
| `/api/health` | Returns 200 with `db.ok: true` |
| `/api/health?mode=live` | Returns 200 instantly without DB ping |

---

## 5. Verify the cron jobs

Hit each manually with the secret (replace `YOUR_SECRET`):

```bash
# Should return 200 with ok:true and a summary
curl -H "Authorization: Bearer YOUR_SECRET" https://YOUR_DOMAIN/api/cron/billing-run
curl -H "Authorization: Bearer YOUR_SECRET" https://YOUR_DOMAIN/api/cron/send-reminders
curl -H "Authorization: Bearer YOUR_SECRET" https://YOUR_DOMAIN/api/cron/erp-push
```

Without the header you should get 401. Without the env var (or with a wrong
value) you get 503 in production — that's the fail-closed behaviour we want.

---

## 6. New RPCs you can call from the UI

The frontend now has these server actions exposed through `src/lib/api/`:

| Action | File | When to use |
|--------|------|-------------|
| `generateSingleUtilityBill(input)` | `billing-run.ts` | Re-issue one bill for a specific subscription + period. Idempotent. |
| `markUtilityBillPaid(input)` | `billing-run.ts` | Mark a utility bill paid via the strict-idempotent RPC. |
| `recordAdminAction(input)` | `audit.ts` | Log a labelled business event (e.g. "manual waive") |
| `listAdminActions(opts)` | `audit.ts` | Read from `admin_action_log` view filtered by `business_action` |

The Phase 12 SQL RPCs available in Supabase (callable from any client via
`supabase.rpc('<name>', {...})`):

- `audit_admin_action`
- `create_meter_reading`
- `calculate_usage_for_period`
- `generate_utility_bill`
- `mark_bill_as_paid`
- `sync_meter_reading_from_provider`
- `get_unit_utility_summary(unit_id)`
- `get_resident_dashboard_summary(resident_id)` — pass null for current user
- `suspend_service_for_overdue_bill(bill_id, reason)`
- `restore_service_after_payment(subscription_id, reason)`

---

## 7. Open items / future work

These were intentionally left out of this session (in
`BACKEND_AUDIT_AND_MIGRATION.md` section 12 — "Dangerous changes"):

1. **Rename `electricity_meters` → `utility_meters`** — breaks every API
   caller that imports the generated types. Plan a separate migration
   with a backward-compat view.
2. **Add `viewer` to `app_role` enum** — must run in its own transaction.
3. **Drop the over-permissive `ct_read` policy on `contract_templates`** —
   the tenant-scoped v2 policy already coexists; drop the old one when
   ready.
4. **Relax `payments.contract_id NOT NULL`** — utility bills today don't
   have an installment contract; the `mark_bill_as_paid` RPC uses a
   fallback that the user's compound has at least one resident contract.
5. **Drop deprecated `meter_readings` table** — only after the UI is
   migrated to `utility_meter_readings`.
6. **Backfill `consumption_aggregate_id` on historical bills** — slow,
   may diverge from what was originally billed.
7. **Enforce Vault-only credentials** — currently `provider_credentials`
   accepts `vault_key OR env_var_name`. Tighten to vault-only once every
   integration has a Vault entry.

See `BACKEND_AUDIT_AND_MIGRATION.md` section 12 for the SQL of each.

---

## 8. Useful Supabase queries

```sql
-- Recent business actions
select business_action, count(*)
from public.audit_log
where business_action is not null
  and created_at > now() - interval '7 days'
group by business_action order by count(*) desc;

-- Failed sync jobs in the last hour
select sj.id, sj.kind, sj.last_error, sj.attempts, sjl.error_message, sj.created_at
from public.sync_jobs sj
left join public.sync_job_logs sjl on sjl.sync_job_id = sj.id and sjl.outcome = 'failure'
where sj.status = 'failed'
  and sj.created_at > now() - interval '1 hour'
order by sj.created_at desc;

-- Idempotency key store size (purge old succeeded entries periodically)
select status, count(*) from public.idempotency_keys group by status;

-- Outstanding overdue bills broken down by dunning_step
select s.dunning_step, count(*) as bill_count, sum(b.total_amount - b.paid_amount) as outstanding
from public.utility_bills b
join public.utility_subscriptions s on s.id = b.subscription_id
where b.status in ('issued','partial','overdue')
  and b.due_date < current_date
group by s.dunning_step order by s.dunning_step;
```

---

## 9. Rollback if something breaks

The Phase 12 migration is additive — nothing was dropped. To roll back the
schema impact:

1. Stop calling the new RPCs from code (revert `src/lib/api/billing-run.ts`
   and `src/lib/api/audit.ts`).
2. Schema additions are harmless to leave in place; they don't affect old
   queries.
3. If a specific new table is causing trouble, you can `DROP TABLE
   public.<name> CASCADE` (only the 11 new Phase 12 tables — never the
   originals).

For production hardening fixes (cron fail-closed, CSP, rate limiter):

- Revert `next.config.ts` and `src/middleware.ts` if CSP blocks an asset.
- Set `CRON_SECRET=anything` in dev to bypass dev-mode warning.

---

**Last verified:** 2026-05-13. This file lives at the project root.
