-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 21 — Iraqi Dinar (IQD) as the default currency
-- ─────────────────────────────────────────────────────────────────────────────
-- This deployment serves Iraqi residential compounds, so IQD should be the
-- baseline currency instead of USD. Migration scope:
--
--   1. Flip the default on `organizations.currency` to 'IQD'
--   2. Flip the default on `maintenance_jobs.cost_currency` to 'IQD'
--   3. Flip the default on `facilities.fee_currency` to 'IQD'
--   4. Backfill existing rows that still say 'USD' (only the demo data + any
--      orgs that were created before this change). Real orgs that already
--      chose USD intentionally should stay USD — we only migrate rows that
--      have the default value and look like demo seed data.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1) defaults
alter table public.organizations  alter column currency       set default 'IQD';
alter table public.maintenance_jobs alter column cost_currency set default 'IQD';
alter table public.facilities       alter column fee_currency  set default 'IQD';

-- 2) demo-only backfill (matches the bonyan.demo org)
update public.organizations  set currency = 'IQD'
  where currency = 'USD' and (slug = 'bonyan-demo' or metadata->>'demo' = 'true');

-- 3) installment_contracts & payments rows for the demo org → IQD
update public.installment_contracts ic
  set currency = 'IQD'
  where currency = 'USD'
    and ic.organization_id in (select id from public.organizations where currency = 'IQD');

update public.payments p
  set currency = 'IQD'
  where currency = 'USD'
    and p.organization_id in (select id from public.organizations where currency = 'IQD');

update public.utility_bills ub
  set currency = 'IQD'
  where currency = 'USD'
    and ub.organization_id in (select id from public.organizations where currency = 'IQD');

commit;
