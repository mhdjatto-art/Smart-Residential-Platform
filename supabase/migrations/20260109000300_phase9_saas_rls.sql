-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 9: RLS for SaaS commercialization tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Plan & feature catalogs are platform-owned (super_admin manages).
-- Per-org tables (branding, domains, settings, subscriptions, invoices, usage)
-- are visible to staff inside that org. Residents NEVER see SaaS billing.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.feature_catalog                  enable row level security;
alter table public.subscription_plans               enable row level security;
alter table public.plan_features                    enable row level security;
alter table public.organization_subscriptions       enable row level security;
alter table public.organization_feature_overrides   enable row level security;
alter table public.organization_branding            enable row level security;
alter table public.organization_domains             enable row level security;
alter table public.organization_settings            enable row level security;
alter table public.saas_invoices                    enable row level security;
alter table public.usage_events                     enable row level security;
alter table public.usage_aggregates                 enable row level security;

alter table public.feature_catalog                  force row level security;
alter table public.subscription_plans               force row level security;
alter table public.plan_features                    force row level security;
alter table public.organization_subscriptions       force row level security;
alter table public.organization_feature_overrides   force row level security;
alter table public.organization_branding            force row level security;
alter table public.organization_domains             force row level security;
alter table public.organization_settings            force row level security;
alter table public.saas_invoices                    force row level security;
alter table public.usage_events                     force row level security;
alter table public.usage_aggregates                 force row level security;

-- ─── feature_catalog: everyone reads, super_admin writes ─────────────────

drop policy if exists fc_select on public.feature_catalog;
create policy fc_select on public.feature_catalog
  for select to authenticated using (true);

drop policy if exists fc_modify on public.feature_catalog;
create policy fc_modify on public.feature_catalog
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── subscription_plans: everyone reads, super_admin writes ──────────────

drop policy if exists sp_select on public.subscription_plans;
create policy sp_select on public.subscription_plans
  for select to authenticated using (true);

drop policy if exists sp_modify on public.subscription_plans;
create policy sp_modify on public.subscription_plans
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- plan_features
drop policy if exists pf_select on public.plan_features;
create policy pf_select on public.plan_features
  for select to authenticated using (true);

drop policy if exists pf_modify on public.plan_features;
create policy pf_modify on public.plan_features
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── organization_subscriptions ──────────────────────────────────────────

drop policy if exists os_select on public.organization_subscriptions;
create policy os_select on public.organization_subscriptions
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = organization_subscriptions.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

drop policy if exists os_modify on public.organization_subscriptions;
create policy os_modify on public.organization_subscriptions
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = organization_subscriptions.organization_id
        and ur.role = 'developer_admin'
    )
  )
  with check (public.is_super_admin() or organization_id in (select public.user_organization_ids()));

-- ─── organization_feature_overrides ──────────────────────────────────────

drop policy if exists ofo_select on public.organization_feature_overrides;
create policy ofo_select on public.organization_feature_overrides
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = organization_feature_overrides.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

drop policy if exists ofo_modify on public.organization_feature_overrides;
create policy ofo_modify on public.organization_feature_overrides
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── organization_branding ───────────────────────────────────────────────

drop policy if exists ob_select on public.organization_branding;
create policy ob_select on public.organization_branding
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = organization_branding.organization_id
    )
    or exists (
      select 1 from public.residents r
      where r.organization_id = organization_branding.organization_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists ob_modify on public.organization_branding;
create policy ob_modify on public.organization_branding
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = organization_branding.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── organization_domains ────────────────────────────────────────────────
-- Public can SELECT (needed for host → org resolution by anon middleware), but
-- only super_admin or org admins can modify.

drop policy if exists od_select_public on public.organization_domains;
create policy od_select_public on public.organization_domains
  for select to anon, authenticated using (true);

drop policy if exists od_modify on public.organization_domains;
create policy od_modify on public.organization_domains
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = organization_domains.organization_id
        and ur.role = 'developer_admin'
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── organization_settings ───────────────────────────────────────────────

drop policy if exists oset_select on public.organization_settings;
create policy oset_select on public.organization_settings
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = organization_settings.organization_id
    )
    or exists (
      select 1 from public.residents r
      where r.organization_id = organization_settings.organization_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists oset_modify on public.organization_settings;
create policy oset_modify on public.organization_settings
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = organization_settings.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── saas_invoices ───────────────────────────────────────────────────────

drop policy if exists sai_select on public.saas_invoices;
create policy sai_select on public.saas_invoices
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = saas_invoices.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  );

drop policy if exists sai_modify on public.saas_invoices;
create policy sai_modify on public.saas_invoices
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── usage_events + usage_aggregates ─────────────────────────────────────

drop policy if exists ue_select on public.usage_events;
create policy ue_select on public.usage_events
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = usage_events.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

drop policy if exists ue_insert on public.usage_events;
create policy ue_insert on public.usage_events
  for insert to authenticated with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

drop policy if exists ua_select on public.usage_aggregates;
create policy ua_select on public.usage_aggregates
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = usage_aggregates.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );
