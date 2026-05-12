-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 3: RLS for financial tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Strict isolation. Residents see only THEIR data. Finance officers can
-- manage. Writes routed through SECURITY DEFINER functions are exempt — they
-- bypass RLS but enforce their own checks. Direct INSERT on payments by a
-- normal client should fail (use record_payment() instead).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.installment_contracts   enable row level security;
alter table public.installment_schedules   enable row level security;
alter table public.payments                enable row level security;
alter table public.payment_allocations     enable row level security;
alter table public.penalties               enable row level security;
alter table public.receipts                enable row level security;
alter table public.financial_transactions  enable row level security;
alter table public.payment_reminders       enable row level security;

alter table public.installment_contracts   force row level security;
alter table public.installment_schedules   force row level security;
alter table public.payments                force row level security;
alter table public.payment_allocations     force row level security;
alter table public.penalties               force row level security;
alter table public.receipts                force row level security;
alter table public.financial_transactions  force row level security;
alter table public.payment_reminders       force row level security;

-- ─── installment_contracts ─────────────────────────────────────────────────

create policy contracts_select on public.installment_contracts
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = installment_contracts.resident_id and r.user_id = auth.uid())
  );

create policy contracts_insert on public.installment_contracts
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = installment_contracts.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

create policy contracts_update on public.installment_contracts
  for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = installment_contracts.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- Hard delete prohibited — use cancellation via status update.
create policy contracts_no_delete on public.installment_contracts
  for delete to authenticated using (public.is_super_admin());

-- ─── installment_schedules ─────────────────────────────────────────────────

create policy schedules_select on public.installment_schedules
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (
      select 1 from public.installment_contracts c
      join public.residents r on r.id = c.resident_id
      where c.id = installment_schedules.contract_id and r.user_id = auth.uid()
    )
  );

-- Schedules are written only via generate_installment_schedule()
-- and updated only via record_payment() / reverse_payment() / penalty
-- functions (all SECURITY DEFINER). Direct writes blocked.
create policy schedules_no_direct_writes on public.installment_schedules
  for all to authenticated
  using (false)
  with check (false);

-- ─── payments ──────────────────────────────────────────────────────────────

create policy payments_select on public.payments
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (select 1 from public.residents r where r.id = payments.resident_id and r.user_id = auth.uid())
  );

-- All writes go through record_payment() / reverse_payment().
create policy payments_no_direct_writes on public.payments
  for all to authenticated
  using (false)
  with check (false);

-- ─── payment_allocations ───────────────────────────────────────────────────

create policy allocations_select on public.payment_allocations
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.payments p
      where p.id = payment_allocations.payment_id
        and exists (select 1 from public.residents r where r.id = p.resident_id and r.user_id = auth.uid())
    )
  );

create policy allocations_no_direct_writes on public.payment_allocations
  for all to authenticated
  using (false)
  with check (false);

-- ─── penalties ─────────────────────────────────────────────────────────────

create policy penalties_select on public.penalties
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or compound_id     in (select public.user_compound_ids())
    or exists (
      select 1 from public.installment_contracts c
      join public.residents r on r.id = c.resident_id
      where c.id = penalties.contract_id and r.user_id = auth.uid()
    )
  );

create policy penalties_no_direct_writes on public.penalties
  for all to authenticated
  using (false)
  with check (false);

-- ─── receipts ──────────────────────────────────────────────────────────────

create policy receipts_select on public.receipts
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.payments p
      where p.id = receipts.payment_id
        and exists (select 1 from public.residents r where r.id = p.resident_id and r.user_id = auth.uid())
    )
  );

create policy receipts_no_direct_writes on public.receipts
  for all to authenticated
  using (false)
  with check (false);

-- ─── financial_transactions ────────────────────────────────────────────────
-- Read-only to staff. Residents see entries that reference their own
-- payments/contracts. Functions write via SECURITY DEFINER + service_role.

create policy ft_select on public.financial_transactions
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── payment_reminders ─────────────────────────────────────────────────────

create policy reminders_select on public.payment_reminders
  for select to authenticated using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.residents r where r.id = payment_reminders.resident_id and r.user_id = auth.uid())
  );

create policy reminders_modify on public.payment_reminders
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = payment_reminders.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );
