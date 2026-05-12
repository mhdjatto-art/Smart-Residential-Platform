-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — local development seed
-- ─────────────────────────────────────────────────────────────────────────────
-- Run AFTER migrations and AFTER signing up a user via the app (or via
-- supabase auth admin). Replace the email below with your actual user.
--
-- Usage (local):
--   supabase db reset            # runs migrations
--   open /login → request OTP → verify, so the auth.users row exists
--   supabase db execute --file supabase/seed.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Promote yourself to super_admin
select public.bootstrap_super_admin('replace-me@example.com');

-- 2. Create a sample organization + developer_admin
-- select public.bootstrap_organization('Acme Developments', 'acme', 'replace-me@example.com');
