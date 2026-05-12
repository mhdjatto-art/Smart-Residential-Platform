-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 5.5: Pricing engine + integration logging
-- ─────────────────────────────────────────────────────────────────────────────
-- Public functions
--   compute_dynamic_fee(org_id, service_kind, unit_id, consumption, when_at)
--     → returns the price for a unit + service + (optional) consumption.
--     Picks the highest-priority active rule that matches the org/compound
--     and service_kind, then applies the rule's method.
--   evaluate_pricing_rule(rule, unit_id, consumption, when_at)
--     → inner evaluator; exposed for testability.
--   log_integration_call(...)
--     → inserts into integration_logs (used by edge functions / workers).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── evaluate_pricing_rule ────────────────────────────────────────────────
-- Pure function: takes a rule + facts, returns a price. No DB writes.

create or replace function public.evaluate_pricing_rule(
  p_rule_id    uuid,
  p_unit_id    uuid default null,
  p_consumption numeric default 0,
  p_residents  integer default null,
  p_when_at    timestamptz default now()
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rule      public.service_pricing_rules%rowtype;
  v_unit      record;
  v_sqm       numeric := 0;
  v_residents integer := coalesce(p_residents, 0);
  v_price     numeric := 0;
  v_tier      jsonb;
  v_consumed  numeric := coalesce(p_consumption, 0);
  v_remaining numeric;
  v_from      numeric;
  v_to        numeric;
  v_rate      numeric;
  v_hour      integer;
  v_month     integer;
  v_window    jsonb;
begin
  select * into v_rule from public.service_pricing_rules where id = p_rule_id;
  if not found or not v_rule.is_active then return 0; end if;

  -- Pull unit context if needed
  if p_unit_id is not null and v_rule.method in ('per_sqm','formula') then
    select u.area_sqm, count(r.id) as resident_count
      into v_unit
    from public.units u
    left join public.residents r on r.unit_id = u.id and r.resident_status = 'active'
    where u.id = p_unit_id
    group by u.area_sqm;
    if found then
      v_sqm := coalesce(v_unit.area_sqm, 0);
      if v_residents = 0 then v_residents := coalesce(v_unit.resident_count, 0); end if;
    end if;
  end if;

  case v_rule.method
    when 'flat' then
      v_price := v_rule.base_amount;

    when 'per_sqm' then
      v_price := v_rule.base_amount + (v_rule.unit_amount * v_sqm);

    when 'per_resident' then
      v_price := v_rule.base_amount + (v_rule.unit_amount * v_residents);

    when 'tiered' then
      -- Tiers consume v_consumed in order: each tier {from,to,price}
      v_price := v_rule.base_amount;
      v_remaining := v_consumed;
      for v_tier in select * from jsonb_array_elements(v_rule.tiers)
      loop
        v_from := coalesce((v_tier ->> 'from')::numeric, 0);
        v_to   := nullif(v_tier ->> 'to', '')::numeric;
        v_rate := coalesce((v_tier ->> 'price')::numeric, 0);
        if v_remaining <= 0 then exit; end if;
        if v_to is null then
          v_price := v_price + v_remaining * v_rate;
          v_remaining := 0;
        else
          v_price := v_price + least(v_remaining, v_to - v_from) * v_rate;
          v_remaining := v_remaining - (v_to - v_from);
        end if;
      end loop;

    when 'time_of_use' then
      v_hour := extract(hour from p_when_at)::integer;
      v_rate := v_rule.unit_amount;
      for v_window in select * from jsonb_array_elements(coalesce(v_rule.schedule -> 'hours', '[]'::jsonb))
      loop
        if v_hour >= coalesce((v_window ->> 'from')::int, 0) and v_hour < coalesce((v_window ->> 'to')::int, 24) then
          v_rate := coalesce((v_window ->> 'price')::numeric, v_rate);
          exit;
        end if;
      end loop;
      v_price := v_rule.base_amount + (v_rate * v_consumed);

    when 'seasonal' then
      v_month := extract(month from p_when_at)::integer;
      v_rate := v_rule.unit_amount;
      for v_window in select * from jsonb_array_elements(coalesce(v_rule.schedule -> 'months', '[]'::jsonb))
      loop
        if v_month >= coalesce((v_window ->> 'from')::int, 1) and v_month <= coalesce((v_window ->> 'to')::int, 12) then
          v_rate := coalesce((v_window ->> 'price')::numeric, v_rate);
          exit;
        end if;
      end loop;
      v_price := v_rule.base_amount + (v_rate * v_consumed);

    when 'formula' then
      -- Minimal safe DSL: replace tokens then evaluate. Supports tokens:
      --   {base} {sqm} {residents} {consumption}
      -- and basic + - * / ( ) numbers. Anything else → 0.
      declare
        v_expr text;
      begin
        v_expr := coalesce(v_rule.formula, '{base}');
        v_expr := replace(v_expr, '{base}',        v_rule.base_amount::text);
        v_expr := replace(v_expr, '{sqm}',         v_sqm::text);
        v_expr := replace(v_expr, '{residents}',   v_residents::text);
        v_expr := replace(v_expr, '{consumption}', v_consumed::text);
        if v_expr ~ '^[0-9+\-*/(). ]+$' then
          execute 'select (' || v_expr || ')::numeric' into v_price;
        else
          v_price := v_rule.base_amount;
        end if;
      end;
  end case;

  if v_rule.min_amount is not null and v_price < v_rule.min_amount then v_price := v_rule.min_amount; end if;
  if v_rule.max_amount is not null and v_price > v_rule.max_amount then v_price := v_rule.max_amount; end if;

  return round(v_price::numeric, 4);
end;
$$;

grant execute on function public.evaluate_pricing_rule(uuid, uuid, numeric, integer, timestamptz) to authenticated;

-- ─── compute_dynamic_fee ──────────────────────────────────────────────────

create or replace function public.compute_dynamic_fee(
  p_org_id       uuid,
  p_service_kind text,
  p_unit_id      uuid default null,
  p_consumption  numeric default 0,
  p_residents    integer default null,
  p_when_at      timestamptz default now()
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_unit_compound uuid;
  v_rule_id uuid;
  v_price numeric;
begin
  if p_unit_id is not null then
    select compound_id into v_unit_compound from public.units where id = p_unit_id;
  end if;

  -- Highest-priority active rule that matches org + service_kind + (optionally) compound
  select id into v_rule_id
  from public.service_pricing_rules
  where organization_id = p_org_id
    and service_kind = p_service_kind
    and is_active
    and effective_from <= current_date
    and (effective_to is null or effective_to >= current_date)
    and (compound_id is null or compound_id = v_unit_compound)
  order by priority asc, compound_id nulls last
  limit 1;

  if v_rule_id is null then return 0; end if;

  v_price := public.evaluate_pricing_rule(v_rule_id, p_unit_id, p_consumption, p_residents, p_when_at);
  return v_price;
end;
$$;

grant execute on function public.compute_dynamic_fee(uuid, text, uuid, numeric, integer, timestamptz) to authenticated;

-- ─── log_integration_call ─────────────────────────────────────────────────

create or replace function public.log_integration_call(
  p_org_id          uuid,
  p_integration_id  uuid,
  p_action          text,
  p_outcome         public.integration_call_outcome,
  p_status_code     integer default null,
  p_duration_ms     integer default null,
  p_request         jsonb default null,
  p_response        jsonb default null,
  p_error           text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.integration_logs (
    organization_id, integration_id, action, outcome,
    status_code, duration_ms, request_payload, response_payload, error_message
  )
  values (
    p_org_id, p_integration_id, p_action, p_outcome,
    p_status_code, p_duration_ms, p_request, p_response, p_error
  )
  returning id into v_id;

  -- Update integration status on failure pattern
  if p_outcome <> 'success' and p_integration_id is not null then
    update public.provider_integrations
      set last_error = p_error,
          status = case
            when status = 'connected' then 'degraded'
            when status = 'degraded' then 'error'
            else status
          end
      where id = p_integration_id;
  elsif p_outcome = 'success' and p_integration_id is not null then
    update public.provider_integrations
      set last_synced_at = now(),
          last_error = null,
          status = 'connected'
      where id = p_integration_id and status <> 'connected';
  end if;

  return v_id;
end;
$$;

grant execute on function public.log_integration_call(uuid, uuid, text, public.integration_call_outcome, integer, integer, jsonb, jsonb, text) to authenticated;
