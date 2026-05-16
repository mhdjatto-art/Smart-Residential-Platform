-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 23 — Security/quality hardening
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Prevent duplicate Stripe webhook ingestion via UNIQUE on external_reference
--    when present + non-empty. Two webhook hits with the same Stripe txn id
--    will now collide instead of double-charging the resident.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- Drop any prior version of the constraint/index so this is idempotent.
drop index if exists payments_external_reference_unique;

-- Partial unique index — only enforces uniqueness on rows that have a real ref.
-- NULL and empty strings are allowed (e.g. cash payments).
create unique index if not exists payments_external_reference_unique
  on public.payments (external_reference)
  where external_reference is not null and external_reference <> '';

comment on index payments_external_reference_unique is
  'Phase 23: prevents duplicate Stripe webhook ingestion by external txn id.';

commit;
