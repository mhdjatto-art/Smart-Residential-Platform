-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 8: Analytics + automation engine functions
-- ─────────────────────────────────────────────────────────────────────────────
-- Public-facing functions
--   refresh_daily_kpi(org_id, kpi_date)        — recompute one org's snapshot
--   refresh_all_daily_kpi(kpi_date)            — sweep across all orgs
--   compute_overdue_risk_for_org(org_id)       — heuristic ai_predictions rows
--   raise_system_alert(org_id, kind, ...)      — create dedup'd alert
--   enqueue_job(...)                           — generic job_queue insert
--   execute_due_automation_rules()             — cron-style entrypoint
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── refresh_daily_kpi ────────────────────────────────────────────────────

create or replace function public.refresh_daily_kpi(
  p_org_id uuid,
  p_kpi_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_compound_id uuid := null;
  v_currency text;
  v_active_residents int;
  v_total_units int;
  v_occupied_units int;
  v_outstanding numeric(14,2);
  v_collections_today numeric(14,2);
  v_collections_mtd numeric(14,2);
  v_overdue numeric(14,2);
  v_overdue_count int;
  v_util_count int;
  v_util_amount numeric(14,2);
  v_active_tickets int;
  v_sla_breached int;
  v_pending_visitors int;
  v_mp_open int;
  v_mp_revenue numeric(14,2);
  v_mp_commission numeric(14,2);
  v_satisfaction numeric(3,2);
begin
  select coalesce(currency, 'USD') into v_currency from public.organizations where id = p_org_id;

  -- org-wide row
  select count(*) into v_active_residents
  from public.residents where organization_id = p_org_id and resident_status = 'active';

  select count(*) into v_total_units    from public.units where organization_id = p_org_id;
  select count(distinct unit_id) into v_occupied_units
  from public.residents where organization_id = p_org_id and unit_id is not null;

  select coalesce(sum(greatest(0, s.total_due + coalesce(s.penalty_amount,0) - s.paid_amount)), 0)
    into v_outstanding
  from public.installment_schedules s
  join public.installment_contracts c on c.id = s.contract_id
  where c.organization_id = p_org_id and s.status <> 'paid';

  select coalesce(sum(payment_amount), 0) into v_collections_today
  from public.payments
  where organization_id = p_org_id and payment_status = 'confirmed'
    and payment_date = p_kpi_date;

  select coalesce(sum(payment_amount), 0) into v_collections_mtd
  from public.payments
  where organization_id = p_org_id and payment_status = 'confirmed'
    and payment_date >= date_trunc('month', p_kpi_date)
    and payment_date <= p_kpi_date;

  select coalesce(sum(greatest(0, s.total_due + coalesce(s.penalty_amount,0) - s.paid_amount)), 0),
         count(*) filter (where s.status in ('overdue','partial') and s.due_date < p_kpi_date)
    into v_overdue, v_overdue_count
  from public.installment_schedules s
  join public.installment_contracts c on c.id = s.contract_id
  where c.organization_id = p_org_id
    and s.status <> 'paid'
    and s.due_date < p_kpi_date;

  select count(*), coalesce(sum(greatest(0, total_amount - paid_amount)), 0)
    into v_util_count, v_util_amount
  from public.utility_bills
  where organization_id = p_org_id and bill_status <> 'paid';

  select count(*) into v_active_tickets
  from public.tickets where organization_id = p_org_id
    and status in ('open','assigned','in_progress','pending');

  select count(*) into v_sla_breached
  from public.tickets where organization_id = p_org_id
    and status not in ('resolved','closed')
    and sla_due_date is not null and sla_due_date < p_kpi_date;

  select count(*) into v_pending_visitors
  from public.visitors where organization_id = p_org_id and status = 'pending';

  select count(*) filter (where order_status in ('pending','confirmed','assigned','in_progress')),
         coalesce(sum(total_amount)     filter (where completed_at::date = p_kpi_date and order_status = 'completed'), 0),
         coalesce(sum(commission_amount) filter (where completed_at::date = p_kpi_date and order_status = 'completed'), 0)
    into v_mp_open, v_mp_revenue, v_mp_commission
  from public.marketplace_orders
  where organization_id = p_org_id;

  select coalesce(round(avg(rating_avg)::numeric, 2), 0)
    into v_satisfaction
  from public.service_providers
  where organization_id = p_org_id and rating_count > 0;

  insert into public.analytics_daily_kpi (
    organization_id, compound_id, kpi_date,
    active_residents, occupancy_rate, outstanding_balance, collections_today, collections_mtd,
    overdue_amount, overdue_count, utility_bills_unpaid, utility_amount_unpaid,
    active_tickets, sla_breached, pending_visitors,
    marketplace_orders_open, marketplace_revenue_today, marketplace_commission_today,
    satisfaction_avg, currency, computed_at
  )
  values (
    p_org_id, v_compound_id, p_kpi_date,
    v_active_residents,
    case when v_total_units > 0 then round((v_occupied_units::numeric / v_total_units) * 100, 2) else 0 end,
    v_outstanding, v_collections_today, v_collections_mtd,
    v_overdue, v_overdue_count, v_util_count, v_util_amount,
    v_active_tickets, v_sla_breached, v_pending_visitors,
    v_mp_open, v_mp_revenue, v_mp_commission,
    v_satisfaction, v_currency, now()
  )
  on conflict (organization_id, compound_id, kpi_date) do update set
    active_residents = excluded.active_residents,
    occupancy_rate = excluded.occupancy_rate,
    outstanding_balance = excluded.outstanding_balance,
    collections_today = excluded.collections_today,
    collections_mtd = excluded.collections_mtd,
    overdue_amount = excluded.overdue_amount,
    overdue_count = excluded.overdue_count,
    utility_bills_unpaid = excluded.utility_bills_unpaid,
    utility_amount_unpaid = excluded.utility_amount_unpaid,
    active_tickets = excluded.active_tickets,
    sla_breached = excluded.sla_breached,
    pending_visitors = excluded.pending_visitors,
    marketplace_orders_open = excluded.marketplace_orders_open,
    marketplace_revenue_today = excluded.marketplace_revenue_today,
    marketplace_commission_today = excluded.marketplace_commission_today,
    satisfaction_avg = excluded.satisfaction_avg,
    computed_at = excluded.computed_at;
end;
$$;

revoke all on function public.refresh_daily_kpi(uuid, date) from public;
grant execute on function public.refresh_daily_kpi(uuid, date) to authenticated;

-- ─── refresh_all_daily_kpi ────────────────────────────────────────────────

create or replace function public.refresh_all_daily_kpi(p_kpi_date date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org record;
  v_count int := 0;
begin
  for v_org in select id from public.organizations loop
    perform public.refresh_daily_kpi(v_org.id, p_kpi_date);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.refresh_all_daily_kpi(date) from public;
grant execute on function public.refresh_all_daily_kpi(date) to authenticated;

-- ─── raise_system_alert ───────────────────────────────────────────────────
-- Dedupes by (org_id, kind, entity_id) if an OPEN alert already exists.

create or replace function public.raise_system_alert(
  p_org_id     uuid,
  p_kind       text,
  p_severity   public.alert_severity,
  p_title      text,
  p_body       text default null,
  p_entity_table text default null,
  p_entity_id  uuid default null,
  p_metric     jsonb default '{}'::jsonb,
  p_compound_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_new_id uuid;
begin
  select id into v_existing
  from public.system_alerts
  where organization_id = p_org_id
    and kind = p_kind
    and status = 'open'
    and ((p_entity_id is null and entity_id is null) or entity_id = p_entity_id)
  limit 1;

  if v_existing is not null then
    update public.system_alerts
      set metric = p_metric,
          body   = coalesce(p_body, body)
      where id = v_existing;
    return v_existing;
  end if;

  insert into public.system_alerts (
    organization_id, compound_id, kind, severity, title, body,
    entity_table, entity_id, metric
  )
  values (p_org_id, p_compound_id, p_kind, p_severity, p_title, p_body, p_entity_table, p_entity_id, p_metric)
  returning id into v_new_id;
  return v_new_id;
end;
$$;

revoke all on function public.raise_system_alert(uuid,text,public.alert_severity,text,text,text,uuid,jsonb,uuid) from public;
grant execute on function public.raise_system_alert(uuid,text,public.alert_severity,text,text,text,uuid,jsonb,uuid) to authenticated;

-- ─── compute_overdue_risk_for_org ─────────────────────────────────────────
-- Heuristic predictor (model_version 'heuristic-v1'). For each resident:
--   risk = clamp( overdue_count*0.2 + days_overdue/30*0.5 + overdue_amount/10000*0.3 , 0, 1 )

create or replace function public.compute_overdue_risk_for_org(p_org_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_row record;
  v_score numeric;
  v_band text;
begin
  for v_row in
    select c.resident_id,
           count(*) filter (where s.status in ('overdue','partial') and s.due_date < current_date) as overdue_count,
           coalesce(sum(greatest(0, s.total_due + coalesce(s.penalty_amount,0) - s.paid_amount))
                    filter (where s.due_date < current_date and s.status <> 'paid'), 0) as overdue_amount,
           coalesce(max(current_date - s.due_date)
                    filter (where s.due_date < current_date and s.status <> 'paid'), 0) as max_days_overdue
    from public.installment_contracts c
    join public.installment_schedules s on s.contract_id = c.id
    where c.organization_id = p_org_id
    group by c.resident_id
  loop
    v_score := round(least(1.0, greatest(0,
      coalesce(v_row.overdue_count,0)*0.2
      + (coalesce(v_row.max_days_overdue,0)::numeric / 30.0) * 0.5
      + (coalesce(v_row.overdue_amount,0)::numeric / 10000.0) * 0.3
    ))::numeric, 4);

    v_band := case
      when v_score >= 0.75 then 'critical'
      when v_score >= 0.5  then 'high'
      when v_score >= 0.25 then 'medium'
      else 'low'
    end;

    insert into public.ai_predictions (
      organization_id, prediction_kind, subject_table, subject_id,
      score, band, rationale, model_version, valid_until
    )
    values (
      p_org_id, 'overdue_risk', 'residents', v_row.resident_id,
      v_score, v_band,
      jsonb_build_object(
        'overdue_count', v_row.overdue_count,
        'overdue_amount', v_row.overdue_amount,
        'max_days_overdue', v_row.max_days_overdue
      ),
      'heuristic-v1',
      now() + interval '7 days'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.compute_overdue_risk_for_org(uuid) from public;
grant execute on function public.compute_overdue_risk_for_org(uuid) to authenticated;

-- ─── enqueue_job ──────────────────────────────────────────────────────────

create or replace function public.enqueue_job(
  p_org_id   uuid,
  p_job_kind text,
  p_payload  jsonb default '{}'::jsonb,
  p_scheduled_for timestamptz default now(),
  p_dedup_key text default null,
  p_source_rule_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.job_queue (
    organization_id, job_kind, payload, scheduled_for, dedup_key, source_rule_id
  )
  values (p_org_id, p_job_kind, p_payload, p_scheduled_for, p_dedup_key, p_source_rule_id)
  on conflict (organization_id, dedup_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enqueue_job(uuid,text,jsonb,timestamptz,text,uuid) from public;
grant execute on function public.enqueue_job(uuid,text,jsonb,timestamptz,text,uuid) to authenticated;

-- ─── execute_due_automation_rules ─────────────────────────────────────────
-- Cron entrypoint. For now this only processes 'cron' triggers — event
-- triggers will be wired via DB triggers in a later iteration. Each rule's
-- action gets translated to one or more enqueue_job calls; the worker is
-- responsible for actually doing the work.

create or replace function public.execute_due_automation_rules()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_count int := 0;
  v_started_at timestamptz;
  v_outcome text;
  v_rows int;
begin
  for v_rule in
    select * from public.automation_rules
    where status = 'active'
      and trigger_kind = 'cron'
      and (next_run_at is null or next_run_at <= now())
    order by next_run_at nulls first
    limit 100
  loop
    v_started_at := clock_timestamp();
    v_outcome := 'success';
    v_rows := 0;

    begin
      -- For each action kind, we enqueue a worker job. Workers are not part
      -- of this migration — they'll be added once a queue runtime is chosen.
      perform public.enqueue_job(
        v_rule.organization_id,
        'automation:' || v_rule.action::text,
        jsonb_build_object(
          'rule_id', v_rule.id,
          'rule_name', v_rule.name,
          'action_config', v_rule.action_config,
          'trigger_config', v_rule.trigger_config
        ),
        now(),
        'rule-' || v_rule.id::text || '-' || to_char(now(), 'YYYYMMDDHH24MI'),
        v_rule.id
      );
      v_rows := 1;
    exception when others then
      v_outcome := 'failure';
    end;

    insert into public.automation_runs (
      organization_id, rule_id, trigger_context, outcome, rows_affected,
      error_message, duration_ms
    )
    values (
      v_rule.organization_id, v_rule.id,
      jsonb_build_object('source','cron'),
      v_outcome, v_rows, null,
      (extract(milliseconds from clock_timestamp() - v_started_at))::int
    );

    update public.automation_rules
      set last_run_at  = now(),
          next_run_at  = now() + interval '1 hour',  -- placeholder; cron parsing comes later
          run_count    = run_count + 1,
          failure_count = failure_count + (case when v_outcome = 'failure' then 1 else 0 end)
      where id = v_rule.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.execute_due_automation_rules() from public;
grant execute on function public.execute_due_automation_rules() to authenticated;
