-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 11: RLS for ERP bridge
-- ─────────────────────────────────────────────────────────────────────────────
-- Finance-only. Residents never see journal entries or ERP configs.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.gl_accounts        enable row level security;
alter table public.erp_integrations   enable row level security;
alter table public.account_mappings   enable row level security;
alter table public.journal_entries    enable row level security;
alter table public.journal_lines      enable row level security;
alter table public.erp_sync_log       enable row level security;

alter table public.gl_accounts        force row level security;
alter table public.erp_integrations   force row level security;
alter table public.account_mappings   force row level security;
alter table public.journal_entries    force row level security;
alter table public.journal_lines      force row level security;
alter table public.erp_sync_log       force row level security;

-- ─── gl_accounts ─────────────────────────────────────────────────────────

drop policy if exists gla_select on public.gl_accounts;
create policy gla_select on public.gl_accounts
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = gl_accounts.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

drop policy if exists gla_modify on public.gl_accounts;
create policy gla_modify on public.gl_accounts
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = gl_accounts.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── erp_integrations ────────────────────────────────────────────────────

drop policy if exists ei_select on public.erp_integrations;
create policy ei_select on public.erp_integrations
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = erp_integrations.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  );

drop policy if exists ei_modify on public.erp_integrations;
create policy ei_modify on public.erp_integrations
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = erp_integrations.organization_id
        and ur.role = 'developer_admin'
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── account_mappings ───────────────────────────────────────────────────

drop policy if exists am_select on public.account_mappings;
create policy am_select on public.account_mappings
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = account_mappings.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  );

drop policy if exists am_modify on public.account_mappings;
create policy am_modify on public.account_mappings
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = account_mappings.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── journal_entries + journal_lines ────────────────────────────────────

drop policy if exists je_select on public.journal_entries;
create policy je_select on public.journal_entries
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = journal_entries.organization_id
        and ur.role in ('developer_admin','finance_officer','compound_manager')
    )
  );

-- Inserts come from SECURITY DEFINER generate_* fns. No direct DML.

drop policy if exists jl_select on public.journal_lines;
create policy jl_select on public.journal_lines
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── erp_sync_log ────────────────────────────────────────────────────────

drop policy if exists esl_select on public.erp_sync_log;
create policy esl_select on public.erp_sync_log
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = erp_sync_log.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  );
