-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 13.1 — Prepaid Wallet System
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds a wallet/balance layer so every utility + rent + service can be
-- prepaid: resident tops up → balance shrinks as consumption arrives → at
-- zero the meter is cut off, on top-up it is restored.
--
-- This is ADDITIVE — the existing postpaid tables (utility_bills,
-- installment_schedules) keep working. Each utility_subscription gets a
-- new `billing_mode` column that selects prepaid vs postpaid.
--
-- Tables:
--   • utility_wallets        — balance per (resident, utility_type)
--   • wallet_topups          — recharge history (links to payments)
--   • wallet_deductions      — every withdrawal with reason + balance snapshot
--   • prepaid_tokens         — 20-digit STS tokens for token meters
--   • wallet_alerts          — low-balance + cutoff + restore events
--
-- RPCs:
--   • topup_wallet
--   • deduct_for_consumption
--   • check_balance_and_cutoff
--   • restore_after_topup
--   • generate_sts_token
--   • get_wallet_summary
--   • transfer_wallet_balance
--   • refund_wallet_topup
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;
create extension if not exists "pgcrypto";

-- ─── 1. Column additions on existing tables ────────────────────────────────

-- 1.1 utility_subscriptions → billing_mode + cached prepaid balance
alter table public.utility_subscriptions
  add column if not exists billing_mode      text not null default 'postpaid',
  add column if not exists prepaid_balance   numeric(14,4) not null default 0,
  add column if not exists low_balance_threshold numeric(14,4) not null default 5000,
  add column if not exists auto_cutoff       boolean not null default true,
  add column if not exists cutoff_at         timestamptz,
  add column if not exists restored_at       timestamptz;

do $blk1$
begin
  if not exists (select 1 from pg_constraint where conname = 'utility_subscriptions_billing_mode_chk') then
    alter table public.utility_subscriptions
      add constraint utility_subscriptions_billing_mode_chk
      check (billing_mode in ('prepaid','postpaid','hybrid'));
  end if;
end $blk1$;

create index if not exists usub_billing_mode_idx
  on public.utility_subscriptions (organization_id, billing_mode, status);

create index if not exists usub_low_balance_idx
  on public.utility_subscriptions (organization_id, prepaid_balance)
  where billing_mode = 'prepaid' and prepaid_balance <= low_balance_threshold;

-- 1.2 Allow installment_contracts to be prepaid too (rent paid upfront monthly)
alter table public.installment_contracts
  add column if not exists is_prepaid boolean not null default false,
  add column if not exists prepaid_months_paid integer not null default 0;

-- ─── 2. New tables ─────────────────────────────────────────────────────────

-- 2.1 utility_wallets — one wallet per (resident, utility_type) or per meter.
-- The unique key allows either resident-scoped (meter_id null) or meter-scoped
-- (meter_id set) wallets. Most setups use resident-scoped.
create table if not exists public.utility_wallets (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations(id) on delete cascade,
  compound_id               uuid not null references public.compounds(id)     on delete cascade,
  resident_id               uuid not null references public.residents(id)     on delete cascade,
  meter_id                  uuid references public.electricity_meters(id)     on delete set null,
  utility_type              public.utility_type not null,
  balance                   numeric(14,4) not null default 0,
  currency                  text not null default 'IQD',
  low_balance_threshold     numeric(14,4) not null default 5000,
  auto_cutoff_at_zero       boolean not null default true,
  status                    text not null default 'active' check (status in ('active','suspended','closed')),
  service_state             text not null default 'connected' check (service_state in ('connected','disconnected','grace_period')),
  grace_period_until        timestamptz,
  last_topup_at             timestamptz,
  last_topup_amount         numeric(14,4),
  last_deduction_at         timestamptz,
  last_low_balance_alert_at timestamptz,
  total_topped_up           numeric(14,4) not null default 0,
  total_consumed            numeric(14,4) not null default 0,
  metadata                  jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by                uuid references auth.users(id) on delete set null
);

-- One wallet per (resident, utility_type) when meter_id is null, OR
-- one wallet per (meter_id) when meter is set. Composite unique index.
create unique index if not exists uw_resident_utility_unique
  on public.utility_wallets (resident_id, utility_type)
  where meter_id is null;

create unique index if not exists uw_meter_unique
  on public.utility_wallets (meter_id)
  where meter_id is not null;

create index if not exists uw_org_utility_idx
  on public.utility_wallets (organization_id, utility_type, status);

create index if not exists uw_low_balance_idx
  on public.utility_wallets (organization_id, balance)
  where balance <= low_balance_threshold and status = 'active';

comment on table public.utility_wallets is
  'Prepaid balance per (resident, utility_type). Wallet drops as the meter consumes; recharges via topup_wallet RPC.';

-- 2.2 wallet_topups — recharge history (one row per top-up payment)
create table if not exists public.wallet_topups (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  wallet_id           uuid not null references public.utility_wallets(id) on delete cascade,
  amount              numeric(14,4) not null check (amount > 0),
  currency            text not null default 'IQD',
  balance_before      numeric(14,4) not null,
  balance_after       numeric(14,4) not null,
  payment_id          uuid references public.payments(id) on delete set null,
  topup_method        text not null check (topup_method in (
    'cash','bank_transfer','stripe','fastpay','zaincash','asiapay','token_card','admin_credit','refund','transfer_in'
  )),
  external_reference  text,
  external_token      text,
  idempotency_key     text,
  notes               text,
  refunded_at         timestamptz,
  refund_reason       text,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  constraint wallet_topups_idem_unique unique (organization_id, idempotency_key)
);

create index if not exists wtu_wallet_time_idx on public.wallet_topups (wallet_id, created_at desc);
create index if not exists wtu_payment_idx     on public.wallet_topups (payment_id) where payment_id is not null;
create index if not exists wtu_method_idx      on public.wallet_topups (organization_id, topup_method, created_at desc);

comment on table public.wallet_topups is
  'Every recharge of a utility wallet. Links to the payments row when paid via Stripe / cash / bank transfer.';

-- 2.3 wallet_deductions — every withdrawal (consumption, service fee, penalty, adjustment)
create table if not exists public.wallet_deductions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  wallet_id             uuid not null references public.utility_wallets(id) on delete cascade,
  amount                numeric(14,4) not null check (amount > 0),
  reason                text not null check (reason in (
    'consumption','service_fee','penalty','adjustment','reconnection_fee','transfer_out'
  )),
  balance_before        numeric(14,4) not null,
  balance_after         numeric(14,4) not null,
  usage_event_id        uuid references public.utility_usage_events(id) on delete set null,
  meter_reading_id      uuid references public.utility_meter_readings(id) on delete set null,
  units_consumed        numeric(14,4),
  unit_price            numeric(10,4),
  notes                 text,
  reversed_at           timestamptz,
  reversal_reason       text,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id) on delete set null
);

create index if not exists wde_wallet_time_idx   on public.wallet_deductions (wallet_id, created_at desc);
create index if not exists wde_reason_idx        on public.wallet_deductions (organization_id, reason, created_at desc);
create index if not exists wde_usage_event_idx   on public.wallet_deductions (usage_event_id) where usage_event_id is not null;
create index if not exists wde_meter_reading_idx on public.wallet_deductions (meter_reading_id) where meter_reading_id is not null;

comment on table public.wallet_deductions is
  'Every withdrawal from a wallet (consumption, service fee, penalty). Append-only — never updated except for reversed_at.';

-- 2.4 prepaid_tokens — 20-digit STS-style tokens for token-based meters
-- Used with meters from Aclara, Conlog, Itron, Hexing that accept a 20-digit
-- numeric key entered manually or scanned.
create table if not exists public.prepaid_tokens (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  meter_id            uuid not null references public.electricity_meters(id) on delete cascade,
  wallet_id           uuid not null references public.utility_wallets(id) on delete cascade,
  topup_id            uuid not null references public.wallet_topups(id) on delete cascade,
  token_value         text not null,
  token_format        text not null default 'STS' check (token_format in ('STS','HEXING','ITRON','VENDOR_SPECIFIC')),
  units_purchased     numeric(14,4) not null check (units_purchased > 0),
  units_unit          text not null default 'kWh',
  amount              numeric(14,4) not null,
  currency            text not null default 'IQD',
  status              text not null default 'pending' check (status in ('pending','delivered','used','expired','cancelled')),
  generated_at        timestamptz not null default now(),
  delivered_at        timestamptz,
  used_at             timestamptz,
  expires_at          timestamptz,
  metadata            jsonb not null default '{}'::jsonb
);

create unique index if not exists prepaid_tokens_value_uniq
  on public.prepaid_tokens (meter_id, token_value);
create index if not exists prepaid_tokens_wallet_idx
  on public.prepaid_tokens (wallet_id, generated_at desc);
create index if not exists prepaid_tokens_status_idx
  on public.prepaid_tokens (organization_id, status, generated_at desc);

comment on table public.prepaid_tokens is
  '20-digit STS tokens for token-based meters. Issued automatically after a topup_wallet call when meter.api_provider = STS_TOKEN.';

-- 2.5 wallet_alerts — low-balance + cutoff + restore notifications
create table if not exists public.wallet_alerts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  wallet_id       uuid not null references public.utility_wallets(id) on delete cascade,
  alert_kind      text not null check (alert_kind in (
    'low_balance','zero_balance','cutoff','restored','grace_started','grace_ended','admin_credit'
  )),
  balance_at_alert numeric(14,4),
  threshold       numeric(14,4),
  payload         jsonb not null default '{}'::jsonb,
  notified_at     timestamptz,
  occurred_at     timestamptz not null default now()
);

create index if not exists wa_wallet_time_idx
  on public.wallet_alerts (wallet_id, occurred_at desc);
create index if not exists wa_org_kind_idx
  on public.wallet_alerts (organization_id, alert_kind, occurred_at desc);

-- ─── 3. updated_at triggers + audit triggers ───────────────────────────────

drop trigger if exists utility_wallets_set_updated_at on public.utility_wallets;
create trigger utility_wallets_set_updated_at
  before update on public.utility_wallets
  for each row execute function public.set_updated_at();

do $blk_aud$
declare t text;
begin
  for t in select unnest(array[
    'utility_wallets','wallet_topups','wallet_deductions',
    'prepaid_tokens','wallet_alerts'
  ])
  loop
    execute format(
      'drop trigger if exists %I_audit on public.%I;
       create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_row();',
      t, t, t, t
    );
  end loop;
end $blk_aud$;

-- ─── 4. RLS ────────────────────────────────────────────────────────────────

alter table public.utility_wallets    enable row level security;
alter table public.wallet_topups      enable row level security;
alter table public.wallet_deductions  enable row level security;
alter table public.prepaid_tokens     enable row level security;
alter table public.wallet_alerts      enable row level security;

alter table public.utility_wallets    force row level security;
alter table public.wallet_topups      force row level security;
alter table public.wallet_deductions  force row level security;
alter table public.prepaid_tokens     force row level security;
alter table public.wallet_alerts      force row level security;

-- utility_wallets: resident sees own; management sees all in their org.
drop policy if exists uw_rls_v1_select on public.utility_wallets;
create policy uw_rls_v1_select on public.utility_wallets
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.residents r where r.id = resident_id and r.user_id = auth.uid())
  );

drop policy if exists uw_rls_v1_modify on public.utility_wallets;
create policy uw_rls_v1_modify on public.utility_wallets
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

-- wallet_topups: resident sees own; management sees all.
drop policy if exists wtu_rls_v1_select on public.wallet_topups;
create policy wtu_rls_v1_select on public.wallet_topups
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.utility_wallets w
      join public.residents r on r.id = w.resident_id
      where w.id = wallet_topups.wallet_id and r.user_id = auth.uid()
    )
  );

-- wallet_deductions: resident sees own; management sees all.
drop policy if exists wde_rls_v1_select on public.wallet_deductions;
create policy wde_rls_v1_select on public.wallet_deductions
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.utility_wallets w
      join public.residents r on r.id = w.resident_id
      where w.id = wallet_deductions.wallet_id and r.user_id = auth.uid()
    )
  );

-- prepaid_tokens: resident sees own; management sees all.
drop policy if exists pt_rls_v1_select on public.prepaid_tokens;
create policy pt_rls_v1_select on public.prepaid_tokens
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.utility_wallets w
      join public.residents r on r.id = w.resident_id
      where w.id = prepaid_tokens.wallet_id and r.user_id = auth.uid()
    )
  );

-- wallet_alerts: management only
drop policy if exists wa_rls_v1_select on public.wallet_alerts;
create policy wa_rls_v1_select on public.wallet_alerts
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- ─── 5. RPCs ───────────────────────────────────────────────────────────────

-- 5.1 topup_wallet — atomic topup with idempotency + audit + STS token gen
create or replace function public.topup_wallet(
  p_wallet_id        uuid,
  p_amount           numeric,
  p_method           text,
  p_payment_id       uuid default null,
  p_external_ref     text default null,
  p_idempotency_key  text default null,
  p_notes            text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_wallet  public.utility_wallets;
  v_topup_id uuid;
  v_was_below_zero boolean;
  v_idem    text;
  v_cached  jsonb;
  v_meter   public.electricity_meters;
  v_token   text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Top-up amount must be > 0' using errcode = '22000';
  end if;

  select * into v_wallet from public.utility_wallets where id = p_wallet_id for update;
  if v_wallet.id is null then
    raise exception 'Wallet % not found', p_wallet_id using errcode = '23503';
  end if;

  if not (public.is_super_admin()
          or public.user_has_management_role(v_wallet.organization_id, v_wallet.compound_id)
          or exists (
              select 1 from public.residents r
              where r.id = v_wallet.resident_id and r.user_id = auth.uid()
          )) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_wallet.status = 'closed' then
    raise exception 'Wallet is closed' using errcode = '22000';
  end if;

  v_idem := coalesce(p_idempotency_key,
    encode(digest(p_wallet_id::text || ':' || p_amount::text || ':' || coalesce(p_payment_id::text,'') || ':' || coalesce(p_external_ref,''), 'sha256'), 'hex'));
  v_cached := public._idempotency_begin(v_idem, 'topup_wallet', v_wallet.organization_id, v_idem);
  if v_cached is not null then
    return (v_cached->>'topup_id')::uuid;
  end if;

  v_was_below_zero := v_wallet.balance <= 0;

  insert into public.wallet_topups (
    organization_id, wallet_id, amount, currency,
    balance_before, balance_after,
    payment_id, topup_method, external_reference,
    idempotency_key, notes, created_by
  )
  values (
    v_wallet.organization_id, p_wallet_id, p_amount, v_wallet.currency,
    v_wallet.balance, v_wallet.balance + p_amount,
    p_payment_id, p_method, p_external_ref,
    v_idem, p_notes, auth.uid()
  )
  returning id into v_topup_id;

  update public.utility_wallets
     set balance = balance + p_amount,
         total_topped_up = total_topped_up + p_amount,
         last_topup_at = now(),
         last_topup_amount = p_amount
   where id = p_wallet_id;

  -- If wallet was at/below zero and is now positive → flag for restore
  if v_was_below_zero and (v_wallet.balance + p_amount) > 0 then
    insert into public.wallet_alerts (organization_id, wallet_id, alert_kind, balance_at_alert, payload)
    values (v_wallet.organization_id, p_wallet_id, 'restored', v_wallet.balance + p_amount,
            jsonb_build_object('topup_id', v_topup_id, 'amount', p_amount));
  end if;

  -- If wallet has a token-based meter, generate the STS token
  if v_wallet.meter_id is not null then
    select * into v_meter from public.electricity_meters where id = v_wallet.meter_id;
    if v_meter.api_provider in ('STS_TOKEN','HEXING','ITRON_TOKEN') then
      -- Generate a 20-digit numeric token deterministically from inputs
      v_token := substr(regexp_replace(
        (extract(epoch from now())::bigint::text
         || encode(digest(v_topup_id::text || v_meter.id::text, 'sha256'), 'hex')),
        '[^0-9]', '', 'g'), 1, 20);
      insert into public.prepaid_tokens (
        organization_id, meter_id, wallet_id, topup_id,
        token_value, token_format, units_purchased, units_unit, amount, currency, status
      )
      values (
        v_wallet.organization_id, v_meter.id, p_wallet_id, v_topup_id,
        v_token,
        case v_meter.api_provider
          when 'STS_TOKEN'    then 'STS'
          when 'HEXING'       then 'HEXING'
          when 'ITRON_TOKEN'  then 'ITRON'
          else 'VENDOR_SPECIFIC'
        end,
        p_amount / nullif(coalesce((select rate_per_unit from public.electricity_tariffs et
                                      where et.provider_id = v_meter.provider_id
                                      order by effective_from desc limit 1), 0), 0),
        coalesce(v_meter.reading_unit, 'kWh'),
        p_amount, v_wallet.currency, 'pending'
      );
    end if;
  end if;

  perform public.audit_admin_action(
    'wallet_topped_up', 'utility_wallets', p_wallet_id,
    v_wallet.organization_id, v_wallet.compound_id,
    'topup_wallet RPC',
    jsonb_build_object('amount', p_amount, 'method', p_method, 'topup_id', v_topup_id)
  );

  perform public._idempotency_complete(v_idem, jsonb_build_object('topup_id', v_topup_id));
  return v_topup_id;
exception when others then
  perform public._idempotency_fail(v_idem, sqlerrm);
  raise;
end;
$fn$;

grant execute on function public.topup_wallet(uuid,numeric,text,uuid,text,text,text) to authenticated;

-- 5.2 deduct_for_consumption — atomic deduction with cutoff handling
create or replace function public.deduct_for_consumption(
  p_wallet_id         uuid,
  p_amount            numeric,
  p_units_consumed    numeric default null,
  p_unit_price        numeric default null,
  p_usage_event_id    uuid default null,
  p_meter_reading_id  uuid default null,
  p_reason            text default 'consumption',
  p_notes             text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_wallet     public.utility_wallets;
  v_deduct_id  uuid;
  v_new_balance numeric(14,4);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Deduction must be > 0' using errcode = '22000';
  end if;

  select * into v_wallet from public.utility_wallets where id = p_wallet_id for update;
  if v_wallet.id is null then
    raise exception 'Wallet % not found', p_wallet_id using errcode = '23503';
  end if;

  -- Permission: management or system only (no resident self-deduct)
  if not (public.is_super_admin()
          or public.user_has_management_role(v_wallet.organization_id, v_wallet.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_new_balance := v_wallet.balance - p_amount;

  insert into public.wallet_deductions (
    organization_id, wallet_id, amount, reason,
    balance_before, balance_after,
    usage_event_id, meter_reading_id, units_consumed, unit_price,
    notes, created_by
  )
  values (
    v_wallet.organization_id, p_wallet_id, p_amount, p_reason,
    v_wallet.balance, v_new_balance,
    p_usage_event_id, p_meter_reading_id, p_units_consumed, p_unit_price,
    p_notes, auth.uid()
  )
  returning id into v_deduct_id;

  update public.utility_wallets
     set balance = v_new_balance,
         total_consumed = total_consumed + p_amount,
         last_deduction_at = now()
   where id = p_wallet_id;

  -- Trigger alerts based on the new balance
  if v_new_balance <= 0 and v_wallet.auto_cutoff_at_zero then
    perform public.check_balance_and_cutoff(p_wallet_id);
  elsif v_new_balance <= v_wallet.low_balance_threshold
        and (v_wallet.last_low_balance_alert_at is null
             or v_wallet.last_low_balance_alert_at < now() - interval '24 hours') then
    insert into public.wallet_alerts (organization_id, wallet_id, alert_kind, balance_at_alert, threshold, payload)
    values (v_wallet.organization_id, p_wallet_id, 'low_balance', v_new_balance, v_wallet.low_balance_threshold,
            jsonb_build_object('deduction_id', v_deduct_id));
    update public.utility_wallets set last_low_balance_alert_at = now() where id = p_wallet_id;
  end if;

  return v_deduct_id;
end;
$fn$;

grant execute on function public.deduct_for_consumption(uuid,numeric,numeric,numeric,uuid,uuid,text,text) to authenticated;

-- 5.3 check_balance_and_cutoff — disconnect service when balance reaches zero
create or replace function public.check_balance_and_cutoff(p_wallet_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_wallet public.utility_wallets;
begin
  select * into v_wallet from public.utility_wallets where id = p_wallet_id for update;
  if v_wallet.id is null then return false; end if;

  if v_wallet.balance > 0 then
    return false;
  end if;

  -- Already cut off?
  if v_wallet.service_state = 'disconnected' then
    return true;
  end if;

  update public.utility_wallets
     set service_state = 'disconnected',
         cutoff_at = now()
   where id = p_wallet_id;

  insert into public.wallet_alerts (organization_id, wallet_id, alert_kind, balance_at_alert, payload)
  values (v_wallet.organization_id, p_wallet_id, 'cutoff', v_wallet.balance,
          jsonb_build_object('auto_cutoff', v_wallet.auto_cutoff_at_zero));

  perform public.audit_admin_action(
    'wallet_service_cutoff', 'utility_wallets', p_wallet_id,
    v_wallet.organization_id, v_wallet.compound_id,
    'check_balance_and_cutoff RPC (balance reached zero)',
    jsonb_build_object('balance', v_wallet.balance)
  );

  return true;
end;
$fn$;

grant execute on function public.check_balance_and_cutoff(uuid) to authenticated;

-- 5.4 restore_after_topup — reconnect service after balance returns to positive
create or replace function public.restore_after_topup(p_wallet_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_wallet public.utility_wallets;
begin
  select * into v_wallet from public.utility_wallets where id = p_wallet_id for update;
  if v_wallet.id is null then return false; end if;

  if v_wallet.balance <= 0 then return false; end if;
  if v_wallet.service_state = 'connected' then return false; end if;

  update public.utility_wallets
     set service_state = 'connected',
         restored_at = now(),
         cutoff_at = null
   where id = p_wallet_id;

  insert into public.wallet_alerts (organization_id, wallet_id, alert_kind, balance_at_alert, payload)
  values (v_wallet.organization_id, p_wallet_id, 'restored', v_wallet.balance, '{}'::jsonb);

  perform public.audit_admin_action(
    'wallet_service_restored', 'utility_wallets', p_wallet_id,
    v_wallet.organization_id, v_wallet.compound_id,
    'restore_after_topup RPC',
    jsonb_build_object('balance', v_wallet.balance)
  );

  return true;
end;
$fn$;

grant execute on function public.restore_after_topup(uuid) to authenticated;

-- 5.5 generate_sts_token — explicit 20-digit token generation (cron-callable)
create or replace function public.generate_sts_token(
  p_meter_id     uuid,
  p_units        numeric,
  p_amount       numeric,
  p_wallet_id    uuid,
  p_topup_id     uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_meter public.electricity_meters;
  v_token text;
begin
  select * into v_meter from public.electricity_meters where id = p_meter_id;
  if v_meter.id is null then
    raise exception 'Meter % not found', p_meter_id using errcode = '23503';
  end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_meter.organization_id, v_meter.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Deterministic 20-digit numeric token. This is a stub — replace with a
  -- vendor-specific STS algorithm when integrating with real key-management
  -- system (KMS) for production STS tokens.
  v_token := substr(regexp_replace(
    encode(digest(p_meter_id::text || p_topup_id::text || extract(epoch from now())::bigint::text, 'sha256'), 'hex'),
    '[^0-9]', '', 'g'
  ), 1, 20);

  insert into public.prepaid_tokens (
    organization_id, meter_id, wallet_id, topup_id,
    token_value, token_format, units_purchased, units_unit,
    amount, currency, status, expires_at
  )
  values (
    v_meter.organization_id, p_meter_id, p_wallet_id, p_topup_id,
    v_token,
    case v_meter.api_provider
      when 'STS_TOKEN'   then 'STS'
      when 'HEXING'      then 'HEXING'
      when 'ITRON_TOKEN' then 'ITRON'
      else 'VENDOR_SPECIFIC'
    end,
    p_units, coalesce(v_meter.reading_unit, 'kWh'),
    p_amount, 'IQD', 'pending',
    now() + interval '60 days'
  );

  return v_token;
end;
$fn$;

grant execute on function public.generate_sts_token(uuid,numeric,numeric,uuid,uuid) to authenticated;

-- 5.6 get_wallet_summary — fast dashboard read for a resident
create or replace function public.get_wallet_summary(p_resident_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_resident public.residents;
  v_result   jsonb;
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
    'resident', jsonb_build_object('id', v_resident.id, 'name', concat_ws(' ', v_resident.first_name, v_resident.last_name)),
    'wallets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'utility_type', w.utility_type,
        'balance', w.balance,
        'currency', w.currency,
        'low_balance_threshold', w.low_balance_threshold,
        'is_low', w.balance <= w.low_balance_threshold,
        'is_zero_or_negative', w.balance <= 0,
        'service_state', w.service_state,
        'status', w.status,
        'last_topup_at', w.last_topup_at,
        'last_topup_amount', w.last_topup_amount,
        'total_topped_up', w.total_topped_up,
        'total_consumed', w.total_consumed
      ) order by w.utility_type)
      from public.utility_wallets w
      where w.resident_id = v_resident.id and w.status = 'active'
    ), '[]'::jsonb),
    'recent_topups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'amount', t.amount, 'method', t.topup_method,
        'balance_after', t.balance_after, 'created_at', t.created_at
      ) order by t.created_at desc)
      from public.wallet_topups t
      join public.utility_wallets w on w.id = t.wallet_id
      where w.resident_id = v_resident.id
      order by t.created_at desc
      limit 10
    ), '[]'::jsonb),
    'pending_tokens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pt.id, 'token', pt.token_value, 'units', pt.units_purchased,
        'amount', pt.amount, 'generated_at', pt.generated_at, 'expires_at', pt.expires_at
      ))
      from public.prepaid_tokens pt
      join public.utility_wallets w on w.id = pt.wallet_id
      where w.resident_id = v_resident.id and pt.status = 'pending'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$fn$;

grant execute on function public.get_wallet_summary(uuid) to authenticated;

-- 5.7 transfer_wallet_balance — move balance between two wallets (e.g. resident moves out)
create or replace function public.transfer_wallet_balance(
  p_from_wallet_id uuid,
  p_to_wallet_id   uuid,
  p_amount         numeric,
  p_reason         text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_from public.utility_wallets;
  v_to   public.utility_wallets;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be > 0' using errcode = '22000';
  end if;
  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Source and destination wallets must differ' using errcode = '22000';
  end if;

  -- Lock both in deterministic order to avoid deadlock
  if p_from_wallet_id < p_to_wallet_id then
    select * into v_from from public.utility_wallets where id = p_from_wallet_id for update;
    select * into v_to   from public.utility_wallets where id = p_to_wallet_id   for update;
  else
    select * into v_to   from public.utility_wallets where id = p_to_wallet_id   for update;
    select * into v_from from public.utility_wallets where id = p_from_wallet_id for update;
  end if;

  if v_from.id is null or v_to.id is null then
    raise exception 'One or both wallets not found' using errcode = '23503';
  end if;
  if v_from.organization_id <> v_to.organization_id then
    raise exception 'Cannot transfer across organizations' using errcode = '42501';
  end if;
  if not (public.is_super_admin() or public.user_has_management_role(v_from.organization_id, v_from.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if v_from.balance < p_amount then
    raise exception 'Insufficient balance' using errcode = '22000';
  end if;

  -- Deduct from source
  insert into public.wallet_deductions (
    organization_id, wallet_id, amount, reason,
    balance_before, balance_after, notes, created_by
  ) values (
    v_from.organization_id, p_from_wallet_id, p_amount, 'transfer_out',
    v_from.balance, v_from.balance - p_amount, p_reason, auth.uid()
  );
  update public.utility_wallets
     set balance = balance - p_amount, total_consumed = total_consumed + 0
   where id = p_from_wallet_id;

  -- Credit destination (as a topup with method = 'transfer_in')
  insert into public.wallet_topups (
    organization_id, wallet_id, amount, currency,
    balance_before, balance_after,
    topup_method, notes, created_by
  ) values (
    v_to.organization_id, p_to_wallet_id, p_amount, v_to.currency,
    v_to.balance, v_to.balance + p_amount,
    'transfer_in', p_reason, auth.uid()
  );
  update public.utility_wallets
     set balance = balance + p_amount, total_topped_up = total_topped_up + p_amount,
         last_topup_at = now(), last_topup_amount = p_amount
   where id = p_to_wallet_id;

  perform public.audit_admin_action(
    'wallet_transfer', 'utility_wallets', p_from_wallet_id,
    v_from.organization_id, v_from.compound_id,
    p_reason,
    jsonb_build_object('to_wallet_id', p_to_wallet_id, 'amount', p_amount)
  );

  return true;
end;
$fn$;

grant execute on function public.transfer_wallet_balance(uuid,uuid,numeric,text) to authenticated;

-- 5.8 refund_wallet_topup — reverse a topup (admin-only)
create or replace function public.refund_wallet_topup(
  p_topup_id uuid,
  p_reason   text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_topup  public.wallet_topups;
  v_wallet public.utility_wallets;
begin
  select * into v_topup from public.wallet_topups where id = p_topup_id;
  if v_topup.id is null then
    raise exception 'Topup not found' using errcode = '23503';
  end if;
  if v_topup.refunded_at is not null then
    raise exception 'Topup already refunded' using errcode = '22000';
  end if;

  select * into v_wallet from public.utility_wallets where id = v_topup.wallet_id for update;

  if not (public.is_super_admin() or public.user_has_management_role(v_wallet.organization_id, v_wallet.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Reverse the wallet balance
  update public.utility_wallets
     set balance = balance - v_topup.amount,
         total_topped_up = total_topped_up - v_topup.amount
   where id = v_topup.wallet_id;

  -- Mark the topup as refunded
  update public.wallet_topups
     set refunded_at = now(),
         refund_reason = p_reason
   where id = p_topup_id;

  -- Audit
  perform public.audit_admin_action(
    'wallet_topup_refunded', 'wallet_topups', p_topup_id,
    v_wallet.organization_id, v_wallet.compound_id,
    p_reason,
    jsonb_build_object('amount', v_topup.amount, 'wallet_id', v_topup.wallet_id)
  );

  return true;
end;
$fn$;

grant execute on function public.refund_wallet_topup(uuid,text) to authenticated;

-- ─── 6. Migration audit row ───────────────────────────────────────────────

insert into public.audit_log (actor_id, organization_id, table_name, row_id, action, diff, business_action)
values (
  null, null, 'schema', null, 'insert',
  jsonb_build_object('migration', '20260514000000_phase13_prepaid_wallets',
                     'applied_at', now()),
  'schema_migration_applied'
);

-- ─── 7. Comments

comment on column public.utility_subscriptions.billing_mode is
  'prepaid: wallet-based, no bills issued. postpaid: classic bill flow. hybrid: bills issued but partial prepayment accepted.';
comment on table public.wallet_topups   is 'Append-only recharge history. payment_id links to the underlying payment.';
comment on table public.wallet_deductions is 'Append-only consumption history. usage_event_id links to the utility_usage_events row.';
comment on table public.prepaid_tokens is 'STS / Hexing / Itron 20-digit tokens. Status flows: pending → delivered → used.';
comment on table public.wallet_alerts is 'low_balance / zero_balance / cutoff / restored events for downstream notifications.';
