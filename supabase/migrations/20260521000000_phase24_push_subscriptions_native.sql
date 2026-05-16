-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 24 — Extend push_subscriptions for native (APNS / FCM) tokens.
-- ─────────────────────────────────────────────────────────────────────────────
-- The table was originally created for web push (p256dh + auth keys are
-- required there). Native tokens are a single opaque string and don't
-- carry keys, so we:
--   1. Add `platform` to discriminate.
--   2. Add `organization_id` for org-scoped fan-out.
--   3. Add `updated_at` so the same device re-registering is a true upsert.
--   4. Relax p256dh/auth to NULLable (native rows leave them empty).
--   5. Replace the global `endpoint UNIQUE` with a composite `(user_id, endpoint)`
--      so two users on the same shared device get distinct rows.
-- Idempotent — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. New columns
alter table public.push_subscriptions
  add column if not exists platform        text;
alter table public.push_subscriptions
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.push_subscriptions
  add column if not exists updated_at      timestamptz not null default now();

-- Default existing rows to 'web' (they were created before this column existed)
update public.push_subscriptions
   set platform = 'web'
 where platform is null;

-- Enforce platform values via a CHECK (DROP first for idempotency)
alter table public.push_subscriptions
  drop constraint if exists ps_platform_check;
alter table public.push_subscriptions
  add  constraint  ps_platform_check
  check (platform in ('ios', 'android', 'web'));

-- After backfill, make it NOT NULL
alter table public.push_subscriptions
  alter column platform set not null;
alter table public.push_subscriptions
  alter column platform set default 'web';

-- 2. Relax p256dh / auth — native tokens won't have these
alter table public.push_subscriptions
  alter column p256dh drop not null;
alter table public.push_subscriptions
  alter column auth   drop not null;

-- 3. Swap the unique constraint
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_unique_endpoint;
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'push_subscriptions_user_endpoint_key'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint);
  end if;
end $$;

-- 4. Helpful index for fan-out by org
create index if not exists ps_org_idx on public.push_subscriptions (organization_id);
create index if not exists ps_platform_idx on public.push_subscriptions (platform);

-- 5. Auto-update updated_at on row change
create or replace function public.tg_push_subscriptions_touch()
  returns trigger
  language plpgsql
  as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_push_subscriptions_touch on public.push_subscriptions;
create trigger trg_push_subscriptions_touch
  before update on public.push_subscriptions
  for each row execute function public.tg_push_subscriptions_touch();

-- Comment for posterity
comment on table public.push_subscriptions is
  'Push notification subscriptions. Native rows (platform=ios|android) put the APNS/FCM token in `endpoint` and leave p256dh/auth NULL. Web rows fill all three.';
