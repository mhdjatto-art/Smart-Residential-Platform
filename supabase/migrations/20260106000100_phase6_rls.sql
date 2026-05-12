-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 6: RLS policies for the marketplace
-- ─────────────────────────────────────────────────────────────────────────────
-- Pattern: org_id is the hard fence. Residents see only their own orders/reviews
-- via residents.user_id = auth.uid(). Staff with management roles within the
-- organization can manage providers/categories/items/orders/payouts.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.service_providers          enable row level security;
alter table public.service_categories         enable row level security;
alter table public.service_items              enable row level security;
alter table public.marketplace_orders         enable row level security;
alter table public.marketplace_order_items    enable row level security;
alter table public.commissions                enable row level security;
alter table public.provider_reviews           enable row level security;
alter table public.provider_payouts           enable row level security;

alter table public.service_providers          force row level security;
alter table public.service_categories         force row level security;
alter table public.service_items              force row level security;
alter table public.marketplace_orders         force row level security;
alter table public.marketplace_order_items    force row level security;
alter table public.commissions                force row level security;
alter table public.provider_reviews           force row level security;
alter table public.provider_payouts           force row level security;

-- ─── service_providers ────────────────────────────────────────────────────
-- Everyone in the org (including residents) can browse providers.
-- Only management roles can create/update.

create policy sp_select on public.service_providers
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.organization_id = service_providers.organization_id
        and r.user_id = auth.uid()
    )
  );

create policy sp_modify on public.service_providers
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(service_providers.organization_id, service_providers.compound_id)
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── service_categories ──────────────────────────────────────────────────

create policy sc_select on public.service_categories
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.organization_id = service_categories.organization_id
        and r.user_id = auth.uid()
    )
  );

create policy sc_modify on public.service_categories
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = service_categories.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── service_items ───────────────────────────────────────────────────────

create policy si_select on public.service_items
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.organization_id = service_items.organization_id
        and r.user_id = auth.uid()
    )
  );

create policy si_modify on public.service_items
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = service_items.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── marketplace_orders ──────────────────────────────────────────────────
-- Residents can SELECT/INSERT their own orders.
-- Management can SELECT/UPDATE all org orders.

create policy mo_select on public.marketplace_orders
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (
      select 1 from public.residents r
      where r.id = marketplace_orders.resident_id
        and r.user_id = auth.uid()
    )
  );

create policy mo_insert on public.marketplace_orders
  for insert to authenticated with check (
    public.is_super_admin()
    or public.user_has_management_role(marketplace_orders.organization_id, marketplace_orders.compound_id)
    or exists (
      select 1 from public.residents r
      where r.id = marketplace_orders.resident_id
        and r.user_id = auth.uid()
        and r.organization_id = marketplace_orders.organization_id
    )
  );

create policy mo_update on public.marketplace_orders
  for update to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(marketplace_orders.organization_id, marketplace_orders.compound_id)
    or (
      -- residents can cancel their own pending order
      exists (
        select 1 from public.residents r
        where r.id = marketplace_orders.resident_id
          and r.user_id = auth.uid()
      )
      and marketplace_orders.order_status in ('pending')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

create policy mo_delete on public.marketplace_orders
  for delete to authenticated using (
    public.is_super_admin()
    or public.user_has_management_role(marketplace_orders.organization_id, marketplace_orders.compound_id)
  );

-- ─── marketplace_order_items ─────────────────────────────────────────────

create policy moi_select on public.marketplace_order_items
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.marketplace_orders o
      join public.residents r on r.id = o.resident_id
      where o.id = marketplace_order_items.order_id
        and r.user_id = auth.uid()
    )
  );

create policy moi_modify on public.marketplace_order_items
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.marketplace_orders o
      where o.id = marketplace_order_items.order_id
        and public.user_has_management_role(o.organization_id, o.compound_id)
    )
    or exists (
      -- resident managing own pending order
      select 1 from public.marketplace_orders o
      join public.residents r on r.id = o.resident_id
      where o.id = marketplace_order_items.order_id
        and r.user_id = auth.uid()
        and o.order_status = 'pending'
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── commissions ─────────────────────────────────────────────────────────
-- Sensitive: only staff/admins can read commission rows.

create policy cm_select on public.commissions
  for select to authenticated using (
    public.is_super_admin()
    or public.user_has_management_role(commissions.organization_id, null)
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = commissions.organization_id
        and ur.role in ('developer_admin','finance_officer','compound_manager')
    )
  );

create policy cm_modify on public.commissions
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = commissions.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

-- ─── provider_reviews ────────────────────────────────────────────────────
-- Residents can post/update reviews. Anyone in the org can read non-hidden ones.

create policy rev_select on public.provider_reviews
  for select to authenticated using (
    public.is_super_admin()
    or (
      organization_id in (select public.user_organization_ids())
      and not is_hidden
    )
    or exists (
      select 1 from public.residents r
      where r.id = provider_reviews.resident_id
        and r.user_id = auth.uid()
    )
  );

create policy rev_insert on public.provider_reviews
  for insert to authenticated with check (
    public.is_super_admin()
    or exists (
      select 1 from public.residents r
      where r.id = provider_reviews.resident_id
        and r.user_id = auth.uid()
        and r.organization_id = provider_reviews.organization_id
    )
  );

create policy rev_update on public.provider_reviews
  for update to authenticated using (
    public.is_super_admin()
    or public.user_has_management_role(provider_reviews.organization_id, null)
    or exists (
      select 1 from public.residents r
      where r.id = provider_reviews.resident_id
        and r.user_id = auth.uid()
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());

create policy rev_delete on public.provider_reviews
  for delete to authenticated using (
    public.is_super_admin()
    or public.user_has_management_role(provider_reviews.organization_id, null)
    or exists (
      select 1 from public.residents r
      where r.id = provider_reviews.resident_id
        and r.user_id = auth.uid()
    )
  );

-- ─── provider_payouts ────────────────────────────────────────────────────
-- Finance-only.

create policy pp_select on public.provider_payouts
  for select to authenticated using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = provider_payouts.organization_id
        and ur.role in ('developer_admin','finance_officer','compound_manager')
    )
  );

create policy pp_modify on public.provider_payouts
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = provider_payouts.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  )
  with check (organization_id in (select public.user_organization_ids()) or public.is_super_admin());
