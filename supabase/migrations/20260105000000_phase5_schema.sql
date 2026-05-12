-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 5: Utilities, Internet, Gas & Smart Billing
-- ─────────────────────────────────────────────────────────────────────────────
-- Architectural principles:
--   1. Provider abstraction — utility_providers carries an `adapter_config`
--      JSONB so future integrations (Modbus, MQTT, MikroTik API, etc.) just
--      add a row, no schema change.
--   2. Single utility_bills table for ALL utility types — billing engine
--      doesn't care about utility-specific quirks; those live in metadata.
--   3. utility_bills.payment_id links to Phase 3 payments — financial calcs
--      stay in the financial engine. No duplication.
--   4. Subscriptions track recurring services; one-off services (gas
--      delivery, manual electricity bill) skip subscriptions and write
--      directly to utility_bills.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enums ──────────────────────────────────────────────────────────────────

create type public.utility_type as enum (
  'electricity','internet','gas','water','maintenance','generator','other'
);
create type public.billing_method        as enum ('flat','metered','tiered','time_of_use','package','pay_per_use');
create type public.tariff_type           as enum ('fixed','tiered','time_of_use','seasonal');
create type public.provider_status       as enum ('active','inactive','suspended');
create type public.billing_cycle         as enum ('monthly','quarterly','biannual','annual','one_time');
create type public.subscription_status   as enum ('pending','active','suspended','cancelled','expired');
create type public.meter_status          as enum ('active','inactive','faulty','replaced');
create type public.reading_source        as enum ('manual','photo','smart_meter','imported');
create type public.utility_bill_status   as enum ('draft','issued','partial','paid','overdue','cancelled');
create type public.suspension_status     as enum ('active','released','expired');
create type public.suspension_reason     as enum ('overdue','manual','violation','maintenance','request');
create type public.gas_order_status      as enum ('pending','scheduled','out_for_delivery','delivered','cancelled');

-- ─── Sequences ──────────────────────────────────────────────────────────────

create sequence if not exists public.utility_bill_seq increment by 1 start with 1;
create sequence if not exists public.gas_order_seq    increment by 1 start with 1;

-- ─── utility_providers ──────────────────────────────────────────────────────

create table public.utility_providers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid references public.compounds(id) on delete set null,

  provider_name   text not null,
  provider_type   public.utility_type not null,
  provider_code   text,
  billing_method  public.billing_method not null default 'flat',
  tariff_type     public.tariff_type    not null default 'fixed',
  provider_status public.provider_status not null default 'active',

  contact_name    text,
  contact_email   text,
  contact_phone   text,

  -- Adapter abstraction for future IoT/API integrations.
  -- E.g. modbus: { "protocol":"modbus_tcp","host":"...","port":502 }
  --      mikrotik: { "host":"...","api_user":"...","credentials_ref":"vault/..." }
  adapter_kind     text,                  -- 'modbus','mqtt','mikrotik','unifi','radius','manual'
  adapter_config   jsonb not null default '{}'::jsonb,

  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,

  constraint providers_unique_code_per_org unique (organization_id, provider_code)
);

create index providers_org_idx     on public.utility_providers (organization_id);
create index providers_type_idx    on public.utility_providers (provider_type);
create index providers_status_idx  on public.utility_providers (provider_status);

-- ─── internet_packages ──────────────────────────────────────────────────────

create table public.internet_packages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_id     uuid not null references public.utility_providers(id) on delete cascade,

  package_name        text not null,
  package_tier        text not null default 'standard'
    check (package_tier in ('basic','standard','premium','enterprise','custom')),
  speed_mbps_down     integer not null check (speed_mbps_down > 0),
  speed_mbps_up       integer check (speed_mbps_up is null or speed_mbps_up > 0),
  data_cap_gb         integer,                          -- null = unlimited
  monthly_price       numeric(12,2) not null check (monthly_price >= 0),
  currency            text not null default 'USD',
  suspension_policy   text not null default 'after_grace'
    check (suspension_policy in ('immediate','after_grace','manual','never')),
  is_active           boolean not null default true,
  description         text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  updated_by          uuid references auth.users(id) on delete set null
);

create index ip_provider_idx on public.internet_packages (provider_id) where is_active;

-- ─── utility_subscriptions ──────────────────────────────────────────────────

create table public.utility_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  unit_id         uuid not null references public.units(id)         on delete cascade,
  resident_id     uuid references public.residents(id) on delete set null,
  provider_id     uuid not null references public.utility_providers(id) on delete restrict,

  subscription_type   public.utility_type not null,
  billing_cycle       public.billing_cycle not null default 'monthly',
  monthly_fee         numeric(12,2) not null default 0 check (monthly_fee >= 0),
  currency            text not null default 'USD',
  internet_package_id uuid references public.internet_packages(id) on delete set null,

  start_date          date not null,
  end_date            date,
  next_billing_date   date,
  last_billed_at      date,

  status              public.subscription_status not null default 'active',
  auto_suspend        boolean not null default true,
  notes               text,
  metadata            jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  updated_by          uuid references auth.users(id) on delete set null,

  constraint subs_dates_valid check (end_date is null or end_date >= start_date)
);

create index subs_org_idx       on public.utility_subscriptions (organization_id);
create index subs_compound_idx  on public.utility_subscriptions (compound_id);
create index subs_unit_idx      on public.utility_subscriptions (unit_id);
create index subs_provider_idx  on public.utility_subscriptions (provider_id);
create index subs_status_idx    on public.utility_subscriptions (status);
create index subs_next_bill_idx on public.utility_subscriptions (next_billing_date)
  where status = 'active' and next_billing_date is not null;

-- ─── electricity_meters ─────────────────────────────────────────────────────

create table public.electricity_meters (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  unit_id         uuid references public.units(id) on delete set null,

  meter_number    text not null,
  brand           text,
  model           text,
  serial_number   text,
  installed_at    date,
  current_reading numeric(12,2) not null default 0 check (current_reading >= 0),
  unit_of_measure text not null default 'kWh',

  status          public.meter_status not null default 'active',
  smart_enabled   boolean not null default false,
  adapter_kind    text,                   -- 'modbus','mqtt','rs485','lorawan'
  adapter_config  jsonb not null default '{}'::jsonb,

  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,

  constraint meters_unique_number_per_org unique (organization_id, meter_number)
);

create index meters_org_idx      on public.electricity_meters (organization_id);
create index meters_compound_idx on public.electricity_meters (compound_id);
create index meters_unit_idx     on public.electricity_meters (unit_id);

-- ─── meter_readings ─────────────────────────────────────────────────────────

create table public.meter_readings (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  meter_id          uuid not null references public.electricity_meters(id) on delete cascade,

  reading_date      date not null default current_date,
  reading_value     numeric(12,2) not null check (reading_value >= 0),
  previous_reading  numeric(12,2) not null default 0 check (previous_reading >= 0),
  consumption       numeric(12,2) generated always as (reading_value - previous_reading) stored,

  source            public.reading_source not null default 'manual',
  photo_path        text,
  is_validated      boolean not null default false,
  validated_by      uuid references auth.users(id) on delete set null,
  validated_at      timestamptz,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null
);

create index mr_meter_idx on public.meter_readings (meter_id, reading_date desc);
create index mr_date_idx  on public.meter_readings (reading_date desc);

-- ─── electricity_tariffs ───────────────────────────────────────────────────

create table public.electricity_tariffs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_id     uuid not null references public.utility_providers(id) on delete cascade,

  tariff_name     text not null,
  rate_per_unit   numeric(10,4) not null check (rate_per_unit >= 0),
  service_fee     numeric(12,2) not null default 0 check (service_fee >= 0),
  currency        text not null default 'USD',
  effective_from  date not null,
  effective_to    date,

  -- For tiered/seasonal: e.g. [{"up_to":100,"rate":0.10},{"up_to":300,"rate":0.15},{"up_to":null,"rate":0.20}]
  tier_brackets   jsonb not null default '[]'::jsonb,
  metadata        jsonb not null default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,

  constraint tariffs_dates_valid check (effective_to is null or effective_to >= effective_from)
);

create index et_provider_idx on public.electricity_tariffs (provider_id, effective_from);

-- ─── utility_bills (generic) ────────────────────────────────────────────────

create table public.utility_bills (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  unit_id         uuid references public.units(id) on delete set null,
  resident_id     uuid references public.residents(id) on delete set null,
  subscription_id uuid references public.utility_subscriptions(id) on delete set null,
  provider_id     uuid references public.utility_providers(id) on delete set null,
  meter_id        uuid references public.electricity_meters(id) on delete set null,

  bill_number     text not null,
  utility_type    public.utility_type not null,
  billing_period_start date not null,
  billing_period_end   date not null,
  due_date        date not null,

  -- Consumption (metered)
  previous_reading numeric(12,2),
  current_reading  numeric(12,2),
  consumption      numeric(12,2),
  rate_per_unit    numeric(10,4),

  -- Amounts
  subtotal         numeric(12,2) not null default 0 check (subtotal >= 0),
  tax_amount       numeric(12,2) not null default 0 check (tax_amount >= 0),
  penalty_amount   numeric(12,2) not null default 0 check (penalty_amount >= 0),
  paid_amount      numeric(12,2) not null default 0 check (paid_amount >= 0),
  total_amount     numeric(12,2) not null default 0 check (total_amount >= 0),
  currency         text not null default 'USD',

  status           public.utility_bill_status not null default 'issued',
  paid_at          timestamptz,
  payment_id       uuid references public.payments(id) on delete set null,

  notes            text,
  metadata         jsonb not null default '{}'::jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id) on delete set null,
  updated_by       uuid references auth.users(id) on delete set null,

  constraint ub_unique_number_per_org unique (organization_id, bill_number),
  constraint ub_period_valid check (billing_period_end >= billing_period_start),
  constraint ub_paid_le_total check (paid_amount <= total_amount + 0.01)
);

create index ub_org_idx        on public.utility_bills (organization_id);
create index ub_compound_idx   on public.utility_bills (compound_id);
create index ub_unit_idx       on public.utility_bills (unit_id) where unit_id is not null;
create index ub_resident_idx   on public.utility_bills (resident_id) where resident_id is not null;
create index ub_sub_idx        on public.utility_bills (subscription_id) where subscription_id is not null;
create index ub_type_idx       on public.utility_bills (utility_type);
create index ub_status_idx     on public.utility_bills (status);
create index ub_due_idx        on public.utility_bills (due_date) where status in ('issued','partial','overdue');

-- Auto-number utility bills
create or replace function public.tg_utility_bills_autonumber()
returns trigger language plpgsql as $$
begin
  if new.bill_number is null or new.bill_number = '' then
    new.bill_number := 'UB-' || upper(left(new.utility_type::text, 3)) || '-' ||
                       to_char(now(), 'YYYY') || '-' ||
                       lpad(nextval('public.utility_bill_seq')::text, 6, '0');
  end if;
  if new.total_amount = 0 or new.total_amount is null then
    new.total_amount := new.subtotal + coalesce(new.tax_amount, 0) + coalesce(new.penalty_amount, 0);
  end if;
  return new;
end;
$$;

create trigger utility_bills_autonumber before insert on public.utility_bills
  for each row execute function public.tg_utility_bills_autonumber();

-- ─── gas_orders ─────────────────────────────────────────────────────────────

create table public.gas_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  unit_id         uuid references public.units(id) on delete set null,
  resident_id     uuid references public.residents(id) on delete set null,
  provider_id     uuid not null references public.utility_providers(id) on delete restrict,

  order_number    text not null,
  cylinder_count  integer not null default 1 check (cylinder_count > 0),
  unit_price      numeric(12,2) not null check (unit_price >= 0),
  total_amount    numeric(12,2) generated always as (cylinder_count * unit_price) stored,
  currency        text not null default 'USD',

  delivery_address text,
  delivery_notes   text,

  requested_at    timestamptz not null default now(),
  scheduled_for   timestamptz,
  delivered_at    timestamptz,
  delivered_by    uuid references auth.users(id) on delete set null,

  status          public.gas_order_status not null default 'pending',
  bill_id         uuid references public.utility_bills(id) on delete set null,
  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,

  constraint gas_unique_number_per_org unique (organization_id, order_number)
);

create index gas_org_idx       on public.gas_orders (organization_id);
create index gas_compound_idx  on public.gas_orders (compound_id);
create index gas_status_idx    on public.gas_orders (status);
create index gas_resident_idx  on public.gas_orders (resident_id) where resident_id is not null;

create or replace function public.tg_gas_orders_autonumber()
returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'GAS-' || to_char(now(), 'YYYY') || '-' ||
                        lpad(nextval('public.gas_order_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger gas_orders_autonumber before insert on public.gas_orders
  for each row execute function public.tg_gas_orders_autonumber();

-- ─── service_suspensions ────────────────────────────────────────────────────

create table public.service_suspensions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  subscription_id uuid not null references public.utility_subscriptions(id) on delete cascade,
  unit_id         uuid references public.units(id) on delete set null,
  resident_id     uuid references public.residents(id) on delete set null,

  utility_type    public.utility_type not null,
  reason          public.suspension_reason not null,
  reason_notes    text,

  suspended_at    timestamptz not null default now(),
  released_at     timestamptz,
  status          public.suspension_status not null default 'active',
  initiated_by    uuid references auth.users(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Only one active suspension per subscription
  constraint suspensions_one_active_per_sub
    exclude using btree (subscription_id with =)
    where (status = 'active')
);

create index susp_sub_idx      on public.service_suspensions (subscription_id);
create index susp_status_idx   on public.service_suspensions (status);
create index susp_org_idx      on public.service_suspensions (organization_id);

-- ─── Apply updated_at + audit triggers ──────────────────────────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'utility_providers','internet_packages','utility_subscriptions',
    'electricity_meters','meter_readings','electricity_tariffs',
    'utility_bills','gas_orders','service_suspensions'
  ])
  loop
    -- updated_at trigger (skip meter_readings which is append-mostly)
    if t <> 'meter_readings' then
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
