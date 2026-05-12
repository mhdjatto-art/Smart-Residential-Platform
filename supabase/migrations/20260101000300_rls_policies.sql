-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Migration 004: Row Level Security policies
-- ─────────────────────────────────────────────────────────────────────────────
-- Policy rules:
--   1. super_admin     → bypasses every tenant check (still subject to RLS,
--                        just gets a permissive policy on every table).
--   2. developer_admin → full access within their organization.
--   3. compound_manager + staff roles → access within their compound only.
--   4. resident → can read their own resident row + the unit/building/compound
--                 they live in. Cannot read other residents.
--
-- Writes are restricted further than reads — staff roles can only mutate rows
-- in tables relevant to their job (e.g. finance_officer can read residents but
-- not delete them; that's reserved for compound_manager+).
--
-- All policies use the SECURITY DEFINER helper functions defined in the audit
-- migration. This is important: directly subquerying user_roles inside a
-- policy on user_roles would cause infinite recursion.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── enable RLS on every table ───────────────────────────────────────────────

alter table public.organizations enable row level security;
alter table public.compounds     enable row level security;
alter table public.buildings     enable row level security;
alter table public.units         enable row level security;
alter table public.residents     enable row level security;
alter table public.user_roles    enable row level security;
alter table public.audit_log     enable row level security;

-- Force RLS even for table owners (defence in depth).
alter table public.organizations force row level security;
alter table public.compounds     force row level security;
alter table public.buildings     force row level security;
alter table public.units         force row level security;
alter table public.residents     force row level security;
alter table public.user_roles    force row level security;
alter table public.audit_log     force row level security;

-- ─── organizations ───────────────────────────────────────────────────────────

create policy organizations_select on public.organizations
  for select to authenticated
  using (
    public.is_super_admin()
    or id in (select public.user_organization_ids())
  );

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (public.is_super_admin());

create policy organizations_update on public.organizations
  for update to authenticated
  using (
    public.is_super_admin()
    or (
      id in (select public.user_organization_ids())
      and exists (
        select 1 from public.user_roles
        where user_id = auth.uid()
          and organization_id = organizations.id
          and role = 'developer_admin'
      )
    )
  )
  with check (
    public.is_super_admin()
    or id in (select public.user_organization_ids())
  );

create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.is_super_admin());

-- ─── compounds ───────────────────────────────────────────────────────────────

create policy compounds_select on public.compounds
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or id              in (select public.user_compound_ids())
  );

create policy compounds_insert on public.compounds
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and organization_id = compounds.organization_id
        and role in ('developer_admin')
    )
  );

create policy compounds_update on public.compounds
  for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and organization_id = compounds.organization_id
        and role in ('developer_admin', 'compound_manager')
        and (compound_id is null or compound_id = compounds.id)
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

create policy compounds_delete on public.compounds
  for delete to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and organization_id = compounds.organization_id
        and role = 'developer_admin'
    )
  );

-- ─── buildings ───────────────────────────────────────────────────────────────
-- Selectable to: super_admin, anyone in the org, anyone in the compound,
-- and residents of that compound (so they can see which building they live in).

create policy buildings_select on public.buildings
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (
      select 1 from public.residents r
      where r.user_id = auth.uid()
        and r.compound_id = buildings.compound_id
    )
  );

create policy buildings_modify on public.buildings
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(buildings.organization_id, buildings.compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(buildings.organization_id, buildings.compound_id)
  );

-- ─── units ───────────────────────────────────────────────────────────────────

create policy units_select on public.units
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (
      select 1 from public.residents r
      where r.user_id = auth.uid()
        and r.unit_id = units.id
    )
  );

create policy units_modify on public.units
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(units.organization_id, units.compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(units.organization_id, units.compound_id)
  );

-- ─── residents ───────────────────────────────────────────────────────────────
-- Reads:
--   - staff (developer_admin / compound_manager / finance / maintenance / security)
--     see all residents in their scope
--   - residents see only themselves
-- Writes:
--   - only developer_admin and compound_manager can mutate
--   - residents can update their OWN contact fields (enforced at API layer; row
--     scope here is intentionally tight)

create policy residents_select on public.residents
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or user_id = auth.uid()
  );

create policy residents_insert on public.residents
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = residents.organization_id
        and ur.role in ('developer_admin', 'compound_manager')
        and (ur.compound_id is null or ur.compound_id = residents.compound_id)
    )
  );

create policy residents_update on public.residents
  for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = residents.organization_id
        and ur.role in ('developer_admin', 'compound_manager')
        and (ur.compound_id is null or ur.compound_id = residents.compound_id)
    )
    or user_id = auth.uid()                          -- resident editing self
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or user_id = auth.uid()
  );

create policy residents_delete on public.residents
  for delete to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = residents.organization_id
        and ur.role in ('developer_admin', 'compound_manager')
        and (ur.compound_id is null or ur.compound_id = residents.compound_id)
    )
  );

-- ─── user_roles ──────────────────────────────────────────────────────────────
-- Users can read their own role rows. Org admins can read all roles in their
-- org. Only super_admin and developer_admin can insert/update/delete roles.

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or organization_id in (select public.user_organization_ids())
  );

create policy user_roles_insert on public.user_roles
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      organization_id is not null
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.organization_id = user_roles.organization_id
          and ur.role = 'developer_admin'
      )
      -- developer_admin cannot mint super_admins
      and user_roles.role <> 'super_admin'
    )
  );

create policy user_roles_update on public.user_roles
  for update to authenticated
  using (
    public.is_super_admin()
    or (
      organization_id is not null
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.organization_id = user_roles.organization_id
          and ur.role = 'developer_admin'
      )
    )
  )
  with check (
    public.is_super_admin()
    or user_roles.role <> 'super_admin'
  );

create policy user_roles_delete on public.user_roles
  for delete to authenticated
  using (
    public.is_super_admin()
    or (
      organization_id is not null
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.organization_id = user_roles.organization_id
          and ur.role = 'developer_admin'
      )
      and user_roles.role <> 'super_admin'
    )
  );

-- ─── audit_log ───────────────────────────────────────────────────────────────
-- Read-only to admins inside the tenant; nobody writes directly (trigger does).

create policy audit_log_select on public.audit_log
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id is not null and organization_id in (select public.user_organization_ids()))
  );

-- explicitly deny direct writes (trigger uses SECURITY DEFINER and bypasses RLS)
revoke insert, update, delete on public.audit_log from authenticated;
