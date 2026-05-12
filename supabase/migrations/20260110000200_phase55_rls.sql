-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 5.5: RLS for pricing + integration tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Pricing rules + integration configs are operational data — staff only.
-- Residents NEVER see provider credentials or pricing logic.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.service_pricing_rules enable row level security;
alter table public.dynamic_tariffs       enable row level security;
alter table public.provider_integrations enable row level security;
alter table public.integration_logs      enable row level security;

alter table public.service_pricing_rules force row level security;
alter table public.dynamic_tariffs       force row level security;
alter table public.provider_integrations force row level security;
alter table public.integration_logs      force row level security;

-- ─── service_pricing_rules ───────────────────────────────────────────────

drop policy if exists spr_select on public.service_pricing_rules;
create policy spr_select on public.service_pricing_rules
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = service_pricing_rules.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer','maintenance_staff')
    )
  );

drop policy if exists spr_modify on public.service_pricing_rules;
create policy spr_modify on public.service_pricing_rules
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = service_pricing_rules.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── dynamic_tariffs ─────────────────────────────────────────────────────

drop policy if exists dt_select on public.dynamic_tariffs;
create policy dt_select on public.dynamic_tariffs
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = dynamic_tariffs.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer','maintenance_staff')
    )
  );

drop policy if exists dt_modify on public.dynamic_tariffs;
create policy dt_modify on public.dynamic_tariffs
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = dynamic_tariffs.organization_id
        and ur.role in ('developer_admin','finance_officer','compound_manager')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── provider_integrations ──────────────────────────────────────────────

drop policy if exists pi_select on public.provider_integrations;
create policy pi_select on public.provider_integrations
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = provider_integrations.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
  );

drop policy if exists pi_modify on public.provider_integrations;
create policy pi_modify on public.provider_integrations
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = provider_integrations.organization_id
        and ur.role = 'developer_admin'
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── integration_logs ────────────────────────────────────────────────────

drop policy if exists il_select on public.integration_logs;
create policy il_select on public.integration_logs
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = integration_logs.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
  );

-- Inserts come only from SECURITY DEFINER log_integration_call. No direct DML.
