-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 6: Marketplace engine functions
-- ─────────────────────────────────────────────────────────────────────────────
-- Functions:
--   place_order(...)               — atomically create order + items + commission
--   cancel_marketplace_order(...)  — cancel pending order
--   mark_order_completed(...)      — close + (later) trigger payout
--   compute_provider_payout(...)   — roll up completed orders for a period
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── place_order ──────────────────────────────────────────────────────────
-- Input: provider_id, resident_id, items[{service_item_id?, item_name, quantity, unit_price}], optional fees, currency
-- Effect: creates an order with auto-numbered order_number, inserts items,
--         computes commission based on provider's default settings, and writes
--         a row into commissions. Returns the order_id.

create or replace function public.place_order(
  p_provider_id     uuid,
  p_resident_id     uuid,
  p_items           jsonb,
  p_service_fee     numeric default 0,
  p_delivery_fee    numeric default 0,
  p_tax_amount      numeric default 0,
  p_currency        text default 'USD',
  p_scheduled_for   timestamptz default null,
  p_delivery_address text default null,
  p_delivery_notes  text default null,
  p_notes           text default null,
  p_compound_id     uuid default null,
  p_unit_id         uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider     public.service_providers%rowtype;
  v_resident     public.residents%rowtype;
  v_subtotal     numeric(12,2) := 0;
  v_total        numeric(12,2) := 0;
  v_commission   numeric(12,2) := 0;
  v_provider_net numeric(12,2) := 0;
  v_order_id     uuid;
  v_item         jsonb;
  v_qty          numeric(12,2);
  v_price        numeric(12,2);
  v_name         text;
  v_si_id        uuid;
  v_compound_id  uuid;
  v_unit_id      uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'place_order: items must be a non-empty JSON array';
  end if;

  select * into v_provider from public.service_providers where id = p_provider_id;
  if not found then raise exception 'place_order: provider not found'; end if;
  if not v_provider.is_active then raise exception 'place_order: provider not active'; end if;

  select * into v_resident from public.residents where id = p_resident_id;
  if not found then raise exception 'place_order: resident not found'; end if;
  if v_resident.organization_id <> v_provider.organization_id then
    raise exception 'place_order: provider and resident must be in the same organization';
  end if;

  v_compound_id := coalesce(p_compound_id, v_resident.compound_id, v_provider.compound_id);
  if v_compound_id is null then
    raise exception 'place_order: compound_id could not be resolved';
  end if;

  v_unit_id := coalesce(p_unit_id, v_resident.unit_id);

  -- Subtotal
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty   := coalesce((v_item ->> 'quantity')::numeric, 1);
    v_price := coalesce((v_item ->> 'unit_price')::numeric, 0);
    if v_qty <= 0 then raise exception 'place_order: item quantity must be > 0'; end if;
    if v_price < 0 then raise exception 'place_order: item unit_price must be >= 0'; end if;
    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
  end loop;

  v_total := round(v_subtotal + coalesce(p_service_fee, 0) + coalesce(p_delivery_fee, 0) + coalesce(p_tax_amount, 0), 2);

  -- Commission
  if v_provider.default_commission_kind = 'percentage' then
    v_commission := round(v_subtotal * (v_provider.default_commission_value / 100.0), 2);
  else
    v_commission := round(v_provider.default_commission_value, 2);
  end if;
  if v_commission > v_subtotal then v_commission := v_subtotal; end if;
  v_provider_net := round(v_subtotal - v_commission, 2);

  -- Insert order
  insert into public.marketplace_orders (
    organization_id, compound_id, resident_id, unit_id, provider_id,
    subtotal, service_fee, delivery_fee, tax_amount, total_amount,
    commission_amount, provider_net, currency,
    scheduled_for, delivery_address, delivery_notes, notes, created_by, updated_by
  ) values (
    v_provider.organization_id, v_compound_id, p_resident_id, v_unit_id, p_provider_id,
    v_subtotal, coalesce(p_service_fee,0), coalesce(p_delivery_fee,0), coalesce(p_tax_amount,0),
    v_total, v_commission, v_provider_net, coalesce(p_currency,'USD'),
    p_scheduled_for, p_delivery_address, p_delivery_notes, p_notes, auth.uid(), auth.uid()
  )
  returning id into v_order_id;

  -- Insert items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty   := coalesce((v_item ->> 'quantity')::numeric, 1);
    v_price := coalesce((v_item ->> 'unit_price')::numeric, 0);
    v_name  := coalesce(v_item ->> 'item_name', 'Item');
    v_si_id := nullif(v_item ->> 'service_item_id', '')::uuid;

    insert into public.marketplace_order_items (
      organization_id, order_id, service_item_id, item_name, quantity, unit_price, notes
    ) values (
      v_provider.organization_id, v_order_id, v_si_id, v_name, v_qty, v_price, v_item ->> 'notes'
    );
  end loop;

  -- Commission record
  insert into public.commissions (
    organization_id, order_id, provider_id, payee,
    commission_kind, commission_value, amount, currency
  ) values (
    v_provider.organization_id, v_order_id, p_provider_id, 'platform',
    v_provider.default_commission_kind, v_provider.default_commission_value, v_commission, coalesce(p_currency,'USD')
  );

  return v_order_id;
end;
$$;

revoke all on function public.place_order(uuid,uuid,jsonb,numeric,numeric,numeric,text,timestamptz,text,text,text,uuid,uuid) from public;
grant execute on function public.place_order(uuid,uuid,jsonb,numeric,numeric,numeric,text,timestamptz,text,text,text,uuid,uuid) to authenticated;

-- ─── cancel_marketplace_order ─────────────────────────────────────────────

create or replace function public.cancel_marketplace_order(
  p_order_id uuid,
  p_reason   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.marketplace_orders%rowtype;
begin
  select * into v_order from public.marketplace_orders where id = p_order_id for update;
  if not found then raise exception 'cancel_marketplace_order: order not found'; end if;

  if v_order.order_status in ('completed','cancelled','refunded') then
    raise exception 'cancel_marketplace_order: cannot cancel an order in status %', v_order.order_status;
  end if;

  update public.marketplace_orders
    set order_status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = p_reason,
        updated_by = auth.uid()
    where id = p_order_id;
end;
$$;

revoke all on function public.cancel_marketplace_order(uuid,text) from public;
grant execute on function public.cancel_marketplace_order(uuid,text) to authenticated;

-- ─── mark_order_completed ─────────────────────────────────────────────────

create or replace function public.mark_order_completed(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.marketplace_orders%rowtype;
begin
  select * into v_order from public.marketplace_orders where id = p_order_id for update;
  if not found then raise exception 'mark_order_completed: order not found'; end if;

  if v_order.order_status in ('cancelled','refunded') then
    raise exception 'mark_order_completed: order is %', v_order.order_status;
  end if;

  update public.marketplace_orders
    set order_status = 'completed',
        completed_at = coalesce(completed_at, now()),
        delivered_at = coalesce(delivered_at, now()),
        updated_by   = auth.uid()
    where id = p_order_id;
end;
$$;

revoke all on function public.mark_order_completed(uuid) from public;
grant execute on function public.mark_order_completed(uuid) to authenticated;

-- ─── compute_provider_payout ──────────────────────────────────────────────
-- Aggregates completed orders for a provider within a period and writes a
-- pending provider_payouts row. Idempotent on (provider_id, period_start, period_end).

create or replace function public.compute_provider_payout(
  p_provider_id  uuid,
  p_period_start date,
  p_period_end   date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider public.service_providers%rowtype;
  v_orders   int;
  v_gross    numeric(12,2);
  v_comm     numeric(12,2);
  v_net      numeric(12,2);
  v_payout_id uuid;
  v_currency text;
begin
  select * into v_provider from public.service_providers where id = p_provider_id;
  if not found then raise exception 'compute_provider_payout: provider not found'; end if;
  if p_period_end < p_period_start then
    raise exception 'compute_provider_payout: invalid period';
  end if;

  select count(*),
         coalesce(sum(total_amount), 0),
         coalesce(sum(commission_amount), 0),
         coalesce(sum(provider_net), 0),
         coalesce(max(currency), 'USD')
    into v_orders, v_gross, v_comm, v_net, v_currency
  from public.marketplace_orders
  where provider_id = p_provider_id
    and order_status = 'completed'
    and completed_at::date between p_period_start and p_period_end;

  -- Upsert by (provider, period)
  select id into v_payout_id
  from public.provider_payouts
  where provider_id = p_provider_id
    and period_start = p_period_start
    and period_end   = p_period_end
  limit 1;

  if v_payout_id is null then
    insert into public.provider_payouts (
      organization_id, provider_id, period_start, period_end,
      total_orders, gross_amount, commission_amount, net_amount, currency
    ) values (
      v_provider.organization_id, p_provider_id, p_period_start, p_period_end,
      v_orders, v_gross, v_comm, v_net, v_currency
    )
    returning id into v_payout_id;
  else
    update public.provider_payouts
      set total_orders = v_orders,
          gross_amount = v_gross,
          commission_amount = v_comm,
          net_amount   = v_net,
          currency     = v_currency,
          updated_at   = now()
      where id = v_payout_id;
  end if;

  return v_payout_id;
end;
$$;

revoke all on function public.compute_provider_payout(uuid,date,date) from public;
grant execute on function public.compute_provider_payout(uuid,date,date) to authenticated;
