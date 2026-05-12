-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 3: Installments & Financial Engine
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables:
--   1. installment_contracts     — the parent contract
--   2. installment_schedules     — generated payment plan rows
--   3. payments                  — money received (immutable after confirmation)
--   4. payment_allocations       — links payments to schedule rows
--   5. penalties                 — late-payment charges
--   6. receipts                  — auto-numbered receipts (1:1 with payment)
--   7. financial_transactions    — immutable audit log
--   8. payment_reminders         — scheduled/sent reminders
--
-- Rules baked into constraints:
--   - amount columns are numeric(14,2) with non-negative checks
--   - payment_amount > 0
--   - allocations cannot exceed payment amount (enforced via trigger)
--   - paid_amount cannot exceed total_due + penalty_amount on a schedule row
--   - contract_number / payment_reference / receipt_number unique per org
--   - financial_transactions has no UPDATE/DELETE policies (immutable)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enums ──────────────────────────────────────────────────────────────────

create type public.contract_type as enum ('property_sale', 'rental', 'lease_to_own');
create type public.contract_status as enum ('draft', 'active', 'completed', 'cancelled', 'defaulted');
create type public.installment_frequency as enum ('monthly', 'quarterly', 'biannual', 'annual');
create type public.installment_status as enum ('pending', 'partial', 'paid', 'overdue', 'cancelled');
create type public.payment_method as enum ('cash', 'bank_transfer', 'online_payment', 'wallet', 'cheque');
create type public.payment_status as enum ('pending', 'confirmed', 'reversed', 'refunded');
create type public.penalty_type as enum ('fixed', 'percentage', 'daily', 'monthly');
create type public.penalty_status as enum ('pending', 'applied', 'waived', 'paid');
create type public.financial_action as enum (
  'contract_created', 'contract_updated', 'contract_cancelled',
  'schedule_generated', 'schedule_regenerated',
  'payment_recorded', 'payment_reversed', 'payment_refunded',
  'penalty_applied', 'penalty_waived',
  'adjustment', 'reminder_sent'
);
create type public.reminder_kind as enum ('upcoming', 'overdue', 'penalty', 'payment_received');
create type public.reminder_channel as enum ('in_app', 'email', 'sms');
create type public.reminder_status as enum ('pending', 'sent', 'failed', 'dismissed');

-- ─── installment_contracts ──────────────────────────────────────────────────

create table public.installment_contracts (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete restrict,
  compound_id             uuid not null references public.compounds(id)     on delete restrict,
  unit_id                 uuid not null references public.units(id)         on delete restrict,
  resident_id             uuid not null references public.residents(id)     on delete restrict,

  contract_number         text not null,
  contract_type           public.contract_type not null,
  contract_status         public.contract_status not null default 'draft',
  contract_start_date     date not null,
  contract_end_date       date,

  -- Financial terms (immutable once status = 'active')
  total_property_price    numeric(14,2) not null check (total_property_price >= 0),
  down_payment            numeric(14,2) not null default 0 check (down_payment >= 0),
  financed_amount         numeric(14,2) generated always as (total_property_price - down_payment) stored,
  installment_frequency   public.installment_frequency not null default 'monthly',
  installment_count       integer not null check (installment_count > 0 and installment_count <= 600),
  monthly_amount          numeric(12,2),                     -- snapshot of computed amount
  annual_interest_rate    numeric(5,2) not null default 0    check (annual_interest_rate >= 0 and annual_interest_rate <= 100),

  -- Penalty config
  late_penalty_type       public.penalty_type,
  late_penalty_value      numeric(10,2) check (late_penalty_value is null or late_penalty_value >= 0),
  grace_period_days       integer not null default 0 check (grace_period_days >= 0 and grace_period_days <= 365),

  notes                   text,
  metadata                jsonb not null default '{}'::jsonb,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id) on delete set null,
  updated_by              uuid references auth.users(id) on delete set null,

  constraint contracts_unique_number_per_org unique (organization_id, contract_number),
  constraint contracts_dates_valid           check (contract_end_date is null or contract_end_date >= contract_start_date),
  constraint contracts_down_payment_le_total check (down_payment <= total_property_price)
);

create index contracts_org_idx       on public.installment_contracts (organization_id);
create index contracts_compound_idx  on public.installment_contracts (compound_id);
create index contracts_unit_idx      on public.installment_contracts (unit_id);
create index contracts_resident_idx  on public.installment_contracts (resident_id);
create index contracts_status_idx    on public.installment_contracts (contract_status);

-- ─── installment_schedules ──────────────────────────────────────────────────

create table public.installment_schedules (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete restrict,
  compound_id         uuid not null references public.compounds(id)     on delete restrict,
  contract_id         uuid not null references public.installment_contracts(id) on delete cascade,

  installment_number  integer not null check (installment_number > 0),
  due_date            date not null,
  principal_amount    numeric(12,2) not null check (principal_amount >= 0),
  interest_amount     numeric(12,2) not null default 0 check (interest_amount >= 0),
  total_due           numeric(12,2) not null check (total_due >= 0),
  penalty_amount      numeric(12,2) not null default 0 check (penalty_amount >= 0),
  paid_amount         numeric(12,2) not null default 0 check (paid_amount >= 0),

  status              public.installment_status not null default 'pending',
  paid_at             timestamptz,
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint schedules_unique_per_contract unique (contract_id, installment_number),
  constraint schedules_paid_le_due         check (paid_amount <= total_due + penalty_amount + 0.01)
);

create index schedules_contract_idx on public.installment_schedules (contract_id, installment_number);
create index schedules_due_idx      on public.installment_schedules (due_date) where status in ('pending', 'partial', 'overdue');
create index schedules_status_idx   on public.installment_schedules (status);

-- ─── payments ──────────────────────────────────────────────────────────────

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete restrict,
  compound_id         uuid not null references public.compounds(id)     on delete restrict,
  contract_id         uuid not null references public.installment_contracts(id) on delete restrict,
  resident_id         uuid not null references public.residents(id) on delete restrict,

  payment_reference   text not null,
  payment_date        date not null default current_date,
  payment_method      public.payment_method not null,
  payment_amount      numeric(12,2) not null check (payment_amount > 0),
  payment_status      public.payment_status not null default 'confirmed',

  notes               text,
  external_reference  text,                              -- bank ref / cheque number / online TXN id
  reversed_at         timestamptz,
  reversed_by         uuid references auth.users(id) on delete set null,
  reversal_reason     text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  updated_by          uuid references auth.users(id) on delete set null,

  constraint payments_unique_reference_per_org unique (organization_id, payment_reference),
  constraint payments_reversal_consistency
    check ((payment_status <> 'reversed') or (reversed_at is not null))
);

create index payments_contract_idx  on public.payments (contract_id);
create index payments_resident_idx  on public.payments (resident_id);
create index payments_org_idx       on public.payments (organization_id);
create index payments_date_idx      on public.payments (payment_date desc);
create index payments_status_idx    on public.payments (payment_status);

-- ─── payment_allocations ────────────────────────────────────────────────────

create table public.payment_allocations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_id      uuid not null references public.payments(id) on delete cascade,
  installment_id  uuid not null references public.installment_schedules(id) on delete restrict,
  amount          numeric(12,2) not null check (amount > 0),
  applied_to      text not null default 'principal' check (applied_to in ('principal','interest','penalty')),
  created_at      timestamptz not null default now()
);

create index allocations_payment_idx     on public.payment_allocations (payment_id);
create index allocations_installment_idx on public.payment_allocations (installment_id);

-- ─── penalties ──────────────────────────────────────────────────────────────

create table public.penalties (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  compound_id     uuid not null references public.compounds(id)     on delete restrict,
  contract_id     uuid not null references public.installment_contracts(id) on delete cascade,
  installment_id  uuid not null references public.installment_schedules(id) on delete cascade,

  penalty_date    date not null,
  penalty_type    public.penalty_type not null,
  penalty_value   numeric(10,2) not null,
  amount          numeric(12,2) not null check (amount >= 0),
  status          public.penalty_status not null default 'applied',
  reason          text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);

create index penalties_contract_idx    on public.penalties (contract_id);
create index penalties_installment_idx on public.penalties (installment_id);
create unique index penalties_one_per_installment_per_day
  on public.penalties (installment_id, penalty_date);

-- ─── receipts ──────────────────────────────────────────────────────────────

create sequence if not exists public.receipt_seq increment by 1 start with 1;

create table public.receipts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_id      uuid not null unique references public.payments(id) on delete cascade,
  receipt_number  text not null,
  issued_at       timestamptz not null default now(),
  issued_by       uuid references auth.users(id) on delete set null,
  pdf_storage_path text,
  constraint receipts_unique_number_per_org unique (organization_id, receipt_number)
);

create index receipts_payment_idx on public.receipts (payment_id);

-- ─── financial_transactions (immutable audit) ──────────────────────────────

create table public.financial_transactions (
  id              bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  compound_id     uuid references public.compounds(id) on delete set null,
  actor_id        uuid references auth.users(id) on delete set null,
  action_type     public.financial_action not null,
  entity_type     text not null check (entity_type in ('contract','schedule','payment','penalty','receipt','reminder')),
  entity_id       uuid not null,
  amount          numeric(14,2),
  old_values      jsonb,
  new_values      jsonb,
  reason          text,
  created_at      timestamptz not null default now()
);

create index ft_org_idx     on public.financial_transactions (organization_id, created_at desc);
create index ft_entity_idx  on public.financial_transactions (entity_type, entity_id);
create index ft_action_idx  on public.financial_transactions (action_type);

-- Block direct mutations on financial_transactions (only the SECURITY DEFINER
-- functions can write to it).
revoke insert, update, delete on public.financial_transactions from authenticated, anon;

-- ─── payment_reminders ─────────────────────────────────────────────────────

create table public.payment_reminders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  compound_id     uuid not null references public.compounds(id)     on delete restrict,
  contract_id     uuid not null references public.installment_contracts(id) on delete cascade,
  installment_id  uuid references public.installment_schedules(id) on delete cascade,
  resident_id     uuid not null references public.residents(id) on delete restrict,
  kind            public.reminder_kind not null,
  channel         public.reminder_channel not null default 'in_app',
  status          public.reminder_status not null default 'pending',
  scheduled_for   timestamptz not null default now(),
  sent_at         timestamptz,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index reminders_resident_idx on public.payment_reminders (resident_id, status);
create index reminders_pending_idx  on public.payment_reminders (scheduled_for) where status = 'pending';

-- ─── Triggers: enforce allocation totals ────────────────────────────────────

create or replace function public.tg_check_allocation_sum()
returns trigger
language plpgsql
as $$
declare
  v_payment_amount numeric(12,2);
  v_allocated      numeric(12,2);
begin
  select payment_amount into v_payment_amount from public.payments where id = new.payment_id;
  select coalesce(sum(amount), 0) into v_allocated
  from public.payment_allocations where payment_id = new.payment_id;
  if v_allocated > v_payment_amount + 0.01 then
    raise exception 'Allocations (%) exceed payment amount (%)', v_allocated, v_payment_amount;
  end if;
  return new;
end;
$$;

create trigger allocations_check_sum
  after insert or update on public.payment_allocations
  for each row execute function public.tg_check_allocation_sum();

-- ─── Apply set_updated_at and audit triggers ──────────────────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'installment_contracts','installment_schedules','payments',
    'payment_allocations','penalties','receipts','payment_reminders'
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
