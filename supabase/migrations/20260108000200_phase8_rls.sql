-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 8: RLS for analytics, automation, jobs, alerts, predictions, reports
-- ─────────────────────────────────────────────────────────────────────────────
-- Analytics tables are operational-intelligence data: residents should never
-- see them. Read access is gated to staff roles only.
-- Write access (automations, reports) is gated to admins + finance.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.analytics_daily_kpi enable row level security;
alter table public.automation_rules    enable row level security;
alter table public.automation_runs     enable row level security;
alter table public.job_queue           enable row level security;
alter table public.system_alerts       enable row level security;
alter table public.ai_predictions      enable row level security;
alter table public.report_definitions  enable row level security;
alter table public.report_runs         enable row level security;

alter table public.analytics_daily_kpi force row level security;
alter table public.automation_rules    force row level security;
alter table public.automation_runs     force row level security;
alter table public.job_queue           force row level security;
alter table public.system_alerts       force row level security;
alter table public.ai_predictions      force row level security;
alter table public.report_definitions  force row level security;
alter table public.report_runs         force row level security;

-- A reusable predicate: "I am staff in this organization (any non-resident role)."
-- Implemented inline as we don't want to add another helper function in this phase.

create policy kpi_select on public.analytics_daily_kpi
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = analytics_daily_kpi.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer','maintenance_staff','security_staff')
    )
  );

create policy kpi_write on public.analytics_daily_kpi
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = analytics_daily_kpi.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- automation_rules — admins + finance only.
create policy ar_select on public.automation_rules
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = automation_rules.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

create policy ar_write on public.automation_rules
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = automation_rules.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- automation_runs — read-only to the same audience as rules.
create policy runs_select on public.automation_runs
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = automation_runs.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

-- job_queue — operational-only, read by admins, write by SECURITY DEFINER fns.
create policy jq_select on public.job_queue
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and (ur.organization_id = job_queue.organization_id or job_queue.organization_id is null)
        and ur.role in ('developer_admin','compound_manager')
    )
  );

create policy jq_write on public.job_queue
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'developer_admin'
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'developer_admin'
    )
  );

-- system_alerts — visible to staff; acknowledge/resolve by management.
create policy alerts_select on public.system_alerts
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = system_alerts.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer','maintenance_staff','security_staff')
    )
  );

create policy alerts_update on public.system_alerts
  for update to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = system_alerts.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ai_predictions — internal; admins + finance only.
create policy pred_select on public.ai_predictions
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = ai_predictions.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

-- report_definitions + report_runs — finance + admins.
create policy rdef_all on public.report_definitions
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = report_definitions.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

create policy rruns_all on public.report_runs
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = report_runs.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());
