-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 17 — Master Permissions Control
-- ─────────────────────────────────────────────────────────────────────────────
-- Lets super_admins toggle features ON/OFF per organization, and override the
-- default role → capability matrix without code changes.
--
-- Two tables:
--   • feature_flags             — module-level on/off (parking, marketplace, …)
--   • role_capability_overrides — fine-grained role × capability toggles
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ─── 1. feature_flags ────────────────────────────────────────────────────────
create table if not exists public.feature_flags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  feature_key     text not null,
  enabled         boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  -- Unique per org (NULL org_id = global default for new orgs)
  constraint feature_flags_unique unique (organization_id, feature_key)
);

create index if not exists feature_flags_org_idx       on public.feature_flags (organization_id);
create index if not exists feature_flags_feature_idx   on public.feature_flags (feature_key);

comment on table public.feature_flags is
  'Per-organization toggles for entire feature modules. NULL organization_id = global default.';

-- ─── 2. role_capability_overrides ────────────────────────────────────────────
create table if not exists public.role_capability_overrides (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  role            text not null,
  capability      text not null,
  enabled         boolean not null,                  -- explicit override (true = grant, false = revoke)
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  constraint role_capability_overrides_unique unique (organization_id, role, capability)
);

create index if not exists role_capability_overrides_org_idx
  on public.role_capability_overrides (organization_id, role);

comment on table public.role_capability_overrides is
  'Per-organization overrides to the default role → capability matrix in code.';

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────
alter table public.feature_flags              enable row level security;
alter table public.role_capability_overrides  enable row level security;

-- Only super_admin / developer_admin / compound_manager (of the same org) can see/edit
drop policy if exists feature_flags_admin_read  on public.feature_flags;
drop policy if exists feature_flags_admin_write on public.feature_flags;
drop policy if exists role_caps_admin_read  on public.role_capability_overrides;
drop policy if exists role_caps_admin_write on public.role_capability_overrides;

create policy feature_flags_admin_read on public.feature_flags
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('super_admin','developer_admin','compound_manager')
        and (ur.organization_id is null or ur.organization_id = feature_flags.organization_id)
    )
  );

create policy feature_flags_admin_write on public.feature_flags
  for all to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('super_admin','developer_admin')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('super_admin','developer_admin')
    )
  );

create policy role_caps_admin_read on public.role_capability_overrides
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('super_admin','developer_admin','compound_manager')
        and (ur.organization_id is null or ur.organization_id = role_capability_overrides.organization_id)
    )
  );

create policy role_caps_admin_write on public.role_capability_overrides
  for all to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('super_admin','developer_admin')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('super_admin','developer_admin')
    )
  );

-- ─── 4. Helper RPCs ──────────────────────────────────────────────────────────

-- Returns the effective feature flag for an org + feature_key.
-- Order: explicit org row → global row → default (true).
create or replace function public.is_feature_enabled(
  p_org_id  uuid,
  p_feature text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  -- Look up org-specific row first
  select enabled into v_enabled
  from public.feature_flags
  where organization_id = p_org_id and feature_key = p_feature
  limit 1;

  if v_enabled is not null then return v_enabled; end if;

  -- Fall back to global default
  select enabled into v_enabled
  from public.feature_flags
  where organization_id is null and feature_key = p_feature
  limit 1;

  if v_enabled is not null then return v_enabled; end if;

  -- No row at all → default ON
  return true;
end;
$$;

grant execute on function public.is_feature_enabled(uuid, text) to authenticated;

-- Returns whether a role has a capability for an org.
-- Order: explicit override → caller's hardcoded default (returned as NULL — JS handles fallback).
create or replace function public.get_role_capability_override(
  p_org_id     uuid,
  p_role       text,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select enabled
  from public.role_capability_overrides
  where organization_id = p_org_id
    and role       = p_role
    and capability = p_capability
  limit 1;
$$;

grant execute on function public.get_role_capability_override(uuid, text, text) to authenticated;

-- ─── 5. Audit trigger — log every change ─────────────────────────────────────
-- We reuse the existing audit_admin_action RPC if available.

create or replace function public._log_feature_flag_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Best-effort — log via audit_admin_action if it exists.
  begin
    perform public.audit_admin_action(
      tg_op || ' feature_flag',
      jsonb_build_object(
        'feature_key',     coalesce(new.feature_key, old.feature_key),
        'organization_id', coalesce(new.organization_id, old.organization_id),
        'enabled',         coalesce(new.enabled, old.enabled)
      )
    );
  exception when others then
    -- swallow — never block writes on audit failures
    null;
  end;
  return coalesce(new, old);
end;
$$;

drop trigger if exists feature_flags_audit on public.feature_flags;
create trigger feature_flags_audit
  after insert or update or delete on public.feature_flags
  for each row execute function public._log_feature_flag_change();

-- ─── 6. Seed default global flags ────────────────────────────────────────────
-- All modules enabled by default. Admins can disable per-org as needed.
insert into public.feature_flags (organization_id, feature_key, enabled, metadata)
values
  (null, 'wallets',        true, '{"label_en":"Prepaid Wallets","label_ar":"المحافظ المسبقة"}'),
  (null, 'marketplace',    true, '{"label_en":"Marketplace",   "label_ar":"السوق"}'),
  (null, 'parking',        true, '{"label_en":"Parking",       "label_ar":"المواقف"}'),
  (null, 'visitors',       true, '{"label_en":"Visitors",      "label_ar":"الزوار"}'),
  (null, 'facilities',     true, '{"label_en":"Facilities",    "label_ar":"المرافق"}'),
  (null, 'tickets',        true, '{"label_en":"Maintenance",   "label_ar":"الصيانة"}'),
  (null, 'utilities',      true, '{"label_en":"Utilities",     "label_ar":"الخدمات"}'),
  (null, 'meters',         true, '{"label_en":"Smart Meters",  "label_ar":"العدّادات الذكية"}'),
  (null, 'contracts',      true, '{"label_en":"Contracts",     "label_ar":"العقود"}'),
  (null, 'documents',      true, '{"label_en":"Documents",     "label_ar":"المستندات"}'),
  (null, 'announcements',  true, '{"label_en":"Announcements", "label_ar":"الإعلانات"}'),
  (null, 'audit_log',      true, '{"label_en":"Audit Log",     "label_ar":"سجل التدقيق"}'),
  (null, 'iot',            true, '{"label_en":"IoT Devices",   "label_ar":"أجهزة IoT"}'),
  (null, 'erp_integration',false,'{"label_en":"ERP Integration","label_ar":"تكامل ERP","beta":true}'),
  (null, 'mobile_apps',    false,'{"label_en":"Mobile Apps",   "label_ar":"تطبيقات الجوال","beta":true}')
on conflict (organization_id, feature_key) do nothing;

commit;
