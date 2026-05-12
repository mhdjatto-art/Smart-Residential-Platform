-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 4: RLS policies for operations tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Patterns:
--   - Staff (super_admin / developer_admin / compound_manager / maintenance /
--     security / finance) see all rows in their scope. Each module restricts
--     who can WRITE more tightly.
--   - Residents see only rows tied to themselves (tickets they opened, their
--     visitors, their bookings, etc.).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tickets             enable row level security;
alter table public.ticket_comments     enable row level security;
alter table public.technicians         enable row level security;
alter table public.maintenance_jobs    enable row level security;
alter table public.visitors            enable row level security;
alter table public.security_logs       enable row level security;
alter table public.facilities          enable row level security;
alter table public.facility_bookings   enable row level security;
alter table public.announcements       enable row level security;
alter table public.notifications       enable row level security;

alter table public.tickets             force row level security;
alter table public.ticket_comments     force row level security;
alter table public.technicians         force row level security;
alter table public.maintenance_jobs    force row level security;
alter table public.visitors            force row level security;
alter table public.security_logs       force row level security;
alter table public.facilities          force row level security;
alter table public.facility_bookings   force row level security;
alter table public.announcements       force row level security;
alter table public.notifications       force row level security;

-- ─── tickets ────────────────────────────────────────────────────────────────

create policy tickets_select on public.tickets
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = tickets.resident_id and r.user_id = auth.uid())
    or assigned_to = auth.uid()
  );

create policy tickets_insert on public.tickets
  for insert to authenticated with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = tickets.resident_id and r.user_id = auth.uid())
  );

create policy tickets_update on public.tickets
  for update to authenticated using (
    public.is_super_admin()
    or public.user_has_management_role(tickets.organization_id, tickets.compound_id)
    or assigned_to = auth.uid()
    or exists (select 1 from public.residents r where r.id = tickets.resident_id and r.user_id = auth.uid())
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── ticket_comments ────────────────────────────────────────────────────────

create policy ticket_comments_select on public.ticket_comments
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or (
      -- Resident sees only non-internal comments on their own tickets
      not is_internal and exists (
        select 1 from public.tickets t
        join public.residents r on r.id = t.resident_id
        where t.id = ticket_comments.ticket_id and r.user_id = auth.uid()
      )
    )
  );

create policy ticket_comments_insert on public.ticket_comments
  for insert to authenticated with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.tickets t
      join public.residents r on r.id = t.resident_id
      where t.id = ticket_comments.ticket_id and r.user_id = auth.uid() and not ticket_comments.is_internal
    )
  );

-- ─── technicians ────────────────────────────────────────────────────────────

create policy technicians_select on public.technicians
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

create policy technicians_modify on public.technicians
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = technicians.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── maintenance_jobs ──────────────────────────────────────────────────────

create policy mj_select on public.maintenance_jobs
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (
      select 1 from public.technicians t
      where t.id = maintenance_jobs.assigned_technician_id and t.user_id = auth.uid()
    )
  );

create policy mj_modify on public.maintenance_jobs
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(maintenance_jobs.organization_id, maintenance_jobs.compound_id)
    or exists (
      select 1 from public.technicians t
      where t.id = maintenance_jobs.assigned_technician_id and t.user_id = auth.uid()
    )
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── visitors ──────────────────────────────────────────────────────────────

create policy visitors_select on public.visitors
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = visitors.resident_id and r.user_id = auth.uid())
  );

create policy visitors_insert on public.visitors
  for insert to authenticated with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.residents r where r.id = visitors.resident_id and r.user_id = auth.uid())
  );

create policy visitors_update on public.visitors
  for update to authenticated using (
    public.is_super_admin()
    or public.user_has_management_role(visitors.organization_id, visitors.compound_id)
    or exists (select 1 from public.residents r where r.id = visitors.resident_id and r.user_id = auth.uid())
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── security_logs ─────────────────────────────────────────────────────────

create policy security_logs_select on public.security_logs
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
  );

create policy security_logs_insert on public.security_logs
  for insert to authenticated with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = security_logs.organization_id
        and ur.role in ('developer_admin','compound_manager','security_staff')
    )
  );

-- ─── facilities ────────────────────────────────────────────────────────────

create policy facilities_select on public.facilities
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.user_id = auth.uid() and r.compound_id = facilities.compound_id)
  );

create policy facilities_modify on public.facilities
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(facilities.organization_id, facilities.compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(facilities.organization_id, facilities.compound_id)
  );

-- ─── facility_bookings ────────────────────────────────────────────────────

create policy fb_select on public.facility_bookings
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = facility_bookings.resident_id and r.user_id = auth.uid())
  );

create policy fb_insert on public.facility_bookings
  for insert to authenticated with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.residents r where r.id = facility_bookings.resident_id and r.user_id = auth.uid())
  );

create policy fb_update on public.facility_bookings
  for update to authenticated using (
    public.is_super_admin()
    or public.user_has_management_role(facility_bookings.organization_id, facility_bookings.compound_id)
    or exists (select 1 from public.residents r where r.id = facility_bookings.resident_id and r.user_id = auth.uid())
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── announcements ────────────────────────────────────────────────────────
-- Audience filter applied via the API; RLS just scopes to org. Residents see
-- 'all' + 'residents_only' announcements. Staff see everything in scope.

create policy announcements_select on public.announcements
  for select to authenticated using (
    public.is_super_admin()
    or (
      organization_id in (select public.user_organization_ids())
      and (
        target_audience in ('all','staff_only','residents_only')
      )
    )
    or (
      target_audience in ('all','residents_only')
      and exists (
        select 1 from public.residents r
        where r.user_id = auth.uid()
          and (announcements.compound_id is null or r.compound_id = announcements.compound_id)
      )
    )
  );

create policy announcements_modify on public.announcements
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(announcements.organization_id, announcements.compound_id)
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── notifications ────────────────────────────────────────────────────────
-- Every user sees ONLY their own notifications. Insert is open (writers
-- specify the user_id; only their own user_id is allowed, OR a management
-- role can write to anyone in their org).

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_insert on public.notifications
  for insert to authenticated with check (
    user_id = auth.uid()
    or public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
