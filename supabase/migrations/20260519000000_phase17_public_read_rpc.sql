-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 17 FINAL FIX — Public RPC for feature flag resolution
-- ─────────────────────────────────────────────────────────────────────────────
-- ROOT CAUSE of "toggle saved but didn't apply":
--
-- The feature_flags RLS allows SELECT only for super_admin/developer_admin/
-- compound_manager. A resident hitting /m → getEnabledFeatures()
-- → SELECT from feature_flags returns [] (empty, no error).
-- getEnabledFeatures sees size===0 and falls back to "default-open" → ALL
-- tiles render regardless of admin toggles.
--
-- FIX: expose a SECURITY DEFINER RPC that bypasses RLS for READ-ONLY listing.
-- Returns rows the caller would otherwise be denied. Returns nothing
-- sensitive — only feature_key + enabled (no credentials, no who-edited).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create or replace function public.list_feature_flags_public(p_org_id uuid default null)
returns table (
  organization_id uuid,
  feature_key     text,
  enabled         boolean,
  updated_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  -- Returns all rows that the caller MIGHT need to resolve:
  --   • Their org's row (if any)
  --   • All global rows (organization_id IS NULL)
  -- The application-level merge decides which wins.
  select organization_id, feature_key, enabled, updated_at
  from public.feature_flags
  where organization_id is null
     or (p_org_id is not null and organization_id = p_org_id);
$$;

grant execute on function public.list_feature_flags_public(uuid) to authenticated;
grant execute on function public.list_feature_flags_public(uuid) to anon;

-- ─── Same fix for role_capability_overrides ──────────────────────────────
create or replace function public.list_role_capability_overrides_public(p_org_id uuid default null)
returns table (
  organization_id uuid,
  role            text,
  capability      text,
  enabled         boolean,
  updated_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select organization_id, role, capability, enabled, updated_at
  from public.role_capability_overrides
  where organization_id is null
     or (p_org_id is not null and organization_id = p_org_id);
$$;

grant execute on function public.list_role_capability_overrides_public(uuid) to authenticated;

commit;
