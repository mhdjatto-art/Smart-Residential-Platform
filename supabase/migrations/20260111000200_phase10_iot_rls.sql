-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 10: RLS for IoT + Access Control
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.devices             enable row level security;
alter table public.device_events       enable row level security;
alter table public.device_commands     enable row level security;
alter table public.access_zones        enable row level security;
alter table public.access_logs         enable row level security;
alter table public.parking_spots       enable row level security;
alter table public.parking_assignments enable row level security;

alter table public.devices             force row level security;
alter table public.device_events       force row level security;
alter table public.device_commands     force row level security;
alter table public.access_zones        force row level security;
alter table public.access_logs         force row level security;
alter table public.parking_spots       force row level security;
alter table public.parking_assignments force row level security;

-- ─── devices ─────────────────────────────────────────────────────────────

drop policy if exists dv_select on public.devices;
create policy dv_select on public.devices
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.organization_id = devices.organization_id
        and r.user_id = auth.uid()
        and (devices.unit_id is null or r.unit_id = devices.unit_id)
    )
  );

drop policy if exists dv_modify on public.devices;
create policy dv_modify on public.devices
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(devices.organization_id, devices.compound_id)
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── device_events ───────────────────────────────────────────────────────

drop policy if exists de_select on public.device_events;
create policy de_select on public.device_events
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- Inserts go only through record_device_event (SECURITY DEFINER). No direct DML.

-- ─── device_commands ─────────────────────────────────────────────────────

drop policy if exists dc_select on public.device_commands;
create policy dc_select on public.device_commands
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

drop policy if exists dc_modify on public.device_commands;
create policy dc_modify on public.device_commands
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(device_commands.organization_id, null)
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── access_zones ────────────────────────────────────────────────────────

drop policy if exists az_select on public.access_zones;
create policy az_select on public.access_zones
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.organization_id = access_zones.organization_id and r.user_id = auth.uid()
    )
  );

drop policy if exists az_modify on public.access_zones;
create policy az_modify on public.access_zones
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(access_zones.organization_id, access_zones.compound_id)
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── access_logs (read by staff + the resident if it's their own log) ────

drop policy if exists al_select on public.access_logs;
create policy al_select on public.access_logs
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.id = access_logs.resident_id and r.user_id = auth.uid()
    )
  );

-- Inserts go only through evaluate_access (SECURITY DEFINER).

-- ─── parking_spots ───────────────────────────────────────────────────────

drop policy if exists ps_select on public.parking_spots;
create policy ps_select on public.parking_spots
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.organization_id = parking_spots.organization_id and r.user_id = auth.uid()
    )
  );

drop policy if exists ps_modify on public.parking_spots;
create policy ps_modify on public.parking_spots
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(parking_spots.organization_id, parking_spots.compound_id)
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── parking_assignments ─────────────────────────────────────────────────

drop policy if exists pa_select on public.parking_assignments;
create policy pa_select on public.parking_assignments
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.id = parking_assignments.resident_id and r.user_id = auth.uid()
    )
  );

drop policy if exists pa_modify on public.parking_assignments;
create policy pa_modify on public.parking_assignments
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(parking_assignments.organization_id, parking_assignments.compound_id)
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());
