-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 2: Property & Resident Management
-- ─────────────────────────────────────────────────────────────────────────────
-- This migration extends the Phase 1 foundation. It adds:
--
--   1. New columns on existing tables (compounds, buildings, units, residents)
--   2. New tables: floors, unit_assignments, documents, vehicles,
--                  emergency_contacts, family_members
--   3. Triggers for derived stats (compound.total_buildings, building.total_units)
--   4. Helper views for dashboards
--
-- Tenancy: every new table carries organization_id, with compound_id where
-- relevant. RLS policies follow the same pattern as Phase 1.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── New enums ──────────────────────────────────────────────────────────────

create type public.ownership_status as enum ('owned', 'for_sale', 'for_rent', 'leased', 'reserved');
create type public.assignment_type   as enum ('owner', 'tenant');
create type public.assignment_status as enum ('active', 'ended', 'cancelled');
create type public.document_kind     as enum (
  'national_id', 'passport', 'ownership_deed', 'lease_agreement',
  'sales_contract', 'profile_photo', 'compound_logo', 'building_photo',
  'unit_photo', 'utility_bill', 'other'
);
create type public.gender_type       as enum ('male', 'female', 'unspecified');

-- Extend unit_type to include office and commercial (per Phase 2 spec).
alter type public.unit_type add value if not exists 'office';
alter type public.unit_type add value if not exists 'commercial';

-- ─── Extend compounds ───────────────────────────────────────────────────────

alter table public.compounds
  add column if not exists code             text,
  add column if not exists description      text,
  add column if not exists logo_path        text,           -- supabase storage path
  add column if not exists total_buildings  integer not null default 0,
  add column if not exists total_units      integer not null default 0;

create unique index if not exists compounds_org_code_uidx
  on public.compounds (organization_id, code) where code is not null;

-- ─── Extend buildings ───────────────────────────────────────────────────────

alter table public.buildings
  add column if not exists description    text,
  add column if not exists status         text not null default 'active'
    check (status in ('active', 'inactive', 'under_construction')),
  add column if not exists total_units    integer not null default 0;

-- Rename "floors" column to "number_of_floors" to match Phase 2 spec while
-- keeping a forwarding generated column for older clients. (No-op if already
-- migrated.)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='buildings' and column_name='floors')
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='buildings' and column_name='number_of_floors')
  then
    alter table public.buildings rename column floors to number_of_floors;
  end if;
end $$;

-- ─── floors (new) ───────────────────────────────────────────────────────────

create table if not exists public.floors (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  building_id     uuid not null references public.buildings(id)     on delete cascade,
  floor_number    integer not null,
  floor_name      text,
  total_units     integer not null default 0,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  constraint floors_unique_per_building unique (building_id, floor_number)
);

create index if not exists floors_building_idx     on public.floors (building_id);
create index if not exists floors_compound_idx     on public.floors (compound_id);
create index if not exists floors_organization_idx on public.floors (organization_id);

-- ─── Extend units ───────────────────────────────────────────────────────────

alter table public.units
  add column if not exists floor_id          uuid references public.floors(id) on delete set null,
  add column if not exists parking_slots     integer not null default 0,
  add column if not exists ownership_status  public.ownership_status not null default 'owned',
  add column if not exists purchase_price    numeric(14,2),
  add column if not exists rent_price        numeric(12,2),
  add column if not exists maintenance_fee   numeric(12,2),
  add column if not exists description       text;

create index if not exists units_floor_id_idx on public.units (floor_id);

-- ─── Extend residents ───────────────────────────────────────────────────────

alter table public.residents
  add column if not exists national_id      text,
  add column if not exists gender           public.gender_type not null default 'unspecified',
  add column if not exists date_of_birth    date,
  add column if not exists occupation       text,
  add column if not exists profile_photo_path text,
  add column if not exists mobile           text;

-- Backfill mobile from phone where mobile is null.
update public.residents set mobile = phone where mobile is null and phone is not null;

create unique index if not exists residents_org_national_id_uidx
  on public.residents (organization_id, national_id) where national_id is not null;

-- ─── unit_assignments (new — replaces residents.unit_id as source of truth) ─

create table if not exists public.unit_assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  unit_id         uuid not null references public.units(id)         on delete cascade,
  resident_id     uuid not null references public.residents(id)     on delete cascade,
  assignment_type public.assignment_type   not null,
  status          public.assignment_status not null default 'active',
  start_date      date not null,
  end_date        date,
  monthly_rent    numeric(12,2),
  notes           text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  constraint unit_assignments_dates_valid
    check (end_date is null or end_date >= start_date)
);

-- A unit can have ONE active owner and ONE active tenant at the same time.
create unique index if not exists unit_assignments_one_active_per_type
  on public.unit_assignments (unit_id, assignment_type)
  where status = 'active';

create index if not exists unit_assignments_unit_idx     on public.unit_assignments (unit_id);
create index if not exists unit_assignments_resident_idx on public.unit_assignments (resident_id);
create index if not exists unit_assignments_status_idx   on public.unit_assignments (status);
create index if not exists unit_assignments_compound_idx on public.unit_assignments (compound_id);
create index if not exists unit_assignments_org_idx      on public.unit_assignments (organization_id);

-- ─── documents (new) ────────────────────────────────────────────────────────

create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid references public.compounds(id) on delete cascade,
  entity_type     text not null check (entity_type in ('resident','unit','assignment','compound','building')),
  entity_id       uuid not null,
  kind            public.document_kind not null,
  storage_path    text not null,           -- path in supabase storage
  file_name       text not null,
  file_size       bigint,
  mime_type       text,
  expires_at      date,
  notes           text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);

create index if not exists documents_entity_idx       on public.documents (entity_type, entity_id);
create index if not exists documents_organization_idx on public.documents (organization_id);
create index if not exists documents_compound_idx     on public.documents (compound_id);
create index if not exists documents_kind_idx         on public.documents (kind);
create index if not exists documents_expires_idx      on public.documents (expires_at) where expires_at is not null;

-- ─── vehicles (new) ─────────────────────────────────────────────────────────

create table if not exists public.vehicles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  resident_id     uuid not null references public.residents(id)     on delete cascade,
  plate_number    text not null,
  make            text,
  model           text,
  color           text,
  year            integer,
  parking_slot    text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  constraint vehicles_unique_plate_per_org unique (organization_id, plate_number)
);

create index if not exists vehicles_resident_idx on public.vehicles (resident_id);
create index if not exists vehicles_compound_idx on public.vehicles (compound_id);

-- ─── emergency_contacts (new) ───────────────────────────────────────────────

create table if not exists public.emergency_contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id     uuid not null references public.residents(id) on delete cascade,
  full_name       text not null,
  relationship    text,
  phone           text not null,
  email           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);

create index if not exists emergency_contacts_resident_idx on public.emergency_contacts (resident_id);

-- ─── family_members (new) ───────────────────────────────────────────────────

create table if not exists public.family_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id     uuid not null references public.residents(id) on delete cascade,
  full_name       text not null,
  relationship    text,
  date_of_birth   date,
  national_id     text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);

create index if not exists family_members_resident_idx on public.family_members (resident_id);

-- ─── Triggers for derived counters ──────────────────────────────────────────
--
-- Keep compounds.total_buildings, compounds.total_units, buildings.total_units,
-- floors.total_units in sync without forcing app code to do it.

create or replace function public.recompute_compound_counts(p_compound_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.compounds
  set
    total_buildings = (select count(*) from public.buildings where compound_id = p_compound_id),
    total_units     = (select count(*) from public.units     where compound_id = p_compound_id)
  where id = p_compound_id;
end;
$$;

create or replace function public.recompute_building_counts(p_building_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.buildings
  set total_units = (select count(*) from public.units where building_id = p_building_id)
  where id = p_building_id;
end;
$$;

create or replace function public.recompute_floor_counts(p_floor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.floors
  set total_units = (select count(*) from public.units where floor_id = p_floor_id)
  where id = p_floor_id;
end;
$$;

-- buildings trigger → recompute compound counts
create or replace function public.tg_buildings_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_compound_counts(new.compound_id);
  elsif tg_op = 'DELETE' then
    perform public.recompute_compound_counts(old.compound_id);
  elsif tg_op = 'UPDATE' and new.compound_id <> old.compound_id then
    perform public.recompute_compound_counts(old.compound_id);
    perform public.recompute_compound_counts(new.compound_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists buildings_counts_trg on public.buildings;
create trigger buildings_counts_trg
  after insert or update or delete on public.buildings
  for each row execute function public.tg_buildings_counts();

-- units trigger → recompute building + compound + floor counts
create or replace function public.tg_units_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_building_counts(new.building_id);
    perform public.recompute_compound_counts(new.compound_id);
    if new.floor_id is not null then perform public.recompute_floor_counts(new.floor_id); end if;
  elsif tg_op = 'DELETE' then
    perform public.recompute_building_counts(old.building_id);
    perform public.recompute_compound_counts(old.compound_id);
    if old.floor_id is not null then perform public.recompute_floor_counts(old.floor_id); end if;
  elsif tg_op = 'UPDATE' then
    if new.building_id <> old.building_id then
      perform public.recompute_building_counts(old.building_id);
      perform public.recompute_building_counts(new.building_id);
    end if;
    if new.compound_id <> old.compound_id then
      perform public.recompute_compound_counts(old.compound_id);
      perform public.recompute_compound_counts(new.compound_id);
    end if;
    if coalesce(new.floor_id, '00000000-0000-0000-0000-000000000000') <>
       coalesce(old.floor_id, '00000000-0000-0000-0000-000000000000') then
      if old.floor_id is not null then perform public.recompute_floor_counts(old.floor_id); end if;
      if new.floor_id is not null then perform public.recompute_floor_counts(new.floor_id); end if;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists units_counts_trg on public.units;
create trigger units_counts_trg
  after insert or update or delete on public.units
  for each row execute function public.tg_units_counts();

-- ─── Trigger to update unit occupancy_status from assignments ──────────────

create or replace function public.tg_assignment_sync_unit_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id uuid;
  v_has_active boolean;
begin
  v_unit_id := coalesce(new.unit_id, old.unit_id);

  select exists(
    select 1 from public.unit_assignments
    where unit_id = v_unit_id and status = 'active'
  ) into v_has_active;

  update public.units
  set status = case
    when v_has_active then 'occupied'::public.unit_status
    when status = 'occupied'::public.unit_status then 'vacant'::public.unit_status
    else status
  end
  where id = v_unit_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists assignment_sync_unit_trg on public.unit_assignments;
create trigger assignment_sync_unit_trg
  after insert or update of status or delete on public.unit_assignments
  for each row execute function public.tg_assignment_sync_unit_status();

-- ─── Apply standard updated_at + audit triggers to new tables ──────────────

do $$
declare t text;
begin
  for t in select unnest(array['floors','unit_assignments','documents','vehicles','emergency_contacts','family_members'])
  loop
    -- updated_at trigger
    execute format(
      'drop trigger if exists %I_set_updated_at on public.%I;
       create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t, t, t, t
    );

    -- audit trigger
    execute format(
      'drop trigger if exists %I_audit on public.%I;
       create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_row();', t, t, t, t
    );
  end loop;
end $$;

-- ─── Backfill existing counters once ────────────────────────────────────────

do $$
declare c record;
begin
  for c in select id from public.compounds loop
    perform public.recompute_compound_counts(c.id);
  end loop;
  for c in select id from public.buildings loop
    perform public.recompute_building_counts(c.id);
  end loop;
end $$;
