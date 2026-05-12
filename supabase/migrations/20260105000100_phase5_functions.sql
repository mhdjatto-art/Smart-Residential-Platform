-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 5: Utility billing engine + suspension engine
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── generate_recurring_utility_bills ──────────────────────────────────────
-- Scans active subscriptions where next_billing_date <= p_billing_date and
-- issues a utility_bill for each. Idempotent per (subscription, period).

create or replace function public.generate_recurring_utility_bills(p_billing_date date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub          record;
  v_period_end   date;
  v_due_date     date;
  v_count        int := 0;
  v_interval     interval;
begin
  for v_sub in
    select * from public.utility_subscriptions
    where status = 'active'
      and (next_billing_date is null or next_billing_date <= p_billing_date)
      and start_date <= p_billing_date
      and (end_date is null or end_date >= p_billing_date)
  loop
    case v_sub.billing_cycle
      when 'monthly'   then v_interval := interval '1 month';
      when 'quarterly' then v_interval := interval '3 months';
      when 'biannual'  then v_interval := interval '6 months';
      when 'annual'    then v_interval := interval '1 year';
      when 'one_time'  then v_interval := interval '0';
      else continue;
    end case;

    v_period_end := (p_billing_date + v_interval - interval '1 day')::date;
    v_due_date   := p_billing_date + interval '14 days';

    -- Idempotency: skip if a bill exists for this subscription + period
    if exists (
      select 1 from public.utility_bills
      where subscription_id = v_sub.id
        and billing_period_start = p_billing_date
    ) then
      continue;
    end if;

    insert into public.utility_bills (
      organization_id, compound_id, unit_id, resident_id, subscription_id, provider_id,
      bill_number, utility_type,
      billing_period_start, billing_period_end, due_date,
      subtotal, total_amount, currency,
      status, created_by
    ) values (
      v_sub.organization_id, v_sub.compound_id, v_sub.unit_id, v_sub.resident_id,
      v_sub.id, v_sub.provider_id,
      '', v_sub.subscription_type,
      p_billing_date, v_period_end, v_due_date::date,
      v_sub.monthly_fee, v_sub.monthly_fee, v_sub.currency,
      'issued', v_sub.created_by
    );

    -- Move subscription's next billing forward
    update public.utility_subscriptions
    set last_billed_at = p_billing_date,
        next_billing_date = case
          when v_sub.billing_cycle = 'one_time' then null
          else (p_billing_date + v_interval)::date
        end
    where id = v_sub.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.generate_recurring_utility_bills(date) from public;
grant execute on function public.generate_recurring_utility_bills(date) to authenticated;

-- ─── generate_electricity_bill_for_reading ─────────────────────────────────
-- Given a meter_reading id, look up the current tariff and create a metered
-- utility_bill. Uses tier_brackets if billing_method = 'tiered'.

create or replace function public.generate_electricity_bill_for_reading(p_reading_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reading    record;
  v_meter      record;
  v_provider   record;
  v_tariff     record;
  v_subtotal   numeric(12,2) := 0;
  v_bill_id    uuid;
  v_remaining  numeric(12,2);
  v_bracket    jsonb;
  v_up_to      numeric;
  v_rate       numeric;
  v_consumed   numeric(12,2);
begin
  select * into v_reading from public.meter_readings where id = p_reading_id;
  if v_reading is null then raise exception 'Reading not found'; end if;

  select * into v_meter from public.electricity_meters where id = v_reading.meter_id;
  if v_meter is null then raise exception 'Meter not found'; end if;
  if v_meter.unit_id is null then raise exception 'Meter is not linked to a unit'; end if;

  -- Find the active tariff for the organization (tied to first active electricity provider).
  select t.* into v_tariff
  from public.electricity_tariffs t
  join public.utility_providers p on p.id = t.provider_id
  where t.organization_id = v_meter.organization_id
    and p.provider_type = 'electricity'
    and p.provider_status = 'active'
    and t.effective_from <= current_date
    and (t.effective_to is null or t.effective_to >= current_date)
  order by t.effective_from desc
  limit 1;

  if v_tariff is null then raise exception 'No active electricity tariff configured'; end if;

  select * into v_provider from public.utility_providers where id = v_tariff.provider_id;

  v_consumed := v_reading.consumption;
  if v_consumed < 0 then raise exception 'Consumption cannot be negative'; end if;

  -- Calculate subtotal: tiered if billing_method = 'tiered', else flat
  if v_provider.billing_method = 'tiered' and jsonb_array_length(v_tariff.tier_brackets) > 0 then
    v_remaining := v_consumed;
    for v_bracket in select * from jsonb_array_elements(v_tariff.tier_brackets)
    loop
      v_up_to := nullif((v_bracket ->> 'up_to'), '')::numeric;
      v_rate  := (v_bracket ->> 'rate')::numeric;
      if v_up_to is null then
        v_subtotal := v_subtotal + v_remaining * v_rate;
        v_remaining := 0;
      elsif v_remaining > v_up_to then
        v_subtotal := v_subtotal + v_up_to * v_rate;
        v_remaining := v_remaining - v_up_to;
      else
        v_subtotal := v_subtotal + v_remaining * v_rate;
        v_remaining := 0;
        exit;
      end if;
    end loop;
  else
    v_subtotal := v_consumed * v_tariff.rate_per_unit;
  end if;

  v_subtotal := round(v_subtotal + v_tariff.service_fee, 2);

  insert into public.utility_bills (
    organization_id, compound_id, unit_id, provider_id, meter_id,
    bill_number, utility_type,
    billing_period_start, billing_period_end, due_date,
    previous_reading, current_reading, consumption, rate_per_unit,
    subtotal, total_amount, currency, status
  ) values (
    v_meter.organization_id, v_meter.compound_id, v_meter.unit_id, v_tariff.provider_id, v_meter.id,
    '', 'electricity',
    (current_date - interval '1 month')::date, current_date, (current_date + interval '14 days')::date,
    v_reading.previous_reading, v_reading.reading_value, v_consumed, v_tariff.rate_per_unit,
    v_subtotal, v_subtotal, v_tariff.currency, 'issued'
  ) returning id into v_bill_id;

  -- Update meter's stored current_reading
  update public.electricity_meters set current_reading = v_reading.reading_value where id = v_meter.id;

  return v_bill_id;
end;
$$;

revoke all on function public.generate_electricity_bill_for_reading(uuid) from public;
grant execute on function public.generate_electricity_bill_for_reading(uuid) to authenticated;

-- ─── suspend_subscription / release_suspension ─────────────────────────────

create or replace function public.suspend_subscription(
  p_subscription_id uuid,
  p_reason          public.suspension_reason,
  p_notes           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub        record;
  v_susp_id    uuid;
begin
  select * into v_sub from public.utility_subscriptions where id = p_subscription_id;
  if v_sub is null then raise exception 'Subscription not found'; end if;
  if v_sub.status = 'suspended' then raise exception 'Already suspended'; end if;

  insert into public.service_suspensions (
    organization_id, compound_id, subscription_id, unit_id, resident_id,
    utility_type, reason, reason_notes, initiated_by
  ) values (
    v_sub.organization_id, v_sub.compound_id, p_subscription_id, v_sub.unit_id, v_sub.resident_id,
    v_sub.subscription_type, p_reason, p_notes, auth.uid()
  ) returning id into v_susp_id;

  update public.utility_subscriptions set status = 'suspended' where id = p_subscription_id;

  return v_susp_id;
end;
$$;

create or replace function public.release_suspension(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_suspensions
  set status = 'released', released_at = now()
  where subscription_id = p_subscription_id and status = 'active';

  update public.utility_subscriptions
  set status = 'active'
  where id = p_subscription_id and status = 'suspended';
end;
$$;

revoke all on function public.suspend_subscription(uuid, public.suspension_reason, text) from public;
revoke all on function public.release_suspension(uuid) from public;
grant execute on function public.suspend_subscription(uuid, public.suspension_reason, text) to authenticated;
grant execute on function public.release_suspension(uuid) to authenticated;

-- ─── auto_suspend_overdue_utilities ────────────────────────────────────────
-- Scan utility_bills overdue beyond grace_days and suspend the subscription
-- IF its auto_suspend flag is true. Idempotent.

create or replace function public.auto_suspend_overdue_utilities(p_grace_days int default 7)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill record;
  v_count int := 0;
begin
  for v_bill in
    select b.subscription_id
    from public.utility_bills b
    join public.utility_subscriptions s on s.id = b.subscription_id
    where b.status in ('issued','partial','overdue')
      and (b.total_amount - b.paid_amount) > 0
      and b.due_date < current_date - (p_grace_days || ' days')::interval
      and s.status = 'active'
      and s.auto_suspend = true
    group by b.subscription_id
  loop
    perform public.suspend_subscription(v_bill.subscription_id, 'overdue', format('Auto-suspended after %s day grace period', p_grace_days));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.auto_suspend_overdue_utilities(int) from public;
grant execute on function public.auto_suspend_overdue_utilities(int) to authenticated;
