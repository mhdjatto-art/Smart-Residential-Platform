-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 3: Financial engine functions
-- ─────────────────────────────────────────────────────────────────────────────
-- All financial mutations go through these SECURITY DEFINER functions so the
-- business rules live in ONE place. The functions are responsible for:
--   - atomic insertion across multiple tables
--   - allocation order (penalty → interest → principal)
--   - FIFO across installments
--   - writing financial_transactions audit rows
--   - preventing destructive operations on confirmed records
-- ─────────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- generate_installment_schedule
-- ───────────────────────────────────────────────────────────────────────────
-- Generates the full payment schedule for a contract. Only allowed while the
-- contract is still in 'draft' status — once activated, the schedule is
-- frozen. Uses standard amortization formula when interest > 0, equal
-- principal split otherwise.

create or replace function public.generate_installment_schedule(p_contract_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract           record;
  v_periods_per_year   int;
  v_period_interval    interval;
  v_period_rate        numeric;
  v_n                  int;
  v_balance            numeric;
  v_monthly            numeric;
  v_i                  int;
  v_principal          numeric;
  v_interest           numeric;
  v_due                date;
  v_inserted           int := 0;
begin
  select * into v_contract from public.installment_contracts where id = p_contract_id;
  if v_contract is null then raise exception 'Contract % not found', p_contract_id; end if;
  if v_contract.contract_status <> 'draft' then
    raise exception 'Cannot generate schedule: contract status is %', v_contract.contract_status;
  end if;
  if v_contract.installment_count <= 0 then
    raise exception 'installment_count must be > 0';
  end if;

  -- Wipe any prior draft schedule so the user can edit & regenerate.
  delete from public.installment_schedules where contract_id = p_contract_id;

  case v_contract.installment_frequency
    when 'monthly'   then v_periods_per_year := 12; v_period_interval := interval '1 month';
    when 'quarterly' then v_periods_per_year := 4;  v_period_interval := interval '3 months';
    when 'biannual'  then v_periods_per_year := 2;  v_period_interval := interval '6 months';
    when 'annual'    then v_periods_per_year := 1;  v_period_interval := interval '1 year';
  end case;

  v_period_rate := (v_contract.annual_interest_rate / 100.0) / v_periods_per_year;
  v_n           := v_contract.installment_count;
  v_balance     := v_contract.financed_amount;

  if v_period_rate = 0 then
    v_monthly := v_balance / v_n;
  else
    -- Standard amortization (PMT)
    v_monthly := v_balance * v_period_rate * power(1 + v_period_rate, v_n)
                 / (power(1 + v_period_rate, v_n) - 1);
  end if;

  for v_i in 1..v_n loop
    if v_period_rate = 0 then
      v_principal := v_balance / (v_n - v_i + 1);
      v_interest  := 0;
    else
      v_interest  := v_balance * v_period_rate;
      v_principal := v_monthly - v_interest;
    end if;

    v_due := (v_contract.contract_start_date + v_i * v_period_interval)::date;

    insert into public.installment_schedules (
      organization_id, compound_id, contract_id,
      installment_number, due_date,
      principal_amount, interest_amount, total_due,
      paid_amount, penalty_amount, status
    ) values (
      v_contract.organization_id, v_contract.compound_id, p_contract_id,
      v_i, v_due,
      round(v_principal, 2), round(v_interest, 2),
      round(v_principal + v_interest, 2),
      0, 0, 'pending'
    );

    v_balance  := v_balance - v_principal;
    v_inserted := v_inserted + 1;
  end loop;

  update public.installment_contracts
  set monthly_amount = round(v_monthly, 2),
      updated_at = now()
  where id = p_contract_id;

  insert into public.financial_transactions (
    organization_id, compound_id, actor_id, action_type, entity_type, entity_id, amount,
    new_values, reason
  ) values (
    v_contract.organization_id, v_contract.compound_id, auth.uid(),
    'schedule_generated', 'contract', p_contract_id, v_contract.financed_amount,
    jsonb_build_object('installments', v_inserted, 'monthly_amount', round(v_monthly, 2)),
    'Schedule generated'
  );

  return v_inserted;
end;
$$;

revoke all on function public.generate_installment_schedule(uuid) from public;
grant execute on function public.generate_installment_schedule(uuid) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- activate_contract — locks the schedule and moves status to active
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.activate_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_count int;
begin
  select * into v_contract from public.installment_contracts where id = p_contract_id;
  if v_contract is null then raise exception 'Contract not found'; end if;
  if v_contract.contract_status <> 'draft' then
    raise exception 'Only draft contracts can be activated (current: %)', v_contract.contract_status;
  end if;

  select count(*) into v_count from public.installment_schedules where contract_id = p_contract_id;
  if v_count = 0 then raise exception 'Cannot activate: no schedule generated'; end if;

  update public.installment_contracts
    set contract_status = 'active', updated_at = now(), updated_by = auth.uid()
    where id = p_contract_id;

  insert into public.financial_transactions (
    organization_id, compound_id, actor_id, action_type, entity_type, entity_id, reason
  ) values (
    v_contract.organization_id, v_contract.compound_id, auth.uid(),
    'contract_updated', 'contract', p_contract_id, 'Contract activated'
  );
end;
$$;

revoke all on function public.activate_contract(uuid) from public;
grant execute on function public.activate_contract(uuid) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- record_payment — the single source of truth for accepting money
-- ───────────────────────────────────────────────────────────────────────────
-- Allocation order:
--   1. Oldest installment first (FIFO by due_date, then installment_number)
--   2. Inside each installment: penalty → interest → principal
-- Stops when payment is fully allocated. If allocations would exceed
-- payment_amount the function rolls back.

create or replace function public.record_payment(
  p_contract_id     uuid,
  p_amount          numeric,
  p_payment_method  public.payment_method,
  p_payment_date    date default current_date,
  p_external_ref    text default null,
  p_notes           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract       record;
  v_payment_id     uuid;
  v_reference      text;
  v_remaining      numeric;
  v_inst           record;
  v_penalty_due    numeric;
  v_interest_due   numeric;
  v_principal_due  numeric;
  v_apply          numeric;
  v_total_alloc    numeric := 0;
  v_receipt_no     text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be > 0';
  end if;

  select * into v_contract from public.installment_contracts where id = p_contract_id;
  if v_contract is null then raise exception 'Contract not found'; end if;
  if v_contract.contract_status not in ('active','completed') then
    raise exception 'Cannot accept payment: contract is %', v_contract.contract_status;
  end if;

  v_reference := 'PMT-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.payments (
    organization_id, compound_id, contract_id, resident_id,
    payment_reference, payment_date, payment_method, payment_amount,
    payment_status, notes, external_reference, created_by, updated_by
  ) values (
    v_contract.organization_id, v_contract.compound_id, p_contract_id, v_contract.resident_id,
    v_reference, p_payment_date, p_payment_method, p_amount,
    'confirmed', p_notes, p_external_ref, auth.uid(), auth.uid()
  ) returning id into v_payment_id;

  v_remaining := p_amount;

  for v_inst in
    select id, total_due, penalty_amount, paid_amount, interest_amount, principal_amount
    from public.installment_schedules
    where contract_id = p_contract_id
      and status in ('pending','partial','overdue')
    order by due_date, installment_number
  loop
    exit when v_remaining <= 0;

    -- Order: penalty → interest → principal. We model paid_amount as a single
    -- counter against (total_due + penalty_amount), but record applied_to for
    -- audit-readable allocations.
    v_penalty_due   := greatest(v_inst.penalty_amount - greatest(v_inst.paid_amount - (v_inst.interest_amount + v_inst.principal_amount), 0), 0);
    v_interest_due  := greatest(v_inst.interest_amount - greatest(v_inst.paid_amount - v_inst.principal_amount, 0), 0);
    v_principal_due := greatest(v_inst.principal_amount - v_inst.paid_amount, 0);

    -- Apply against penalty
    if v_penalty_due > 0 and v_remaining > 0 then
      v_apply := least(v_penalty_due, v_remaining);
      insert into public.payment_allocations (organization_id, payment_id, installment_id, amount, applied_to)
      values (v_contract.organization_id, v_payment_id, v_inst.id, v_apply, 'penalty');
      v_remaining   := v_remaining - v_apply;
      v_total_alloc := v_total_alloc + v_apply;
      update public.installment_schedules set paid_amount = paid_amount + v_apply where id = v_inst.id;
    end if;

    -- Apply against interest
    if v_interest_due > 0 and v_remaining > 0 then
      v_apply := least(v_interest_due, v_remaining);
      insert into public.payment_allocations (organization_id, payment_id, installment_id, amount, applied_to)
      values (v_contract.organization_id, v_payment_id, v_inst.id, v_apply, 'interest');
      v_remaining   := v_remaining - v_apply;
      v_total_alloc := v_total_alloc + v_apply;
      update public.installment_schedules set paid_amount = paid_amount + v_apply where id = v_inst.id;
    end if;

    -- Apply against principal
    if v_principal_due > 0 and v_remaining > 0 then
      v_apply := least(v_principal_due, v_remaining);
      insert into public.payment_allocations (organization_id, payment_id, installment_id, amount, applied_to)
      values (v_contract.organization_id, v_payment_id, v_inst.id, v_apply, 'principal');
      v_remaining   := v_remaining - v_apply;
      v_total_alloc := v_total_alloc + v_apply;
      update public.installment_schedules set paid_amount = paid_amount + v_apply where id = v_inst.id;
    end if;

    -- Update installment status and paid_at if fully paid
    update public.installment_schedules
    set status = case
      when paid_amount >= (total_due + penalty_amount) then 'paid'::installment_status
      when paid_amount > 0 then 'partial'::installment_status
      else status
    end,
    paid_at = case
      when paid_amount >= (total_due + penalty_amount) and paid_at is null then now()
      else paid_at
    end
    where id = v_inst.id;
  end loop;

  if v_remaining > 0.01 then
    raise exception 'Overpayment: % unallocated after covering all outstanding balances', v_remaining;
  end if;

  -- Receipt
  v_receipt_no := 'RCP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0');
  insert into public.receipts (organization_id, payment_id, receipt_number, issued_by)
  values (v_contract.organization_id, v_payment_id, v_receipt_no, auth.uid());

  -- Audit
  insert into public.financial_transactions (
    organization_id, compound_id, actor_id, action_type, entity_type, entity_id, amount,
    new_values, reason
  ) values (
    v_contract.organization_id, v_contract.compound_id, auth.uid(),
    'payment_recorded', 'payment', v_payment_id, p_amount,
    jsonb_build_object('method', p_payment_method, 'reference', v_reference, 'receipt', v_receipt_no),
    'Payment recorded via record_payment()'
  );

  -- Mark contract completed if all installments paid
  if not exists (
    select 1 from public.installment_schedules
    where contract_id = p_contract_id and status not in ('paid','cancelled')
  ) then
    update public.installment_contracts set contract_status = 'completed' where id = p_contract_id;
  end if;

  return v_payment_id;
end;
$$;

revoke all on function public.record_payment(uuid, numeric, public.payment_method, date, text, text) from public;
grant execute on function public.record_payment(uuid, numeric, public.payment_method, date, text, text) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- reverse_payment — flags a payment as reversed and rolls back allocations
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.reverse_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_alloc   record;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment is null then raise exception 'Payment not found'; end if;
  if v_payment.payment_status = 'reversed' then raise exception 'Payment already reversed'; end if;

  -- Roll back the paid_amount on each installment this payment touched.
  for v_alloc in
    select installment_id, sum(amount) as total
    from public.payment_allocations
    where payment_id = p_payment_id
    group by installment_id
  loop
    update public.installment_schedules
    set paid_amount = greatest(paid_amount - v_alloc.total, 0),
        status = case
          when greatest(paid_amount - v_alloc.total, 0) = 0 then 'pending'::installment_status
          when greatest(paid_amount - v_alloc.total, 0) < (total_due + penalty_amount) then 'partial'::installment_status
          else status
        end,
        paid_at = case
          when greatest(paid_amount - v_alloc.total, 0) < (total_due + penalty_amount) then null
          else paid_at
        end
    where id = v_alloc.installment_id;
  end loop;

  update public.payments
  set payment_status = 'reversed',
      reversed_at = now(),
      reversed_by = auth.uid(),
      reversal_reason = p_reason,
      updated_at = now()
  where id = p_payment_id;

  -- If the contract was previously completed, reopen it.
  update public.installment_contracts c
  set contract_status = 'active'
  where c.id = v_payment.contract_id
    and c.contract_status = 'completed'
    and exists (
      select 1 from public.installment_schedules s
      where s.contract_id = c.id and s.status <> 'paid'
    );

  insert into public.financial_transactions (
    organization_id, compound_id, actor_id, action_type, entity_type, entity_id, amount,
    old_values, reason
  ) values (
    v_payment.organization_id, v_payment.compound_id, auth.uid(),
    'payment_reversed', 'payment', p_payment_id, v_payment.payment_amount,
    jsonb_build_object('was_status', 'confirmed'), p_reason
  );
end;
$$;

revoke all on function public.reverse_payment(uuid, text) from public;
grant execute on function public.reverse_payment(uuid, text) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- apply_penalties_for_contract — penalty calculator
-- ───────────────────────────────────────────────────────────────────────────
-- Idempotent per (installment, day). Run on demand or on schedule.

create or replace function public.apply_penalties_for_contract(p_contract_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract     record;
  v_inst         record;
  v_days_overdue int;
  v_penalty      numeric;
  v_count        int := 0;
begin
  select * into v_contract from public.installment_contracts where id = p_contract_id;
  if v_contract is null or v_contract.late_penalty_type is null then return 0; end if;
  if v_contract.contract_status <> 'active' then return 0; end if;

  for v_inst in
    select * from public.installment_schedules
    where contract_id = p_contract_id
      and status in ('pending','partial','overdue')
      and due_date < current_date
      and (total_due + penalty_amount - paid_amount) > 0
  loop
    v_days_overdue := (current_date - v_inst.due_date) - coalesce(v_contract.grace_period_days, 0);
    if v_days_overdue <= 0 then continue; end if;

    -- Skip if a penalty already exists for this installment today (idempotency)
    if exists (select 1 from public.penalties where installment_id = v_inst.id and penalty_date = current_date) then
      continue;
    end if;

    case v_contract.late_penalty_type
      when 'fixed'      then v_penalty := v_contract.late_penalty_value;
      when 'percentage' then v_penalty := v_inst.total_due * v_contract.late_penalty_value / 100.0;
      when 'daily'      then v_penalty := v_contract.late_penalty_value * v_days_overdue;
      when 'monthly'    then v_penalty := v_contract.late_penalty_value * ceil(v_days_overdue::numeric / 30);
    end case;

    v_penalty := round(coalesce(v_penalty, 0), 2);
    if v_penalty <= 0 then continue; end if;

    insert into public.penalties (
      organization_id, compound_id, contract_id, installment_id,
      penalty_date, penalty_type, penalty_value, amount, status, reason, created_by
    ) values (
      v_contract.organization_id, v_contract.compound_id, p_contract_id, v_inst.id,
      current_date, v_contract.late_penalty_type, v_contract.late_penalty_value,
      v_penalty, 'applied', format('Overdue %s day(s)', v_days_overdue), auth.uid()
    );

    update public.installment_schedules
    set penalty_amount = penalty_amount + v_penalty, status = 'overdue'
    where id = v_inst.id;

    insert into public.financial_transactions (
      organization_id, compound_id, actor_id, action_type, entity_type, entity_id, amount, reason
    ) values (
      v_contract.organization_id, v_contract.compound_id, auth.uid(),
      'penalty_applied', 'installment', v_inst.id, v_penalty,
      format('%s penalty applied (%s days overdue)', v_contract.late_penalty_type, v_days_overdue)
    );

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.apply_penalties_for_contract(uuid) from public;
grant execute on function public.apply_penalties_for_contract(uuid) to authenticated;

-- Batch wrapper: scan ALL active contracts in user's scope and apply.
create or replace function public.apply_penalties_all()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract_id uuid;
  v_total int := 0;
begin
  for v_contract_id in
    select id from public.installment_contracts where contract_status = 'active'
  loop
    v_total := v_total + public.apply_penalties_for_contract(v_contract_id);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.apply_penalties_all() from public;
grant execute on function public.apply_penalties_all() to authenticated;
