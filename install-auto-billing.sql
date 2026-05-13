-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — Auto-billing engine for utility subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates two functions:
--
--   public.generate_due_utility_bills(p_dry_run boolean default false)
--       Finds every active subscription whose next_billing_date <= current_date,
--       generates a utility_bills row with the appropriate fee + tax,
--       advances next_billing_date by one billing cycle, and stamps last_billed_at.
--
--       Returns a JSONB summary { generated, skipped, errors, details[] }.
--       Idempotent within the same day for the same subscription.
--
--   public.advance_billing_date(p_date date, p_cycle text)
--       Helper that takes a date + cycle ('monthly'|'quarterly'|'biannual'|'annual'|'one_time')
--       and returns the next billing date. one_time returns NULL.
--
-- Run as super_admin in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── advance_billing_date ─────────────────────────────────────────────────

create or replace function public.advance_billing_date(p_date date, p_cycle text)
returns date
language sql
immutable
as $$
  select case p_cycle
    when 'monthly'   then p_date + interval '1 month'
    when 'quarterly' then p_date + interval '3 months'
    when 'biannual'  then p_date + interval '6 months'
    when 'annual'    then p_date + interval '1 year'
    when 'one_time'  then null
    else p_date + interval '1 month'
  end::date;
$$;

revoke all on function public.advance_billing_date(date, text) from public;
grant execute on function public.advance_billing_date(date, text) to authenticated, service_role;

-- ─── generate_due_utility_bills ──────────────────────────────────────────

create or replace function public.generate_due_utility_bills(p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today           date := current_date;
  v_generated       int := 0;
  v_skipped         int := 0;
  v_errors          int := 0;
  v_details         jsonb := '[]'::jsonb;
  r                 record;
  v_bill_id         uuid;
  v_bill_number     text;
  v_period_start    date;
  v_period_end      date;
  v_due_date        date;
  v_next_date       date;
  v_tax_rate        numeric := 0.05;  -- 5% default; override via provider metadata if needed
  v_subtotal        numeric;
  v_tax_amount      numeric;
  v_total           numeric;
begin
  for r in
    select
      s.id              as sub_id,
      s.organization_id,
      s.compound_id,
      s.unit_id,
      s.resident_id,
      s.provider_id,
      s.subscription_type,
      s.billing_cycle,
      s.monthly_fee,
      s.currency,
      s.next_billing_date,
      p.provider_name
    from public.utility_subscriptions s
    join public.utility_providers p on p.id = s.provider_id
    where s.status = 'active'
      and s.next_billing_date is not null
      and s.next_billing_date <= v_today
    order by s.next_billing_date
  loop
    begin
      -- Skip if we already generated a bill for THIS period (idempotency)
      v_period_start := r.next_billing_date;
      v_period_end   := public.advance_billing_date(r.next_billing_date, r.billing_cycle) - interval '1 day';
      v_due_date     := v_period_start + interval '14 days';

      if exists (
        select 1 from public.utility_bills b
        where b.unit_id = r.unit_id
          and b.utility_type = r.subscription_type::public.utility_type
          and b.billing_period_start = v_period_start
      ) then
        v_skipped := v_skipped + 1;
        v_details := v_details || jsonb_build_object(
          'sub_id', r.sub_id, 'outcome', 'skipped_duplicate', 'period_start', v_period_start
        );
        -- Still advance the date so we don't keep retrying this period
        v_next_date := public.advance_billing_date(r.next_billing_date, r.billing_cycle);
        if not p_dry_run then
          update public.utility_subscriptions
          set next_billing_date = v_next_date,
              last_billed_at    = v_today,
              updated_at        = now()
          where id = r.sub_id;
        end if;
        continue;
      end if;

      v_subtotal   := r.monthly_fee;
      v_tax_amount := round(v_subtotal * v_tax_rate, 2);
      v_total      := v_subtotal + v_tax_amount;

      v_bill_number := 'AUTO-' || to_char(v_today, 'YYYYMM') || '-' || lpad(nextval('utility_bill_seq')::text, 6, '0');

      if not p_dry_run then
        insert into public.utility_bills (
          organization_id, compound_id, unit_id, resident_id,
          subscription_id, provider_id,
          bill_number, utility_type,
          billing_period_start, billing_period_end, due_date,
          subtotal, tax_amount, paid_amount, total_amount,
          currency, status
        ) values (
          r.organization_id, r.compound_id, r.unit_id, r.resident_id,
          r.sub_id, r.provider_id,
          v_bill_number,
          r.subscription_type::public.utility_type,
          v_period_start, v_period_end, v_due_date,
          v_subtotal, v_tax_amount, 0, v_total,
          r.currency, 'issued'
        )
        returning id into v_bill_id;

        v_next_date := public.advance_billing_date(r.next_billing_date, r.billing_cycle);
        update public.utility_subscriptions
        set next_billing_date = v_next_date,
            last_billed_at    = v_today,
            updated_at        = now()
        where id = r.sub_id;
      end if;

      v_generated := v_generated + 1;
      v_details := v_details || jsonb_build_object(
        'sub_id',       r.sub_id,
        'provider',     r.provider_name,
        'bill_id',      v_bill_id,
        'bill_number',  v_bill_number,
        'period_start', v_period_start,
        'period_end',   v_period_end,
        'total',        v_total,
        'currency',     r.currency,
        'outcome',      'generated'
      );

    exception when others then
      v_errors := v_errors + 1;
      v_details := v_details || jsonb_build_object(
        'sub_id', r.sub_id, 'outcome', 'error', 'message', sqlerrm
      );
    end;
  end loop;

  return jsonb_build_object(
    'date',      v_today,
    'dry_run',   p_dry_run,
    'generated', v_generated,
    'skipped',   v_skipped,
    'errors',    v_errors,
    'details',   v_details
  );
end;
$$;

-- Create sequence used by the function (if missing)
create sequence if not exists public.utility_bill_seq increment by 1 start with 1;

revoke all on function public.generate_due_utility_bills(boolean) from public;
grant execute on function public.generate_due_utility_bills(boolean) to authenticated, service_role;

-- ─── Quick test (dry run) ─────────────────────────────────────────────────
-- select public.generate_due_utility_bills(true);
