-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — Resident invitations
-- ─────────────────────────────────────────────────────────────────────────────
-- A staff member (super_admin / developer_admin / compound_manager) generates
-- a one-time invite code tied to a specific unit. The resident enters the
-- code on /m/signup and a fresh auth.users + residents row is created
-- atomically.
--
-- Run as super_admin in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.resident_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compound_id     uuid not null references public.compounds(id)     on delete cascade,
  unit_id         uuid not null references public.units(id)         on delete cascade,
  code            text not null unique check (code ~ '^[A-Z0-9]{6,16}$'),
  email           citext,                                             -- optional lock to a specific email
  tenancy_type    public.tenancy_type not null default 'tenant',
  expires_at      timestamptz not null default (now() + interval '14 days'),
  used_at         timestamptz,
  used_by_user_id uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

create index if not exists ri_unit_idx    on public.resident_invites (unit_id);
create index if not exists ri_compound_idx on public.resident_invites (compound_id);
create index if not exists ri_unused_idx  on public.resident_invites (code) where used_at is null;

-- RLS — only staff in the same compound can read/manage; public can verify a code
alter table public.resident_invites enable row level security;
alter table public.resident_invites force row level security;

drop policy if exists ri_staff_select on public.resident_invites;
create policy ri_staff_select on public.resident_invites
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and (ur.role = 'super_admin'
             or (ur.role in ('developer_admin','compound_manager')
                 and (ur.organization_id is null or ur.organization_id = resident_invites.organization_id)
                 and (ur.compound_id is null or ur.compound_id = resident_invites.compound_id)))
    )
  );

drop policy if exists ri_staff_insert on public.resident_invites;
create policy ri_staff_insert on public.resident_invites
  for insert to authenticated
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and (ur.role = 'super_admin'
             or (ur.role in ('developer_admin','compound_manager')
                 and (ur.organization_id is null or ur.organization_id = resident_invites.organization_id)
                 and (ur.compound_id is null or ur.compound_id = resident_invites.compound_id)))
    )
  );

drop policy if exists ri_staff_delete on public.resident_invites;
create policy ri_staff_delete on public.resident_invites
  for delete to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and (ur.role = 'super_admin'
             or (ur.role in ('developer_admin','compound_manager')
                 and (ur.organization_id is null or ur.organization_id = resident_invites.organization_id)))
    )
  );

-- The signup endpoint uses the service-role client so it bypasses RLS.

-- ─── Helper: a short, human-friendly code generator ─────────────────────────
create or replace function public.gen_invite_code() returns text
language plpgsql
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- exclude I O 0 1
  v_code  text := '';
  i int;
begin
  for i in 1..8 loop
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  end loop;
  return v_code;
end;
$$;
