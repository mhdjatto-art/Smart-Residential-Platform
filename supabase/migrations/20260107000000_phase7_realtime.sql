-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 7: enable Supabase Realtime publication on resident-facing tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime broadcasts row changes only for tables added to the
-- `supabase_realtime` publication. RLS still applies, so subscribers only
-- see rows they have SELECT permission on.
--
-- Idempotent: each ALTER PUBLICATION wrapped in a DO block that skips if the
-- table is already in the publication.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
  arr text[] := array[
    'notifications',
    'tickets',
    'visitors',
    'marketplace_orders',
    'utility_bills',
    'installment_schedules',
    'payments',
    'facility_bookings',
    'maintenance_jobs',
    'announcements'
  ];
begin
  foreach t in array arr loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       )
       and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = t and c.relkind = 'r')
    then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
