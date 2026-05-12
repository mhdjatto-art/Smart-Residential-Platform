-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 9: SaaS commercialization layer
-- ─────────────────────────────────────────────────────────────────────────────
-- New tables
--   subscription_plans         — Starter / Pro / Enterprise / custom
--   plan_features              — what each plan unlocks
--   feature_catalog            — every feature flag the platform exposes
--   organization_subscriptions — which plan an org is on + status + period
--   organization_feature_overrides — per-org overrides on top of plan defaults
--   organization_branding      — logo, colors, typography, custom CSS
--   organization_domains       — custom domain → org resolution (PWA + multi-tenant routing)
--   organization_settings      — kv settings (currency, timezone, locale, ...)
--   saas_invoices              — platform-level billing (separate from resident installments)
--   usage_events               — raw event log (one row per metered action)
--   usage_aggregates           — daily roll-up per org + metric
--
-- All tenant-scoped tables enforce FORCE RLS in the companion migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── enums (idempotent) ───────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'plan_tier' and typnamespace = 'public'::regnamespace) then
    create type public.plan_tier as enum ('starter','professional','enterprise','custom');
  end if;
  if not exists (select 1 from pg_type where typname = 'saas_subscription_status' and typnamespace = 'public'::regnamespace) then
    create type public.saas_subscription_status as enum ('trialing','active','past_due','suspended','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'saas_billing_cycle' and typnamespace = 'public'::regnamespace) then
    create type public.saas_billing_cycle as enum ('monthly','quarterly','annual','custom');
  end if;
  if not exists (select 1 from pg_type where typname = 'saas_invoice_status' and typnamespace = 'public'::regnamespace) then
    create type public.saas_invoice_status as enum ('draft','open','paid','void','uncollectible');
  end if;
  if not exists (select 1 from pg_type where typname = 'usage_metric' and typnamespace = 'public'::regnamespace) then
    create type public.usage_metric as enum (
      'active_units','active_residents','transactions','storage_mb','api_calls',
      'utility_bills','marketplace_orders','sms_sent','email_sent'
    );
  end if;
end $$;

-- ─── feature_catalog ──────────────────────────────────────────────────────
-- The platform-wide registry of features. NOT tenant-scoped.

create table if not exists public.feature_catalog (
  key             text primary key check (key ~ '^[a-z][a-z0-9_]+$'),
  name            text not null,
  description     text,
  category        text not null,                    -- 'finance','utilities','marketplace','analytics','automation','mobile','ai'
  is_premium      boolean not null default false,
  default_enabled boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ─── subscription_plans ───────────────────────────────────────────────────
-- Plan catalog. Owned by the platform (super_admin only) — NOT tenant-scoped.

create table if not exists public.subscription_plans (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[a-z0-9_-]{2,32}$'),
  name            text not null,
  tier            public.plan_tier not null,
  description     text,
  monthly_price   numeric(10,2) not null default 0 check (monthly_price >= 0),
  annual_price    numeric(10,2) not null default 0 check (annual_price >= 0),
  currency        text not null default 'USD',

  -- Quotas (null = unlimited)
  max_compounds   integer,
  max_units       integer,
  max_residents   integer,
  max_admin_users integer,
  max_storage_mb  integer,
  max_api_calls_per_month integer,

  is_active       boolean not null default true,
  display_order   integer not null default 0,
  metadata        jsonb not null default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists plan_active_idx on public.subscription_plans (is_active, display_order);

-- ─── plan_features ────────────────────────────────────────────────────────

create table if not exists public.plan_features (
  plan_id    uuid not null references public.subscription_plans(id) on delete cascade,
  feature    text not null references public.feature_catalog(key)   on delete cascade,
  is_enabled boolean not null default true,
  limit_val  integer,                                -- optional per-feature limit
  primary key (plan_id, feature)
);

create index if not exists plan_features_plan_idx on public.plan_features (plan_id);

-- ─── organization_subscriptions ───────────────────────────────────────────

create table if not exists public.organization_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  plan_id                 uuid not null references public.subscription_plans(id) on delete restrict,
  status                  public.saas_subscription_status not null default 'trialing',
  billing_cycle           public.saas_billing_cycle not null default 'monthly',
  unit_price              numeric(10,2) not null default 0,
  currency                text not null default 'USD',

  trial_ends_at           timestamptz,
  current_period_start    timestamptz not null default now(),
  current_period_end      timestamptz not null default (now() + interval '1 month'),
  cancel_at_period_end    boolean not null default false,
  cancelled_at            timestamptz,

  external_provider       text,                     -- 'stripe','manual', ...
  external_subscription_id text,

  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists org_sub_one_active_idx
  on public.organization_subscriptions (organization_id)
  where status in ('trialing','active','past_due');

create index if not exists org_sub_status_idx on public.organization_subscriptions (status);
create index if not exists org_sub_period_idx on public.organization_subscriptions (current_period_end);

-- ─── organization_feature_overrides ───────────────────────────────────────

create table if not exists public.organization_feature_overrides (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature         text not null references public.feature_catalog(key) on delete cascade,
  is_enabled      boolean not null,
  limit_val       integer,
  reason          text,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  primary key (organization_id, feature)
);

create index if not exists ofo_org_idx on public.organization_feature_overrides (organization_id);

-- ─── organization_branding ────────────────────────────────────────────────

create table if not exists public.organization_branding (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  logo_path       text,
  logo_dark_path  text,
  favicon_path    text,
  primary_color   text not null default '#0B1F3A' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color    text not null default '#10B981' check (accent_color  ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text,
  font_family     text not null default 'Inter',
  custom_css      text,
  email_from_name text,
  email_footer    text,
  metadata        jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- ─── organization_domains ─────────────────────────────────────────────────
-- A single organization can attach multiple custom domains. The middleware
-- looks up `host` here to resolve which tenant a request belongs to.

create table if not exists public.organization_domains (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  host            text not null,                          -- 'portal.client.com' or 'client.srp.app'
  is_primary      boolean not null default false,
  ssl_status      text not null default 'pending' check (ssl_status in ('pending','issued','failed','manual')),
  verified_at     timestamptz,
  verification_token text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint org_domain_unique_host unique (host)
);

create index if not exists od_org_idx on public.organization_domains (organization_id);
create unique index if not exists od_one_primary_per_org on public.organization_domains (organization_id) where is_primary;

-- ─── organization_settings ────────────────────────────────────────────────

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  default_locale  text not null default 'en' check (default_locale in ('en','ar','ku','fr','es')),
  supported_locales text[] not null default array['en']::text[],
  timezone        text not null default 'UTC',
  date_format     text not null default 'YYYY-MM-DD',
  number_format   text not null default 'en-US',
  rtl_enabled     boolean not null default false,
  notifications_config jsonb not null default '{}'::jsonb,
  feature_flags   jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- ─── saas_invoices ────────────────────────────────────────────────────────
-- Platform → customer (organization) billing. Distinct from resident
-- installment payments. References organization_subscriptions.

create table if not exists public.saas_invoices (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete restrict,
  subscription_id         uuid references public.organization_subscriptions(id) on delete set null,
  invoice_number          text not null,
  status                  public.saas_invoice_status not null default 'open',
  currency                text not null default 'USD',
  subtotal                numeric(12,2) not null default 0,
  tax_amount              numeric(12,2) not null default 0,
  total_amount            numeric(12,2) not null default 0,
  paid_amount             numeric(12,2) not null default 0,
  period_start            date not null,
  period_end              date not null,
  due_date                date not null,
  paid_at                 timestamptz,
  external_invoice_id     text,
  notes                   text,
  line_items              jsonb not null default '[]'::jsonb,    -- [{description,qty,unit_price,amount}, ...]
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint saas_invoices_unique_number unique (invoice_number)
);

create index if not exists si_org_idx     on public.saas_invoices (organization_id);
create index if not exists si_status_idx  on public.saas_invoices (status);
create index if not exists si_due_idx     on public.saas_invoices (due_date) where status in ('open','draft');

create sequence if not exists public.saas_invoice_seq increment by 1 start with 1;
create or replace function public.tg_saas_invoice_autonumber()
returns trigger language plpgsql as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.saas_invoice_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists saas_invoices_autonumber on public.saas_invoices;
create trigger saas_invoices_autonumber before insert on public.saas_invoices
  for each row execute function public.tg_saas_invoice_autonumber();

-- ─── usage_events + usage_aggregates ─────────────────────────────────────

create table if not exists public.usage_events (
  id              bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric          public.usage_metric not null,
  amount          numeric(14,4) not null default 1,
  occurred_at     timestamptz not null default now(),
  context         jsonb not null default '{}'::jsonb
);

create index if not exists ue_org_metric_time_idx on public.usage_events (organization_id, metric, occurred_at desc);

create table if not exists public.usage_aggregates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric          public.usage_metric not null,
  period_date     date not null,
  total_amount    numeric(14,4) not null default 0,
  event_count     integer not null default 0,
  computed_at     timestamptz not null default now(),
  constraint ua_unique_per_period unique (organization_id, metric, period_date)
);

create index if not exists ua_org_period_idx on public.usage_aggregates (organization_id, period_date desc);

-- ─── triggers (updated_at + audit) ────────────────────────────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'subscription_plans','organization_subscriptions','organization_branding',
    'organization_domains','organization_settings','saas_invoices'
  ])
  loop
    execute format(
      'drop trigger if exists %I_set_updated_at on public.%I;
       create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t, t, t, t
    );
  end loop;
end $$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'subscription_plans','organization_subscriptions','organization_feature_overrides',
    'organization_branding','organization_domains','organization_settings','saas_invoices'
  ])
  loop
    execute format(
      'drop trigger if exists %I_audit on public.%I;
       create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_row();', t, t, t, t
    );
  end loop;
end $$;
