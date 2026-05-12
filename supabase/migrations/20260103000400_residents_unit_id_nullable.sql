-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 follow-up: residents.unit_id should be nullable
-- ─────────────────────────────────────────────────────────────────────────────
-- In Phase 1 every resident was tied to a single unit via residents.unit_id.
-- Phase 2 introduced unit_assignments as the source of truth, allowing a
-- resident to be created BEFORE any unit is assigned (and to have multiple
-- historical assignments). The NOT NULL constraint on residents.unit_id is
-- no longer valid and was blocking inserts from /residents/new.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.residents alter column unit_id drop not null;
