-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 12 — RPC functions
-- ─────────────────────────────────────────────────────────────────────────────
-- Conventions:
--   • Every function performs tenant_id resolution from auth.uid() before any
--     write. is_super_admin() is the only bypass.
--   • Functions write to audit_log via audit_admin_action() at every privileged
--     step.
--   • Idempotency uses public.idempotency_keys (RPC-side dedup) and
--     UNIQUE constraints in the data layer (defence in depth).
--   • Errors carry HINT/DETAIL so the UI can surface meaningful messages.
--
-- See BACKEND_AUDIT_AND_MIGRATION.md for the full design rationale.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── 0. Helper: actor context ─────────────────────────────────────────────

create or replace function public._actor_context()
returns table (user_id uuid, role public.app_role, organization_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    (select ur.role from public.user_roles ur
      where ur.user_id = u.id
      order by case when ur.role = 'super_admin' then 0 else 1 end
      limit 1),
    (select ur.organization_id from public.user_roles ur
      where ur.user_id = u.id and ur.organization_id is not null
      limit 1),
    u.email
  from auth.users u
  where u.id = auth.uid()
$$;

grant execute on function public._actor_context() to authenticated;

-- ─── 0.1 audit_admin_action — labelled business-event logger ──────────────

create or replace function public.audit_admin_action(
  p_business_action text,
  p_target_table    text,
  p_target_id       uuid,
  p_organization_id uuid,
  p_compound_id     uuid default null,
  p_reason          text default null,
  p_payload         jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role  text;
  v_email text;
  v_id    bigint;
begin
  if v_actor is null then
    raise exception 'audit_admin_action requires an authenticated user'
      using errcode = '28000';
  end if;

  -- Snapshot role + email at action time (so they survive later changes).
  select coalesce(ur.role::text, 'unknown'),
         (select email from auth.users where id = v_actor)
    into v_role, v_email
  from public.user_roles ur
  where ur.user_id = v_actor
  order by case when ur.role = 'super_admin' then 0 else 1 end
  limit 1;

  insert into public.audit_log (
    actor_id, actor_role, actor_email,
    organization_id, compound_id,
    table_name, row_id, action, diff, business_action,
    request_id, client_ip, user_agent
  )
  values (
    v_actor, v_role, v_email,
    p_organization_id, p_compound_id,
    p_target_table, p_target_id, 'admin',
    jsonb_build_object(
      'reason',  p_reason,
      'payload', coalesce(p_payload, '{}'::jsonb)
    ),
    p_business_action,
    current_setting('app.request_id', true),
    current_setting('app.client_ip',  true),
    current_setting('app.user_agent', true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.audit_admin_action(text,text,uuid,uuid,uuid,text,jsonb) to authenticated;

-- The existing audit_log action CHECK uses (insert|update|delete). The
-- audit_admin_action RPC writes 'admin'. Relax the check via an additive
-- constraint rename (we cannot drop the existing one without breaking the
-- audit_row trigger). Instead, write 'update' as the action and rely on
-- business_action to label it.
--
-- Re-issue audit_admin_action so 'action' is one of the allowed lowercased
-- values:

create or replace function public.audit_admin_action(
  p_business_action text,
  p_target_table    text,
  p_target_id       uuid,
  p_organization_id uuid,
  p_compound_id     uuid default null,
  p_reason          text default null,
  p_payload         jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role  text;
  v_email text;
  v_id    bigint;
begin
  if v_actor is null then
    raise exception 'audit_admin_action requires an authenticated user'
      using errcode = '28000';
  end if;

  select coalesce(ur.role::text, 'unknown'),
         (select email from auth.users where id = v_actor)
    into v_role, v_email
  from public.user_roles ur
  where ur.user_id = v_actor
  order by case when ur.role = 'super_admin' then 0 else 1 end
  limit 1;

  insert into public.audit_log (
    actor_id, actor_role, actor_email,
    organization_id, compound_id,
    table_name, row_id, action, diff, business_action,
    request_id, client_ip, user_agent
  )
  values (
    v_actor, v_role, v_email,
    p_organization_id, p_compound_id,
    p_target_table, p_target_id,
    -- audit_log.action CHECK only allows insert|update|delete; we map admin
    -- actions to 'update' and identify them via business_action.
    'update',
    jsonb_build_object(
      'reason',  p_reason,
      'payload', coalesce(p_payload, '{}'::jsonb)
    ),
    p_business_action,
    current_setting('app.request_id', true),
    current_setting('app.client_ip',  true),
    current_setting('app.user_agent', true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.audit_admin_action(text,text,uuid,uuid,uuid,text,jsonb) to authenticated;

-- ─── 0.2 Internal idempotency helpers ─────────────────────────────────────

create or replace function public._idempotency_begin(
  p_key text, p_scope text, p_org uuid, p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.idempotency_keys;
begin
  if p_key is null or length(p_key) = 0 then
    return null;
  end if;

  insert into public.idempotency_keys (key, scope, organization_id, request_hash, status)
  values (p_key, p_scope, p_org, p_request_hash, 'pending')
  on conflict (key) do nothing;

  select * into v_row from public.idempotency_keys where key = p_key;

  if v_row.status = 'succeeded' then
    return v_row.response;
  end if;

  if v_row.status = 'failed' then
    if v_row.request_hash is distinct from p_request_hash then
      raise exception 'Idempotency key % already used with different inputs', p_key
        using errcode = '23505';
    end if;
    update public.idempotency_keys set status='pending', completed_at=null where key = p_key;
  end if;

  return null;
end;
$$;

create or replace function public._idempotency_complete(
  p_key text, p_response jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null then return; end if;
  update public.idempotency_keys
     set status='succeeded', completed_at=now(), response=p_response
   where key = p_key;
end;
$$;

create or replace function public._idempotency_fail(
  p_key text, p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null then return; end if;
  update public.idempotency_keys
     set status='failed', completed_at=now(),
         response=jsonb_build_object('error', p_error)
   where key = p_key;
end;
$$;

-- ─── 1. create_meter_reading ──────────────────────────────────────────────

create or replace function public.create_meter_reading(
  p_meter_id        uuid,
  p_reading_value   numeric,
  p_reading_at      timestamptz default now(),
  p_source          public.reading_source default 'manual',
  p_external_id     text default null,
  p_raw_payload     jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_meter   public.electricity_meters;
  v_prev    public.utility_meter_readings;
  v_id      uuid;
  v_cached  jsonb;
  v_hash    text;
begin
  if v_actor is null then
    raise exception 'create_meter_reading requires authentication' using errcode = '28000';
  end if;

  select * into v_meter from public.electricity_meters where id = p_meter_id;
  if v_meter.id is null then
    raise exception 'Meter % not found', p_meter_id using errcode = '23503';
  end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_meter.organization_id, v_meter.compound_id)) then
    raise exception 'Not authorized to record readings for org %', v_meter.organization_id
      using errcode = '42501';
  end if;

  if p_reading_value is null or p_reading_value < 0 then
    raise exception 'reading_value must be >= 0' using errcode = '22000';
  end if;

  v_hash := encode(digest(p_meter_id::text || ':' || p_reading_at::text || ':' || p_reading_value::text, 'sha256'), 'hex');
  v_cached := public._idempotency_begin(p_idempotency_key, 'create_meter_reading', v_meter.organization_id, v_hash);
  if v_cached is not null then
    return (v_cached->>'id')::uuid;
  end if;

  -- Most recent prior reading drives derived usage event.
  select * into v_prev
  from public.utility_meter_readings
  where meter_id = p_meter_id and reading_at < p_reading_at
  order by reading_at desc
  limit 1;

  insert into public.utility_meter_readings (
    organization_id, compound_id, meter_id, utility_type,
    reading_value, reading_unit, reading_at, source, raw_payload, external_reading_id,
    created_by
  )
  values (
    v_meter.organization_id, v_meter.compound_id, p_meter_id, v_meter.utility_type,
    p_reading_value, v_meter.reading_unit, p_reading_at, p_source, p_raw_payload, p_external_id,
    v_actor
  )
  returning id into v_id;

  -- Roll the meter forward so the billing engine has a current/last reading.
  update public.electricity_meters
     set last_reading = current_reading,
         current_reading = p_reading_value,
         last_sync_at = now(),
         sync_status = 'ok'
   where id = p_meter_id;

  -- Derived usage event when we have a sane prior reading.
  if v_prev.id is not null and p_reading_value >= v_prev.reading_value then
    insert into public.utility_usage_events (
      organization_id, compound_id, meter_id, unit_id, utility_type,
      period_start, period_end, quantity, quantity_unit,
      derived_from_reading_id, source, created_by
    )
    values (
      v_meter.organization_id, v_meter.compound_id, p_meter_id, v_meter.unit_id, v_meter.utility_type,
      v_prev.reading_at, p_reading_at, p_reading_value - v_prev.reading_value, v_meter.reading_unit,
      v_id, 'computed', v_actor
    );
  end if;

  perform public.audit_admin_action(
    'meter_reading_created', 'utility_meter_readings', v_id,
    v_meter.organization_id, v_meter.compound_id,
    'create_meter_reading RPC',
    jsonb_build_object('meter_id', p_meter_id, 'value', p_reading_value, 'source', p_source)
  );

  perform public._idempotency_complete(p_idempotency_key, jsonb_build_object('id', v_id));
  return v_id;
exception when others then
  perform public._idempotency_fail(p_idempotency_key, sqlerrm);
  raise;
end;
$$;

grant execute on function public.create_meter_reading(uuid,numeric,timestamptz,public.reading_source,text,jsonb,text) to authenticated;

-- ─── 2. calculate_usage_for_period ────────────────────────────────────────

create or replace function public.calculate_usage_for_period(
  p_meter_id        uuid,
  p_subscription_id uuid default null,
  p_period_start    date  default null,
  p_period_end      date  default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meter        public.electricity_meters;
  v_total        numeric(14,4) := 0;
  v_count        integer := 0;
  v_aggregate_id uuid;
begin
  if p_period_start is null or p_period_end is null then
    raise exception 'period_start and period_end are required' using errcode = '22000';
  end if;
  if p_period_end < p_period_start then
    raise exception 'period_end must be >= period_start' using errcode = '22000';
  end if;

  select * into v_meter from public.electricity_meters where id = p_meter_id;
  if v_meter.id is null then
    raise exception 'Meter % not found', p_meter_id using errcode = '23503';
  end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_meter.organization_id, v_meter.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(sum(quantity), 0), count(*)
    into v_total, v_count
  from public.utility_usage_events
  where meter_id = p_meter_id
    and (p_subscription_id is null or subscription_id = p_subscription_id)
    and period_start >= p_period_start::timestamptz
    and period_end   <= (p_period_end + 1)::timestamptz;

  insert into public.utility_usage_aggregates (
    organization_id, compound_id, meter_id, subscription_id, utility_type,
    period_start, period_end, total_quantity, quantity_unit, event_count
  )
  values (
    v_meter.organization_id, v_meter.compound_id, p_meter_id, p_subscription_id, v_meter.utility_type,
    p_period_start, p_period_end, v_total, v_meter.reading_unit, v_count
  )
  on conflict (organization_id,
               coalesce(meter_id, '00000000-0000-0000-0000-000000000000'::uuid),
               coalesce(subscription_id, '00000000-0000-0000-0000-000000000000'::uuid),
               utility_type, period_start, period_end)
  do update
     set total_quantity = excluded.total_quantity,
         event_count    = excluded.event_count,
         computed_at    = now(),
         is_frozen      = utility_usage_aggregates.is_frozen
  returning id into v_aggregate_id;

  perform public.audit_admin_action(
    'usage_aggregate_computed', 'utility_usage_aggregates', v_aggregate_id,
    v_meter.organization_id, v_meter.compound_id,
    'calculate_usage_for_period RPC',
    jsonb_build_object(
      'meter_id', p_meter_id,
      'subscription_id', p_subscription_id,
      'period_start', p_period_start,
      'period_end',   p_period_end,
      'total', v_total,
      'event_count', v_count
    )
  );

  return v_aggregate_id;
end;
$$;

grant execute on function public.calculate_usage_for_period(uuid,uuid,date,date) to authenticated;

-- ─── 3. generate_utility_bill ─────────────────────────────────────────────

create or replace function public.generate_utility_bill(
  p_subscription_id uuid,
  p_period_start    date,
  p_period_end      date,
  p_due_date        date default null,
  p_tariff_id       uuid default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub      public.utility_subscriptions;
  v_meter    public.electricity_meters;
  v_agg      public.utility_usage_aggregates;
  v_tariff   public.electricity_tariffs;
  v_rate     numeric(10,4) := 0;
  v_subtotal numeric(12,2) := 0;
  v_due      date;
  v_bill_id  uuid;
  v_idem     text;
  v_cached   jsonb;
begin
  select * into v_sub from public.utility_subscriptions where id = p_subscription_id;
  if v_sub.id is null then
    raise exception 'Subscription % not found', p_subscription_id using errcode = '23503';
  end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_sub.organization_id, v_sub.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_idem := coalesce(p_idempotency_key,
    encode(digest(p_subscription_id::text || ':' || p_period_start::text || ':' || p_period_end::text, 'sha256'), 'hex'));

  v_cached := public._idempotency_begin(v_idem, 'generate_utility_bill', v_sub.organization_id, v_idem);
  if v_cached is not null then
    return (v_cached->>'id')::uuid;
  end if;

  -- Find a meter for the subscription's unit, same provider, same utility type.
  select * into v_meter
  from public.electricity_meters
  where organization_id = v_sub.organization_id
    and unit_id = v_sub.unit_id
    and (provider_id is null or provider_id = v_sub.provider_id)
    and utility_type = v_sub.subscription_type
  limit 1;

  -- Pick (or compute on demand) the aggregate for this period.
  select * into v_agg
  from public.utility_usage_aggregates
  where organization_id = v_sub.organization_id
    and (v_meter.id is null or meter_id = v_meter.id)
    and (subscription_id = p_subscription_id or subscription_id is null)
    and period_start = p_period_start
    and period_end   = p_period_end
  order by computed_at desc
  limit 1;

  if v_agg.id is null and v_meter.id is not null then
    perform public.calculate_usage_for_period(v_meter.id, p_subscription_id, p_period_start, p_period_end);
    select * into v_agg
    from public.utility_usage_aggregates
    where organization_id = v_sub.organization_id and meter_id = v_meter.id
      and (subscription_id = p_subscription_id or subscription_id is null)
      and period_start = p_period_start and period_end = p_period_end
    order by computed_at desc limit 1;
  end if;

  -- Resolve the active tariff (caller can override).
  if p_tariff_id is not null then
    select * into v_tariff from public.electricity_tariffs where id = p_tariff_id;
  else
    select * into v_tariff
    from public.electricity_tariffs
    where provider_id = v_sub.provider_id
      and effective_from <= p_period_end
      and (effective_to is null or effective_to >= p_period_start)
    order by effective_from desc limit 1;
  end if;

  v_rate := coalesce(v_tariff.rate_per_unit, 0);

  if v_sub.subscription_type = 'internet' then
    -- Internet is a flat monthly fee — consumption is irrelevant.
    v_subtotal := v_sub.monthly_fee;
  else
    v_subtotal := coalesce(v_agg.total_quantity, 0) * v_rate + coalesce(v_tariff.service_fee, 0);
  end if;

  v_due := coalesce(p_due_date, p_period_end + interval '14 days');

  insert into public.utility_bills (
    organization_id, compound_id, unit_id, resident_id, subscription_id,
    provider_id, meter_id,
    utility_type, billing_period_start, billing_period_end, due_date,
    previous_reading, current_reading, consumption, rate_per_unit,
    subtotal, tax_amount, penalty_amount, paid_amount, total_amount,
    currency, status,
    tariff_id, idempotency_key, generated_by_rpc, consumption_aggregate_id
  )
  values (
    v_sub.organization_id, v_sub.compound_id, v_sub.unit_id, v_sub.resident_id, v_sub.id,
    v_sub.provider_id, v_meter.id,
    v_sub.subscription_type, p_period_start, p_period_end, v_due,
    nullif(v_meter.last_reading, 0), v_meter.current_reading, v_agg.total_quantity, v_rate,
    v_subtotal, 0, 0, 0, v_subtotal,
    coalesce(v_tariff.currency, v_sub.currency, 'USD'), 'issued',
    v_tariff.id, v_idem, 'generate_utility_bill_v1', v_agg.id
  )
  returning id into v_bill_id;

  -- Freeze the aggregate so no later recompute can change the bill's basis.
  if v_agg.id is not null then
    update public.utility_usage_aggregates
       set is_frozen = true, bill_id = v_bill_id
     where id = v_agg.id;
  end if;

  -- Advance the subscription's billing cursor.
  update public.utility_subscriptions
     set last_billed_at = p_period_end,
         next_billing_date = case
           when billing_cycle = 'monthly'   then (p_period_end + interval '1 month')::date
           when billing_cycle = 'quarterly' then (p_period_end + interval '3 months')::date
           when billing_cycle = 'biannual'  then (p_period_end + interval '6 months')::date
           when billing_cycle = 'annual'    then (p_period_end + interval '1 year')::date
           else next_billing_date
         end
   where id = p_subscription_id;

  perform public.audit_admin_action(
    'utility_bill_generated', 'utility_bills', v_bill_id,
    v_sub.organization_id, v_sub.compound_id,
    'generate_utility_bill RPC',
    jsonb_build_object(
      'subscription_id', p_subscription_id,
      'period_start', p_period_start,
      'period_end',   p_period_end,
      'subtotal', v_subtotal,
      'tariff_id', v_tariff.id
    )
  );

  perform public._idempotency_complete(v_idem, jsonb_build_object('id', v_bill_id));
  return v_bill_id;
exception when others then
  perform public._idempotency_fail(v_idem, sqlerrm);
  raise;
end;
$$;

grant execute on function public.generate_utility_bill(uuid,date,date,date,uuid,text) to authenticated;

-- ─── 4. mark_bill_as_paid ─────────────────────────────────────────────────

create or replace function public.mark_bill_as_paid(
  p_bill_id                uuid,
  p_amount                 numeric,
  p_payment_method         public.payment_method,
  p_payment_method_code    text default null,
  p_gateway_provider       text default null,
  p_gateway_payment_intent text default null,
  p_payment_reference      text default null,
  p_idempotency_key        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill      public.utility_bills;
  v_payment_id uuid;
  v_idem      text;
  v_cached    jsonb;
  v_reference text;
  v_fallback_contract uuid;
begin
  select * into v_bill from public.utility_bills where id = p_bill_id;
  if v_bill.id is null then
    raise exception 'Bill % not found', p_bill_id using errcode = '23503';
  end if;

  -- Auth: management OR the resident themselves can pay.
  if not (public.is_super_admin()
          or public.user_has_management_role(v_bill.organization_id, v_bill.compound_id)
          or exists (
              select 1 from public.residents r
              where r.id = v_bill.resident_id and r.user_id = auth.uid()
          )) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be > 0' using errcode = '22000';
  end if;
  if p_amount > (v_bill.total_amount - v_bill.paid_amount) + 0.01 then
    raise exception 'Payment amount % exceeds remaining balance %',
      p_amount, (v_bill.total_amount - v_bill.paid_amount)
      using errcode = '22000';
  end if;

  v_idem := coalesce(p_idempotency_key,
    encode(digest(p_bill_id::text || ':' || p_amount::text || ':' || coalesce(p_gateway_payment_intent, '')::text, 'sha256'), 'hex'));

  v_cached := public._idempotency_begin(v_idem, 'mark_bill_as_paid', v_bill.organization_id, v_idem);
  if v_cached is not null then
    return (v_cached->>'payment_id')::uuid;
  end if;

  v_reference := coalesce(p_payment_reference,
    'UB-PMT-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  -- payments.contract_id is NOT NULL today. Pick the resident's latest
  -- installment contract as a fallback. See section 12.4 in the audit doc
  -- for the recommendation to relax this column.
  select id into v_fallback_contract
  from public.installment_contracts
  where resident_id = v_bill.resident_id
    and organization_id = v_bill.organization_id
  order by created_at desc limit 1;

  if v_fallback_contract is null then
    raise exception 'Cannot record utility payment — resident has no installment contract on file. Run section 12.4 in BACKEND_AUDIT_AND_MIGRATION.md to relax payments.contract_id NOT NULL.'
      using errcode = '23502';
  end if;

  insert into public.payments (
    organization_id, compound_id, contract_id, resident_id,
    payment_reference, payment_date, payment_method, payment_amount, payment_status,
    utility_bill_id, idempotency_key,
    payment_method_code, gateway_provider, gateway_payment_intent
  )
  values (
    v_bill.organization_id, v_bill.compound_id,
    v_fallback_contract,
    v_bill.resident_id,
    v_reference, current_date, p_payment_method, p_amount, 'confirmed',
    p_bill_id, v_idem,
    p_payment_method_code, p_gateway_provider, p_gateway_payment_intent
  )
  returning id into v_payment_id;

  insert into public.utility_payment_allocation (organization_id, payment_id, utility_bill_id, amount, applied_to)
  values (v_bill.organization_id, v_payment_id, p_bill_id, p_amount, 'subtotal');

  update public.utility_bills
     set paid_amount = paid_amount + p_amount,
         status = case when (paid_amount + p_amount) >= total_amount - 0.01
                       then 'paid'::public.utility_bill_status
                       else 'partial'::public.utility_bill_status end,
         paid_at = case when (paid_amount + p_amount) >= total_amount - 0.01 then now() else paid_at end,
         payment_id = case when (paid_amount + p_amount) >= total_amount - 0.01 then v_payment_id else payment_id end
   where id = p_bill_id;

  insert into public.receipts (organization_id, payment_id, receipt_number, issued_at, issued_by)
  values (v_bill.organization_id, v_payment_id,
          'RCP-UB-' || to_char(now(),'YYYY') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8),
          now(), auth.uid())
  on conflict do nothing;

  if p_gateway_payment_intent is not null then
    insert into public.external_reference_mapping (organization_id, provider, external_id, srp_table, srp_id)
    values (v_bill.organization_id, coalesce(p_gateway_provider, 'unknown'), p_gateway_payment_intent, 'payments', v_payment_id)
    on conflict do nothing;
  end if;

  perform public.audit_admin_action(
    'utility_bill_paid', 'utility_bills', p_bill_id,
    v_bill.organization_id, v_bill.compound_id,
    'mark_bill_as_paid RPC',
    jsonb_build_object('payment_id', v_payment_id, 'amount', p_amount, 'method', p_payment_method)
  );

  perform public._idempotency_complete(v_idem, jsonb_build_object('payment_id', v_payment_id));
  return v_payment_id;
exception when others then
  perform public._idempotency_fail(v_idem, sqlerrm);
  raise;
end;
$$;

grant execute on function public.mark_bill_as_paid(uuid,numeric,public.payment_method,text,text,text,text,text) to authenticated;

-- ─── 5. sync_meter_reading_from_provider ──────────────────────────────────

create or replace function public.sync_meter_reading_from_provider(
  p_meter_id          uuid,
  p_external_id       text,
  p_reading_value     numeric,
  p_reading_at        timestamptz,
  p_integration_id    uuid default null,
  p_raw_payload       jsonb default '{}'::jsonb,
  p_idempotency_key   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meter   public.electricity_meters;
  v_job_id  uuid;
  v_read_id uuid;
  v_idem    text;
  v_cached  jsonb;
begin
  select * into v_meter from public.electricity_meters where id = p_meter_id;
  if v_meter.id is null then
    raise exception 'Meter % not found', p_meter_id using errcode = '23503';
  end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_meter.organization_id, v_meter.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_idem := coalesce(p_idempotency_key, p_external_id);
  v_cached := public._idempotency_begin(v_idem, 'sync_meter_reading_from_provider', v_meter.organization_id, v_idem);
  if v_cached is not null then
    return (v_cached->>'reading_id')::uuid;
  end if;

  insert into public.sync_jobs (
    organization_id, integration_id, provider_id,
    kind, status, scheduled_for, started_at,
    idempotency_key, request_payload
  )
  values (
    v_meter.organization_id, p_integration_id, v_meter.provider_id,
    'pull_readings', 'running', now(), now(),
    v_idem,
    jsonb_build_object('meter_id', p_meter_id, 'external_id', p_external_id, 'reading_at', p_reading_at)
  )
  returning id into v_job_id;

  v_read_id := public.create_meter_reading(
    p_meter_id, p_reading_value, p_reading_at, 'imported',
    p_external_id, p_raw_payload, v_idem || ':reading'
  );

  update public.sync_jobs
     set status='succeeded', finished_at=now(), attempts=attempts+1,
         result_payload=jsonb_build_object('reading_id', v_read_id)
   where id = v_job_id;

  insert into public.sync_job_logs (
    organization_id, sync_job_id, step, outcome, response_payload
  ) values (
    v_meter.organization_id, v_job_id, 'reading_imported', 'success',
    jsonb_build_object('reading_id', v_read_id, 'value', p_reading_value)
  );

  -- Touch the integration's last_sync_job_id pointer (if known).
  if p_integration_id is not null then
    update public.provider_integrations
       set last_sync_job_id = v_job_id, last_synced_at = now()
     where id = p_integration_id;
  end if;

  perform public.audit_admin_action(
    'meter_reading_synced', 'utility_meter_readings', v_read_id,
    v_meter.organization_id, v_meter.compound_id,
    'sync_meter_reading_from_provider RPC',
    jsonb_build_object('external_id', p_external_id, 'value', p_reading_value, 'job_id', v_job_id)
  );

  perform public._idempotency_complete(v_idem, jsonb_build_object('reading_id', v_read_id, 'job_id', v_job_id));
  return v_read_id;
exception when others then
  if v_job_id is not null then
    update public.sync_jobs
       set status='failed', finished_at=now(), last_error=sqlerrm
     where id = v_job_id;
    insert into public.sync_job_logs (organization_id, sync_job_id, step, outcome, error_message)
    values (v_meter.organization_id, v_job_id, 'reading_import', 'failure', sqlerrm);
  end if;
  perform public._idempotency_fail(v_idem, sqlerrm);
  raise;
end;
$$;

grant execute on function public.sync_meter_reading_from_provider(uuid,text,numeric,timestamptz,uuid,jsonb,text) to authenticated;

-- ─── 6. get_unit_utility_summary ──────────────────────────────────────────

create or replace function public.get_unit_utility_summary(p_unit_id uuid)
returns table (
  utility_type            public.utility_type,
  current_reading         numeric,
  last_reading            numeric,
  unit_label              text,
  open_bill_count         integer,
  open_amount             numeric,
  last_bill_at            timestamptz,
  last_bill_id            uuid,
  service_overdue_state   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit public.units;
begin
  select * into v_unit from public.units where id = p_unit_id;
  if v_unit.id is null then raise exception 'Unit not found' using errcode = '23503'; end if;

  if not (public.is_super_admin()
          or v_unit.organization_id in (select public.user_organization_ids())
          or v_unit.compound_id in (select public.user_compound_ids())
          or exists (select 1 from public.residents r where r.user_id = auth.uid() and r.unit_id = v_unit.id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
    with meters as (
      select * from public.electricity_meters where unit_id = p_unit_id
    ), bills as (
      select b.utility_type,
             count(*) filter (where b.status in ('issued','partial','overdue')) as open_count,
             coalesce(sum(case when b.status in ('issued','partial','overdue')
                              then b.total_amount - b.paid_amount else 0 end), 0) as open_amount,
             max(b.created_at) as last_bill_at,
             (array_agg(b.id order by b.created_at desc))[1] as last_bill_id
        from public.utility_bills b
       where b.unit_id = p_unit_id
       group by b.utility_type
    ), subs as (
      select s.subscription_type as utility_type, max(s.service_overdue_state) as overdue_state
        from public.utility_subscriptions s
       where s.unit_id = p_unit_id
       group by s.subscription_type
    )
    select
      m.utility_type, m.current_reading, m.last_reading, m.reading_unit,
      coalesce(b.open_count, 0)::integer, coalesce(b.open_amount, 0),
      b.last_bill_at, b.last_bill_id, s.overdue_state
    from meters m
    left join bills b on b.utility_type = m.utility_type
    left join subs  s on s.utility_type = m.utility_type;
end;
$$;

grant execute on function public.get_unit_utility_summary(uuid) to authenticated;

-- ─── 7. get_resident_dashboard_summary ────────────────────────────────────

create or replace function public.get_resident_dashboard_summary(p_resident_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resident public.residents;
  v_summary  jsonb;
begin
  if p_resident_id is null then
    select * into v_resident from public.residents where user_id = auth.uid() limit 1;
  else
    select * into v_resident from public.residents where id = p_resident_id;
  end if;

  if v_resident.id is null then
    return jsonb_build_object('error', 'resident_not_found');
  end if;

  if not (public.is_super_admin()
          or v_resident.user_id = auth.uid()
          or public.user_has_management_role(v_resident.organization_id, v_resident.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'resident', jsonb_build_object('id', v_resident.id, 'first_name', v_resident.first_name, 'last_name', v_resident.last_name),
    'unit',     (select to_jsonb(u) from public.units u where u.id = v_resident.unit_id),
    'open_bills', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'utility_type', b.utility_type, 'due_date', b.due_date,
        'total', b.total_amount, 'paid', b.paid_amount, 'status', b.status
      ) order by b.due_date), '[]'::jsonb)
      from public.utility_bills b
      where b.resident_id = v_resident.id and b.status in ('issued','partial','overdue')
    ),
    'open_installments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'installment_number', s.installment_number,
        'due_date', s.due_date, 'total_due', s.total_due, 'paid_amount', s.paid_amount, 'status', s.status
      ) order by s.due_date), '[]'::jsonb)
      from public.installment_schedules s
      join public.installment_contracts c on c.id = s.contract_id
      where c.resident_id = v_resident.id and s.status in ('pending','partial','overdue')
    ),
    'subscriptions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', us.id, 'type', us.subscription_type, 'status', us.status,
        'overdue_state', us.service_overdue_state, 'next_billing_date', us.next_billing_date
      )), '[]'::jsonb)
      from public.utility_subscriptions us
      where us.resident_id = v_resident.id and us.status = 'active'
    ),
    'tickets_open', (
      select count(*) from public.tickets t where t.resident_id = v_resident.id and t.status not in ('resolved','closed')
    ),
    'unread_notifications', (
      select count(*) from public.notifications n where n.user_id = v_resident.user_id and n.read_at is null
    )
  ) into v_summary;

  return v_summary;
end;
$$;

grant execute on function public.get_resident_dashboard_summary(uuid) to authenticated;

-- ─── 8. suspend_service_for_overdue_bill ──────────────────────────────────

create or replace function public.suspend_service_for_overdue_bill(
  p_bill_id uuid,
  p_reason  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.utility_bills;
  v_sub  public.utility_subscriptions;
  v_sus_id uuid;
begin
  select * into v_bill from public.utility_bills where id = p_bill_id;
  if v_bill.id is null then raise exception 'Bill not found' using errcode = '23503'; end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_bill.organization_id, v_bill.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_bill.subscription_id is null then
    raise exception 'Bill has no subscription — cannot suspend service' using errcode = '22000';
  end if;

  select * into v_sub from public.utility_subscriptions where id = v_bill.subscription_id;

  if v_sub.status <> 'active' then
    raise exception 'Subscription is not active (status=%)', v_sub.status using errcode = '22000';
  end if;

  insert into public.service_suspensions (
    organization_id, compound_id, subscription_id, unit_id, resident_id,
    utility_type, reason, reason_notes, initiated_by
  )
  values (
    v_bill.organization_id, v_bill.compound_id, v_sub.id, v_bill.unit_id, v_bill.resident_id,
    v_bill.utility_type, 'overdue', p_reason, auth.uid()
  )
  returning id into v_sus_id;

  update public.utility_subscriptions
     set status = 'suspended',
         service_overdue_state = 'suspended',
         dunning_step = greatest(dunning_step, 3)
   where id = v_sub.id;

  update public.utility_bills set suspended_at = now() where id = p_bill_id;

  insert into public.service_overdue_actions (
    organization_id, compound_id, subscription_id, utility_bill_id,
    action_kind, dunning_step, outcome, payload, actor_id
  )
  values (
    v_bill.organization_id, v_bill.compound_id, v_sub.id, p_bill_id,
    'suspended', 3, 'service_suspended', jsonb_build_object('reason', p_reason), auth.uid()
  );

  perform public.audit_admin_action(
    'service_suspended', 'service_suspensions', v_sus_id,
    v_bill.organization_id, v_bill.compound_id,
    p_reason,
    jsonb_build_object('bill_id', p_bill_id, 'subscription_id', v_sub.id)
  );

  return v_sus_id;
end;
$$;

grant execute on function public.suspend_service_for_overdue_bill(uuid,text) to authenticated;

-- ─── 9. restore_service_after_payment ─────────────────────────────────────

create or replace function public.restore_service_after_payment(
  p_subscription_id uuid,
  p_reason          text default 'payment received'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub        public.utility_subscriptions;
  v_open_count integer;
begin
  select * into v_sub from public.utility_subscriptions where id = p_subscription_id;
  if v_sub.id is null then raise exception 'Subscription not found' using errcode = '23503'; end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_sub.organization_id, v_sub.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select count(*) into v_open_count
  from public.utility_bills
  where subscription_id = p_subscription_id
    and status in ('overdue','partial');

  if v_open_count > 0 then
    raise exception 'Cannot restore — % bill(s) still unpaid', v_open_count using errcode = '22000';
  end if;

  update public.service_suspensions
     set status = 'released', released_at = now()
   where subscription_id = p_subscription_id and status = 'active';

  update public.utility_subscriptions
     set status = 'active',
         service_overdue_state = 'restored',
         dunning_step = 0
   where id = p_subscription_id;

  insert into public.service_overdue_actions (
    organization_id, compound_id, subscription_id,
    action_kind, dunning_step, outcome, payload, actor_id
  )
  values (
    v_sub.organization_id, v_sub.compound_id, v_sub.id,
    'restored', 0, 'service_restored', jsonb_build_object('reason', p_reason), auth.uid()
  );

  perform public.audit_admin_action(
    'service_restored', 'utility_subscriptions', v_sub.id,
    v_sub.organization_id, v_sub.compound_id,
    p_reason, '{}'::jsonb
  );

  return true;
end;
$$;

grant execute on function public.restore_service_after_payment(uuid,text) to authenticated;

-- ─── 10. audit_admin_action — already defined above (section 0.1) ─────────

-- end of migration
