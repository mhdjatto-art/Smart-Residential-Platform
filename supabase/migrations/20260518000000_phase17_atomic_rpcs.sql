-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 17 fix — Atomic RPC for feature_flags & role_capability_overrides
-- ─────────────────────────────────────────────────────────────────────────────
-- The Supabase JS client's .update() call can silently affect 0 rows when
-- RLS rejects the write — no error is thrown, the UI optimistically updates,
-- toast says "saved", but the DB never changed.
--
-- These RPCs use SECURITY DEFINER + an explicit role check, returning the
-- actual row count so the client can detect silent failures.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ─── Feature flag upsert ─────────────────────────────────────────────────
create or replace function public.set_feature_flag(
  p_org_id      uuid,
  p_feature_key text,
  p_enabled     boolean,
  p_metadata    jsonb default '{}'::jsonb
)
returns public.feature_flags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_row    public.feature_flags;
begin
  -- Auth check: only super_admin / developer_admin can change flags
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_caller
      and ur.role in ('super_admin','developer_admin')
  ) then
    raise exception 'Forbidden: only super_admin/developer_admin can set feature flags';
  end if;

  if p_org_id is null then
    -- Global row — match by feature_key only (NULL ≠ NULL in UNIQUE constraints)
    update public.feature_flags
    set    enabled    = p_enabled,
           metadata   = p_metadata,
           updated_at = now(),
           updated_by = v_caller
    where  organization_id is null
      and  feature_key = p_feature_key
    returning * into v_row;

    if not found then
      insert into public.feature_flags (organization_id, feature_key, enabled, metadata, updated_by)
      values (null, p_feature_key, p_enabled, p_metadata, v_caller)
      returning * into v_row;
    end if;
  else
    insert into public.feature_flags (organization_id, feature_key, enabled, metadata, updated_by)
    values (p_org_id, p_feature_key, p_enabled, p_metadata, v_caller)
    on conflict (organization_id, feature_key) do update
      set enabled    = excluded.enabled,
          metadata   = excluded.metadata,
          updated_at = now(),
          updated_by = v_caller
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.set_feature_flag(uuid, text, boolean, jsonb) to authenticated;

-- ─── Role capability override upsert ─────────────────────────────────────
create or replace function public.set_role_capability_override(
  p_org_id     uuid,
  p_role       text,
  p_capability text,
  p_enabled    boolean
)
returns public.role_capability_overrides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_row    public.role_capability_overrides;
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_caller
      and ur.role in ('super_admin','developer_admin')
  ) then
    raise exception 'Forbidden: only super_admin/developer_admin can set capability overrides';
  end if;

  if p_org_id is null then
    update public.role_capability_overrides
    set    enabled    = p_enabled,
           updated_at = now(),
           updated_by = v_caller
    where  organization_id is null
      and  role = p_role
      and  capability = p_capability
    returning * into v_row;

    if not found then
      insert into public.role_capability_overrides (organization_id, role, capability, enabled, updated_by)
      values (null, p_role, p_capability, p_enabled, v_caller)
      returning * into v_row;
    end if;
  else
    insert into public.role_capability_overrides (organization_id, role, capability, enabled, updated_by)
    values (p_org_id, p_role, p_capability, p_enabled, v_caller)
    on conflict (organization_id, role, capability) do update
      set enabled    = excluded.enabled,
          updated_at = now(),
          updated_by = v_caller
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.set_role_capability_override(uuid, text, text, boolean) to authenticated;

-- ─── Clear (delete) a role capability override ───────────────────────────
create or replace function public.clear_role_capability_override(
  p_org_id     uuid,
  p_role       text,
  p_capability text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_deleted  integer;
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_caller
      and ur.role in ('super_admin','developer_admin')
  ) then
    raise exception 'Forbidden';
  end if;

  if p_org_id is null then
    delete from public.role_capability_overrides
    where organization_id is null
      and role = p_role
      and capability = p_capability;
  else
    delete from public.role_capability_overrides
    where organization_id = p_org_id
      and role = p_role
      and capability = p_capability;
  end if;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.clear_role_capability_override(uuid, text, text) to authenticated;

commit;
