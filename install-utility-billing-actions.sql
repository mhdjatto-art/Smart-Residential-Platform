-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — Utility bill payments + late penalties
-- ─────────────────────────────────────────────────────────────────────────────
-- Functions created:
--
--   public.record_utility_bill_payment(p_bill_id, p_amount, p_method, p_reference, p_notes)
--       Applies a payment to a utility_bill. Updates paid_amount, status
--       (paid / partial / issued), and stamps paid_at when fully settled.
--       Cannot pay more than (total_amount + penalty_amount).
--       Returns the bill_id.
--
--   public.apply_utility_bill_penalty(p_bill_id, p_rate, p_grace_days)
--       Applies a late-payment penalty to one bill if days-overdue > grace.
--       penalty_amount = total_amount * rate * weeks_overdue
--       Returns the new penalty_amount (or 0 if not applied).
--
--   public.apply_utility_bill_penalties_all(p_rate default 0.02, p_grace_days default 7)
--       Batch applies penalties to every issued/partial bill whose due_date
--       has passed. Returns JSONB summary.
--
-- Run as super_admin in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── record_utility_bill_payment ─────────────────────────────────────────

create or replace function public.record_utility_bill_payment(
  p_bill_id   uuid,
  p_amount    numeric,
  p_method    text default 'cash',
  p_reference text default null,
  p_notes     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill            record;
  v_new_paid        numeric;
  v_owed            numeric;
  v_new_status      public.utility_bill_status;
  v_paid_at         timestamptz;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be > 0 (got %)', p_amount;
  end if;

  select * into v_bill from public.utility_bills where id = p_bill_id;
  if v_bill is null then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if v_bill.status = 'cancelled' then
    raise exception 'Cannot pay a cancelled bill';
  end if;

  v_new_paid := v_bill.paid_amount + p_amount;
  v_owed     := v_bill.total_amount + coalesce(v_bill.penalty_amount, 0);

  if v_new_paid > v_owed + 0.01 then
    raise exception 'Payment exceeds amount owed. Bill owes %, attempted to pay % (already paid %)',
      v_owed - v_bill.paid_amount, p_amount, v_bill.paid_amount;
  end if;

  if v_new_paid >= v_owed - 0.01 then
    v_new_status := 'paid';
    v_paid_at    := now();
  elsif v_new_paid > 0 then
    v_new_status := 'partial';
    v_paid_at    := null;
  else
    v_new_status := v_bill.status;
    v_paid_at    := null;
  end if;

  update public.utility_bills
  set paid_amount = v_new_paid,
      status      = v_new_status,
      paid_at     = coalesce(v_paid_at, paid_at),
      notes       = coalesce(p_notes, notes),
      metadata    = metadata || jsonb_build_object(
        'last_payment', jsonb_build_object(
          'amount',    p_amount,
          'method',    p_method,
          'reference', p_reference,
          'at',        now()
        )
      ),
      updated_at  = now()
  where id = p_bill_id;

  return p_bill_id;
end;
$$;

revoke all on function public.record_utility_bill_payment(uuid, numeric, text, text, text) from public;
grant execute on function public.record_utility_bill_payment(uuid, numeric, text, text, text) to authenticated, service_role;

-- ─── apply_utility_bill_penalty (per bill) ───────────────────────────────

create or replace function public.apply_utility_bill_penalty(
  p_bill_id     uuid,
  p_rate        numeric default 0.02,    -- 2% per week overdue
  p_grace_days  integer default 7
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill         record;
  v_days_overdue int;
  v_weeks        numeric;
  v_penalty      numeric;
begin
  select * into v_bill from public.utility_bills where id = p_bill_id;
  if v_bill is null then return 0; end if;
  if v_bill.status not in ('issued','partial','overdue') then return v_bill.penalty_amount; end if;

  v_days_overdue := greatest(0, (current_date - v_bill.due_date));
  if v_days_overdue <= p_grace_days then return 0; end if;

  v_weeks   := ceil((v_days_overdue - p_grace_days)::numeric / 7);
  v_penalty := round(v_bill.total_amount * p_rate * v_weeks, 2);

  update public.utility_bills
  set penalty_amount = v_penalty,
      status         = case when v_bill.status = 'partial' then 'partial' else 'overdue' end,
      updated_at     = now()
  where id = p_bill_id;

  return v_penalty;
end;
$$;

revoke all on function public.apply_utility_bill_penalty(uuid, numeric, integer) from public;
grant execute on function public.apply_utility_bill_penalty(uuid, numeric, integer) to authenticated, service_role;

-- ─── apply_utility_bill_penalties_all (batch) ────────────────────────────

create or replace function public.apply_utility_bill_penalties_all(
  p_rate       numeric default 0.02,
  p_grace_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count    int := 0;
  v_total    numeric := 0;
  v_details  jsonb := '[]'::jsonb;
  r          record;
  v_pen      numeric;
begin
  for r in
    select id, bill_number, total_amount, penalty_amount, due_date, status
    from public.utility_bills
    where status in ('issued','partial','overdue')
      and due_date < current_date - (p_grace_days || ' days')::interval
  loop
    v_pen := public.apply_utility_bill_penalty(r.id, p_rate, p_grace_days);
    if v_pen > 0 and v_pen <> coalesce(r.penalty_amount, 0) then
      v_count := v_count + 1;
      v_total := v_total + v_pen;
      v_details := v_details || jsonb_build_object(
        'bill_id',     r.id,
        'bill_number', r.bill_number,
        'days_overdue', current_date - r.due_date,
        'penalty',     v_pen
      );
    end if;
  end loop;

  return jsonb_build_object(
    'applied',       v_count,
    'total_penalty', v_total,
    'rate',          p_rate,
    'grace_days',    p_grace_days,
    'details',       v_details
  );
end;
$$;

revoke all on function public.apply_utility_bill_penalties_all(numeric, integer) from public;
grant execute on function public.apply_utility_bill_penalties_all(numeric, integer) to authenticated, service_role;

-- ─── Quick test ───────────────────────────────────────────────────────────
-- select public.apply_utility_bill_penalties_all(0.02, 7);
