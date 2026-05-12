-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Migration 003: Audit + maintenance triggers
-- ─────────────────────────────────────────────────────────────────────────────
-- Two cross-cutting concerns wired up here:
--   1. set_updated_at()  → keeps updated_at honest on every UPDATE
--   2. audit_row()       → writes a row to public.audit_log on INSERT/UPDATE/DELETE
--
-- Helper functions for RLS also live here so policies can reference them.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── updated_at trigger ─────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── audit trigger ──────────────────────────────────────────────────────────

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id      uuid;
  v_compound_id uuid;
  v_row_id      uuid;
  v_diff        jsonb;
begin
  -- Pull tenant scope off the row if present. Cast through jsonb so this
  -- function works generically across all tables.
  if tg_op = 'DELETE' then
    v_row_id      := (to_jsonb(old) ->> 'id')::uuid;
    v_org_id      := nullif(to_jsonb(old) ->> 'organization_id','')::uuid;
    v_compound_id := nullif(to_jsonb(old) ->> 'compound_id','')::uuid;
    v_diff        := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    v_row_id      := (to_jsonb(new) ->> 'id')::uuid;
    v_org_id      := nullif(to_jsonb(new) ->> 'organization_id','')::uuid;
    v_compound_id := nullif(to_jsonb(new) ->> 'compound_id','')::uuid;
    v_diff        := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else -- INSERT
    v_row_id      := (to_jsonb(new) ->> 'id')::uuid;
    v_org_id      := nullif(to_jsonb(new) ->> 'organization_id','')::uuid;
    v_compound_id := nullif(to_jsonb(new) ->> 'compound_id','')::uuid;
    v_diff        := jsonb_build_object('new', to_jsonb(new));
  end if;

  insert into public.audit_log (actor_id, organization_id, compound_id, table_name, row_id, action, diff)
  values (auth.uid(), v_org_id, v_compound_id, tg_table_name, v_row_id, lower(tg_op), v_diff);

  return coalesce(new, old);
end;
$$;

-- ─── apply triggers to every domain table ───────────────────────────────────

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'organizations',
      'compounds',
      'buildings',
      'units',
      'residents',
      'user_roles'
    ])
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t, t
    );

    execute format(
      'create trigger %I_audit
         after insert or update or delete on public.%I
         for each row execute function public.audit_row();', t, t
    );
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS helper functions
-- ─────────────────────────────────────────────────────────────────────────────
-- These are referenced from policies. Defining them once as SECURITY DEFINER
-- avoids recursive policy evaluation when reading user_roles inside policies
-- on other tables.

create or replace function public.is_super_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = p_user and role = 'super_admin'
  );
$$;

create or replace function public.user_organization_ids(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct organization_id
  from public.user_roles
  where user_id = p_user
    and organization_id is not null;
$$;

create or replace function public.user_compound_ids(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- Org-wide roles (developer_admin) grant access to all compounds in that org.
  select c.id
  from public.compounds c
  join public.user_roles ur
    on ur.organization_id = c.organization_id
   and ur.user_id = p_user
   and ur.compound_id is null
   and ur.role in ('developer_admin')
  union
  -- Compound-scoped roles (compound_manager, finance, maintenance, security).
  select ur.compound_id
  from public.user_roles ur
  where ur.user_id = p_user
    and ur.compound_id is not null;
$$;

-- True if the user holds ANY role that grants management privileges
-- (i.e. anything other than resident) within the given org/compound scope.
create or replace function public.user_has_management_role(
  p_org uuid,
  p_compound uuid default null,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = p_user
      and ur.role in ('developer_admin', 'compound_manager', 'finance_officer', 'maintenance_staff', 'security_staff')
      and (ur.organization_id = p_org)
      and (p_compound is null or ur.compound_id is null or ur.compound_id = p_compound)
  );
$$;

grant execute on function public.is_super_admin(uuid)            to authenticated;
grant execute on function public.user_organization_ids(uuid)     to authenticated;
grant execute on function public.user_compound_ids(uuid)         to authenticated;
grant execute on function public.user_has_management_role(uuid, uuid, uuid) to authenticated;
