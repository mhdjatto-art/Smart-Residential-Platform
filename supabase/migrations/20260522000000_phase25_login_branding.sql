-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 25 — Login page branding + storage bucket.
-- ─────────────────────────────────────────────────────────────────────────────
-- Extends `organization_branding` with 3 new fields so each tenant can
-- customise their login screen:
--   - login_hero_path:     URL/path of the hero background image.
--   - login_welcome_title:    JSONB {en, ar, ku} multi-lang headline.
--   - login_welcome_subtitle: JSONB {en, ar, ku} subtitle/tagline.
--
-- Also creates a public Supabase Storage bucket `branding` so the new
-- BrandingImageUpload component can write logos / heroes / favicons
-- without each tenant having to wire up CDN URLs manually.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add the three columns to organization_branding
alter table public.organization_branding
  add column if not exists login_hero_path        text,
  add column if not exists login_welcome_title    jsonb default '{}'::jsonb,
  add column if not exists login_welcome_subtitle jsonb default '{}'::jsonb;

comment on column public.organization_branding.login_hero_path is
  'Public URL or storage path of the login-page hero/background image.';
comment on column public.organization_branding.login_welcome_title is
  'Multi-language welcome headline. Shape: {en, ar, ku}. Empty {} = use default.';
comment on column public.organization_branding.login_welcome_subtitle is
  'Multi-language subtitle. Shape: {en, ar, ku}.';

-- 2. Create the `branding` storage bucket if it doesn't exist.
--    Public read, authenticated write — RLS-style policies below.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- 3. RLS policies on storage.objects for the `branding` bucket.
--    Anyone can READ (so logos render on /login without auth).
--    Only super_admin / developer_admin / compound_manager can write.

drop policy if exists "branding_public_read" on storage.objects;
create policy "branding_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'branding');

drop policy if exists "branding_admin_insert" on storage.objects;
create policy "branding_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'branding'
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('super_admin','developer_admin','compound_manager')
    )
  );

drop policy if exists "branding_admin_update" on storage.objects;
create policy "branding_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'branding'
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('super_admin','developer_admin','compound_manager')
    )
  );

drop policy if exists "branding_admin_delete" on storage.objects;
create policy "branding_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'branding'
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('super_admin','developer_admin','compound_manager')
    )
  );
