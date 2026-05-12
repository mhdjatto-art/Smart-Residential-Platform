-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 5: RLS policies for utilities
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.utility_providers      enable row level security;
alter table public.internet_packages      enable row level security;
alter table public.utility_subscriptions  enable row level security;
alter table public.electricity_meters     enable row level security;
alter table public.meter_readings         enable row level security;
alter table public.electricity_tariffs    enable row level security;
alter table public.utility_bills          enable row level security;
alter table public.gas_orders             enable row level security;
alter table public.service_suspensions    enable row level security;

alter table public.utility_providers      force row level security;
alter table public.internet_packages      force row level security;
alter table public.utility_subscriptions  force row level security;
alter table public.electricity_meters     force row level security;
alter table public.meter_readings         force row level security;
alter table public.electricity_tariffs    force row level security;
alter table public.utility_bills          force row level security;
alter table public.gas_orders             force row level security;
alter table public.service_suspensions    force row level security;

-- ─── utility_providers ─────────────────────────────────────────────────────

create policy providers_select on public.utility_providers
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

create policy providers_modify on public.utility_providers
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(utility_providers.organization_id, utility_providers.compound_id)
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── internet_packages ─────────────────────────────────────────────────────

create policy ip_select on public.internet_packages
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.residents r where r.organization_id = internet_packages.organization_id and r.user_id = auth.uid())
  );

create policy ip_modify on public.internet_packages
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = internet_packages.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── utility_subscriptions ────────────────────────────────────────────────

create policy subs_select on public.utility_subscriptions
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = utility_subscriptions.resident_id and r.user_id = auth.uid())
  );

create policy subs_modify on public.utility_subscriptions
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(utility_subscriptions.organization_id, utility_subscriptions.compound_id)
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── electricity_meters ──────────────────────────────────────────────────

create policy meters_select on public.electricity_meters
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.user_id = auth.uid() and r.unit_id = electricity_meters.unit_id)
  );

create policy meters_modify on public.electricity_meters
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(electricity_meters.organization_id, electricity_meters.compound_id)
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── meter_readings ───────────────────────────────────────────────────────

create policy mr_select on public.meter_readings
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.electricity_meters m
      join public.residents r on r.unit_id = m.unit_id
      where m.id = meter_readings.meter_id and r.user_id = auth.uid()
    )
  );

create policy mr_insert on public.meter_readings
  for insert to authenticated with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.electricity_meters m
      join public.residents r on r.unit_id = m.unit_id
      where m.id = meter_readings.meter_id and r.user_id = auth.uid()
    )
  );

create policy mr_update on public.meter_readings
  for update to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.electricity_meters m
      where m.id = meter_readings.meter_id
        and public.user_has_management_role(m.organization_id, m.compound_id)
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── electricity_tariffs ─────────────────────────────────────────────────

create policy tariffs_select on public.electricity_tariffs
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

create policy tariffs_modify on public.electricity_tariffs
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = electricity_tariffs.organization_id
        and ur.role in ('developer_admin','finance_officer','compound_manager')
    )
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── utility_bills ───────────────────────────────────────────────────────

create policy ub_select on public.utility_bills
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = utility_bills.resident_id and r.user_id = auth.uid())
  );

create policy ub_modify on public.utility_bills
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(utility_bills.organization_id, utility_bills.compound_id)
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = utility_bills.organization_id
        and ur.role = 'finance_officer'
    )
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── gas_orders ──────────────────────────────────────────────────────────

create policy gas_select on public.gas_orders
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = gas_orders.resident_id and r.user_id = auth.uid())
  );

create policy gas_insert on public.gas_orders
  for insert to authenticated with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.residents r where r.id = gas_orders.resident_id and r.user_id = auth.uid())
  );

create policy gas_update on public.gas_orders
  for update to authenticated using (
    public.is_super_admin()
    or public.user_has_management_role(gas_orders.organization_id, gas_orders.compound_id)
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── service_suspensions ─────────────────────────────────────────────────

create policy susp_select on public.service_suspensions
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = service_suspensions.resident_id and r.user_id = auth.uid())
  );

-- Writes only via SECURITY DEFINER functions
create policy susp_no_direct_writes on public.service_suspensions
  for all to authenticated
  using (false)
  with check (false);
