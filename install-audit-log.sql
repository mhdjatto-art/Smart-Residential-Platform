-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — Audit log: extend existing coverage to all critical tables
-- ─────────────────────────────────────────────────────────────────────────────
-- The audit_log table + audit_row() trigger function were already created in
-- migration 003 (20260101000200_audit.sql). Existing triggers cover:
--   organizations, compounds, buildings, units, residents, user_roles
--
-- This script attaches audit triggers to the rest of the business-critical
-- tables that were added in later phases:
--   installment_contracts, installment_schedules, payments, receipts,
--   utility_bills, utility_subscriptions, contract_templates,
--   contract_signatures, organization_branding, organization_domains,
--   subscription_plans, documents
--
-- Safe to run multiple times — uses CREATE TRIGGER IF NOT EXISTS logic and
-- skips tables that don't exist in this database.
--
-- Run as super_admin in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure the RLS policy on audit_log lets compound_manager + finance_officer
-- see entries within their org. (The original migration may only have allowed
-- super_admin reads.)
alter table public.audit_log enable row level security;

drop policy if exists audit_read_extended on public.audit_log;
create policy audit_read_extended on public.audit_log
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('developer_admin','compound_manager','finance_officer')
        and (ur.organization_id is null or ur.organization_id = audit_log.organization_id)
    )
  );

-- ─── Attach triggers to additional tables ────────────────────────────────────

do $$
declare
  t text;
  tables text[] := array[
    'installment_contracts',
    'installment_schedules',
    'payments',
    'receipts',
    'utility_bills',
    'utility_subscriptions',
    'contract_templates',
    'contract_signatures',
    'organization_branding',
    'organization_domains',
    'subscription_plans',
    'documents',
    'tickets',
    'visitors',
    'facility_bookings',
    'announcements'
  ];
begin
  foreach t in array tables loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      -- Drop any prior audit trigger with the same name, then re-create.
      execute format('drop trigger if exists %I_audit on public.%I', t, t);
      execute format(
        'create trigger %I_audit
           after insert or update or delete on public.%I
           for each row execute function public.audit_row()',
        t, t
      );
      raise notice '✓ audit trigger attached to %', t;
    else
      raise notice '— skipped % (table not in this database)', t;
    end if;
  end loop;
end
$$;
