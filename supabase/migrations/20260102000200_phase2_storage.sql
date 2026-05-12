-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 2: Storage buckets + policies
-- ─────────────────────────────────────────────────────────────────────────────
-- One bucket per concern. Path convention: <org_id>/<kind>/<entity_id>/<file>
-- so each path is tenant-scoped and easy to check in RLS.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 10485760,
    array['image/jpeg','image/png','image/webp','application/pdf']::text[]),
  ('photos',    'photos',    true,   5242880,
    array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do nothing;

-- ─── Helper: extract organization id from path (first segment) ─────────────

create or replace function public.storage_org_from_path(p_path text)
returns uuid
language sql
immutable
as $$
  select case when p_path ~ '^[0-9a-f-]{36}/' then substring(p_path from 1 for 36)::uuid else null end;
$$;

-- ─── Policies for 'documents' bucket ───────────────────────────────────────

-- READ: anyone in the org / compound scope, or super admin.
create policy "documents_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or public.storage_org_from_path(name) in (select public.user_organization_ids())
    )
  );

-- WRITE: management role in the org.
create policy "documents_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or public.user_has_management_role(public.storage_org_from_path(name), null)
    )
  );

create policy "documents_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or public.user_has_management_role(public.storage_org_from_path(name), null)
    )
  );

create policy "documents_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or public.user_has_management_role(public.storage_org_from_path(name), null)
    )
  );

-- ─── Policies for 'photos' bucket (public reads, scoped writes) ────────────

create policy "photos_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (
      public.is_super_admin()
      or public.user_has_management_role(public.storage_org_from_path(name), null)
    )
  );

create policy "photos_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.is_super_admin()
      or public.user_has_management_role(public.storage_org_from_path(name), null)
    )
  );

create policy "photos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.is_super_admin()
      or public.user_has_management_role(public.storage_org_from_path(name), null)
    )
  );
