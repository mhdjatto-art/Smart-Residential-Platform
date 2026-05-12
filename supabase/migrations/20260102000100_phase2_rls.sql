-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 2: RLS policies for new tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Same tenant-isolation model as Phase 1:
--   - super_admin sees everything
--   - org-wide roles (developer_admin) see all rows in their org
--   - compound-scoped roles see rows in their compound
--   - residents see only rows tied to themselves
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.floors              enable row level security;
alter table public.unit_assignments    enable row level security;
alter table public.documents           enable row level security;
alter table public.vehicles            enable row level security;
alter table public.emergency_contacts  enable row level security;
alter table public.family_members      enable row level security;

alter table public.floors              force row level security;
alter table public.unit_assignments    force row level security;
alter table public.documents           force row level security;
alter table public.vehicles            force row level security;
alter table public.emergency_contacts  force row level security;
alter table public.family_members      force row level security;

-- ─── floors ─────────────────────────────────────────────────────────────────

create policy floors_select on public.floors
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.user_id = auth.uid() and r.compound_id = floors.compound_id)
  );

create policy floors_modify on public.floors
  for all to authenticated
  using (public.is_super_admin() or public.user_has_management_role(floors.organization_id, floors.compound_id))
  with check (public.is_super_admin() or public.user_has_management_role(floors.organization_id, floors.compound_id));

-- ─── unit_assignments ───────────────────────────────────────────────────────
-- Staff see all assignments in their scope. A resident sees only their own.

create policy unit_assignments_select on public.unit_assignments
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = unit_assignments.resident_id and r.user_id = auth.uid())
  );

create policy unit_assignments_modify on public.unit_assignments
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = unit_assignments.organization_id
        and ur.role in ('developer_admin','compound_manager')
        and (ur.compound_id is null or ur.compound_id = unit_assignments.compound_id)
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = unit_assignments.organization_id
        and ur.role in ('developer_admin','compound_manager')
        and (ur.compound_id is null or ur.compound_id = unit_assignments.compound_id)
    )
  );

-- ─── documents ──────────────────────────────────────────────────────────────
-- Staff in scope can read all docs. A resident can read documents tied to
-- their own resident record (entity_type='resident' and entity_id = their id).
-- Writes restricted to management.

create policy documents_select on public.documents
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or (
      entity_type = 'resident'
      and exists (select 1 from public.residents r where r.id = documents.entity_id and r.user_id = auth.uid())
    )
  );

create policy documents_modify on public.documents
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(documents.organization_id, documents.compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(documents.organization_id, documents.compound_id)
  );

-- ─── vehicles ───────────────────────────────────────────────────────────────

create policy vehicles_select on public.vehicles
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = vehicles.resident_id and r.user_id = auth.uid())
  );

create policy vehicles_modify on public.vehicles
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(vehicles.organization_id, vehicles.compound_id)
    or exists (select 1 from public.residents r where r.id = vehicles.resident_id and r.user_id = auth.uid())
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(vehicles.organization_id, vehicles.compound_id)
    or exists (select 1 from public.residents r where r.id = vehicles.resident_id and r.user_id = auth.uid())
  );

-- ─── emergency_contacts ────────────────────────────────────────────────────

create policy emergency_contacts_select on public.emergency_contacts
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.residents r where r.id = emergency_contacts.resident_id and r.user_id = auth.uid())
  );

create policy emergency_contacts_modify on public.emergency_contacts
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.organization_id = emergency_contacts.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
    or exists (select 1 from public.residents r where r.id = emergency_contacts.resident_id and r.user_id = auth.uid())
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.residents r where r.id = emergency_contacts.resident_id and r.user_id = auth.uid())
  );

-- ─── family_members ────────────────────────────────────────────────────────

create policy family_members_select on public.family_members
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.residents r where r.id = family_members.resident_id and r.user_id = auth.uid())
  );

create policy family_members_modify on public.family_members
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.organization_id = family_members.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
    or exists (select 1 from public.residents r where r.id = family_members.resident_id and r.user_id = auth.uid())
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.residents r where r.id = family_members.resident_id and r.user_id = auth.uid())
  );
