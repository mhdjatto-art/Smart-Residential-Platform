-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 11: ERP Integration Bridge
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
--   gl_accounts          — mirror of the customer's chart of accounts (Cache)
--   account_mappings     — SRP entity (revenue/cash/penalty) → GL account id
--   erp_integrations     — per-org Odoo/SAP/CSV/Custom connection config
--   journal_entries      — internal generated journal entry header
--   journal_lines        — debit/credit lines
--   erp_sync_log         — every push/pull attempt with outcome
--
-- The bridge architecture: SRP never touches accounting logic; it produces
-- balanced double-entry JEs in `journal_entries` + `journal_lines` and ships
-- them via an adapter (Odoo / SAP / CSV / Custom).
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'erp_kind' and typnamespace = 'public'::regnamespace) then
    create type public.erp_kind as enum ('odoo','sap','csv','custom','sage','quickbooks','xero','generic');
  end if;
  if not exists (select 1 from pg_type where typname = 'erp_status' and typnamespace = 'public'::regnamespace) then
    create type public.erp_status as enum ('disconnected','configured','connected','degraded','error');
  end if;
  if not exists (select 1 from pg_type where typname = 'journal_status' and typnamespace = 'public'::regnamespace) then
    create type public.journal_status as enum ('draft','queued','syncing','posted','failed','reversed');
  end if;
  if not exists (select 1 from pg_type where typname = 'sync_outcome' and typnamespace = 'public'::regnamespace) then
    create type public.sync_outcome as enum ('success','failure','timeout','skipped');
  end if;
  if not exists (select 1 from pg_type where typname = 'mapping_kind' and typnamespace = 'public'::regnamespace) then
    create type public.mapping_kind as enum (
      'installment_revenue','utility_revenue','marketplace_revenue','commission_income',
      'cash_account','bank_account','penalty_income','refund_expense',
      'tax_payable','customer_receivable','provider_payable','other'
    );
  end if;
end $$;

-- ─── gl_accounts (cache) ─────────────────────────────────────────────────
-- We don't strictly need this — mappings can point to a remote ID directly.
-- But caching the names/numbers makes the mapping UI much friendlier.

create table if not exists public.gl_accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  -- integration_id FK is added below after erp_integrations exists.
  integration_id   uuid,
  external_id      text not null,                              -- the id Odoo/SAP knows it by
  account_code     text not null,                              -- e.g. 4100
  account_name     text not null,                              -- 'Installment Revenue'
  account_type     text,                                       -- asset/liability/income/expense/equity
  currency         text default 'USD',
  is_active        boolean not null default true,
  metadata         jsonb not null default '{}'::jsonb,
  synced_at        timestamptz not null default now(),
  constraint gl_accounts_unique unique (organization_id, integration_id, external_id)
);

create index if not exists gla_org_idx on public.gl_accounts (organization_id);
create index if not exists gla_int_idx on public.gl_accounts (integration_id) where integration_id is not null;

-- ─── erp_integrations ─────────────────────────────────────────────────────

create table if not exists public.erp_integrations (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  kind               public.erp_kind not null,
  name               text not null,
  base_url           text,                                        -- Odoo URL, SAP gateway, ...
  database_name      text,                                        -- Odoo db name; ignored for SAP
  username           text,
  credentials_ref    text,                                        -- Vault pointer for password/api_key
  company_external_id text,                                       -- Odoo company_id, SAP BUKRS, etc.
  default_currency   text not null default 'USD',
  config             jsonb not null default '{}'::jsonb,          -- adapter-specific extras
  status             public.erp_status not null default 'configured',
  last_synced_at     timestamptz,
  last_error         text,
  is_active          boolean not null default true,
  auto_push          boolean not null default true,               -- push payments automatically?
  csv_export_path    text,                                        -- for kind='csv': bucket/path template
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null
);

create index if not exists ei_org_idx    on public.erp_integrations (organization_id);
create index if not exists ei_kind_idx   on public.erp_integrations (kind);
create index if not exists ei_status_idx on public.erp_integrations (status);

-- Add the FK we forward-referenced
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'gl_accounts_integration_id_fkey'
      and table_name = 'gl_accounts'
  ) then
    alter table public.gl_accounts
      add constraint gl_accounts_integration_id_fkey
      foreign key (integration_id) references public.erp_integrations(id) on delete cascade;
  end if;
end $$;

-- ─── account_mappings ─────────────────────────────────────────────────────
-- "SRP business event" → "GL account in their ERP"

create table if not exists public.account_mappings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id  uuid not null references public.erp_integrations(id) on delete cascade,
  mapping_kind    public.mapping_kind not null,
  -- Optional scope: a mapping can be specific to a compound / currency / payment_method
  compound_id     uuid references public.compounds(id) on delete cascade,
  currency        text,
  payment_method  text,
  gl_account_external_id text not null,                          -- account id in the remote ERP
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists am_unique_per_scope on public.account_mappings (
  integration_id, mapping_kind,
  coalesce(compound_id::text, ''), coalesce(currency, ''), coalesce(payment_method, '')
);

create index if not exists am_org_idx on public.account_mappings (organization_id);

-- ─── journal_entries (header) ─────────────────────────────────────────────

create sequence if not exists public.journal_entry_seq increment by 1 start with 1;

create table if not exists public.journal_entries (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  integration_id     uuid references public.erp_integrations(id) on delete set null,
  entry_number       text not null,
  entry_date         date not null default current_date,
  reference          text,                                       -- e.g. 'SRP/PMT-2026-000123'
  description        text,
  source_table       text,                                       -- 'payments','utility_bills','marketplace_orders','saas_invoices'
  source_id          uuid,
  currency           text not null default 'USD',
  total_amount       numeric(14,2) not null default 0 check (total_amount >= 0),
  status             public.journal_status not null default 'draft',
  external_journal_id text,                                       -- the id the ERP assigned (e.g. INV/2026/000456)
  posted_at          timestamptz,
  failed_at          timestamptz,
  retry_count        integer not null default 0,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint je_unique_per_org unique (organization_id, entry_number)
);

create index if not exists je_org_idx           on public.journal_entries (organization_id, entry_date desc);
create index if not exists je_status_idx        on public.journal_entries (status, entry_date desc);
create index if not exists je_source_idx        on public.journal_entries (source_table, source_id) where source_id is not null;
create index if not exists je_integration_idx   on public.journal_entries (integration_id) where integration_id is not null;

create or replace function public.tg_je_autonumber()
returns trigger language plpgsql as $$
begin
  if new.entry_number is null or new.entry_number = '' then
    new.entry_number := 'JE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.journal_entry_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists je_autonumber on public.journal_entries;
create trigger je_autonumber before insert on public.journal_entries
  for each row execute function public.tg_je_autonumber();

-- ─── journal_lines ────────────────────────────────────────────────────────

create table if not exists public.journal_lines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_id        uuid not null references public.journal_entries(id) on delete cascade,
  line_number     integer not null,
  account_external_id text not null,                            -- GL account id in the remote ERP
  account_code    text,                                          -- denormalized for readability
  account_name    text,
  debit           numeric(14,2) not null default 0 check (debit >= 0),
  credit          numeric(14,2) not null default 0 check (credit >= 0),
  description     text,
  partner_external_id text,                                      -- resident's contact id in the ERP
  metadata        jsonb not null default '{}'::jsonb,
  constraint jl_line_balanced check ((debit > 0 and credit = 0) or (debit = 0 and credit > 0))
);

create index if not exists jl_entry_idx on public.journal_lines (entry_id, line_number);

-- ─── erp_sync_log ─────────────────────────────────────────────────────────

create table if not exists public.erp_sync_log (
  id              bigserial primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  integration_id  uuid references public.erp_integrations(id) on delete cascade,
  entry_id        uuid references public.journal_entries(id) on delete set null,
  action          text not null,                                 -- 'push_entry','pull_accounts','test_connection','reconcile'
  outcome         public.sync_outcome not null,
  http_status     integer,
  duration_ms     integer,
  request_payload  jsonb,
  response_payload jsonb,
  error_message   text,
  external_id_returned text,
  occurred_at     timestamptz not null default now()
);

create index if not exists esl_org_time_idx on public.erp_sync_log (organization_id, occurred_at desc);
create index if not exists esl_failed_idx   on public.erp_sync_log (organization_id, occurred_at desc) where outcome <> 'success';
create index if not exists esl_entry_idx    on public.erp_sync_log (entry_id, occurred_at desc) where entry_id is not null;

-- ─── triggers ─────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'gl_accounts','erp_integrations','account_mappings',
    'journal_entries'
  ])
  loop
    execute format(
      'drop trigger if exists %I_set_updated_at on public.%I;
       create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t, t, t, t
    );
    execute format(
      'drop trigger if exists %I_audit on public.%I;
       create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_row();', t, t, t, t
    );
  end loop;
end $$;
