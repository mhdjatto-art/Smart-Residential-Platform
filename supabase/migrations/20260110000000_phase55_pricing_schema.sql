-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 5.5: Dynamic service fees + provider integrations
-- ─────────────────────────────────────────────────────────────────────────────
-- New tables
--   service_pricing_rules   — formula/tiered/per-sqm pricing per service kind
--   dynamic_tariffs         — time-of-use, seasonal, tiered consumption rates
--   provider_integrations   — adapter config per utility provider (Mikrotik, Modbus...)
--   integration_logs        — every adapter call with outcome + latency
--
-- All tenant-scoped tables enforce FORCE RLS in the companion migration.
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'pricing_method' and typnamespace = 'public'::regnamespace) then
    create type public.pricing_method as enum (
      'flat',           -- one fixed price
      'per_sqm',        -- price × unit.area_sqm
      'per_resident',   -- price × resident count
      'tiered',         -- consumption-based tiers
      'formula',        -- custom formula (limited safe DSL)
      'time_of_use',    -- different rate per hour-of-day
      'seasonal'        -- different rate per month
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'integration_status' and typnamespace = 'public'::regnamespace) then
    create type public.integration_status as enum ('disconnected','configured','connected','degraded','error');
  end if;
  if not exists (select 1 from pg_type where typname = 'integration_call_outcome' and typnamespace = 'public'::regnamespace) then
    create type public.integration_call_outcome as enum ('success','failure','timeout','retry');
  end if;
end $$;

-- ─── service_pricing_rules ────────────────────────────────────────────────
-- Tenant-scoped. Each rule applies to a service_kind (matches utility types
-- plus marketplace kinds) and computes a price using the chosen method.

create table if not exists public.service_pricing_rules (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  compound_id         uuid references public.compounds(id) on delete cascade,
  name                text not null,
  service_kind        text not null,                          -- 'electricity','internet','gas','water','generator','maintenance','cleaning','other'
  method              public.pricing_method not null,
  base_amount         numeric(12,4) not null default 0 check (base_amount >= 0),
  unit_amount         numeric(12,4) not null default 0 check (unit_amount >= 0),   -- multiplier (per sqm, per resident, per kWh)
  min_amount          numeric(12,4),                          -- price floor
  max_amount          numeric(12,4),                          -- price ceiling
  currency            text not null default 'USD',
  -- Tier config: jsonb array [{from:0,to:100,price:0.12},{from:100,to:300,price:0.18},...]
  tiers               jsonb not null default '[]'::jsonb,
  -- Formula DSL: limited expressions like "base + sqm*0.5 + residents*2"
  -- Evaluated safely server-side (no eval; tokenized arithmetic only).
  formula             text,
  -- For time_of_use: jsonb {hours: [{from:0,to:7,price:0.08},{from:7,to:22,price:0.15},...]}
  -- For seasonal:   jsonb {months: [{from:6,to:9,price:0.18},...]}
  schedule            jsonb not null default '{}'::jsonb,
  is_active           boolean not null default true,
  effective_from      date not null default current_date,
  effective_to        date,
  priority            integer not null default 100,           -- lower wins
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  updated_by          uuid references auth.users(id) on delete set null,
  constraint spr_amount_bounds_valid check (max_amount is null or min_amount is null or max_amount >= min_amount)
);

create index if not exists spr_org_idx       on public.service_pricing_rules (organization_id);
create index if not exists spr_compound_idx  on public.service_pricing_rules (compound_id) where compound_id is not null;
create index if not exists spr_kind_idx      on public.service_pricing_rules (service_kind);
create index if not exists spr_active_idx    on public.service_pricing_rules (organization_id, service_kind, priority) where is_active;

-- ─── dynamic_tariffs ──────────────────────────────────────────────────────
-- Reusable tariff records for utilities. References Phase 5's
-- electricity_tariffs for backward compat — new tariffs land here.

create table if not exists public.dynamic_tariffs (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  compound_id         uuid references public.compounds(id) on delete cascade,
  provider_id         uuid references public.utility_providers(id) on delete cascade,
  name                text not null,
  service_kind        text not null,
  method              public.pricing_method not null default 'tiered',
  tiers               jsonb not null default '[]'::jsonb,
  schedule            jsonb not null default '{}'::jsonb,
  currency            text not null default 'USD',
  is_active           boolean not null default true,
  effective_from      date not null default current_date,
  effective_to        date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists dt_org_idx      on public.dynamic_tariffs (organization_id);
create index if not exists dt_provider_idx on public.dynamic_tariffs (provider_id) where provider_id is not null;
create index if not exists dt_active_idx   on public.dynamic_tariffs (organization_id, service_kind) where is_active;

-- ─── provider_integrations ────────────────────────────────────────────────
-- Adapter configuration. Secrets stored encrypted via Supabase Vault hooks
-- (we keep them as plain JSONB here for now — production should swap to
-- pgsodium / Vault references).

create table if not exists public.provider_integrations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  provider_id         uuid references public.utility_providers(id) on delete cascade,
  adapter_kind        text not null,                          -- 'mikrotik','unifi','modbus','radius','mqtt','rest','webhook','generic'
  name                text not null,
  endpoint_url        text,
  config              jsonb not null default '{}'::jsonb,     -- { host, port, ssh_user, ... }
  credentials_ref     text,                                    -- pointer to a secret in Vault (TODO)
  status              public.integration_status not null default 'configured',
  last_synced_at      timestamptz,
  last_error          text,
  health_check_url    text,
  webhook_secret      text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists pi_org_idx      on public.provider_integrations (organization_id);
create index if not exists pi_provider_idx on public.provider_integrations (provider_id) where provider_id is not null;
create index if not exists pi_kind_idx     on public.provider_integrations (adapter_kind);
create index if not exists pi_status_idx   on public.provider_integrations (status);

-- ─── integration_logs ─────────────────────────────────────────────────────

create table if not exists public.integration_logs (
  id                  bigserial primary key,
  organization_id     uuid references public.organizations(id) on delete cascade,
  integration_id      uuid references public.provider_integrations(id) on delete set null,
  action              text not null,                          -- 'sync_meters','disconnect_user','reading_pull','webhook_in'
  outcome             public.integration_call_outcome not null,
  status_code         integer,
  duration_ms         integer,
  request_payload     jsonb,
  response_payload    jsonb,
  error_message       text,
  occurred_at         timestamptz not null default now()
);

create index if not exists il_org_time_idx     on public.integration_logs (organization_id, occurred_at desc);
create index if not exists il_integration_idx  on public.integration_logs (integration_id, occurred_at desc) where integration_id is not null;
create index if not exists il_failures_idx     on public.integration_logs (organization_id, occurred_at desc) where outcome <> 'success';

-- ─── triggers ─────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'service_pricing_rules','dynamic_tariffs','provider_integrations'
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
