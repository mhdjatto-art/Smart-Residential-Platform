-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 11: ERP bridge functions
-- ─────────────────────────────────────────────────────────────────────────────
-- Functions
--   generate_journal_entry_for_payment(payment_id)
--   generate_journal_entry_for_utility_bill(bill_id)
--   enqueue_journal_sync(entry_id)
--   log_erp_sync(...)
-- ─────────────────────────────────────────────────────────────────────────────

-- helper: lookup a mapping (most specific scope wins)
create or replace function public.resolve_account_for_mapping(
  p_integration_id uuid,
  p_kind public.mapping_kind,
  p_compound_id uuid default null,
  p_currency text default null,
  p_payment_method text default null
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select gl_account_external_id
  from public.account_mappings
  where integration_id = p_integration_id
    and mapping_kind = p_kind
    and (compound_id is null or compound_id = p_compound_id)
    and (currency is null or currency = p_currency)
    and (payment_method is null or payment_method = p_payment_method)
  order by
    case when compound_id    is not null then 0 else 1 end,
    case when currency       is not null then 0 else 1 end,
    case when payment_method is not null then 0 else 1 end
  limit 1;
$$;

grant execute on function public.resolve_account_for_mapping(uuid, public.mapping_kind, uuid, text, text) to authenticated;

-- ─── generate_journal_entry_for_payment ───────────────────────────────────
-- Converts a confirmed payment into a balanced double-entry JE.
-- Standard scheme:
--   Dr. Cash/Bank          (payment.amount)
--      Cr. Installment Receivable / Revenue   (payment.amount)
-- The exact accounts come from account_mappings for the org's active integration.

create or replace function public.generate_journal_entry_for_payment(p_payment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay        public.payments%rowtype;
  v_integration_id uuid;
  v_cash_acc   text;
  v_rcv_acc    text;
  v_entry_id   uuid;
  v_compound_id uuid;
begin
  select * into v_pay from public.payments where id = p_payment_id;
  if not found or v_pay.payment_status <> 'confirmed' then
    raise exception 'generate_journal_entry_for_payment: payment not found or not confirmed';
  end if;

  -- Idempotency: if there is already an entry pointing to this payment, return it.
  select id into v_entry_id from public.journal_entries
    where source_table = 'payments' and source_id = p_payment_id and status <> 'reversed'
    limit 1;
  if v_entry_id is not null then return v_entry_id; end if;

  -- Pick the active ERP integration for the org
  select id into v_integration_id
  from public.erp_integrations
  where organization_id = v_pay.organization_id and is_active and auto_push
  order by created_at asc
  limit 1;

  -- Look up mappings (works even if no integration — entry is still recorded with text 'TBD')
  v_compound_id := v_pay.compound_id;
  if v_integration_id is not null then
    v_cash_acc := public.resolve_account_for_mapping(v_integration_id, 'cash_account', v_compound_id, v_pay.currency, v_pay.payment_method::text);
    v_rcv_acc  := public.resolve_account_for_mapping(v_integration_id, 'customer_receivable', v_compound_id, v_pay.currency, null);
    if v_rcv_acc is null then
      v_rcv_acc := public.resolve_account_for_mapping(v_integration_id, 'installment_revenue', v_compound_id, v_pay.currency, null);
    end if;
  end if;

  -- Header
  insert into public.journal_entries (
    organization_id, integration_id, entry_date, reference, description,
    source_table, source_id, currency, total_amount, status
  )
  values (
    v_pay.organization_id, v_integration_id, v_pay.payment_date,
    'SRP/' || v_pay.payment_number,
    'Resident payment ' || v_pay.payment_number,
    'payments', v_pay.id, v_pay.currency, v_pay.payment_amount,
    case when v_integration_id is null then 'draft' else 'queued' end
  )
  returning id into v_entry_id;

  -- Lines: Debit cash, Credit receivable/revenue
  insert into public.journal_lines (
    organization_id, entry_id, line_number, account_external_id,
    debit, credit, description
  ) values
    (v_pay.organization_id, v_entry_id, 1, coalesce(v_cash_acc, 'TBD-CASH'),
     v_pay.payment_amount, 0,
     'Cash received via ' || v_pay.payment_method::text),
    (v_pay.organization_id, v_entry_id, 2, coalesce(v_rcv_acc, 'TBD-RCV'),
     0, v_pay.payment_amount,
     'Installment receivable cleared');

  -- If we have an integration, enqueue an ERP sync job (Phase 8 job_queue)
  if v_integration_id is not null then
    perform public.enqueue_job(
      v_pay.organization_id,
      'erp:push_journal_entry',
      jsonb_build_object('entry_id', v_entry_id, 'integration_id', v_integration_id),
      now(),
      'je-' || v_entry_id::text,
      null
    );
  end if;

  return v_entry_id;
end;
$$;

grant execute on function public.generate_journal_entry_for_payment(uuid) to authenticated;

-- ─── generate_journal_entry_for_utility_bill ──────────────────────────────
-- When a utility bill is issued (not paid yet):
--   Dr. Customer Receivable   (bill total)
--      Cr. Utility Revenue    (bill total)

create or replace function public.generate_journal_entry_for_utility_bill(p_bill_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill       public.utility_bills%rowtype;
  v_integration_id uuid;
  v_rev_acc    text;
  v_rcv_acc    text;
  v_entry_id   uuid;
begin
  select * into v_bill from public.utility_bills where id = p_bill_id;
  if not found then raise exception 'utility bill not found'; end if;

  select id into v_entry_id from public.journal_entries
    where source_table = 'utility_bills' and source_id = p_bill_id and status <> 'reversed' limit 1;
  if v_entry_id is not null then return v_entry_id; end if;

  select id into v_integration_id from public.erp_integrations
    where organization_id = v_bill.organization_id and is_active and auto_push
    order by created_at asc limit 1;

  if v_integration_id is not null then
    v_rev_acc := public.resolve_account_for_mapping(v_integration_id, 'utility_revenue',     v_bill.compound_id, v_bill.currency, null);
    v_rcv_acc := public.resolve_account_for_mapping(v_integration_id, 'customer_receivable', v_bill.compound_id, v_bill.currency, null);
  end if;

  insert into public.journal_entries (
    organization_id, integration_id, entry_date, reference, description,
    source_table, source_id, currency, total_amount, status
  )
  values (
    v_bill.organization_id, v_integration_id, current_date,
    'SRP/' || v_bill.bill_number, 'Utility bill ' || v_bill.bill_number,
    'utility_bills', v_bill.id, v_bill.currency, v_bill.total_amount,
    case when v_integration_id is null then 'draft' else 'queued' end
  )
  returning id into v_entry_id;

  insert into public.journal_lines (
    organization_id, entry_id, line_number, account_external_id, debit, credit, description
  ) values
    (v_bill.organization_id, v_entry_id, 1, coalesce(v_rcv_acc, 'TBD-RCV'), v_bill.total_amount, 0, 'Customer receivable — utility'),
    (v_bill.organization_id, v_entry_id, 2, coalesce(v_rev_acc, 'TBD-REV'), 0, v_bill.total_amount, 'Utility revenue — ' || v_bill.utility_type);

  if v_integration_id is not null then
    perform public.enqueue_job(
      v_bill.organization_id, 'erp:push_journal_entry',
      jsonb_build_object('entry_id', v_entry_id, 'integration_id', v_integration_id),
      now(), 'je-' || v_entry_id::text, null
    );
  end if;

  return v_entry_id;
end;
$$;

grant execute on function public.generate_journal_entry_for_utility_bill(uuid) to authenticated;

-- ─── log_erp_sync ─────────────────────────────────────────────────────────
-- Worker calls this after every adapter push. Updates the journal_entry
-- status + the integration's health.

create or replace function public.log_erp_sync(
  p_org_id        uuid,
  p_integration_id uuid,
  p_entry_id      uuid,
  p_action        text,
  p_outcome       public.sync_outcome,
  p_http_status   integer default null,
  p_duration_ms   integer default null,
  p_request       jsonb default null,
  p_response      jsonb default null,
  p_error         text default null,
  p_external_id   text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id bigint;
begin
  insert into public.erp_sync_log (
    organization_id, integration_id, entry_id, action, outcome,
    http_status, duration_ms, request_payload, response_payload,
    error_message, external_id_returned
  )
  values (
    p_org_id, p_integration_id, p_entry_id, p_action, p_outcome,
    p_http_status, p_duration_ms, p_request, p_response, p_error, p_external_id
  )
  returning id into v_log_id;

  if p_entry_id is not null and p_action = 'push_entry' then
    if p_outcome = 'success' then
      update public.journal_entries
        set status = 'posted', posted_at = now(), external_journal_id = p_external_id
        where id = p_entry_id;
    else
      update public.journal_entries
        set status = 'failed', failed_at = now(),
            retry_count = retry_count + 1
        where id = p_entry_id;
    end if;
  end if;

  if p_integration_id is not null then
    if p_outcome = 'success' then
      update public.erp_integrations
        set last_synced_at = now(), last_error = null,
            status = 'connected'
        where id = p_integration_id and status <> 'connected';
    else
      update public.erp_integrations
        set last_error = p_error,
            status = case when status = 'connected' then 'degraded' else status end
        where id = p_integration_id;
    end if;
  end if;

  return v_log_id;
end;
$$;

grant execute on function public.log_erp_sync(uuid, uuid, uuid, text, public.sync_outcome, integer, integer, jsonb, jsonb, text, text) to authenticated;
