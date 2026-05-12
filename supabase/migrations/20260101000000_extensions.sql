-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Migration 001: Extensions
-- ─────────────────────────────────────────────────────────────────────────────
-- Enables PostgreSQL extensions used across the platform.
--   pgcrypto  → gen_random_uuid() for primary keys
--   citext    → case-insensitive emails
--   pg_trgm   → trigram search on names, addresses
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";
