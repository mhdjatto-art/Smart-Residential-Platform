-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 4: Operations layer
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables:
--   tickets, ticket_comments
--   technicians, maintenance_jobs, maintenance_inventory
--   visitors, security_logs
--   facilities, facility_bookings
--   announcements
--   notifications
--
-- Conventions:
--   - All carry organization_id (+ compound_id where relevant)
--   - All have created_at/updated_at + audit triggers via the helpers
--   - Auto-numbering for tickets/jobs/visitor passes via sequences + triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enums ──────────────────────────────────────────────────────────────────

create type public.ticket_category as enum (
  'electricity','water','internet','gas','maintenance','cleaning',
  'parking','security','elevator','noise','other'
);
create type public.ticket_priority as enum ('low','medium','high','urgent');
create type public.ticket_status   as enum ('open','assigned','in_progress','pending','resolved','closed');

create type public.maintenance_type   as enum ('preventive','corrective','emergency');
create type public.maintenance_status as enum ('scheduled','in_progress','on_hold','completed','cancelled');

create type public.technician_availability as enum ('available','busy','off_duty','vacation');

create type public.visitor_type   as enum ('guest','delivery','maintenance','contractor');
create type public.visitor_status as enum ('pending','approved','rejected','expired','checked_in','checked_out');

create type public.facility_type as enum (
  'gym','pool','meeting_room','event_hall','football_field',
  'basketball_court','tennis_court','bbq_area','playground','other'
);
create type public.booking_status as enum ('pending','approved','rejected','cancelled','completed');

create type public.announcement_kind as enum ('general','urgent','maintenance','billing','security','event');

create type public.notification_kind as enum (
  'ticket_update','maintenance_assigned','booking_status','visitor_status',
  'announcement','payment_received','payment_due','penalty','generic'
);

-- ─── Sequences for auto-numbering ───────────────────────────────────────────

create sequence if not exists public.ticket_seq          increment by 1 start with 1;
create sequence if not exists public.maintenance_job_seq increment by 1 start with 1;

-- ─── tickets ────────────────────────────────────────────────────────────────

create table public.tickets (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  compound_id         uuid not null references public.compounds(id)     on delete cascade,
  resident_id         uuid references public.residents(id) on delete set null,
  unit_id             uuid references public.units(id) on delete set null,

  ticket_number       text not null,
  category            public.ticket_category not null,
  priority            public.ticket_priority not null default 'medium',
  status              public.ticket_status   not null default 'open',
  subject             text not null,
  description         text not null,

  assigned_to         uuid references auth.users(id) on delete set null,
  sla_due_date        timestamptz,
  resolution_notes    text,
  satisfaction_rating int check (satisfaction_rating between 1 and 5),

  opened_at           timestamptz not null default now(),
  assigned_at         timestamptz,
  resolved_at         timestamptz,
  closed_at           timestamptz,
  metadata            jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  updated_by          uuid references auth.users(id) on delete set null,

  constraint tickets_unique_number_per_org unique (organization_id, ticket_number)
);

create index tickets_org_idx       on public.tickets (organization_id);
create index tickets_compound_idx  on public.tickets (compound_id);
create index tickets_resident_idx  on public.tickets (resident_id) where resident_id is not null;
create index tickets_assignee_idx  on public.tickets (assigned_to) where assigned_to is not null;
create index tickets_status_idx    on public.tickets (status);
create index tickets_priority_idx  on public.tickets (priority);
create index tickets_sla_due_idx   on public.tickets (sla_due_date) where status not in ('resolved','closed');

-- Auto-number tickets per organization (TKT-YYYY-000001)
create or replace function public.tg_tickets_autonumber()
returns trigger language plpgsql as $$
begin
  if new.ticket_number is null or new.ticket_number = '' then
    new.ticket_number := 'TKT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.ticket_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger tickets_autonumber before insert on public.tickets
  for each row execute function public.tg_tickets_autonumber();

-- Sync status timestamps automatically
create or replace function public.tg_tickets_status_sync()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' or new.status <> old.status) then
    if new.status = 'assigned' and new.assigned_at is null then new.assigned_at := now(); end if;
    if new.status = 'resolved' and new.resolved_at is null then new.resolved_at := now(); end if;
    if new.status = 'closed' and new.closed_at is null   then new.closed_at   := now(); end if;
  end if;
  return new;
end;
$$;

create trigger tickets_status_sync before insert or update on public.tickets
  for each row execute function public.tg_tickets_status_sync();

-- ─── ticket_comments ────────────────────────────────────────────────────────

create table public.ticket_comments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id       uuid not null references public.tickets(id) on delete cascade,
  author_id       uuid references auth.users(id) on delete set null,
  is_internal     boolean not null default false,
  body            text not null,
  created_at      timestamptz not null default now()
);

create index ticket_comments_ticket_idx on public.ticket_comments (ticket_id, created_at);

-- ─── technicians ────────────────────────────────────────────────────────────

create table public.technicians (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  user_id             uuid unique references auth.users(id) on delete set null,
  full_name           text not null,
  mobile              text,
  email               text,
  specialization      text[] not null default '{}',
  availability_status public.technician_availability not null default 'available',
  is_active           boolean not null default true,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  updated_by          uuid references auth.users(id) on delete set null
);

create index technicians_org_idx          on public.technicians (organization_id);
create index technicians_availability_idx on public.technicians (availability_status) where is_active;
create index technicians_user_idx         on public.technicians (user_id) where user_id is not null;

-- ─── maintenance_jobs ──────────────────────────────────────────────────────

create table public.maintenance_jobs (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations(id) on delete cascade,
  compound_id              uuid not null references public.compounds(id)     on delete cascade,
  ticket_id                uuid references public.tickets(id) on delete set null,
  unit_id                  uuid references public.units(id)     on delete set null,
  building_id              uuid references public.buildings(id) on delete set null,

  job_number               text not null,
  job_type                 public.maintenance_type not null,
  status                   public.maintenance_status not null default 'scheduled',
  title                    text not null,
  description              text,

  assigned_technician_id   uuid references public.technicians(id) on delete set null,
  scheduled_for            timestamptz,
  started_at               timestamptz,
  completed_at             timestamptz,
  cost                     numeric(12,2),
  cost_currency            text default 'USD',
  completion_notes         text,
  completion_proof_path    text,

  is_recurring             boolean not null default false,
  recurrence_interval_days int,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid references auth.users(id) on delete set null,
  updated_by               uuid references auth.users(id) on delete set null,

  constraint maintenance_jobs_unique_number unique (organization_id, job_number)
);

create index mj_org_idx        on public.maintenance_jobs (organization_id);
create index mj_compound_idx   on public.maintenance_jobs (compound_id);
create index mj_technician_idx on public.maintenance_jobs (assigned_technician_id) where assigned_technician_id is not null;
create index mj_status_idx     on public.maintenance_jobs (status);
create index mj_scheduled_idx  on public.maintenance_jobs (scheduled_for) where status in ('scheduled','in_progress');

create or replace function public.tg_maintenance_autonumber()
returns trigger language plpgsql as $$
begin
  if new.job_number is null or new.job_number = '' then
    new.job_number := 'MJ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.maintenance_job_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger maintenance_jobs_autonumber before insert on public.maintenance_jobs
  for each row execute function public.tg_maintenance_autonumber();

-- ─── visitors + security_logs ──────────────────────────────────────────────

create table public.visitors (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  compound_id         uuid not null references public.compounds(id)     on delete cascade,
  resident_id         uuid not null references public.residents(id) on delete cascade,
  unit_id             uuid references public.units(id) on delete set null,

  full_name           text not null,
  mobile              text,
  id_number           text,
  vehicle_plate       text,
  visitor_type        public.visitor_type not null default 'guest',
  visit_purpose       text,

  scheduled_date      date not null,
  scheduled_time      time,
  expires_at          timestamptz,

  status              public.visitor_status not null default 'pending',
  pass_code           text not null,                       -- 8-char alphanumeric, used for QR

  approved_at         timestamptz,
  approved_by         uuid references auth.users(id) on delete set null,
  checked_in_at       timestamptz,
  checked_out_at      timestamptz,

  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  updated_by          uuid references auth.users(id) on delete set null,

  constraint visitors_unique_pass_per_org unique (organization_id, pass_code)
);

create index visitors_org_idx       on public.visitors (organization_id);
create index visitors_compound_idx  on public.visitors (compound_id);
create index visitors_resident_idx  on public.visitors (resident_id);
create index visitors_status_idx    on public.visitors (status);
create index visitors_date_idx      on public.visitors (scheduled_date);

create or replace function public.tg_visitors_passcode()
returns trigger language plpgsql as $$
begin
  if new.pass_code is null or new.pass_code = '' then
    new.pass_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

create trigger visitors_passcode_trg before insert on public.visitors
  for each row execute function public.tg_visitors_passcode();

create table public.security_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  visitor_id      uuid references public.visitors(id) on delete set null,
  action          text not null check (action in ('check_in','check_out','denied')),
  officer_id      uuid references auth.users(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index security_logs_compound_idx on public.security_logs (compound_id, created_at desc);
create index security_logs_visitor_idx  on public.security_logs (visitor_id) where visitor_id is not null;

-- ─── facilities + bookings ─────────────────────────────────────────────────

create table public.facilities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  name            text not null,
  facility_type   public.facility_type not null,
  capacity        integer,
  booking_fee     numeric(12,2) not null default 0,
  fee_currency    text default 'USD',
  min_duration_minutes int not null default 60,
  max_duration_minutes int not null default 240,
  is_active       boolean not null default true,
  requires_approval boolean not null default false,
  description     text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,
  constraint facilities_unique_name_per_compound unique (compound_id, name)
);

create index facilities_compound_idx on public.facilities (compound_id);

create table public.facility_bookings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  facility_id     uuid not null references public.facilities(id)    on delete cascade,
  resident_id     uuid not null references public.residents(id)     on delete cascade,
  unit_id         uuid references public.units(id) on delete set null,

  start_time      timestamptz not null,
  end_time        timestamptz not null,
  status          public.booking_status not null default 'pending',
  fee_amount      numeric(12,2) not null default 0,
  fee_paid        boolean not null default false,
  notes           text,

  approved_at     timestamptz,
  approved_by     uuid references auth.users(id) on delete set null,
  rejected_reason text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null,

  constraint bookings_time_valid check (end_time > start_time)
);

create index bookings_facility_time_idx on public.facility_bookings (facility_id, start_time, end_time);
create index bookings_resident_idx      on public.facility_bookings (resident_id);
create index bookings_status_idx        on public.facility_bookings (status);

-- ─── announcements ─────────────────────────────────────────────────────────

create table public.announcements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid references public.compounds(id) on delete cascade,
  kind            public.announcement_kind not null default 'general',
  title           text not null,
  body            text not null,
  published_at    timestamptz not null default now(),
  expires_at      timestamptz,
  is_pinned       boolean not null default false,
  target_audience text not null default 'all'
    check (target_audience in ('all','staff_only','residents_only')),
  attachments     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_by      uuid references auth.users(id) on delete set null
);

create index announcements_org_idx       on public.announcements (organization_id, published_at desc);
create index announcements_pinned_idx    on public.announcements (organization_id) where is_pinned;

-- ─── notifications ─────────────────────────────────────────────────────────

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            public.notification_kind not null,
  title           text not null,
  body            text,
  entity_type     text,
  entity_id       uuid,
  href            text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- ─── Apply updated_at + audit triggers to all new tables ──────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'tickets','ticket_comments','technicians','maintenance_jobs',
    'visitors','security_logs','facilities','facility_bookings',
    'announcements','notifications'
  ])
  loop
    -- updated_at trigger (skip for ticket_comments + security_logs + notifications which are immutable-ish)
    if t not in ('ticket_comments','security_logs','notifications') then
      execute format(
        'drop trigger if exists %I_set_updated_at on public.%I;
         create trigger %I_set_updated_at before update on public.%I
           for each row execute function public.set_updated_at();', t, t, t, t
      );
    end if;
    -- audit trigger
    execute format(
      'drop trigger if exists %I_audit on public.%I;
       create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_row();', t, t, t, t
    );
  end loop;
end $$;
