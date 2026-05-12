-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 6: Marketplace, Services & Community Commerce
-- ─────────────────────────────────────────────────────────────────────────────
-- Architecture:
--   service_providers → service_categories → service_items → orders → order_items
--   reviews link to provider + order
--   commissions track platform/compound cuts per order
--   provider_payouts track money owed to providers after commission
--
-- The order engine integrates with Phase 3 payments via orders.payment_id
-- (settled later). Commissions calculated server-side via place_order().
-- ─────────────────────────────────────────────────────────────────────────────

create type public.provider_kind as enum (
  'maintenance','cleaning','plumbing','electrician','ac_technician','grocery',
  'pharmacy','restaurant','laundry','moving','car_wash','delivery','security',
  'internet_services','other'
);
create type public.provider_verification as enum ('unverified','pending','verified','rejected');
create type public.provider_availability as enum ('open','busy','closed');
create type public.service_kind as enum ('product','on_demand_service','subscription','package');
create type public.order_status as enum ('pending','confirmed','assigned','in_progress','completed','cancelled','refunded');
create type public.order_payment_status as enum ('unpaid','partial','paid','refunded');
create type public.commission_kind as enum ('percentage','fixed');
create type public.commission_payee as enum ('platform','compound','organization');
create type public.payout_status as enum ('pending','processing','paid','cancelled');

create sequence if not exists public.order_seq increment by 1 start with 1;

-- ─── service_providers ────────────────────────────────────────────────────

create table public.service_providers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- nullable compound_id means the provider serves all compounds in the org
  compound_id     uuid references public.compounds(id) on delete cascade,

  provider_name   text not null,
  provider_kind   public.provider_kind not null,
  slug            text not null,
  description     text,
  logo_path       text,

  mobile          text,
  email           text,
  website         text,
  address         text,

  -- Operational
  rating_avg          numeric(3,2) not null default 0 check (rating_avg between 0 and 5),
  rating_count        integer not null default 0,
  verification_status public.provider_verification not null default 'unverified',
  availability_status public.provider_availability not null default 'open',
  is_active           boolean not null default true,

  -- Commission config (override of org defaults)
  default_commission_kind  public.commission_kind not null default 'percentage',
  default_commission_value numeric(10,2) not null default 10 check (default_commission_value >= 0),

  operating_hours jsonb not null default '{}'::jsonb,
  metadata        jsonb not null default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,

  constraint providers_unique_slug_per_org unique (organization_id, slug)
);

create index sp_org_idx           on public.service_providers (organization_id);
create index sp_compound_idx      on public.service_providers (compound_id) where compound_id is not null;
create index sp_kind_idx          on public.service_providers (provider_kind);
create index sp_rating_idx        on public.service_providers (rating_avg desc) where is_active;
create index sp_verification_idx  on public.service_providers (verification_status);

-- ─── service_categories ───────────────────────────────────────────────────

create table public.service_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id       uuid references public.service_categories(id) on delete cascade,
  name            text not null,
  slug            text not null,
  icon            text,
  display_order   integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint service_cat_unique_slug_per_org unique (organization_id, slug)
);

create index sc_org_idx    on public.service_categories (organization_id);
create index sc_parent_idx on public.service_categories (parent_id) where parent_id is not null;

-- ─── service_items (catalog) ──────────────────────────────────────────────

create table public.service_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_id     uuid not null references public.service_providers(id) on delete cascade,
  category_id     uuid references public.service_categories(id) on delete set null,

  name            text not null,
  slug            text not null,
  description     text,
  service_kind    public.service_kind not null default 'on_demand_service',

  price           numeric(12,2) not null check (price >= 0),
  currency        text not null default 'USD',

  duration_minutes int,                            -- for on-demand services
  unit             text,                           -- 'item', 'hour', 'kg', etc.
  image_path       text,

  is_active        boolean not null default true,
  availability_rules jsonb not null default '{}'::jsonb,
  metadata         jsonb not null default '{}'::jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id) on delete set null,
  updated_by       uuid references auth.users(id) on delete set null,

  constraint service_items_unique_slug_per_provider unique (provider_id, slug)
);

create index si_org_idx      on public.service_items (organization_id);
create index si_provider_idx on public.service_items (provider_id);
create index si_category_idx on public.service_items (category_id) where category_id is not null;
create index si_active_idx   on public.service_items (organization_id) where is_active;

-- ─── orders ───────────────────────────────────────────────────────────────

create table public.marketplace_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  resident_id     uuid not null references public.residents(id)     on delete restrict,
  unit_id         uuid references public.units(id) on delete set null,
  provider_id     uuid not null references public.service_providers(id) on delete restrict,

  order_number    text not null,
  order_status    public.order_status not null default 'pending',
  payment_status  public.order_payment_status not null default 'unpaid',

  scheduled_for   timestamptz,
  delivered_at    timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  cancellation_reason text,

  -- Amounts
  subtotal         numeric(12,2) not null default 0 check (subtotal >= 0),
  service_fee      numeric(12,2) not null default 0 check (service_fee >= 0),
  delivery_fee     numeric(12,2) not null default 0 check (delivery_fee >= 0),
  tax_amount       numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount     numeric(12,2) not null default 0 check (total_amount >= 0),
  paid_amount      numeric(12,2) not null default 0 check (paid_amount >= 0),
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  provider_net     numeric(12,2) not null default 0 check (provider_net >= 0),
  currency         text not null default 'USD',

  -- Delivery info
  delivery_address text,
  delivery_notes   text,

  -- Link to financial engine
  payment_id       uuid references public.payments(id) on delete set null,

  notes            text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id) on delete set null,
  updated_by       uuid references auth.users(id) on delete set null,

  constraint orders_unique_number_per_org unique (organization_id, order_number)
);

create index mo_org_idx      on public.marketplace_orders (organization_id);
create index mo_resident_idx on public.marketplace_orders (resident_id);
create index mo_provider_idx on public.marketplace_orders (provider_id);
create index mo_status_idx   on public.marketplace_orders (order_status);
create index mo_compound_idx on public.marketplace_orders (compound_id);
create index mo_scheduled_idx on public.marketplace_orders (scheduled_for) where order_status in ('pending','confirmed','assigned','in_progress');

create or replace function public.tg_orders_autonumber()
returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger orders_autonumber before insert on public.marketplace_orders
  for each row execute function public.tg_orders_autonumber();

-- ─── order_items ──────────────────────────────────────────────────────────

create table public.marketplace_order_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id        uuid not null references public.marketplace_orders(id) on delete cascade,
  service_item_id uuid references public.service_items(id) on delete set null,

  item_name       text not null,           -- snapshot of name at time of order
  quantity        numeric(12,2) not null default 1 check (quantity > 0),
  unit_price      numeric(12,2) not null check (unit_price >= 0),
  line_total      numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  notes           text,
  created_at      timestamptz not null default now()
);

create index moi_order_idx on public.marketplace_order_items (order_id);

-- ─── commissions ─────────────────────────────────────────────────────────

create table public.commissions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id        uuid not null references public.marketplace_orders(id) on delete cascade,
  provider_id     uuid not null references public.service_providers(id) on delete restrict,
  payee           public.commission_payee not null default 'platform',
  commission_kind public.commission_kind not null,
  commission_value numeric(10,2) not null,   -- the configured value (e.g. 10 for 10%)
  amount          numeric(12,2) not null check (amount >= 0),
  currency        text not null default 'USD',
  notes           text,
  created_at      timestamptz not null default now()
);

create index cm_order_idx    on public.commissions (order_id);
create index cm_provider_idx on public.commissions (provider_id);
create index cm_org_idx      on public.commissions (organization_id, created_at desc);

-- ─── reviews ─────────────────────────────────────────────────────────────

create table public.provider_reviews (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_id     uuid not null references public.service_providers(id) on delete cascade,
  order_id        uuid references public.marketplace_orders(id) on delete set null,
  resident_id     uuid not null references public.residents(id) on delete cascade,

  rating          integer not null check (rating between 1 and 5),
  title           text,
  body            text,
  is_moderated    boolean not null default false,
  is_hidden       boolean not null default false,
  helpful_count   integer not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- A resident can only review a specific order once
  constraint reviews_unique_per_order unique (order_id, resident_id)
);

create index pr_provider_idx on public.provider_reviews (provider_id);
create index pr_resident_idx on public.provider_reviews (resident_id);
create index pr_rating_idx   on public.provider_reviews (rating);

-- Recompute provider rating on review change
create or replace function public.tg_recompute_provider_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_provider_id uuid;
  v_avg numeric;
  v_count int;
begin
  v_provider_id := coalesce(new.provider_id, old.provider_id);
  select coalesce(round(avg(rating)::numeric, 2), 0), count(*)
  into v_avg, v_count
  from public.provider_reviews
  where provider_id = v_provider_id and not is_hidden;
  update public.service_providers
  set rating_avg = v_avg, rating_count = v_count
  where id = v_provider_id;
  return coalesce(new, old);
end;
$$;

create trigger reviews_recompute_rating
  after insert or update or delete on public.provider_reviews
  for each row execute function public.tg_recompute_provider_rating();

-- ─── provider_payouts ────────────────────────────────────────────────────

create table public.provider_payouts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_id     uuid not null references public.service_providers(id) on delete restrict,
  period_start    date not null,
  period_end      date not null,
  total_orders    integer not null default 0,
  gross_amount    numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  net_amount      numeric(12,2) not null default 0,
  currency        text not null default 'USD',
  status          public.payout_status not null default 'pending',
  paid_at         timestamptz,
  paid_by         uuid references auth.users(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payouts_period_valid check (period_end >= period_start)
);

create index pp_provider_idx on public.provider_payouts (provider_id, period_start desc);
create index pp_status_idx   on public.provider_payouts (status);

-- ─── Apply audit + updated_at triggers ─────────────────────────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'service_providers','service_categories','service_items',
    'marketplace_orders','marketplace_order_items','commissions',
    'provider_reviews','provider_payouts'
  ])
  loop
    if t not in ('marketplace_order_items','commissions') then
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
