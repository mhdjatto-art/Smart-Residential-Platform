-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 18 — Per-user preferences (theme + accent color + locale persistence)
-- ─────────────────────────────────────────────────────────────────────────────
-- Each authenticated user gets one row. Stores their personal theme overrides
-- which are layered on top of the org-level branding:
--   • theme            light | dark | system (default 'system')
--   • accent_color     optional hex override for primary tint
--   • locale_pref      ku | ar | en — overrides cookie if set
--   • notifications_*  per-channel mute toggles
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.user_preferences (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  theme                text not null default 'system' check (theme in ('light','dark','system')),
  accent_color         text,        -- hex like '#10b981'; null = use org branding
  locale_pref          text,        -- 'ku' | 'ar' | 'en'; null = use cookie/browser
  notify_email         boolean not null default true,
  notify_push          boolean not null default true,
  notify_in_app        boolean not null default true,
  updated_at           timestamptz not null default now()
);

comment on table public.user_preferences is
  'Per-user UI preferences (theme, accent color, locale). Layered on org branding.';

create index if not exists user_preferences_user_idx on public.user_preferences (user_id);

-- ─── RLS — each user reads/writes their own row only ─────────────────────────
alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_self_read  on public.user_preferences;
drop policy if exists user_preferences_self_write on public.user_preferences;

create policy user_preferences_self_read on public.user_preferences
  for select to authenticated
  using (user_id = auth.uid());

create policy user_preferences_self_write on public.user_preferences
  for all to authenticated
  using       (user_id = auth.uid())
  with check  (user_id = auth.uid());

-- ─── Upsert helper RPC — used by client-side settings form ───────────────────
create or replace function public.set_user_preferences(
  p_theme         text default null,
  p_accent_color  text default null,
  p_locale_pref   text default null,
  p_notify_email  boolean default null,
  p_notify_push   boolean default null,
  p_notify_in_app boolean default null
)
returns public.user_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row  public.user_preferences;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  insert into public.user_preferences (user_id, theme, accent_color, locale_pref, notify_email, notify_push, notify_in_app)
  values (
    v_user,
    coalesce(p_theme,         'system'),
    p_accent_color,
    p_locale_pref,
    coalesce(p_notify_email,  true),
    coalesce(p_notify_push,   true),
    coalesce(p_notify_in_app, true)
  )
  on conflict (user_id) do update
  set theme         = coalesce(excluded.theme,         user_preferences.theme),
      accent_color  = coalesce(excluded.accent_color,  user_preferences.accent_color),
      locale_pref   = coalesce(excluded.locale_pref,   user_preferences.locale_pref),
      notify_email  = coalesce(excluded.notify_email,  user_preferences.notify_email),
      notify_push   = coalesce(excluded.notify_push,   user_preferences.notify_push),
      notify_in_app = coalesce(excluded.notify_in_app, user_preferences.notify_in_app),
      updated_at    = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.set_user_preferences(text, text, text, boolean, boolean, boolean) to authenticated;

commit;
