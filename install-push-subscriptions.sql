-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — Web Push subscriptions table
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores one row per device that has subscribed to push notifications.
-- A user can have multiple subscriptions (phone + laptop + tablet).
-- Each subscription contains the Push API endpoint + the device's P-256 keys.
--
-- Run as super_admin in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  endpoint        text not null,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  constraint push_subscriptions_unique_endpoint unique (endpoint)
);

create index if not exists ps_user_idx on public.push_subscriptions (user_id);

-- RLS — a user can only see/manage their own subscriptions
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

drop policy if exists ps_select_own on public.push_subscriptions;
create policy ps_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists ps_insert_own on public.push_subscriptions;
create policy ps_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists ps_delete_own on public.push_subscriptions;
create policy ps_delete_own on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());

-- Service role bypasses RLS so the push sender can read every subscription.
