-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Migration 002: Core schema
-- ─────────────────────────────────────────────────────────────────────────────
-- Tenancy model:
--   organizations  (the developer / property mgmt company — top-level tenant)
--     └── compounds (a residential project owned by an organization)
--           └── buildings
--                 └── units
--                       └── residents
--
-- Every domain table carries organization_id; tables below compound also carry
-- compound_id. This keeps RLS queries fast (indexed equality on a UUID) and
-- makes cross-tenant joins impossible by construction.
--
-- Every table has:
--   id uuid PK (gen_random_uuid)
--   created_at, updated_at (timestamptz, default now())
--   created_by, updated_by (uuid, FK to auth.users, nullable for system rows)
--
-- All FKs use ON DELETE CASCADE for tenant scope (org → compound → building →
-- unit → resident) so deleting a compound cleanly removes its descendants.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type public.app_role as enum (
  'super_admin',
  'developer_admin',
  'compound_manager',
  'finance_officer',
  'maintenance_staff',
  'security_staff',
  'resident'
);

create type public.organization_status as enum ('active', 'suspended', 'archived');
create type public.compound_status     as enum ('active', 'inactive', 'archived');
create type public.unit_status         as enum ('vacant', 'occupied', 'reserved', 'maintenance');
create type public.unit_type           as enum ('apartment', 'villa', 'townhouse', 'studio', 'duplex', 'penthouse', 'other');
create type public.resident_status     as enum ('active', 'pending', 'former');
create type public.tenancy_type        as enum ('owner', 'tenant', 'family_member', 'guest');

-- ─── organizations ───────────────────────────────────────────────────────────
-- A developer, real-estate company, or property management firm.

create table public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  status          public.organization_status not null default 'active',
  contact_email   citext,
  contact_phone   text,
  country_code    text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  constraint organizations_slug_format check (slug ~ '^[a-z0-9-]{2,64}$')
);

create index organizations_status_idx on public.organizations (status);

-- ─── compounds ───────────────────────────────────────────────────────────────
-- A specific residential project. Belongs to one organization.

create table public.compounds (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  slug            text not null,
  status          public.compound_status not null default 'active',
  address_line1   text,
  address_line2   text,
  city            text,
  region          text,
  country_code    text,
  postal_code     text,
  timezone        text not null default 'UTC',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  unique (organization_id, slug),
  constraint compounds_slug_format check (slug ~ '^[a-z0-9-]{2,64}$')
);

create index compounds_organization_id_idx on public.compounds (organization_id);
create index compounds_status_idx on public.compounds (status);

-- ─── buildings ───────────────────────────────────────────────────────────────

create table public.buildings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id) on delete cascade,
  name            text not null,
  code            text,                -- internal code, e.g. "B12"
  floors          integer,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  unique (compound_id, name),
  constraint buildings_floors_check check (floors is null or floors >= 0)
);

create index buildings_compound_id_idx on public.buildings (compound_id);
create index buildings_organization_id_idx on public.buildings (organization_id);

-- ─── units ───────────────────────────────────────────────────────────────────

create table public.units (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id) on delete cascade,
  building_id     uuid not null references public.buildings(id) on delete cascade,
  unit_number     text not null,
  unit_type       public.unit_type not null default 'apartment',
  status          public.unit_status not null default 'vacant',
  floor           integer,
  area_sqm        numeric(10,2),
  bedrooms        smallint,
  bathrooms       smallint,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  unique (building_id, unit_number),
  constraint units_area_check     check (area_sqm  is null or area_sqm  > 0),
  constraint units_bedrooms_check check (bedrooms  is null or bedrooms  >= 0),
  constraint units_bathrooms_chk  check (bathrooms is null or bathrooms >= 0)
);

create index units_building_id_idx on public.units (building_id);
create index units_compound_id_idx on public.units (compound_id);
create index units_organization_id_idx on public.units (organization_id);
create index units_status_idx on public.units (status);

-- ─── residents ───────────────────────────────────────────────────────────────
-- A person occupying or owning a unit. May or may not have an auth.users row
-- (residents are invited to the portal in a later phase).

create table public.residents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id) on delete cascade,
  unit_id         uuid not null references public.units(id) on delete cascade,
  user_id         uuid unique references auth.users(id) on delete set null,
  first_name      text not null,
  last_name       text not null,
  email           citext,
  phone           text,
  tenancy_type    public.tenancy_type not null default 'tenant',
  status          public.resident_status not null default 'active',
  move_in_date    date,
  move_out_date   date,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  constraint residents_move_dates_check
    check (move_out_date is null or move_in_date is null or move_out_date >= move_in_date)
);

create index residents_unit_id_idx       on public.residents (unit_id);
create index residents_compound_id_idx   on public.residents (compound_id);
create index residents_organization_id_idx on public.residents (organization_id);
create index residents_user_id_idx       on public.residents (user_id) where user_id is not null;
create index residents_email_idx         on public.residents (email) where email is not null;
create index residents_name_trgm         on public.residents using gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- ─── user_roles ──────────────────────────────────────────────────────────────
-- Maps an auth user to a role within an organization (and optionally a
-- compound). A user may have multiple rows (e.g. compound_manager at compound A
-- AND finance_officer at compound B), or a single org-wide role.
--
-- super_admin is the only role allowed to have organization_id = null.

create table public.user_roles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  compound_id     uuid references public.compounds(id) on delete cascade,
  role            public.app_role not null,
  is_primary      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,

  constraint user_roles_super_admin_scope
    check (
      (role = 'super_admin' and organization_id is null and compound_id is null)
      or (role <> 'super_admin' and organization_id is not null)
    ),

  constraint user_roles_compound_belongs_to_org
    check (compound_id is null or organization_id is not null)
);

-- A user can hold a given role only once per (org, compound) scope.
create unique index user_roles_unique_scope
  on public.user_roles (user_id, role, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(compound_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index user_roles_user_id_idx         on public.user_roles (user_id);
create index user_roles_organization_id_idx on public.user_roles (organization_id);
create index user_roles_compound_id_idx     on public.user_roles (compound_id) where compound_id is not null;

-- ─── audit_log ───────────────────────────────────────────────────────────────
-- Generic change log written by triggers (see audit migration).
create table public.audit_log (
  id              bigserial primary key,
  actor_id        uuid references auth.users(id) on delete set null,
  organization_id uuid,
  compound_id     uuid,
  table_name      text not null,
  row_id          uuid,
  action          text not null check (action in ('insert','update','delete')),
  diff            jsonb,
  created_at      timestamptz not null default now()
);

create index audit_log_table_row_idx on public.audit_log (table_name, row_id);
create index audit_log_org_idx       on public.audit_log (organization_id, created_at desc);
create index audit_log_actor_idx     on public.audit_log (actor_id, created_at desc);
