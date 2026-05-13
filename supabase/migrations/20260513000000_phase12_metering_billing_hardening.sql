-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 12 — Metering generalization, billing hardening, integration layer
-- ─────────────────────────────────────────────────────────────────────────────
-- This migration is ADDITIVE ONLY.
--   • No DROP TABLE
--   • No DROP COLUMN
--   • No RENAME of existing objects
--   • No removal of existing RLS policies
--
-- See BACKEND_AUDIT_AND_MIGRATION.md (project root) for the full design
-- rationale.
--
-- Tested patterns:
--   • CREATE TABLE IF NOT EXISTS
--   • ALTER TABLE ADD COLUMN IF NOT EXISTS
--   • CREATE INDEX IF NOT EXISTS
--   • Named FK constraints added via DO $$ … pg_constraint guard
--   • Policy names follow pattern <table>_rls_v2_<purpose>
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- pgcrypto is already loaded in migration 001, but be safe — we use digest().
create extension if not exists "pgcrypto";

-- ─── 1. Column additions on existing tables ────────────────────────────────

-- 1.1 electricity_meters → become a generic utility meter (without rename).
alter table public.electricity_meters
  add column if not exists meter_type        text         not null default 'standard',
  add column if not exists utility_type      public.utility_type not null default 'electricity',
  add column if not exists provider_id       uuid,
  add column if not exists external_meter_id text,
  add column if not exists api_provider      text,
  add column if not exists last_reading      numeric(14,4) not null default 0 check (last_reading >= 0),
  add column if not exists reading_unit      text         not null default 'kWh',
  add column if not exists installation_date date,
  add column if not exists last_sync_at      timestamptz,
  add column if not exists sync_status       text not null default 'idle';

-- One-shot backfill from older columns. Both old & new survive — defence in depth.
update public.electricity_meters
   set installation_date = installed_at
 where installation_date is null and installed_at is not null;

update public.electricity_meters
   set reading_unit = unit_of_measure
 where reading_unit = 'kWh' and unit_of_measure is distinct from 'kWh';

-- Named check + FK additions (idempotent).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'electricity_meters_meter_type_chk') then
    alter table public.electricity_meters
      add constraint electricity_meters_meter_type_chk
      check (meter_type in ('standard','sub','main','bulk','prepaid','postpaid'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'electricity_meters_sync_status_chk') then
    alter table public.electricity_meters
      add constraint electricity_meters_sync_status_chk
      check (sync_status in ('idle','syncing','ok','error','disabled'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'electricity_meters_provider_id_fkey') then
    alter table public.electricity_meters
      add constraint electricity_meters_provider_id_fkey
      foreign key (provider_id) references public.utility_providers(id) on delete set null;
  end if;
end $$;

create index if not exists meters_provider_idx
  on public.electricity_meters (provider_id) where provider_id is not null;
create index if not exists meters_utility_type_idx
  on public.electricity_meters (organization_id, utility_type);
create index if not exists meters_sync_state_idx
  on public.electricity_meters (organization_id, sync_status, last_sync_at);

comment on column public.electricity_meters.meter_type
  is 'Distinguishes main/bulk/sub meters from unit-level standard meters.';
comment on column public.electricity_meters.utility_type
  is 'Generic utility type — table is no longer electricity-only.';
comment on column public.electricity_meters.provider_id
  is 'FK to utility_providers — answers ‘‘which utility company owns this meter’’.';
comment on column public.electricity_meters.external_meter_id
  is 'Provider-side identifier (Modbus address, ISP account, Mikrotik secret name).';
comment on column public.electricity_meters.last_reading
  is 'Snapshot of the previous reading_value; billing engine reads this without touching readings.';
comment on column public.electricity_meters.sync_status
  is 'idle | syncing | ok | error | disabled — driven by the sync_jobs worker.';

-- 1.2 utility_bills → traceability + idempotency
alter table public.utility_bills
  add column if not exists external_invoice_id      text,
  add column if not exists tariff_id                uuid,
  add column if not exists dynamic_tariff_id        uuid,
  add column if not exists idempotency_key          text,
  add column if not exists generated_by_rpc         text,
  add column if not exists consumption_aggregate_id uuid,
  add column if not exists suspended_at             timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'utility_bills_tariff_id_fkey') then
    alter table public.utility_bills
      add constraint utility_bills_tariff_id_fkey
      foreign key (tariff_id) references public.electricity_tariffs(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'utility_bills_dynamic_tariff_id_fkey') then
    alter table public.utility_bills
      add constraint utility_bills_dynamic_tariff_id_fkey
      foreign key (dynamic_tariff_id) references public.dynamic_tariffs(id) on delete set null;
  end if;
end $$;

create unique index if not exists utility_bills_idempotency_uidx
  on public.utility_bills (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists utility_bills_org_status_due_idx
  on public.utility_bills (organization_id, status, due_date)
  where status in ('issued','partial','overdue');

create index if not exists utility_bills_external_invoice_idx
  on public.utility_bills (organization_id, external_invoice_id)
  where external_invoice_id is not null;

comment on column public.utility_bills.idempotency_key
  is 'sha256(subscription_id || period_start || period_end) — prevents duplicate bills from concurrent workers.';
comment on column public.utility_bills.tariff_id
  is 'Snapshot of the tariff row used to compute this bill — keeps the bill auditable even if the tariff changes later.';

-- 1.3 utility_subscriptions → dunning state machine
alter table public.utility_subscriptions
  add column if not exists service_overdue_state  text not null default 'current',
  add column if not exists last_overdue_check_at  timestamptz,
  add column if not exists dunning_step           smallint not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'utility_subscriptions_overdue_state_chk') then
    alter table public.utility_subscriptions
      add constraint utility_subscriptions_overdue_state_chk
      check (service_overdue_state in ('current','warning','grace','suspended','restored'));
  end if;
end $$;

create index if not exists utility_subscriptions_org_state_idx
  on public.utility_subscriptions (organization_id, service_overdue_state)
  where status = 'active';

-- 1.4 payments → idempotency + utility-bill fast-path + gateway data
alter table public.payments
  add column if not exists utility_bill_id        uuid,
  add column if not exists idempotency_key        text,
  add column if not exists payment_method_code    text,
  add column if not exists gateway_provider       text,
  add column if not exists gateway_session_id     text,
  add column if not exists gateway_payment_intent text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_utility_bill_id_fkey') then
    alter table public.payments
      add constraint payments_utility_bill_id_fkey
      foreign key (utility_bill_id) references public.utility_bills(id) on delete set null;
  end if;
end $$;

create unique index if not exists payments_idempotency_uidx
  on public.payments (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists payments_utility_bill_idx
  on public.payments (utility_bill_id) where utility_bill_id is not null;

create index if not exists payments_gateway_intent_idx
  on public.payments (gateway_provider, gateway_payment_intent)
  where gateway_payment_intent is not null;

create index if not exists payments_org_status_date_idx
  on public.payments (organization_id, payment_status, payment_date desc);

-- 1.5 utility_providers → geography + currency + defaults
alter table public.utility_providers
  add column if not exists country_code          text,
  add column if not exists region                text,
  add column if not exists support_url           text,
  add column if not exists currency              text not null default 'USD',
  add column if not exists is_default_for_kind   boolean not null default false;

create index if not exists utility_providers_country_kind_idx
  on public.utility_providers (organization_id, country_code, provider_type);

-- 1.6 provider_integrations → secret references
alter table public.provider_integrations
  add column if not exists vault_key         text,
  add column if not exists env_var_name      text,
  add column if not exists last_sync_job_id  uuid;
-- FK to sync_jobs is added AFTER sync_jobs exists (section 2.6).

-- 1.7 audit_log → request context + business-action label
alter table public.audit_log
  add column if not exists actor_role       text,
  add column if not exists actor_email      text,
  add column if not exists request_id       text,
  add column if not exists client_ip        text,
  add column if not exists user_agent       text,
  add column if not exists business_action  text;

create index if not exists audit_log_business_action_idx
  on public.audit_log (organization_id, business_action, created_at desc)
  where business_action is not null;

create index if not exists audit_log_request_idx
  on public.audit_log (request_id, created_at desc)
  where request_id is not null;

comment on column public.audit_log.business_action
  is 'Set by audit_admin_action() RPC — labels rows that are not pure trigger-driven mutations.';
comment on column public.audit_log.actor_role
  is 'Snapshot of the actor''s role at action time — survives role changes / user deletion.';

-- ─── 2. New tables ─────────────────────────────────────────────────────────

-- 2.1 utility_meter_readings (generic, immutable once validated)
create table if not exists public.utility_meter_readings (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  compound_id           uuid not null references public.compounds(id)     on delete cascade,
  meter_id              uuid not null references public.electricity_meters(id) on delete cascade,
  utility_type          public.utility_type not null,
  reading_value         numeric(14,4) not null check (reading_value >= 0),
  reading_unit          text not null default 'kWh',
  reading_at            timestamptz not null default now(),
  source                public.reading_source not null default 'manual',
  raw_payload           jsonb not null default '{}'::jsonb,
  external_reading_id   text,
  is_validated          boolean not null default false,
  validated_by          uuid references auth.users(id) on delete set null,
  validated_at          timestamptz,
  validation_notes      text,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id) on delete set null
);

create index if not exists umr_meter_time_idx
  on public.utility_meter_readings (meter_id, reading_at desc);
create index if not exists umr_org_type_time_idx
  on public.utility_meter_readings (organization_id, utility_type, reading_at desc);
create index if not exists umr_external_idx
  on public.utility_meter_readings (organization_id, external_reading_id)
  where external_reading_id is not null;

comment on table public.utility_meter_readings is
  'Raw provider-side meter readings. Generic across electricity/water/gas/internet. Immutable once is_validated=true.';

-- 2.2 utility_usage_events
create table if not exists public.utility_usage_events (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations(id) on delete cascade,
  compound_id              uuid not null references public.compounds(id)     on delete cascade,
  meter_id                 uuid references public.electricity_meters(id) on delete set null,
  subscription_id          uuid references public.utility_subscriptions(id) on delete set null,
  unit_id                  uuid references public.units(id) on delete set null,
  utility_type             public.utility_type not null,
  period_start             timestamptz not null,
  period_end               timestamptz not null,
  quantity                 numeric(14,4) not null check (quantity >= 0),
  quantity_unit            text not null,
  derived_from_reading_id  uuid references public.utility_meter_readings(id) on delete set null,
  source                   text not null default 'computed',
  notes                    text,
  created_at               timestamptz not null default now(),
  created_by               uuid references auth.users(id) on delete set null,
  constraint uue_period_valid check (period_end > period_start),
  constraint uue_source_chk   check (source in ('computed','manual','api','adjustment'))
);

create index if not exists uue_meter_period_idx
  on public.utility_usage_events (meter_id, period_start, period_end);
create index if not exists uue_sub_period_idx
  on public.utility_usage_events (subscription_id, period_start, period_end)
  where subscription_id is not null;
create index if not exists uue_org_type_period_idx
  on public.utility_usage_events (organization_id, utility_type, period_start);

-- 2.3 utility_usage_aggregates
create table if not exists public.utility_usage_aggregates (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  compound_id       uuid not null references public.compounds(id)     on delete cascade,
  meter_id          uuid references public.electricity_meters(id) on delete set null,
  subscription_id   uuid references public.utility_subscriptions(id) on delete set null,
  utility_type      public.utility_type not null,
  period_start      date not null,
  period_end        date not null,
  total_quantity    numeric(14,4) not null check (total_quantity >= 0),
  quantity_unit     text not null,
  event_count       integer not null default 0,
  is_frozen         boolean not null default false,
  bill_id           uuid references public.utility_bills(id) on delete set null,
  computed_at       timestamptz not null default now(),
  constraint uua_period_valid check (period_end >= period_start)
);

-- Composite uniqueness: handle nullable meter_id / subscription_id via coalesce.
create unique index if not exists uua_unique_per_period
  on public.utility_usage_aggregates (
    organization_id,
    coalesce(meter_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(subscription_id, '00000000-0000-0000-0000-000000000000'::uuid),
    utility_type, period_start, period_end);

create index if not exists uua_org_type_period_idx
  on public.utility_usage_aggregates (organization_id, utility_type, period_start desc);

-- 2.4 Forward-link utility_bills.consumption_aggregate_id → utility_usage_aggregates
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'utility_bills_consumption_aggregate_id_fkey') then
    alter table public.utility_bills
      add constraint utility_bills_consumption_aggregate_id_fkey
      foreign key (consumption_aggregate_id) references public.utility_usage_aggregates(id) on delete set null;
  end if;
end $$;

-- 2.5 provider_credentials (reference-only — vault_key OR env_var_name)
create table if not exists public.provider_credentials (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  integration_id    uuid not null references public.provider_integrations(id) on delete cascade,
  credential_name   text not null,
  vault_key         text,
  env_var_name      text,
  scope             text,
  rotated_at        timestamptz,
  expires_at        timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  constraint provider_credentials_no_plaintext
    check (vault_key is not null or env_var_name is not null),
  constraint provider_credentials_unique
    unique (integration_id, credential_name)
);

create index if not exists provider_credentials_org_idx
  on public.provider_credentials (organization_id);

comment on table public.provider_credentials is
  'Reference-only credentials: vault_key (preferred) or env_var_name (fallback). No plaintext.';

-- 2.6 sync_jobs (worker-agnostic job header)
create table if not exists public.sync_jobs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  integration_id    uuid references public.provider_integrations(id) on delete set null,
  provider_id       uuid references public.utility_providers(id) on delete set null,
  kind              text not null,
  status            text not null default 'queued' check (status in ('queued','running','succeeded','failed','dead')),
  scheduled_for     timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  attempts          integer not null default 0,
  max_attempts      integer not null default 5,
  idempotency_key   text,
  request_payload   jsonb not null default '{}'::jsonb,
  result_payload    jsonb,
  last_error        text,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  constraint sync_jobs_unique_idem unique (organization_id, idempotency_key)
);

create index if not exists sync_jobs_status_due_idx
  on public.sync_jobs (status, scheduled_for) where status in ('queued','running');
create index if not exists sync_jobs_org_kind_idx
  on public.sync_jobs (organization_id, kind, created_at desc);
create index if not exists sync_jobs_integration_idx
  on public.sync_jobs (integration_id, created_at desc) where integration_id is not null;

-- Close the forward reference on provider_integrations
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'provider_integrations_last_sync_job_fkey') then
    alter table public.provider_integrations
      add constraint provider_integrations_last_sync_job_fkey
      foreign key (last_sync_job_id) references public.sync_jobs(id) on delete set null;
  end if;
end $$;

-- 2.7 sync_job_logs (append-only granular log)
create table if not exists public.sync_job_logs (
  id                bigserial primary key,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  sync_job_id       uuid not null references public.sync_jobs(id) on delete cascade,
  step              text not null,
  outcome           text not null check (outcome in ('success','failure','retry','noop')),
  http_status       integer,
  duration_ms       integer,
  request_payload   jsonb,
  response_payload  jsonb,
  error_message     text,
  occurred_at       timestamptz not null default now()
);

create index if not exists sync_job_logs_job_idx
  on public.sync_job_logs (sync_job_id, occurred_at desc);
create index if not exists sync_job_logs_failures_idx
  on public.sync_job_logs (organization_id, occurred_at desc) where outcome <> 'success';

-- 2.8 external_reference_mapping
create table if not exists public.external_reference_mapping (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  provider          text not null,
  external_id       text not null,
  srp_table         text not null,
  srp_id            uuid not null,
  notes             text,
  created_at        timestamptz not null default now(),
  constraint erm_unique_external unique (organization_id, provider, external_id),
  constraint erm_unique_srp     unique (organization_id, srp_table, srp_id, provider)
);

create index if not exists erm_srp_lookup_idx
  on public.external_reference_mapping (organization_id, srp_table, srp_id);

-- 2.9 utility_payment_allocation
create table if not exists public.utility_payment_allocation (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  payment_id        uuid not null references public.payments(id) on delete cascade,
  utility_bill_id   uuid not null references public.utility_bills(id) on delete cascade,
  amount            numeric(12,2) not null check (amount > 0),
  applied_to        text not null default 'subtotal' check (applied_to in ('subtotal','tax','penalty')),
  created_at        timestamptz not null default now()
);

create index if not exists upa_payment_idx on public.utility_payment_allocation (payment_id);
create index if not exists upa_bill_idx    on public.utility_payment_allocation (utility_bill_id);

-- Enforce that the sum of allocations <= payment amount (mirrors the installment trigger).
create or replace function public.tg_check_utility_allocation_sum()
returns trigger
language plpgsql
as $$
declare
  v_payment_amount numeric(12,2);
  v_allocated      numeric(12,2);
begin
  select payment_amount into v_payment_amount from public.payments where id = new.payment_id;
  select coalesce(sum(amount), 0) into v_allocated
    from public.utility_payment_allocation where payment_id = new.payment_id;
  if v_allocated > v_payment_amount + 0.01 then
    raise exception 'Utility allocations (%) exceed payment amount (%)', v_allocated, v_payment_amount;
  end if;
  return new;
end;
$$;

drop trigger if exists upa_check_sum on public.utility_payment_allocation;
create trigger upa_check_sum
  after insert or update on public.utility_payment_allocation
  for each row execute function public.tg_check_utility_allocation_sum();

-- 2.10 payment_method_registry
create table if not exists public.payment_method_registry (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  code              text not null,
  display_name      text not null,
  gateway_provider  text,
  is_online         boolean not null default false,
  is_active         boolean not null default true,
  config            jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint payment_method_registry_unique unique (organization_id, code)
);

create index if not exists pmr_org_active_idx
  on public.payment_method_registry (organization_id) where is_active;

-- 2.11 service_overdue_actions (dunning trail)
create table if not exists public.service_overdue_actions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  compound_id       uuid not null references public.compounds(id)     on delete cascade,
  subscription_id   uuid references public.utility_subscriptions(id) on delete set null,
  utility_bill_id   uuid references public.utility_bills(id) on delete set null,
  action_kind       text not null check (action_kind in (
                       'reminder_sent','grace_started','grace_ended',
                       'suspension_warned','suspended','restored','manual_override')),
  dunning_step      smallint,
  outcome           text,
  payload           jsonb not null default '{}'::jsonb,
  actor_id          uuid references auth.users(id) on delete set null,
  occurred_at       timestamptz not null default now()
);

create index if not exists soa_sub_time_idx
  on public.service_overdue_actions (subscription_id, occurred_at desc) where subscription_id is not null;
create index if not exists soa_bill_idx
  on public.service_overdue_actions (utility_bill_id) where utility_bill_id is not null;
create index if not exists soa_org_kind_idx
  on public.service_overdue_actions (organization_id, action_kind, occurred_at desc);

-- 2.12 idempotency_keys (RPC-side dedup)
create table if not exists public.idempotency_keys (
  key               text primary key,
  organization_id   uuid references public.organizations(id) on delete cascade,
  scope             text not null,
  request_hash      text,
  response          jsonb,
  status            text not null default 'pending' check (status in ('pending','succeeded','failed')),
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index if not exists idempotency_keys_org_scope_idx
  on public.idempotency_keys (organization_id, scope, created_at desc) where organization_id is not null;

revoke insert, update, delete on public.idempotency_keys from authenticated, anon;

-- 2.13 admin_action_log view (over audit_log)
create or replace view public.admin_action_log as
select
  id, actor_id, actor_role, actor_email,
  organization_id, compound_id,
  table_name as target_table, row_id as target_id,
  business_action, diff, request_id, client_ip, user_agent, created_at
from public.audit_log
where business_action is not null;

comment on view public.admin_action_log is
  'Read-only view onto audit_log filtered to business-action rows (written by audit_admin_action()).';

-- ─── 3. Missing indexes on existing tables ─────────────────────────────────

create index if not exists tickets_org_status_priority_idx
  on public.tickets (organization_id, status, priority);

create index if not exists residents_org_status_idx
  on public.residents (organization_id, status);

create index if not exists units_compound_status_idx
  on public.units (compound_id, status);

create index if not exists installment_contracts_org_status_idx
  on public.installment_contracts (organization_id, contract_status);

create index if not exists installment_schedules_org_due_status_idx
  on public.installment_schedules (organization_id, due_date, status);

create index if not exists utility_subscriptions_org_status_next_bill_idx
  on public.utility_subscriptions (organization_id, status, next_billing_date);

create index if not exists meter_readings_org_meter_date_idx
  on public.meter_readings (organization_id, meter_id, reading_date desc);

create index if not exists audit_log_org_table_row_idx
  on public.audit_log (organization_id, table_name, row_id, created_at desc);

create index if not exists audit_log_actor_created_idx
  on public.audit_log (actor_id, created_at desc) where actor_id is not null;

create index if not exists saas_invoices_org_due_status_idx
  on public.saas_invoices (organization_id, due_date, status);

create index if not exists analytics_kpi_org_compound_date_idx
  on public.analytics_daily_kpi (organization_id, compound_id, kpi_date desc);

create index if not exists marketplace_orders_org_status_created_idx
  on public.marketplace_orders (organization_id, order_status, created_at desc);

create index if not exists provider_payouts_org_status_period_idx
  on public.provider_payouts (organization_id, status, period_start desc);

create index if not exists device_events_org_kind_time_idx
  on public.device_events (organization_id, event_kind, occurred_at desc);

create index if not exists access_logs_org_compound_outcome_idx
  on public.access_logs (organization_id, compound_id, outcome, occurred_at desc);

create index if not exists journal_entries_org_status_date_idx
  on public.journal_entries (organization_id, status, entry_date desc);

create index if not exists notifications_user_entity_idx
  on public.notifications (user_id, entity_type, entity_id) where entity_id is not null;

-- ─── 4. updated_at + audit triggers on new tables ──────────────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'utility_meter_readings',
    'utility_usage_events',
    'utility_usage_aggregates',
    'provider_credentials',
    'sync_jobs',
    'sync_job_logs',
    'external_reference_mapping',
    'utility_payment_allocation',
    'payment_method_registry',
    'service_overdue_actions',
    'idempotency_keys'
  ])
  loop
    if t not in ('utility_meter_readings','utility_usage_events','sync_job_logs',
                 'external_reference_mapping','utility_payment_allocation',
                 'service_overdue_actions','idempotency_keys') then
      execute format(
        'drop trigger if exists %I_set_updated_at on public.%I;
         create trigger %I_set_updated_at before update on public.%I
           for each row execute function public.set_updated_at();', t, t, t, t
      );
    end if;

    execute format(
      'drop trigger if exists %I_audit on public.%I;
       create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_row();', t, t, t, t
    );
  end loop;
end $$;

-- ─── 5. RLS — enable + force on every new table ────────────────────────────

alter table public.utility_meter_readings    enable row level security;
alter table public.utility_usage_events      enable row level security;
alter table public.utility_usage_aggregates  enable row level security;
alter table public.provider_credentials      enable row level security;
alter table public.sync_jobs                 enable row level security;
alter table public.sync_job_logs             enable row level security;
alter table public.external_reference_mapping enable row level security;
alter table public.utility_payment_allocation enable row level security;
alter table public.payment_method_registry   enable row level security;
alter table public.service_overdue_actions   enable row level security;
alter table public.idempotency_keys          enable row level security;

alter table public.utility_meter_readings    force row level security;
alter table public.utility_usage_events      force row level security;
alter table public.utility_usage_aggregates  force row level security;
alter table public.provider_credentials      force row level security;
alter table public.sync_jobs                 force row level security;
alter table public.sync_job_logs             force row level security;
alter table public.external_reference_mapping force row level security;
alter table public.utility_payment_allocation force row level security;
alter table public.payment_method_registry   force row level security;
alter table public.service_overdue_actions   force row level security;
alter table public.idempotency_keys          force row level security;

-- 5.1 utility_meter_readings

drop policy if exists utility_meter_readings_rls_v2_select on public.utility_meter_readings;
create policy utility_meter_readings_rls_v2_select on public.utility_meter_readings
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.user_id = auth.uid()
        and r.unit_id = (select unit_id from public.electricity_meters m where m.id = utility_meter_readings.meter_id)
    )
  );

drop policy if exists utility_meter_readings_rls_v2_insert on public.utility_meter_readings;
create policy utility_meter_readings_rls_v2_insert on public.utility_meter_readings
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

drop policy if exists utility_meter_readings_rls_v2_update on public.utility_meter_readings;
create policy utility_meter_readings_rls_v2_update on public.utility_meter_readings
  for update to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

drop policy if exists utility_meter_readings_rls_v2_delete on public.utility_meter_readings;
create policy utility_meter_readings_rls_v2_delete on public.utility_meter_readings
  for delete to authenticated
  using (public.is_super_admin());

-- 5.2 utility_usage_events

drop policy if exists utility_usage_events_rls_v2_select on public.utility_usage_events;
create policy utility_usage_events_rls_v2_select on public.utility_usage_events
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.user_id = auth.uid()
        and r.id = (select resident_id from public.utility_subscriptions s where s.id = utility_usage_events.subscription_id)
    )
  );

drop policy if exists utility_usage_events_rls_v2_insert on public.utility_usage_events;
create policy utility_usage_events_rls_v2_insert on public.utility_usage_events
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

drop policy if exists utility_usage_events_rls_v2_update on public.utility_usage_events;
create policy utility_usage_events_rls_v2_update on public.utility_usage_events
  for update to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

drop policy if exists utility_usage_events_rls_v2_delete on public.utility_usage_events;
create policy utility_usage_events_rls_v2_delete on public.utility_usage_events
  for delete to authenticated
  using (public.is_super_admin());

-- 5.3 utility_usage_aggregates

drop policy if exists utility_usage_aggregates_rls_v2_select on public.utility_usage_aggregates;
create policy utility_usage_aggregates_rls_v2_select on public.utility_usage_aggregates
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

drop policy if exists utility_usage_aggregates_rls_v2_modify on public.utility_usage_aggregates;
create policy utility_usage_aggregates_rls_v2_modify on public.utility_usage_aggregates
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

-- 5.4 provider_credentials — super_admin + developer_admin only

drop policy if exists provider_credentials_rls_v2_select on public.provider_credentials;
create policy provider_credentials_rls_v2_select on public.provider_credentials
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = provider_credentials.organization_id
        and ur.role = 'developer_admin'
    )
  );

drop policy if exists provider_credentials_rls_v2_modify on public.provider_credentials;
create policy provider_credentials_rls_v2_modify on public.provider_credentials
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = provider_credentials.organization_id
        and ur.role = 'developer_admin'
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = provider_credentials.organization_id
        and ur.role = 'developer_admin'
    )
  );

-- 5.5 sync_jobs / sync_job_logs — management roles only

drop policy if exists sync_jobs_rls_v2_select on public.sync_jobs;
create policy sync_jobs_rls_v2_select on public.sync_jobs
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

drop policy if exists sync_jobs_rls_v2_modify on public.sync_jobs;
create policy sync_jobs_rls_v2_modify on public.sync_jobs
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, null)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, null)
  );

drop policy if exists sync_job_logs_rls_v2_select on public.sync_job_logs;
create policy sync_job_logs_rls_v2_select on public.sync_job_logs
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- 5.6 external_reference_mapping

drop policy if exists erm_rls_v2_select on public.external_reference_mapping;
create policy erm_rls_v2_select on public.external_reference_mapping
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = external_reference_mapping.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

drop policy if exists erm_rls_v2_modify on public.external_reference_mapping;
create policy erm_rls_v2_modify on public.external_reference_mapping
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = external_reference_mapping.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = external_reference_mapping.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
  );

-- 5.7 utility_payment_allocation

drop policy if exists upa_rls_v2_select on public.utility_payment_allocation;
create policy upa_rls_v2_select on public.utility_payment_allocation
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.utility_bills b
      join public.residents r on r.id = b.resident_id
      where b.id = utility_payment_allocation.utility_bill_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists upa_rls_v2_modify on public.utility_payment_allocation;
create policy upa_rls_v2_modify on public.utility_payment_allocation
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = utility_payment_allocation.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = utility_payment_allocation.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

-- 5.8 payment_method_registry

drop policy if exists pmr_rls_v2_select on public.payment_method_registry;
create policy pmr_rls_v2_select on public.payment_method_registry
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id in (select public.user_organization_ids()))
    or (
      is_active = true and exists (
        select 1 from public.residents r
        where r.user_id = auth.uid()
          and r.organization_id = payment_method_registry.organization_id
      )
    )
  );

drop policy if exists pmr_rls_v2_modify on public.payment_method_registry;
create policy pmr_rls_v2_modify on public.payment_method_registry
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = payment_method_registry.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = payment_method_registry.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  );

-- 5.9 service_overdue_actions

drop policy if exists soa_rls_v2_select on public.service_overdue_actions;
create policy soa_rls_v2_select on public.service_overdue_actions
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.utility_subscriptions s
      join public.residents r on r.id = s.resident_id
      where s.id = service_overdue_actions.subscription_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists soa_rls_v2_modify on public.service_overdue_actions;
create policy soa_rls_v2_modify on public.service_overdue_actions
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

-- 5.10 idempotency_keys — service_role only (authenticated sees nothing useful)

drop policy if exists idempotency_keys_rls_v2_super on public.idempotency_keys;
create policy idempotency_keys_rls_v2_super on public.idempotency_keys
  for select to authenticated
  using (public.is_super_admin());

-- 5.11 financial_transactions hardening (RLS hole)

alter table public.financial_transactions enable row level security;
alter table public.financial_transactions force row level security;

drop policy if exists financial_transactions_rls_v2_select on public.financial_transactions;
create policy financial_transactions_rls_v2_select on public.financial_transactions
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id in (select public.user_organization_ids())
        and exists (
          select 1 from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.organization_id = financial_transactions.organization_id
            and ur.role in ('developer_admin','compound_manager','finance_officer')
        ))
  );

-- 5.12 contract_templates — add tenant-scoped policy alongside existing global one.

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='contract_templates') then
    alter table public.contract_templates enable row level security;
    alter table public.contract_templates force row level security;

    if not exists (select 1 from pg_policies where schemaname='public' and tablename='contract_templates' and policyname='ct_select_v2_tenant') then
      create policy ct_select_v2_tenant on public.contract_templates
        for select to authenticated
        using (
          public.is_super_admin()
          or organization_id is null
          or organization_id in (select public.user_organization_ids())
        );
    end if;
  end if;
end $$;

-- 5.13 audit_log read policy (versioned, additive)

drop policy if exists audit_log_rls_v2_admin_action_select on public.audit_log;
create policy audit_log_rls_v2_admin_action_select on public.audit_log
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id is not null
        and exists (
          select 1 from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.organization_id = audit_log.organization_id
            and ur.role in ('developer_admin','compound_manager','finance_officer')
        ))
  );

-- ─── 6. COMMENT ON TABLE for the new tables ────────────────────────────────

comment on table public.utility_usage_events       is 'Period-bounded utility usage facts. Derived from raw readings or pushed by provider APIs.';
comment on table public.utility_usage_aggregates   is 'Roll-ups over usage events, scoped per (meter | subscription, period). Frozen once a bill references them.';
comment on table public.sync_jobs                  is 'Worker-agnostic job header. One row per logical sync attempt; idempotent by (organization_id, idempotency_key).';
comment on table public.sync_job_logs              is 'Append-only granular log of every adapter call inside a sync_job.';
comment on table public.external_reference_mapping is 'Provider external_id → SRP internal id. One mapping per (provider, external_id) per org.';
comment on table public.utility_payment_allocation is 'Allocations of a payment to one or many utility_bills (parallel to payment_allocations for installments).';
comment on table public.payment_method_registry    is 'Tenant-defined payment methods (Stripe, FastPay, ZainCash, cash-at-office, …).';
comment on table public.service_overdue_actions    is 'Dunning trail per subscription/bill — every reminder / grace / suspension action lands here.';
comment on table public.idempotency_keys           is 'Server-side idempotency table for SECURITY DEFINER RPCs. Not directly writable by clients.';

-- ─── 7. Migration audit row (so the migration itself is logged) ────────────

insert into public.audit_log (actor_id, organization_id, table_name, row_id, action, diff, business_action)
values (
  null, null, 'schema', null, 'insert',
  jsonb_build_object('migration','20260513000000_phase12_metering_billing_hardening',
                     'applied_at', now()),
  'schema_migration_applied'
);

-- end of migration
