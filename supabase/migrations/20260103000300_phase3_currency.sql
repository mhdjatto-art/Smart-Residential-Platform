-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 3.1: Multi-currency support
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds currency to organizations (the default) and to installment_contracts
-- (per-contract override). Supported currencies for Phase 3: USD, IQD.
--
-- IQD is integer-based in practice (no decimals), but we keep numeric(14,2)
-- everywhere — display logic in the app strips decimals for IQD.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add currency to organizations (default = USD).
alter table public.organizations
  add column if not exists currency text not null default 'USD'
  check (currency in ('USD','IQD','EUR','GBP','SAR','AED','EGP','JOD','KWD','QAR','BHD','OMR','TRY'));

-- Add currency override to installment_contracts (null = inherit org).
alter table public.installment_contracts
  add column if not exists currency text
  check (currency is null or currency in ('USD','IQD','EUR','GBP','SAR','AED','EGP','JOD','KWD','QAR','BHD','OMR','TRY'));

-- Add currency override to payments so we can display the actual currency
-- collected even if a contract's currency changes later.
alter table public.payments
  add column if not exists currency text
  check (currency is null or currency in ('USD','IQD','EUR','GBP','SAR','AED','EGP','JOD','KWD','QAR','BHD','OMR','TRY'));

-- Helper: resolve a contract's effective currency (override → org).
create or replace function public.contract_currency(p_contract_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(c.currency, o.currency, 'USD')
  from public.installment_contracts c
  join public.organizations o on o.id = c.organization_id
  where c.id = p_contract_id
$$;

grant execute on function public.contract_currency(uuid) to authenticated;

-- Patch record_payment to stamp the currency from the contract at payment time.
-- (Old payments without currency continue to be displayed via fallback.)
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
  v_receipt_no     text;
  v_currency       text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be > 0';
  end if;

  select * into v_contract from public.installment_contracts where id = p_contract_id;
  if v_contract is null then raise exception 'Contract not found'; end if;
  if v_contract.contract_status not in ('active','completed') then
    raise exception 'Cannot accept payment: contract is %', v_contract.contract_status;
  end if;

  v_currency := public.contract_currency(p_contract_id);
  v_reference := 'PMT-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.payments (
    organization_id, compound_id, contract_id, resident_id,
    payment_reference, payment_date, payment_method, payment_amount,
    payment_status, currency, notes, external_reference, created_by, updated_by
  ) values (
    v_contract.organization_id, v_contract.compound_id, p_contract_id, v_contract.resident_id,
    v_reference, p_payment_date, p_payment_method, p_amount,
    'confirmed', v_currency, p_notes, p_external_ref, auth.uid(), auth.uid()
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

    v_penalty_due   := greatest(v_inst.penalty_amount - greatest(v_inst.paid_amount - (v_inst.interest_amount + v_inst.principal_amount), 0), 0);
    v_interest_due  := greatest(v_inst.interest_amount - greatest(v_inst.paid_amount - v_inst.principal_amount, 0), 0);
    v_principal_due := greatest(v_inst.principal_amount - v_inst.paid_amount, 0);

    if v_penalty_due > 0 and v_remaining > 0 then
      v_apply := least(v_penalty_due, v_remaining);
      insert into public.payment_allocations (organization_id, payment_id, installment_id, amount, applied_to)
      values (v_contract.organization_id, v_payment_id, v_inst.id, v_apply, 'penalty');
      v_remaining := v_remaining - v_apply;
      update public.installment_schedules set paid_amount = paid_amount + v_apply where id = v_inst.id;
    end if;

    if v_interest_due > 0 and v_remaining > 0 then
      v_apply := least(v_interest_due, v_remaining);
      insert into public.payment_allocations (organization_id, payment_id, installment_id, amount, applied_to)
      values (v_contract.organization_id, v_payment_id, v_inst.id, v_apply, 'interest');
      v_remaining := v_remaining - v_apply;
      update public.installment_schedules set paid_amount = paid_amount + v_apply where id = v_inst.id;
    end if;

    if v_principal_due > 0 and v_remaining > 0 then
      v_apply := least(v_principal_due, v_remaining);
      insert into public.payment_allocations (organization_id, payment_id, installment_id, amount, applied_to)
      values (v_contract.organization_id, v_payment_id, v_inst.id, v_apply, 'principal');
      v_remaining := v_remaining - v_apply;
      update public.installment_schedules set paid_amount = paid_amount + v_apply where id = v_inst.id;
    end if;

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

  v_receipt_no := 'RCP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0');
  insert into public.receipts (organization_id, payment_id, receipt_number, issued_by)
  values (v_contract.organization_id, v_payment_id, v_receipt_no, auth.uid());

  insert into public.financial_transactions (
    organization_id, compound_id, actor_id, action_type, entity_type, entity_id, amount,
    new_values, reason
  ) values (
    v_contract.organization_id, v_contract.compound_id, auth.uid(),
    'payment_recorded', 'payment', v_payment_id, p_amount,
    jsonb_build_object('method', p_payment_method, 'reference', v_reference, 'receipt', v_receipt_no, 'currency', v_currency),
    'Payment recorded via record_payment()'
  );

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
