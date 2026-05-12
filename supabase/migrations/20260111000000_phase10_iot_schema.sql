-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 10: Smart IoT + Access Control
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
--   devices              — every physical/logical device the platform tracks
--   device_events        — append-only event stream (online, measurement, alarm)
--   device_commands      — outgoing commands (lock/unlock, restart, etc.)
--   access_zones         — gates, parkings, gyms — any controllable area
--   access_logs          — every attempted entry/exit (granted or denied)
--   parking_spots        — physical parking spots in a compound
--   parking_assignments  — which spot belongs to which unit/resident
--
-- All tenant-scoped. RLS enforced in the companion migration.
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'device_kind' and typnamespace = 'public'::regnamespace) then
    create type public.device_kind as enum (
      'smart_meter','router','switch','access_point','smart_lock',
      'gate_controller','camera','sensor','intercom','parking_barrier','generator','other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'device_status' and typnamespace = 'public'::regnamespace) then
    create type public.device_status as enum ('provisioned','online','offline','degraded','retired','unknown');
  end if;
  if not exists (select 1 from pg_type where typname = 'device_event_kind' and typnamespace = 'public'::regnamespace) then
    create type public.device_event_kind as enum (
      'heartbeat','online','offline','measurement','alarm','config_change','firmware_update','manual'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'command_status' and typnamespace = 'public'::regnamespace) then
    create type public.command_status as enum ('queued','sent','acknowledged','succeeded','failed','timeout','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'access_method' and typnamespace = 'public'::regnamespace) then
    create type public.access_method as enum ('qr','rfid','pin','plate','biometric','manual','app','intercom');
  end if;
  if not exists (select 1 from pg_type where typname = 'access_outcome' and typnamespace = 'public'::regnamespace) then
    create type public.access_outcome as enum ('granted','denied','tailgate','manual_override','expired','blacklisted');
  end if;
  if not exists (select 1 from pg_type where typname = 'parking_assignment_status' and typnamespace = 'public'::regnamespace) then
    create type public.parking_assignment_status as enum ('active','expired','released','suspended');
  end if;
end $$;

-- ─── devices ──────────────────────────────────────────────────────────────

create table if not exists public.devices (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  compound_id        uuid not null references public.compounds(id)     on delete cascade,
  building_id        uuid references public.buildings(id) on delete set null,
  unit_id            uuid references public.units(id)     on delete set null,
  -- Optional link to a Phase 5/5.5 integration that manages this device.
  integration_id     uuid references public.provider_integrations(id) on delete set null,

  device_kind        public.device_kind not null,
  name               text not null,
  serial             text,
  mac_address        text,
  ip_address         text,
  firmware_version   text,
  vendor             text,
  model              text,
  installed_at       timestamptz,
  status             public.device_status not null default 'provisioned',
  last_seen_at       timestamptz,
  metadata           jsonb not null default '{}'::jsonb,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  updated_by         uuid references auth.users(id) on delete set null,

  constraint devices_serial_unique_per_org unique (organization_id, serial)
);

create index if not exists devices_org_idx       on public.devices (organization_id);
create index if not exists devices_compound_idx  on public.devices (compound_id);
create index if not exists devices_kind_idx      on public.devices (device_kind);
create index if not exists devices_status_idx    on public.devices (status);
create index if not exists devices_unit_idx      on public.devices (unit_id) where unit_id is not null;
create index if not exists devices_last_seen_idx on public.devices (last_seen_at desc);

-- ─── device_events (append-only, hot table) ───────────────────────────────

create table if not exists public.device_events (
  id              bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id       uuid not null references public.devices(id) on delete cascade,
  event_kind      public.device_event_kind not null,
  payload         jsonb not null default '{}'::jsonb,
  measurement_value numeric(14,4),
  measurement_unit  text,
  source          text,                                         -- 'webhook','poll','manual','simulation'
  occurred_at     timestamptz not null default now()
);

create index if not exists de_device_time_idx on public.device_events (device_id, occurred_at desc);
create index if not exists de_org_time_idx    on public.device_events (organization_id, occurred_at desc);
create index if not exists de_alarms_idx      on public.device_events (organization_id, occurred_at desc) where event_kind = 'alarm';

-- ─── device_commands ──────────────────────────────────────────────────────

create table if not exists public.device_commands (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id       uuid not null references public.devices(id) on delete cascade,
  command         text not null,                                -- 'lock','unlock','restart','sync','custom'
  payload         jsonb not null default '{}'::jsonb,
  status          public.command_status not null default 'queued',
  scheduled_for   timestamptz not null default now(),
  attempts        integer not null default 0,
  max_attempts    integer not null default 3,
  result          jsonb,
  error_message   text,
  issued_by       uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists dc_device_idx   on public.device_commands (device_id, created_at desc);
create index if not exists dc_status_idx   on public.device_commands (status, scheduled_for) where status in ('queued','sent');
create index if not exists dc_org_idx      on public.device_commands (organization_id, created_at desc);

-- ─── access_zones ─────────────────────────────────────────────────────────

create table if not exists public.access_zones (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  name            text not null,
  zone_kind       text not null check (zone_kind in ('main_gate','vehicle_gate','pedestrian_gate','parking','gym','pool','lobby','elevator','door','other')),
  device_id       uuid references public.devices(id) on delete set null,
  requires_approval boolean not null default false,
  is_active       boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists az_org_idx      on public.access_zones (organization_id);
create index if not exists az_compound_idx on public.access_zones (compound_id);
create index if not exists az_device_idx   on public.access_zones (device_id) where device_id is not null;

-- ─── access_logs (append-only, hot) ───────────────────────────────────────

create table if not exists public.access_logs (
  id              bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id) on delete cascade,
  zone_id         uuid references public.access_zones(id) on delete set null,
  device_id       uuid references public.devices(id) on delete set null,
  resident_id     uuid references public.residents(id) on delete set null,
  visitor_id      uuid references public.visitors(id)  on delete set null,
  method          public.access_method not null,
  outcome         public.access_outcome not null,
  direction       text check (direction in ('in','out','unknown')) default 'unknown',
  identifier      text,                                          -- the QR code, plate, RFID id used
  vehicle_plate   text,
  notes           text,
  payload         jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now()
);

create index if not exists al_org_time_idx     on public.access_logs (organization_id, occurred_at desc);
create index if not exists al_zone_time_idx    on public.access_logs (zone_id, occurred_at desc) where zone_id is not null;
create index if not exists al_resident_idx     on public.access_logs (resident_id, occurred_at desc) where resident_id is not null;
create index if not exists al_visitor_idx      on public.access_logs (visitor_id, occurred_at desc) where visitor_id is not null;
create index if not exists al_denied_idx       on public.access_logs (organization_id, occurred_at desc) where outcome <> 'granted';

-- ─── parking_spots ────────────────────────────────────────────────────────

create table if not exists public.parking_spots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  zone_id         uuid references public.access_zones(id) on delete set null,
  spot_number     text not null,                                  -- e.g. "P1-014"
  spot_kind       text not null default 'standard' check (spot_kind in ('standard','compact','disabled','ev','visitor','motorcycle','other')),
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint parking_spots_unique unique (compound_id, spot_number)
);

create index if not exists ps_org_idx      on public.parking_spots (organization_id);
create index if not exists ps_compound_idx on public.parking_spots (compound_id);

-- ─── parking_assignments ──────────────────────────────────────────────────

create table if not exists public.parking_assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  spot_id         uuid not null references public.parking_spots(id) on delete cascade,
  unit_id         uuid references public.units(id) on delete set null,
  resident_id     uuid references public.residents(id) on delete set null,
  vehicle_plate   text,
  vehicle_make    text,
  vehicle_model   text,
  start_date      date not null default current_date,
  end_date        date,
  status          public.parking_assignment_status not null default 'active',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists pa_spot_idx     on public.parking_assignments (spot_id);
create index if not exists pa_unit_idx     on public.parking_assignments (unit_id) where unit_id is not null;
create index if not exists pa_resident_idx on public.parking_assignments (resident_id) where resident_id is not null;
create index if not exists pa_active_idx   on public.parking_assignments (compound_id, status) where status = 'active';

-- Only one active assignment per spot at a time
create unique index if not exists pa_one_active_per_spot
  on public.parking_assignments (spot_id) where status = 'active';

-- ─── triggers ─────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'devices','access_zones','parking_spots','parking_assignments'
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
