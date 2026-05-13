-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — Contract e-signatures
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores the resident's hand-drawn signature (PNG data URL) along with metadata
-- about how the signature was captured (IP, user agent, signed_at). The signed
-- contract HTML is persisted at signing time so future edits to the template
-- cannot retroactively change what the resident actually saw and agreed to.
--
-- Run as super_admin in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.contract_signatures (
  id                uuid primary key default gen_random_uuid(),
  contract_id       uuid not null references public.installment_contracts(id) on delete cascade,
  resident_id       uuid not null references public.residents(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  signed_at         timestamptz not null default now(),
  signature_png     text not null,  -- data:image/png;base64,...
  full_name_typed   text,           -- optional typed full name as supplementary attestation
  template_id       uuid references public.contract_templates(id) on delete set null,
  rendered_html     text not null,  -- frozen snapshot of what the resident agreed to
  ip_address        text,
  user_agent        text,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  compound_id       uuid references public.compounds(id) on delete set null
);

-- One active signature per contract (residents can re-sign; we keep history).
create index if not exists cs_contract_idx on public.contract_signatures (contract_id, signed_at desc);
create index if not exists cs_resident_idx on public.contract_signatures (resident_id, signed_at desc);

alter table public.contract_signatures enable row level security;
alter table public.contract_signatures force row level security;

-- Resident can read + insert their own signatures.
drop policy if exists cs_resident_read on public.contract_signatures;
create policy cs_resident_read on public.contract_signatures
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists cs_resident_insert on public.contract_signatures;
create policy cs_resident_insert on public.contract_signatures
  for insert to authenticated
  with check (user_id = auth.uid());

-- Compound staff can read all signatures within their org.
drop policy if exists cs_staff_read on public.contract_signatures;
create policy cs_staff_read on public.contract_signatures
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('super_admin','developer_admin','compound_manager','finance_officer')
      and (ur.organization_id is null or ur.organization_id = contract_signatures.organization_id)
  ));
