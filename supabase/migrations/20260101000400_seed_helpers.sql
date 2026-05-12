-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Migration 005: Bootstrap helpers
-- ─────────────────────────────────────────────────────────────────────────────
-- These helpers exist so a fresh project can be bootstrapped from SQL without
-- relying on the UI (which doesn't exist until there's a super_admin).
--
-- They are SECURITY DEFINER and explicitly callable only by service_role. The
-- intended invocation is from supabase/seed.sql or a one-off psql session by
-- the operator.
-- ─────────────────────────────────────────────────────────────────────────────

-- Promote an existing auth user to super_admin.
create or replace function public.bootstrap_super_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = p_email limit 1;
  if v_user_id is null then
    raise exception 'No auth.users row found for %', p_email;
  end if;

  insert into public.user_roles (user_id, organization_id, compound_id, role)
  values (v_user_id, null, null, 'super_admin')
  on conflict do nothing;

  return v_user_id;
end;
$$;

revoke all on function public.bootstrap_super_admin(text) from public, authenticated;
grant execute on function public.bootstrap_super_admin(text) to service_role;

-- Create an organization and assign a developer_admin in a single call.
create or replace function public.bootstrap_organization(
  p_name text,
  p_slug text,
  p_admin_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
begin
  insert into public.organizations (name, slug)
  values (p_name, p_slug)
  returning id into v_org_id;

  select id into v_user_id from auth.users where email = p_admin_email limit 1;
  if v_user_id is null then
    raise exception 'No auth.users row found for %', p_admin_email;
  end if;

  insert into public.user_roles (user_id, organization_id, role)
  values (v_user_id, v_org_id, 'developer_admin');

  return v_org_id;
end;
$$;

revoke all on function public.bootstrap_organization(text, text, text) from public, authenticated;
grant execute on function public.bootstrap_organization(text, text, text) to service_role;
