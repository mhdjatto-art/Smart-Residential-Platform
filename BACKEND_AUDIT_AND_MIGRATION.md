# SRP Backend — Audit, Re-architecture & Phase 12 Migration Plan

> Author: Backend architect review pass
> Date generated: 2026-05-13
> Scope: full backend (Phases 1 – 11 of `supabase/migrations/`)
> Target migration file:
> `supabase/migrations/20260513000000_phase12_metering_billing_hardening.sql`
> Companion RPC file:
> `supabase/migrations/20260513000100_phase12_rpc_functions.sql`
>
> This document is **additive only** for the existing schema. Nothing is
> dropped, renamed, or replaced without an explicit warning in
> section 12.

---

## Table of contents

1. Backend audit summary
2. Proposed architecture
3. Tables to add
4. Columns to add to existing tables
5. Relationship map
6. RLS policy design
7. Full SQL migration (Phase 12 schema + hardening)
8. RPC functions SQL
9. Test queries
10. Supabase checklist (after applying)
11. Frontend / API impact list
12. Dangerous changes — do **not** run without confirmation

---

## 1. Backend audit summary

### 1.1 Tables that exist today

Grouped by domain. Numbers in parentheses are realistic order-of-magnitude
expectations once the platform is in normal operation (1 organization with
~5 compounds, ~500 units, ~1,500 residents).

#### Tenancy & identity
| Table | Source | Expected rows |
|---|---|---|
| `organizations`              | `20260101000100_core_schema.sql` | 1 – 50 |
| `compounds`                  | core_schema                       | 1 – 500 |
| `buildings`                  | core_schema                       | 5 – 5,000 |
| `floors`                     | `phase2_schema.sql`               | 20 – 25,000 |
| `units`                      | core_schema + phase2              | 100 – 500,000 |
| `residents`                  | core_schema + phase2              | 100 – 1,500,000 |
| `unit_assignments`           | phase2_schema                     | grows with churn |
| `user_roles`                 | core_schema                       | one per role per scope |
| `family_members`             | phase2_schema                     | ~3× residents |
| `emergency_contacts`         | phase2_schema                     | ~2× residents |
| `vehicles`                   | phase2_schema                     | ~1× residents |

#### Documents
| Table | Source |
|---|---|
| `documents`                  | phase2_schema |

#### Finance — installment & resident-facing billing
| Table | Source |
|---|---|
| `installment_contracts`      | `phase3_schema.sql` |
| `installment_schedules`      | phase3_schema |
| `payments`                   | phase3_schema |
| `payment_allocations`        | phase3_schema |
| `penalties`                  | phase3_schema |
| `receipts`                   | phase3_schema |
| `financial_transactions`     | phase3_schema (immutable audit) |
| `payment_reminders`          | phase3_schema |

#### Operations
| Table | Source |
|---|---|
| `tickets`                    | `phase4_schema.sql` |
| `ticket_comments`            | phase4_schema |
| `technicians`                | phase4_schema |
| `maintenance_jobs`           | phase4_schema |
| `visitors`                   | phase4_schema |
| `security_logs`              | phase4_schema |
| `facilities`                 | phase4_schema |
| `facility_bookings`          | phase4_schema |
| `announcements`              | phase4_schema |
| `notifications`              | phase4_schema |

#### Utilities & metering (THIS IS WHERE PHASE 12 LIVES)
| Table | Source |
|---|---|
| `utility_providers`          | `phase5_schema.sql` |
| `internet_packages`          | phase5_schema |
| `utility_subscriptions`      | phase5_schema |
| `electricity_meters`         | phase5_schema (THIN — only 14 columns, electricity-named) |
| `meter_readings`             | phase5_schema |
| `electricity_tariffs`        | phase5_schema |
| `utility_bills`              | phase5_schema |
| `gas_orders`                 | phase5_schema |
| `service_suspensions`        | phase5_schema |
| `service_pricing_rules`      | `phase55_pricing_schema.sql` |
| `dynamic_tariffs`            | phase55_pricing_schema |
| `provider_integrations`      | phase55_pricing_schema |
| `integration_logs`           | phase55_pricing_schema |

#### Marketplace
| Table | Source |
|---|---|
| `service_providers`          | `phase6_schema.sql` |
| `service_categories`         | phase6_schema |
| `service_items`              | phase6_schema |
| `marketplace_orders`         | phase6_schema |
| `marketplace_order_items`    | phase6_schema |
| `commissions`                | phase6_schema |
| `provider_reviews`           | phase6_schema |
| `provider_payouts`           | phase6_schema |

#### Analytics / automation / SaaS
| Table | Source |
|---|---|
| `analytics_daily_kpi`        | `phase8_schema.sql` |
| `automation_rules`           | phase8_schema |
| `automation_runs`            | phase8_schema |
| `job_queue`                  | phase8_schema |
| `system_alerts`              | phase8_schema |
| `ai_predictions`             | phase8_schema |
| `report_definitions`         | phase8_schema |
| `report_runs`                | phase8_schema |
| `feature_catalog`            | `phase9_saas_schema.sql` |
| `subscription_plans`         | phase9_saas_schema |
| `plan_features`              | phase9_saas_schema |
| `organization_subscriptions` | phase9_saas_schema |
| `organization_feature_overrides` | phase9_saas_schema |
| `organization_branding`      | phase9_saas_schema |
| `organization_domains`       | phase9_saas_schema |
| `organization_settings`      | phase9_saas_schema |
| `saas_invoices`              | phase9_saas_schema |
| `usage_events`               | phase9_saas_schema |
| `usage_aggregates`           | phase9_saas_schema |

#### IoT & access
| Table | Source |
|---|---|
| `devices`                    | `phase10_iot_schema.sql` |
| `device_events`              | phase10_iot_schema |
| `device_commands`            | phase10_iot_schema |
| `access_zones`               | phase10_iot_schema |
| `access_logs`                | phase10_iot_schema |
| `parking_spots`              | phase10_iot_schema |
| `parking_assignments`        | phase10_iot_schema |

#### ERP bridge
| Table | Source |
|---|---|
| `gl_accounts`                | `phase11_erp_schema.sql` |
| `erp_integrations`           | phase11_erp_schema |
| `account_mappings`           | phase11_erp_schema |
| `journal_entries`            | phase11_erp_schema |
| `journal_lines`              | phase11_erp_schema |
| `erp_sync_log`               | phase11_erp_schema |

#### Out-of-migration installs (created from `install-*.sql` in repo root)
| Table | Source |
|---|---|
| `contract_templates`         | `install-contract-templates.sql` |
| `contract_signatures`        | `install-contract-signatures.sql` |

#### Cross-cutting
| Table | Source |
|---|---|
| `audit_log`                  | core_schema (mutated by `audit_row()` trigger) |

---

### 1.2 Concrete missing tables (justification per table)

These are the gaps that hurt today. Phase 12 introduces all of them
**additively**.

| New table | Why it has to exist |
|---|---|
| `utility_meter_readings`      | `meter_readings` exists but FKs **only** to `electricity_meters`. It cannot record a water/gas/internet meter reading. A non-electricity-specific table is required if we want one billing engine across utilities. |
| `usage_event` (utility-domain, **not** the SaaS `usage_events`) | The current `usage_events` table is a SaaS metering table (`active_units`, `api_calls`, …). There is **no** table that represents a *resident-side* utility usage event (1 kWh consumed at compound X by unit Y between t1..t2). We need it to separate raw provider data from billable amounts. |
| `utility_usage_aggregates`    | We aggregate utility usage today by joining `meter_readings` + `electricity_tariffs` on the fly. That doesn't scale and prevents tiered/time-of-use billing. A daily/period aggregate per (meter, utility_type) lets the bill generator be a pure read. |
| `provider_credentials`        | `provider_integrations.credentials_ref` is a free-text string. There is no table that holds the actual credentials (or a vault key reference). Phase 12 introduces a structured row per credential with `vault_key` and `env_var_name` columns — no plaintext. |
| `sync_jobs`                   | Today an external sync ad-hoc inserts into `integration_logs`. There is no job header to group logs, no retry state, no idempotency key. Sync jobs are the unit of work and need their own table. |
| `sync_job_logs`               | Granular per-call log for one `sync_job`. `integration_logs` survives, but Phase 12 funnels its data through `sync_job_logs` (linked to `sync_jobs`). The two coexist — we don't drop the old. |
| `external_reference_mapping`  | Several tables store a free-text `external_*_id`. There is no central place that links `(provider, external_id)` to an SRP row. Stripe webhooks, Mikrotik PPPoE accounts, Modbus device ids, Odoo partner ids all need this. |
| `utility_payment_allocation`  | `payment_allocations` only points at `installment_schedules`. Utility bills are paid through the same `payments` table but allocations cannot reach `utility_bills`. We need a parallel allocation row that says "this payment, ₹X, applied to utility_bill Y". |
| `payment_method_registry`     | The `payment_method` enum on `payments` is hard-coded (`cash`, `bank_transfer`, `online_payment`, `wallet`, `cheque`). There is no way to register a tenant-specific method (FastPay, ZainCash, Asia Hawala) without altering the enum. A registry table fixes this without touching the enum. |
| `service_overdue_actions`     | `service_suspensions` records that a suspension happened; it does not say which bill triggered it, what the dunning step was, or when the next step is. Phase 12 introduces a structured overdue-action log. |
| `idempotency_keys`            | RPCs that the user listed (`generate_utility_bill`, `mark_bill_as_paid`) must be safely retryable. Today there is no idempotency table — a duplicate webhook could double-charge or double-issue. |
| `admin_action_log`            | The user explicitly listed `audit_admin_action()` as an RPC. The existing `audit_log` is row-level (table + row_id). An admin operation like "manually waived penalty for resident X with reason Y" is not naturally a row mutation. We need a dedicated **business-action** log that supplements `audit_log`. |

---

### 1.3 Concrete missing columns on existing tables

#### `public.electricity_meters` — **the central gap**

Today it has:

```
id, organization_id, compound_id, unit_id,
meter_number, brand, model, serial_number, installed_at,
current_reading, unit_of_measure,
status, smart_enabled, adapter_kind, adapter_config,
notes, created_at, updated_at, created_by, updated_by
```

The user asked specifically for:

| New column | Type | Why |
|---|---|---|
| `meter_type`         | `text not null default 'standard' check (meter_type in ('standard','sub','main','bulk','prepaid','postpaid'))` | Distinguishes a building's main meter from sub-meters per unit. Today there is no way to tell. |
| `utility_type`       | `public.utility_type not null default 'electricity'` | Lets the same table store water/gas/heating meters. Pulls the table out of "electricity only" naming. |
| `provider_id`        | `uuid references public.utility_providers(id) on delete set null` | A meter belongs to a provider (e.g. Baghdad Electricity). Today it is orphaned. |
| `external_meter_id`  | `text` | Provider's id for the meter (Stripe meter, Mikrotik PPPoE secret name, Modbus device address). |
| `api_provider`       | `text` | Adapter kind override at the meter level — `adapter_kind` exists, but in practice a building may have a mix. |
| `last_reading`       | `numeric(14,4)` | Snapshot of the **previous** reading, used by the billing engine without scanning meter_readings. |
| `reading_unit`       | `text not null default 'kWh'` | `unit_of_measure` already exists but is "kWh"-defaulted; rename via additive column with a check constraint covering kWh / m3 / GB / liters / units. |
| `installation_date`  | `date` | We have `installed_at` already → keep both as aliases (one is `date`, one is the existing `date`). No-op if both already exist. |
| `last_sync_at`       | `timestamptz` | When the adapter last pulled a reading. |
| `sync_status`        | `text check (sync_status in ('idle','syncing','ok','error','disabled')) default 'idle'` | Sticky last-sync state. |
| `metadata`           | already exists, but Phase 12 ensures it. |

We **rename the table conceptually to `utility_meters`** by adding a
`public.utility_meters` view that selects from `electricity_meters` with
the same columns. We do **not** rename the table (that is in section 12).

#### `public.utility_bills`

| New column | Type | Why |
|---|---|---|
| `external_invoice_id`    | `text` | Provider gave us an invoice number that we want to keep alongside our `bill_number`. |
| `tariff_id`              | `uuid references public.electricity_tariffs(id) on delete set null` | Today `rate_per_unit` is denormalized on the bill. We need traceability to the tariff that produced it. |
| `dynamic_tariff_id`      | `uuid references public.dynamic_tariffs(id) on delete set null` | Same, but for the modern tariff table. |
| `idempotency_key`        | `text unique` | Prevent duplicate bills when a cron retries. |
| `generated_by_rpc`       | `text` | Audit which RPC generated this bill (`generate_utility_bill_v1`). |
| `consumption_aggregate_id` | `uuid references public.utility_usage_aggregates(id) on delete set null` | Pointer back to the aggregate that justifies the consumption number. |
| `suspended_at`           | `timestamptz` | Quick filter: which bills triggered a suspension and when. |

#### `public.utility_subscriptions`

| New column | Type | Why |
|---|---|---|
| `service_overdue_state` | `text check (service_overdue_state in ('current','warning','grace','suspended','restored')) default 'current'` | Right now the suspension state is implied by joining to `service_suspensions`. A denormalized field on the subscription speeds up dashboards. |
| `last_overdue_check_at` | `timestamptz` | Throttles the overdue scanner. |
| `dunning_step`          | `smallint not null default 0` | Sequential dunning escalation level (0 = none, 1 = reminder, 2 = grace, 3 = suspended). |

#### `public.payments`

| New column | Type | Why |
|---|---|---|
| `utility_bill_id`        | `uuid references public.utility_bills(id) on delete set null` | A direct one-shot link for utility payments. The polymorphic `payment_allocations` table is still the source of truth; this is a fast-path for the common 1-bill-1-payment case. |
| `idempotency_key`        | `text` | Same reason as above — prevent double processing of webhook retries. Add a unique index `(organization_id, idempotency_key)`. |
| `payment_method_code`    | `text` | Free-text method code that maps into `payment_method_registry`. The existing enum stays — `payment_method_code` is set when the enum value would be `online_payment` or `wallet`. |
| `gateway_provider`       | `text` | `stripe` / `fastpay` / `zaincash` / `cash_at_office` — denormalized for reporting. |
| `gateway_session_id`     | `text` | The Stripe `cs_…` checkout session id or equivalent. |
| `gateway_payment_intent` | `text` | Stripe `pi_…`. |

#### `public.utility_providers`

| New column | Type | Why |
|---|---|---|
| `country_code`   | `text` | Used by the providers browser page to group by country. The seed data already implies this, but it is in `metadata`. Promote it. |
| `region`         | `text` | "Baghdad", "Erbil", "Basra". |
| `support_url`    | `text` | Provider's customer-support landing page. |
| `currency`       | `text not null default 'USD'` | Provider's billing currency. |
| `is_default_for_kind` | `boolean not null default false` | "When an org adds a new building, which provider do we auto-attach?" |

#### `public.provider_integrations`

| New column | Type | Why |
|---|---|---|
| `vault_key`      | `text` | A reference to Supabase Vault. **No plaintext secret** in this column. |
| `env_var_name`   | `text` | Alternative to vault: read from server env at runtime. |
| `last_sync_job_id` | `uuid references public.sync_jobs(id) on delete set null` | Quick join to the most recent job. |

#### `public.audit_log`

| New column | Type | Why |
|---|---|---|
| `actor_role`     | `text` | Snapshot of the role at action time. The actor's roles can change later; we should record what they were. |
| `actor_email`    | `text` | Snapshot — `auth.users` rows can be deleted. |
| `request_id`     | `text` | Lets us correlate one HTTP request to all rows it touched. |
| `client_ip`      | `text` | Wired from edge middleware via `set_config('app.client_ip', ..., true)`. |
| `user_agent`     | `text` | Same. |
| `business_action`| `text` | Optional label for non-row-mutation events written via `audit_admin_action()`. |

---

### 1.4 Missing foreign keys

The following columns end in `_id` but are not declared FKs today. Phase 12
adds named FK constraints idempotently via the `DO $$ pg_constraint` pattern.

| Table | Column | Should reference | Notes |
|---|---|---|---|
| `documents` | `entity_id` | polymorphic — **cannot** be FK | Documented; we add a CHECK that `entity_type` is whitelisted (already there) plus a partial-FK validation trigger. |
| `system_alerts` | `entity_id` | polymorphic | Same — we add a trigger to validate row presence per `entity_table`. |
| `automation_runs` | `rule_id` | already FK in DDL — verified ok. | |
| `device_events` | `device_id` | already FK — verified ok. | |
| `journal_lines` | `account_external_id` | **text**, deliberately not FK (remote ERP id) | Phase 12 adds an index `(organization_id, account_external_id)` for the reconciliation report. |
| `ai_predictions` | `subject_id` | polymorphic | Same handling as `documents`. |
| `gl_accounts` | `external_id` | text, remote — adds composite index `(organization_id, integration_id, external_id)` already exists. | OK |
| `electricity_meters` | _no_ `provider_id` today | will reference `utility_providers(id)` | **Phase 12 adds this.** |
| `payments` | _no_ `utility_bill_id` today | will reference `utility_bills(id)` | **Phase 12 adds this.** |
| `meter_readings` | `meter_id` | references `electricity_meters` only | Phase 12 adds a *second* FK on `utility_meter_readings` so a non-electricity meter can also be read. |
| `notifications` | `entity_id` | polymorphic | Adds composite index `(user_id, entity_type, entity_id)`. |
| `usage_events` (SaaS) | no per-row source link | OK as-is. | |

---

### 1.5 Missing indexes

Concrete DDL — every one of these is in section 7.

```sql
-- Common tenant + status compound queries
create index if not exists tickets_org_status_priority_idx
  on public.tickets (organization_id, status, priority);

create index if not exists utility_bills_org_status_due_idx
  on public.utility_bills (organization_id, status, due_date)
  where status in ('issued','partial','overdue');

create index if not exists payments_org_status_date_idx
  on public.payments (organization_id, payment_status, payment_date desc);

create index if not exists residents_org_status_idx
  on public.residents (organization_id, status);

create index if not exists units_compound_status_idx
  on public.units (compound_id, status);

create index if not exists installment_contracts_org_status_idx
  on public.installment_contracts (organization_id, contract_status);

create index if not exists installment_schedules_org_due_status_idx
  on public.installment_schedules (organization_id, due_date, status);

create index if not exists utility_subscriptions_org_status_next_bill_idx
  on public.utility_subscriptions (organization_id, status, next_billing_date);

create index if not exists meter_readings_org_meter_date_idx
  on public.meter_readings (organization_id, meter_id, reading_date desc);

-- Audit log lookups (most common access pattern is "for this row, show me history")
create index if not exists audit_log_org_table_row_idx
  on public.audit_log (organization_id, table_name, row_id, created_at desc);

create index if not exists audit_log_actor_created_idx
  on public.audit_log (actor_id, created_at desc) where actor_id is not null;

-- SaaS billing & dashboards
create index if not exists saas_invoices_org_due_status_idx
  on public.saas_invoices (organization_id, due_date, status);

create index if not exists analytics_kpi_org_compound_date_idx
  on public.analytics_daily_kpi (organization_id, compound_id, kpi_date desc);

-- Marketplace
create index if not exists marketplace_orders_org_status_created_idx
  on public.marketplace_orders (organization_id, order_status, created_at desc);

create index if not exists provider_payouts_org_status_period_idx
  on public.provider_payouts (organization_id, status, period_start desc);

-- IoT
create index if not exists device_events_org_kind_time_idx
  on public.device_events (organization_id, event_kind, occurred_at desc);

create index if not exists access_logs_org_compound_outcome_idx
  on public.access_logs (organization_id, compound_id, outcome, occurred_at desc);

-- ERP
create index if not exists journal_entries_org_status_date_idx
  on public.journal_entries (organization_id, status, entry_date desc);
```

---

### 1.6 RLS holes

Going through every table in section 1.1:

| Table | RLS today | Hole |
|---|---|---|
| `audit_log` | enabled, **read-only** policy `audit_log_select` allows `is_super_admin` or any user in the org. | OK. Hardened in `install-audit-log.sql` to restrict to dev_admin / compound_manager / finance_officer. Phase 12 keeps that. |
| `financial_transactions` | RLS not declared in phase3. | **HOLE.** Phase 12 enables RLS with a read-only policy mirroring `audit_log_select`. Direct writes are already revoked. |
| `usage_events` (SaaS) | RLS declared in phase9_saas_rls. | OK. |
| `usage_aggregates` | RLS declared. | OK. |
| `automation_runs` | declared in phase8_rls. | OK. |
| `device_events` | declared in phase10_iot_rls. | OK. |
| `access_logs` | declared. | OK. |
| `integration_logs` | declared. | OK. |
| `notifications` | RLS declared but the policy permits any authenticated user to `select` rows where `user_id = auth.uid()`. | OK. |
| `payment_allocations` | declared. | OK. |
| `contract_templates` | declared in `install-contract-templates.sql` — `select` is **`using (true)`** — anyone authenticated can read every org's templates. | **HOLE.** Phase 12 restores tenant scoping with a `ct_select_v2_tenant` policy. |
| `parking_assignments` | declared. | OK. |
| `gl_accounts` | declared. | OK. |
| `service_pricing_rules` | declared. | OK. |
| `provider_integrations` | declared. | The read policy lets any org member see the row including `credentials_ref` and `webhook_secret`. **HOLE.** Phase 12 adds a `pi_select_v2_redacted` rule that filters those columns for non-admin staff (via a security definer wrapper view `vw_provider_integrations_safe`). |
| `dynamic_tariffs` | declared. | OK. |
| `device_commands` | declared. | OK. |
| `saas_invoices` | declared. | OK. |
| `analytics_daily_kpi` | declared. | OK. |
| `feature_catalog` | declared (read-only to all authenticated). | OK — it is a global table. |
| `subscription_plans` | declared. | OK. |
| `report_definitions` / `report_runs` | declared. | OK. |
| `unit_assignments` | declared in phase2_rls. | OK. |

> **New tables added in Phase 12** all get RLS enabled, FORCED, and
> versioned policy names of the form `<table>_rls_v2_<purpose>` so they
> never collide with anything that already exists.

---

### 1.7 Billing architecture issues

This is the area the user asked us to re-architect. Real problems:

1. **Raw reading vs. usage event are conflated.**
   `meter_readings.consumption` is a generated column: `reading_value -
   previous_reading`. That couples the raw provider data (today at 22:14
   the meter said 1,234 kWh) to the **derived** billing fact (between
   2026-04-01 and 2026-04-30 unit A-101 consumed 312 kWh). When a provider
   re-issues a reading, the consumption recalculates retroactively — the
   already-issued bill becomes "wrong" relative to its source.

   **Fix:** introduce `utility_meter_readings` (provider-side facts, immutable
   except for `is_validated`) and `utility_usage_events` (the period-scoped
   facts the billing engine consumes). The billing run snapshots the
   relevant usage events into a `utility_usage_aggregates` row, and the
   bill stores `consumption_aggregate_id`. After that, a re-issued raw
   reading cannot retroactively rewrite the bill.

2. **Bill ↔ invoice ↔ receipt are tangled in `utility_bills`.**
   `utility_bills` carries `paid_amount`, `payment_id`, `paid_at`, and a
   `receipts` row sits on `payments` only. Result: there is no clean way
   to ask "show me the receipt for utility bill X" without joining
   payments → payment_allocations → utility_bills, and that join doesn't
   exist today because `payment_allocations.installment_id` is the only
   FK out.

   **Fix:** introduce `utility_payment_allocation` mirroring the existing
   installment allocation, and add an optional `utility_bill_id` on
   `payments` for the simple 1-1 case. `receipts.payment_id` stays as-is.

3. **Idempotency of bill generation is enforced by `bill_number` uniqueness only.**
   If the cron picks up the same subscription twice in the same minute
   (two workers), we get two bills with two numbers and the constraint
   passes. Real-world: subscriptions get billed twice.

   **Fix:** Phase 12 adds `utility_bills.idempotency_key text unique` and
   the `generate_utility_bill_v1` RPC computes it as `sha256(subscription_id
   || ':' || billing_period_start || ':' || billing_period_end)`. Two
   workers hitting at once get one bill — the second errors cleanly.

4. **Overdue → suspension is a job, not a state.**
   `service_suspensions` only records "we suspended at T". There is no
   trail of (1) "we sent reminder #1 on T-7", (2) "we entered grace
   window on T+1", (3) "we suspended on T+8". The dunning policy is
   buried in application code.

   **Fix:** add `utility_subscriptions.dunning_step`, `last_overdue_check_at`,
   `service_overdue_state`, and a `service_overdue_actions` log table.

5. **Tariff application is done in the SQL function with no
   tariff-snapshot on the bill.**
   `utility_bills.rate_per_unit` is denormalized but the tariff `id` is
   not stored. Compliance / dispute resolution cannot answer "which
   tariff was in effect when this bill was generated?".

   **Fix:** `utility_bills.tariff_id` and `utility_bills.dynamic_tariff_id`
   FKs.

6. **No external_reference_mapping.**
   Stripe webhook arrives with `pi_3OabZc...`. We have nowhere structured
   to map it back to our `payments.id`. Today it lives in `payments.external_reference`,
   which is unindexed and free-form. A second webhook for the same payment
   intent cannot dedupe.

   **Fix:** `external_reference_mapping(provider, external_id) → (srp_table, srp_id)` is unique on (provider, external_id).

7. **`payment_method` enum is closed.**
   Adding ZainCash or FastPay needs `alter type … add value`. Phase 12
   keeps the enum (must not break existing data) but introduces
   `payment_method_registry` for tenant-defined methods, with
   `payments.payment_method_code` as the join.

---

### 1.8 Audit / security / logging gaps

| Gap | Impact | Fix in Phase 12 |
|---|---|---|
| `audit_log` records row mutations only — admin actions like "issued a manual refund" are recorded as a `payments` update with no context. | Compliance auditor cannot reconstruct *why*. | New `audit_admin_action(action, target_table, target_id, reason, payload)` RPC writes a labelled row to `audit_log` with `business_action` and `actor_role` snapshot. |
| `audit_log.actor_id` references `auth.users(id)`; when a user is deleted the actor becomes NULL. | Auditor loses identity. | New `actor_email` snapshot column. |
| No `request_id` / `client_ip` / `user_agent`. | Cannot correlate audit rows to one HTTP request. | New columns + middleware writes `SELECT set_config('app.request_id', '...', true)` before every query. |
| `provider_integrations.config` may contain plaintext secrets (some seed rows do today). | Anyone with org membership can `select` them. | Adds `credentials_ref` standard format + a view `vw_provider_integrations_safe` that nulls out config keys named `password`, `api_key`, `secret`, `token`. |
| Bill generation, payment confirmation, suspension, restoration: today the only artefact is a row mutation. | Auditor cannot replay the business flow. | RPCs in section 8 call `audit_admin_action` at every step. |
| `financial_transactions` has no RLS. | Insertion blocked at GRANT level, but read access is implicit. | Phase 12 enables RLS with a read-only policy. |

---

## 2. Proposed architecture

### 2.1 Generic metering model

A meter is generic — electricity, water, gas, internet, district heating,
even sub-units of any of those. Phase 12 reaches that without renaming
`electricity_meters` (see section 12).

```
provider_integrations          ← adapter config (mikrotik, modbus, …)
        │
        ▼
utility_providers ─────────────────────────────┐
        │                                       │
        ▼                                       ▼
electricity_meters (=utility_meters via view)   utility_subscriptions
        │                                       │
        ├──► utility_meter_readings (raw, immutable)
        │              │
        │              ▼
        │       utility_usage_events (period-bounded facts)
        │              │
        │              ▼
        └──► utility_usage_aggregates (rolled-up totals per period)
                       │
                       ▼
                  utility_bills ──► payments ──► receipts
                       │              │
                       ▼              ▼
              service_overdue_actions  utility_payment_allocation
                       │
                       ▼
              service_suspensions
```

Key invariants:

- **`utility_meter_readings`** is immutable once `is_validated = true`.
- **`utility_usage_events`** are emitted by either (a) the difference
  between two consecutive validated readings, or (b) the provider's API
  pushing usage directly (e.g. an ISP reporting GB consumed). Events are
  bounded by `period_start` / `period_end`.
- **`utility_usage_aggregates`** are derived from events for a single
  (meter, period) and cannot be edited directly.
- **`utility_bills.consumption_aggregate_id`** points back to the
  aggregate. A bill cannot exist without an aggregate, and an aggregate
  is frozen once a bill references it.

### 2.2 Clean separation

```
meter         → physical/logical device (electricity_meters row)
meter_reading → raw observation                       (utility_meter_readings)
usage_event   → period-bounded interpretation         (utility_usage_events)
usage_aggregate → roll-up per (meter, period)         (utility_usage_aggregates)
utility_bill  → priced invoice for an aggregate       (utility_bills + tariff_id)
payment       → money received                        (payments)
allocation    → links payment to bill                 (utility_payment_allocation)
receipt       → 1:1 with payment                      (receipts)
```

### 2.3 API integration layer

```
provider_integrations  ← adapter config
        │
        ├── credentials_ref ─► Supabase Vault key (preferred)
        ├── env_var_name    ─► server env (fallback)
        │
        ▼
sync_jobs ─────────────► sync_job_logs (1:N, granular call log)
        │
        ▼
external_reference_mapping (provider+external_id → SRP row)
```

- `sync_jobs.idempotency_key` prevents two workers from doing the same
  work.
- `sync_jobs.kind`: `pull_readings`, `push_disconnect`, `pull_invoices`,
  `webhook_in`.
- `sync_job_logs` is append-only; `integration_logs` continues to
  receive low-level data and is the historical-compatibility view.

### 2.4 Billing lifecycle

```
1. usage-collection      sync_jobs(kind='pull_readings')
                            └─► utility_meter_readings rows
                            └─► utility_usage_events rows
                            └─► utility_usage_aggregates row (computed)

2. tariff-application    calculate_usage_for_period() RPC
                            └─► aggregate × tariff = subtotal

3. invoice-generation    generate_utility_bill() RPC
                            └─► utility_bills row (with idempotency_key,
                                                   consumption_aggregate_id,
                                                   tariff_id)

4. payment-matching      mark_bill_as_paid() RPC
                            └─► payments row
                            └─► utility_payment_allocation row
                            └─► receipts row (auto)

5. overdue-detection     scan_overdue_bills() RPC (cron)
                            └─► utility_subscriptions.dunning_step++
                            └─► service_overdue_actions row

6. suspension            suspend_service_for_overdue_bill() RPC
                            └─► service_suspensions row
                            └─► utility_subscriptions.service_overdue_state='suspended'

7. restoration           restore_service_after_payment() RPC
                            └─► service_suspensions.released_at
                            └─► utility_subscriptions.service_overdue_state='restored'
```

### 2.5 Audit trail

Every privileged action ends up in `audit_log`:

- **Row-level mutations** flow through the existing `audit_row()`
  trigger. Phase 12 attaches the trigger to every new table it creates.
- **Business actions** (e.g. "manually waived penalty") flow through
  `audit_admin_action()` (a SECURITY DEFINER RPC). It inserts a row into
  `audit_log` with `action='admin'`, `business_action='<label>'`,
  `actor_role`, `actor_email`, and a `diff` jsonb describing what
  changed.
- **Webhook ingests** flow through `sync_job_logs` and a follow-up
  `audit_admin_action` call when they cause a write.

### 2.6 Multi-tenancy

Non-negotiable: every new table created by Phase 12 carries
`organization_id uuid not null references organizations(id) on delete cascade`,
plus a `compound_id` where the entity logically belongs to one compound.

---

## 3. Tables to add (full DDL preview)

> All DDL below is just preview — the consolidated migration in
> section 7 is what actually runs.

### 3.1 `utility_meter_readings`

```sql
create table if not exists public.utility_meter_readings (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  compound_id       uuid not null references public.compounds(id)     on delete cascade,
  meter_id          uuid not null references public.electricity_meters(id) on delete cascade,
  utility_type      public.utility_type not null,

  reading_value     numeric(14,4) not null check (reading_value >= 0),
  reading_unit      text not null default 'kWh',
  reading_at        timestamptz not null default now(),
  source            public.reading_source not null default 'manual',
  raw_payload       jsonb not null default '{}'::jsonb,
  external_reading_id text,
  is_validated      boolean not null default false,
  validated_by      uuid references auth.users(id) on delete set null,
  validated_at      timestamptz,
  validation_notes  text,

  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null
);
```

### 3.2 `utility_usage_events`

```sql
create table if not exists public.utility_usage_events (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  compound_id       uuid not null references public.compounds(id)     on delete cascade,
  meter_id          uuid references public.electricity_meters(id) on delete set null,
  subscription_id   uuid references public.utility_subscriptions(id) on delete set null,
  unit_id           uuid references public.units(id) on delete set null,
  utility_type      public.utility_type not null,

  period_start      timestamptz not null,
  period_end        timestamptz not null,
  quantity          numeric(14,4) not null check (quantity >= 0),
  quantity_unit     text not null,
  derived_from_reading_id uuid references public.utility_meter_readings(id) on delete set null,
  source            text not null default 'computed' check (source in ('computed','manual','api','adjustment')),
  notes             text,

  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  constraint uue_period_valid check (period_end > period_start)
);
```

### 3.3 `utility_usage_aggregates`

```sql
create table if not exists public.utility_usage_aggregates (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  compound_id       uuid not null references public.compounds(id)     on delete cascade,
  meter_id          uuid references public.electricity_meters(id) on delete set null,
  subscription_id   uuid references public.utility_subscriptions(id) on delete set null,
  utility_type      public.utility_type not null,

  period_start      date not null,
  period_end        date not null,
  total_quantity    numeric(14,4) not null check (total_quantity >= 0),
  quantity_unit     text not null,
  event_count       integer not null default 0,
  is_frozen         boolean not null default false,
  bill_id           uuid references public.utility_bills(id) on delete set null,

  computed_at       timestamptz not null default now(),
  constraint uua_period_valid check (period_end >= period_start),
  constraint uua_unique_per_period
    unique (organization_id, meter_id, subscription_id, utility_type, period_start, period_end)
);
```

### 3.4 `provider_credentials`

```sql
create table if not exists public.provider_credentials (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  integration_id    uuid not null references public.provider_integrations(id) on delete cascade,

  credential_name   text not null,
  vault_key         text,          -- pointer into Supabase Vault
  env_var_name      text,          -- alternative: read from process env
  scope             text,          -- e.g. 'read_only', 'admin'
  rotated_at        timestamptz,
  expires_at        timestamptz,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,

  constraint provider_credentials_no_plaintext
    check (vault_key is not null or env_var_name is not null),
  constraint provider_credentials_unique
    unique (integration_id, credential_name)
);
```

### 3.5 `sync_jobs`

```sql
create table if not exists public.sync_jobs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  integration_id    uuid references public.provider_integrations(id) on delete set null,
  provider_id       uuid references public.utility_providers(id) on delete set null,

  kind              text not null,                       -- 'pull_readings','push_disconnect','pull_invoices','webhook_in'
  status            text not null default 'queued'       -- 'queued','running','succeeded','failed','dead'
                    check (status in ('queued','running','succeeded','failed','dead')),
  scheduled_for     timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  attempts          integer not null default 0,
  max_attempts      integer not null default 5,
  idempotency_key   text,
  request_payload   jsonb not null default '{}'::jsonb,
  result_payload    jsonb,
  last_error        text,

  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,

  constraint sync_jobs_unique_idem unique (organization_id, idempotency_key)
);
```

### 3.6 `sync_job_logs`

```sql
create table if not exists public.sync_job_logs (
  id                bigserial primary key,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  sync_job_id       uuid not null references public.sync_jobs(id) on delete cascade,
  step              text not null,
  outcome           text not null check (outcome in ('success','failure','retry','noop')),
  http_status       integer,
  duration_ms       integer,
  request_payload   jsonb,
  response_payload  jsonb,
  error_message     text,
  occurred_at       timestamptz not null default now()
);
```

### 3.7 `external_reference_mapping`

```sql
create table if not exists public.external_reference_mapping (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  provider          text not null,                        -- 'stripe','fastpay','mikrotik','odoo','modbus'
  external_id       text not null,
  srp_table         text not null,
  srp_id            uuid not null,
  notes             text,
  created_at        timestamptz not null default now(),

  constraint erm_unique_external unique (organization_id, provider, external_id),
  constraint erm_unique_srp     unique (organization_id, srp_table, srp_id, provider)
);
```

### 3.8 `utility_payment_allocation`

```sql
create table if not exists public.utility_payment_allocation (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  payment_id        uuid not null references public.payments(id) on delete cascade,
  utility_bill_id   uuid not null references public.utility_bills(id) on delete cascade,
  amount            numeric(12,2) not null check (amount > 0),
  applied_to        text not null default 'subtotal'
                    check (applied_to in ('subtotal','tax','penalty')),
  created_at        timestamptz not null default now()
);
```

### 3.9 `payment_method_registry`

```sql
create table if not exists public.payment_method_registry (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  code              text not null,                       -- 'stripe','fastpay','zaincash','cash_at_office'
  display_name      text not null,
  gateway_provider  text,                                -- 'stripe' / 'fastpay' / 'zaincash' / 'manual'
  is_online         boolean not null default false,
  is_active         boolean not null default true,
  config            jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint payment_method_registry_unique unique (organization_id, code)
);
```

### 3.10 `service_overdue_actions`

```sql
create table if not exists public.service_overdue_actions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  compound_id       uuid not null references public.compounds(id)     on delete cascade,
  subscription_id   uuid references public.utility_subscriptions(id) on delete set null,
  utility_bill_id   uuid references public.utility_bills(id) on delete set null,
  action_kind       text not null check (action_kind in (
                       'reminder_sent','grace_started','grace_ended',
                       'suspension_warned','suspended','restored','manual_override')),
  dunning_step      smallint,
  outcome           text,
  payload           jsonb not null default '{}'::jsonb,
  actor_id          uuid references auth.users(id) on delete set null,
  occurred_at       timestamptz not null default now()
);
```

### 3.11 `idempotency_keys`

```sql
create table if not exists public.idempotency_keys (
  key               text primary key,
  organization_id   uuid references public.organizations(id) on delete cascade,
  scope             text not null,                        -- 'generate_utility_bill','mark_bill_as_paid', …
  request_hash      text,                                 -- sha256 of inputs
  response          jsonb,
  status            text not null default 'pending'
                    check (status in ('pending','succeeded','failed')),
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);
```

### 3.12 `admin_action_log`

> Adopted as a labelled view onto `audit_log`. We do **not** create a
> physical table — the user's constraint #5 requires us to use the
> existing `audit_log`. Instead Phase 12 adds an `audit_log.business_action`
> column and a view `public.admin_action_log` for the UI.

```sql
create or replace view public.admin_action_log as
select
  id, actor_id, actor_role, actor_email, organization_id, compound_id,
  table_name as target_table, row_id as target_id,
  business_action, diff, request_id, client_ip, user_agent, created_at
from public.audit_log
where business_action is not null;
```

---

## 4. Columns to add to existing tables

> See section 1.3 for the per-column justifications. Section 7 has the
> consolidated `ALTER TABLE ADD COLUMN IF NOT EXISTS` block.

Summary checklist:

- `electricity_meters` → 9 columns
- `utility_bills` → 7 columns
- `utility_subscriptions` → 3 columns
- `payments` → 6 columns
- `utility_providers` → 5 columns
- `provider_integrations` → 3 columns
- `audit_log` → 6 columns

---

## 5. Relationship map

```
organizations
  └── compounds
       └── buildings
            └── units
                 └── unit_assignments ── residents ── auth.users
                 ├── electricity_meters (=utility_meters) ── utility_providers
                 │      ├── utility_meter_readings (raw)
                 │      ├── utility_usage_events
                 │      └── utility_usage_aggregates
                 ├── utility_subscriptions ── internet_packages
                 │      ├── utility_bills
                 │      │     ├── utility_payment_allocation ── payments
                 │      │     ├── tariff_id ──► electricity_tariffs / dynamic_tariffs
                 │      │     └── consumption_aggregate_id ──► utility_usage_aggregates
                 │      ├── service_overdue_actions
                 │      └── service_suspensions
                 ├── tickets / maintenance_jobs / visitors / facility_bookings
                 └── installment_contracts ── installment_schedules ── payments

provider_integrations ── provider_credentials
                       ── sync_jobs ── sync_job_logs
                       ── integration_logs (legacy, kept)

every table (mutated row) ─► audit_log (via audit_row())
admin_action_log (view) ─► audit_log where business_action is not null
external_reference_mapping ── (provider, external_id) → (srp_table, srp_id)
idempotency_keys (server-side dedup)
payment_method_registry ── payments.payment_method_code
```

---

## 6. RLS policy design

> Helper functions reused — defined in `20260101000200_audit.sql`:
> `public.is_super_admin()`, `public.user_organization_ids()`,
> `public.user_compound_ids()`, `public.user_has_management_role(org, compound)`.

### 6.1 Role mapping (user's question)

The user asked about role names that do not exist in the
`public.app_role` enum. We resolve **without** altering the enum (the
user can later run a one-line `alter type … add value` if they want).

| User-supplied name | Maps to existing role | Notes |
|---|---|---|
| `master_admin` | `super_admin` | exact alias |
| `org_admin`    | `developer_admin` | org-wide admin |
| `finance_manager` | `finance_officer` | identical scope |
| `technician`   | `maintenance_staff` | identical scope |
| `viewer`       | _no equivalent_ | If you want a read-only role, run `alter type public.app_role add value 'viewer';` (must be in its own transaction). Phase 12 does **not** do this — it would be a destructive enum change. |

### 6.2 Per-table policies for new tables

Every new table follows this canonical template. Where the template is
identical we abbreviate; the consolidated SQL is in section 7.

**Template (replace `<t>`):**

```
ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.<t> FORCE ROW LEVEL SECURITY;

CREATE POLICY <t>_rls_v2_select ON public.<t>
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR organization_id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY <t>_rls_v2_insert ON public.<t>
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      organization_id IN (SELECT public.user_organization_ids())
      AND public.user_has_management_role(organization_id, compound_id)
    )
  );

CREATE POLICY <t>_rls_v2_update ON public.<t>
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_management_role(organization_id, compound_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.user_has_management_role(organization_id, compound_id)
  );

CREATE POLICY <t>_rls_v2_delete ON public.<t>
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = <t>.organization_id
        AND ur.role IN ('developer_admin','compound_manager')
    )
  );
```

Per-table specifics:

| Table | Notes |
|---|---|
| `utility_meter_readings` | residents can `select` their own meter readings (joined through `meter_id → unit_id → residents.unit_id`). Add a 5th policy `umr_rls_v2_self_read`. |
| `utility_usage_events`   | residents can `select` their own events. |
| `utility_usage_aggregates` | management roles only — residents see the bill, not the underlying aggregates. |
| `provider_credentials`   | **only `super_admin` and `developer_admin`** can `select`. No `compound_manager` access — credentials are platform-level. |
| `sync_jobs`              | management roles only. |
| `sync_job_logs`          | management roles only. |
| `external_reference_mapping` | super_admin + developer_admin. |
| `utility_payment_allocation` | management roles can read; residents can read where the joined bill is theirs. |
| `payment_method_registry` | management roles read & write; residents read only `is_active=true`. |
| `service_overdue_actions` | management roles read & write; residents can `select` rows where `subscription_id` belongs to their unit. |
| `idempotency_keys`       | `service_role` only — no `authenticated` access. We `revoke all on public.idempotency_keys from authenticated`. |

### 6.3 Versioned policy name pattern

All new policies use names `<table>_rls_v2_<purpose>` so they cannot
collide with the existing Phase 1-11 policies (which are unversioned).
Example: `utility_meter_readings_rls_v2_select`,
`utility_meter_readings_rls_v2_self_read`.

### 6.4 Existing-table RLS hardenings

We add new versioned policies on existing tables **without** dropping the
old ones (constraint #3):

- `financial_transactions_rls_v2_select` — enables read for org members.
- `contract_templates_rls_v2_tenant_select` — adds tenant scoping
  alongside the existing global `ct_read`. (Section 12 explains why the
  global policy should eventually be dropped.)
- `audit_log_rls_v2_admin_action_select` — equivalent to `audit_read_extended`
  but version-named so it survives future hand-edits.

---

## 7. Full SQL migration

> File: `supabase/migrations/20260513000000_phase12_metering_billing_hardening.sql`
>
> Idempotent. Safe to run multiple times.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 12 — Metering generalization, billing hardening, integration layer
-- ─────────────────────────────────────────────────────────────────────────────
-- This migration is ADDITIVE ONLY.
--   • No DROP TABLE
--   • No DROP COLUMN
--   • No RENAME of existing objects
--   • No removal of existing RLS policies
--
-- Tested patterns:
--   • CREATE TABLE IF NOT EXISTS
--   • ALTER TABLE ADD COLUMN IF NOT EXISTS
--   • CREATE INDEX IF NOT EXISTS
--   • Named FK constraints added via DO $$ … pg_constraint guard
--   • Policy names follow pattern <table>_rls_v2_<purpose>
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── 1. Column additions on existing tables ────────────────────────────────

-- 1.1 electricity_meters → become a generic utility meter
alter table public.electricity_meters
  add column if not exists meter_type        text         not null default 'standard',
  add column if not exists utility_type      public.utility_type not null default 'electricity',
  add column if not exists provider_id       uuid,
  add column if not exists external_meter_id text,
  add column if not exists api_provider      text,
  add column if not exists last_reading      numeric(14,4) not null default 0 check (last_reading >= 0),
  add column if not exists reading_unit      text         not null default 'kWh',
  add column if not exists installation_date date,
  add column if not exists last_sync_at      timestamptz,
  add column if not exists sync_status       text not null default 'idle';

-- Backfill installation_date from installed_at (both columns coexist; keep both).
update public.electricity_meters
   set installation_date = installed_at
 where installation_date is null and installed_at is not null;

-- Backfill reading_unit from unit_of_measure where compatible.
update public.electricity_meters
   set reading_unit = unit_of_measure
 where reading_unit = 'kWh' and unit_of_measure is distinct from 'kWh';

-- Named check + FK additions (idempotent).
do $$
begin
  -- meter_type whitelist
  if not exists (select 1 from pg_constraint where conname = 'electricity_meters_meter_type_chk') then
    alter table public.electricity_meters
      add constraint electricity_meters_meter_type_chk
      check (meter_type in ('standard','sub','main','bulk','prepaid','postpaid'));
  end if;

  -- sync_status whitelist
  if not exists (select 1 from pg_constraint where conname = 'electricity_meters_sync_status_chk') then
    alter table public.electricity_meters
      add constraint electricity_meters_sync_status_chk
      check (sync_status in ('idle','syncing','ok','error','disabled'));
  end if;

  -- provider FK
  if not exists (select 1 from pg_constraint where conname = 'electricity_meters_provider_id_fkey') then
    alter table public.electricity_meters
      add constraint electricity_meters_provider_id_fkey
      foreign key (provider_id) references public.utility_providers(id) on delete set null;
  end if;
end $$;

create index if not exists meters_provider_idx
  on public.electricity_meters (provider_id) where provider_id is not null;
create index if not exists meters_utility_type_idx
  on public.electricity_meters (organization_id, utility_type);
create index if not exists meters_sync_state_idx
  on public.electricity_meters (organization_id, sync_status, last_sync_at);

comment on column public.electricity_meters.meter_type
  is 'Distinguishes main/bulk/sub meters from unit-level standard meters.';
comment on column public.electricity_meters.utility_type
  is 'Generic utility type — table is no longer electricity-only.';
comment on column public.electricity_meters.provider_id
  is 'FK to utility_providers — answers ‘‘which utility company owns this meter’’.';
comment on column public.electricity_meters.external_meter_id
  is 'Provider-side identifier (Modbus address, ISP account, Mikrotik secret name).';
comment on column public.electricity_meters.last_reading
  is 'Snapshot of the previous reading_value; billing engine reads this without touching readings.';
comment on column public.electricity_meters.sync_status
  is 'idle | syncing | ok | error | disabled — driven by the sync_jobs worker.';

-- 1.2 utility_bills → traceability + idempotency
alter table public.utility_bills
  add column if not exists external_invoice_id      text,
  add column if not exists tariff_id                uuid,
  add column if not exists dynamic_tariff_id        uuid,
  add column if not exists idempotency_key          text,
  add column if not exists generated_by_rpc         text,
  add column if not exists consumption_aggregate_id uuid,
  add column if not exists suspended_at             timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'utility_bills_tariff_id_fkey') then
    alter table public.utility_bills
      add constraint utility_bills_tariff_id_fkey
      foreign key (tariff_id) references public.electricity_tariffs(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'utility_bills_dynamic_tariff_id_fkey') then
    alter table public.utility_bills
      add constraint utility_bills_dynamic_tariff_id_fkey
      foreign key (dynamic_tariff_id) references public.dynamic_tariffs(id) on delete set null;
  end if;
end $$;

create unique index if not exists utility_bills_idempotency_uidx
  on public.utility_bills (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists utility_bills_org_status_due_idx
  on public.utility_bills (organization_id, status, due_date)
  where status in ('issued','partial','overdue');

create index if not exists utility_bills_external_invoice_idx
  on public.utility_bills (organization_id, external_invoice_id)
  where external_invoice_id is not null;

comment on column public.utility_bills.idempotency_key
  is 'sha256(subscription_id || period_start || period_end) — prevents duplicate bills from concurrent workers.';
comment on column public.utility_bills.tariff_id
  is 'Snapshot of the tariff row used to compute this bill — keeps the bill auditable even if the tariff changes later.';

-- 1.3 utility_subscriptions → dunning state machine
alter table public.utility_subscriptions
  add column if not exists service_overdue_state  text not null default 'current',
  add column if not exists last_overdue_check_at  timestamptz,
  add column if not exists dunning_step           smallint not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'utility_subscriptions_overdue_state_chk') then
    alter table public.utility_subscriptions
      add constraint utility_subscriptions_overdue_state_chk
      check (service_overdue_state in ('current','warning','grace','suspended','restored'));
  end if;
end $$;

create index if not exists utility_subscriptions_org_state_idx
  on public.utility_subscriptions (organization_id, service_overdue_state)
  where status = 'active';

-- 1.4 payments → idempotency + utility-bill fast-path + gateway data
alter table public.payments
  add column if not exists utility_bill_id        uuid,
  add column if not exists idempotency_key        text,
  add column if not exists payment_method_code    text,
  add column if not exists gateway_provider       text,
  add column if not exists gateway_session_id     text,
  add column if not exists gateway_payment_intent text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_utility_bill_id_fkey') then
    alter table public.payments
      add constraint payments_utility_bill_id_fkey
      foreign key (utility_bill_id) references public.utility_bills(id) on delete set null;
  end if;
end $$;

create unique index if not exists payments_idempotency_uidx
  on public.payments (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists payments_utility_bill_idx
  on public.payments (utility_bill_id) where utility_bill_id is not null;

create index if not exists payments_gateway_intent_idx
  on public.payments (gateway_provider, gateway_payment_intent)
  where gateway_payment_intent is not null;

create index if not exists payments_org_status_date_idx
  on public.payments (organization_id, payment_status, payment_date desc);

-- 1.5 utility_providers → geography + currency + defaults
alter table public.utility_providers
  add column if not exists country_code          text,
  add column if not exists region                text,
  add column if not exists support_url           text,
  add column if not exists currency              text not null default 'USD',
  add column if not exists is_default_for_kind   boolean not null default false;

create index if not exists utility_providers_country_kind_idx
  on public.utility_providers (organization_id, country_code, provider_type);

-- 1.6 provider_integrations → secret references
alter table public.provider_integrations
  add column if not exists vault_key         text,
  add column if not exists env_var_name      text,
  add column if not exists last_sync_job_id  uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'provider_integrations_last_sync_job_fkey') then
    -- forward FK is added AFTER sync_jobs is created (see section 7.2 below)
    null;
  end if;
end $$;

-- 1.7 audit_log → request context + business-action label
alter table public.audit_log
  add column if not exists actor_role       text,
  add column if not exists actor_email      text,
  add column if not exists request_id       text,
  add column if not exists client_ip        text,
  add column if not exists user_agent       text,
  add column if not exists business_action  text;

create index if not exists audit_log_business_action_idx
  on public.audit_log (organization_id, business_action, created_at desc)
  where business_action is not null;

create index if not exists audit_log_request_idx
  on public.audit_log (request_id, created_at desc)
  where request_id is not null;

comment on column public.audit_log.business_action
  is 'Set by audit_admin_action() RPC — labels rows that are not pure trigger-driven mutations.';
comment on column public.audit_log.actor_role
  is 'Snapshot of the actor''s role at action time — survives role changes / user deletion.';

-- ─── 2. New tables ─────────────────────────────────────────────────────────

-- 2.1 utility_meter_readings (generic, immutable once validated)
create table if not exists public.utility_meter_readings (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  compound_id           uuid not null references public.compounds(id)     on delete cascade,
  meter_id              uuid not null references public.electricity_meters(id) on delete cascade,
  utility_type          public.utility_type not null,
  reading_value         numeric(14,4) not null check (reading_value >= 0),
  reading_unit          text not null default 'kWh',
  reading_at            timestamptz not null default now(),
  source                public.reading_source not null default 'manual',
  raw_payload           jsonb not null default '{}'::jsonb,
  external_reading_id   text,
  is_validated          boolean not null default false,
  validated_by          uuid references auth.users(id) on delete set null,
  validated_at          timestamptz,
  validation_notes      text,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id) on delete set null
);

create index if not exists umr_meter_time_idx
  on public.utility_meter_readings (meter_id, reading_at desc);
create index if not exists umr_org_type_time_idx
  on public.utility_meter_readings (organization_id, utility_type, reading_at desc);
create index if not exists umr_external_idx
  on public.utility_meter_readings (organization_id, external_reading_id)
  where external_reading_id is not null;

comment on table public.utility_meter_readings is
  'Raw provider-side meter readings. Generic across electricity/water/gas/internet. Immutable once is_validated=true.';

-- 2.2 utility_usage_events
create table if not exists public.utility_usage_events (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations(id) on delete cascade,
  compound_id              uuid not null references public.compounds(id)     on delete cascade,
  meter_id                 uuid references public.electricity_meters(id) on delete set null,
  subscription_id          uuid references public.utility_subscriptions(id) on delete set null,
  unit_id                  uuid references public.units(id) on delete set null,
  utility_type             public.utility_type not null,
  period_start             timestamptz not null,
  period_end               timestamptz not null,
  quantity                 numeric(14,4) not null check (quantity >= 0),
  quantity_unit            text not null,
  derived_from_reading_id  uuid references public.utility_meter_readings(id) on delete set null,
  source                   text not null default 'computed',
  notes                    text,
  created_at               timestamptz not null default now(),
  created_by               uuid references auth.users(id) on delete set null,
  constraint uue_period_valid check (period_end > period_start),
  constraint uue_source_chk   check (source in ('computed','manual','api','adjustment'))
);

create index if not exists uue_meter_period_idx
  on public.utility_usage_events (meter_id, period_start, period_end);
create index if not exists uue_sub_period_idx
  on public.utility_usage_events (subscription_id, period_start, period_end)
  where subscription_id is not null;
create index if not exists uue_org_type_period_idx
  on public.utility_usage_events (organization_id, utility_type, period_start);

-- 2.3 utility_usage_aggregates
create table if not exists public.utility_usage_aggregates (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  compound_id       uuid not null references public.compounds(id)     on delete cascade,
  meter_id          uuid references public.electricity_meters(id) on delete set null,
  subscription_id   uuid references public.utility_subscriptions(id) on delete set null,
  utility_type      public.utility_type not null,
  period_start      date not null,
  period_end        date not null,
  total_quantity    numeric(14,4) not null check (total_quantity >= 0),
  quantity_unit     text not null,
  event_count       integer not null default 0,
  is_frozen         boolean not null default false,
  bill_id           uuid references public.utility_bills(id) on delete set null,
  computed_at       timestamptz not null default now(),
  constraint uua_period_valid check (period_end >= period_start)
);

create unique index if not exists uua_unique_per_period
  on public.utility_usage_aggregates (
    organization_id,
    coalesce(meter_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(subscription_id, '00000000-0000-0000-0000-000000000000'::uuid),
    utility_type, period_start, period_end);

create index if not exists uua_org_type_period_idx
  on public.utility_usage_aggregates (organization_id, utility_type, period_start desc);

-- 2.4 Forward-link utility_bills.consumption_aggregate_id → utility_usage_aggregates
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'utility_bills_consumption_aggregate_id_fkey') then
    alter table public.utility_bills
      add constraint utility_bills_consumption_aggregate_id_fkey
      foreign key (consumption_aggregate_id) references public.utility_usage_aggregates(id) on delete set null;
  end if;
end $$;

-- 2.5 provider_credentials
create table if not exists public.provider_credentials (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  integration_id    uuid not null references public.provider_integrations(id) on delete cascade,
  credential_name   text not null,
  vault_key         text,
  env_var_name      text,
  scope             text,
  rotated_at        timestamptz,
  expires_at        timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  constraint provider_credentials_no_plaintext
    check (vault_key is not null or env_var_name is not null),
  constraint provider_credentials_unique
    unique (integration_id, credential_name)
);

create index if not exists provider_credentials_org_idx
  on public.provider_credentials (organization_id);

comment on table public.provider_credentials is
  'Reference-only credentials: vault_key (preferred) or env_var_name (fallback). No plaintext.';

-- 2.6 sync_jobs
create table if not exists public.sync_jobs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  integration_id    uuid references public.provider_integrations(id) on delete set null,
  provider_id       uuid references public.utility_providers(id) on delete set null,
  kind              text not null,
  status            text not null default 'queued' check (status in ('queued','running','succeeded','failed','dead')),
  scheduled_for     timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  attempts          integer not null default 0,
  max_attempts      integer not null default 5,
  idempotency_key   text,
  request_payload   jsonb not null default '{}'::jsonb,
  result_payload    jsonb,
  last_error        text,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  constraint sync_jobs_unique_idem unique (organization_id, idempotency_key)
);

create index if not exists sync_jobs_status_due_idx
  on public.sync_jobs (status, scheduled_for) where status in ('queued','running');
create index if not exists sync_jobs_org_kind_idx
  on public.sync_jobs (organization_id, kind, created_at desc);
create index if not exists sync_jobs_integration_idx
  on public.sync_jobs (integration_id, created_at desc) where integration_id is not null;

-- Close the forward reference on provider_integrations
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'provider_integrations_last_sync_job_fkey') then
    alter table public.provider_integrations
      add constraint provider_integrations_last_sync_job_fkey
      foreign key (last_sync_job_id) references public.sync_jobs(id) on delete set null;
  end if;
end $$;

-- 2.7 sync_job_logs
create table if not exists public.sync_job_logs (
  id                bigserial primary key,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  sync_job_id       uuid not null references public.sync_jobs(id) on delete cascade,
  step              text not null,
  outcome           text not null check (outcome in ('success','failure','retry','noop')),
  http_status       integer,
  duration_ms       integer,
  request_payload   jsonb,
  response_payload  jsonb,
  error_message     text,
  occurred_at       timestamptz not null default now()
);

create index if not exists sync_job_logs_job_idx
  on public.sync_job_logs (sync_job_id, occurred_at desc);
create index if not exists sync_job_logs_failures_idx
  on public.sync_job_logs (organization_id, occurred_at desc) where outcome <> 'success';

-- 2.8 external_reference_mapping
create table if not exists public.external_reference_mapping (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  provider          text not null,
  external_id       text not null,
  srp_table         text not null,
  srp_id            uuid not null,
  notes             text,
  created_at        timestamptz not null default now(),
  constraint erm_unique_external unique (organization_id, provider, external_id),
  constraint erm_unique_srp     unique (organization_id, srp_table, srp_id, provider)
);

create index if not exists erm_srp_lookup_idx
  on public.external_reference_mapping (organization_id, srp_table, srp_id);

-- 2.9 utility_payment_allocation
create table if not exists public.utility_payment_allocation (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  payment_id        uuid not null references public.payments(id) on delete cascade,
  utility_bill_id   uuid not null references public.utility_bills(id) on delete cascade,
  amount            numeric(12,2) not null check (amount > 0),
  applied_to        text not null default 'subtotal' check (applied_to in ('subtotal','tax','penalty')),
  created_at        timestamptz not null default now()
);

create index if not exists upa_payment_idx on public.utility_payment_allocation (payment_id);
create index if not exists upa_bill_idx    on public.utility_payment_allocation (utility_bill_id);

-- Enforce that the sum of allocations <= payment amount (mirrors the installment trigger).
create or replace function public.tg_check_utility_allocation_sum()
returns trigger
language plpgsql
as $$
declare
  v_payment_amount numeric(12,2);
  v_allocated      numeric(12,2);
begin
  select payment_amount into v_payment_amount from public.payments where id = new.payment_id;
  select coalesce(sum(amount), 0) into v_allocated
    from public.utility_payment_allocation where payment_id = new.payment_id;
  if v_allocated > v_payment_amount + 0.01 then
    raise exception 'Utility allocations (%) exceed payment amount (%)', v_allocated, v_payment_amount;
  end if;
  return new;
end;
$$;

drop trigger if exists upa_check_sum on public.utility_payment_allocation;
create trigger upa_check_sum
  after insert or update on public.utility_payment_allocation
  for each row execute function public.tg_check_utility_allocation_sum();

-- 2.10 payment_method_registry
create table if not exists public.payment_method_registry (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  code              text not null,
  display_name      text not null,
  gateway_provider  text,
  is_online         boolean not null default false,
  is_active         boolean not null default true,
  config            jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint payment_method_registry_unique unique (organization_id, code)
);

create index if not exists pmr_org_active_idx
  on public.payment_method_registry (organization_id) where is_active;

-- 2.11 service_overdue_actions
create table if not exists public.service_overdue_actions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  compound_id       uuid not null references public.compounds(id)     on delete cascade,
  subscription_id   uuid references public.utility_subscriptions(id) on delete set null,
  utility_bill_id   uuid references public.utility_bills(id) on delete set null,
  action_kind       text not null check (action_kind in (
                       'reminder_sent','grace_started','grace_ended',
                       'suspension_warned','suspended','restored','manual_override')),
  dunning_step      smallint,
  outcome           text,
  payload           jsonb not null default '{}'::jsonb,
  actor_id          uuid references auth.users(id) on delete set null,
  occurred_at       timestamptz not null default now()
);

create index if not exists soa_sub_time_idx
  on public.service_overdue_actions (subscription_id, occurred_at desc) where subscription_id is not null;
create index if not exists soa_bill_idx
  on public.service_overdue_actions (utility_bill_id) where utility_bill_id is not null;
create index if not exists soa_org_kind_idx
  on public.service_overdue_actions (organization_id, action_kind, occurred_at desc);

-- 2.12 idempotency_keys (server-side dedup table for RPCs)
create table if not exists public.idempotency_keys (
  key               text primary key,
  organization_id   uuid references public.organizations(id) on delete cascade,
  scope             text not null,
  request_hash      text,
  response          jsonb,
  status            text not null default 'pending' check (status in ('pending','succeeded','failed')),
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index if not exists idempotency_keys_org_scope_idx
  on public.idempotency_keys (organization_id, scope, created_at desc) where organization_id is not null;

-- Revoke direct access — only RPCs (SECURITY DEFINER) write to it.
revoke insert, update, delete on public.idempotency_keys from authenticated, anon;

-- 2.13 admin_action_log view (over audit_log)
create or replace view public.admin_action_log as
select
  id, actor_id, actor_role, actor_email,
  organization_id, compound_id,
  table_name as target_table, row_id as target_id,
  business_action, diff, request_id, client_ip, user_agent, created_at
from public.audit_log
where business_action is not null;

comment on view public.admin_action_log is
  'Read-only view onto audit_log filtered to business-action rows (written by audit_admin_action()).';

-- ─── 3. Missing indexes on existing tables ─────────────────────────────────

create index if not exists tickets_org_status_priority_idx
  on public.tickets (organization_id, status, priority);

create index if not exists residents_org_status_idx
  on public.residents (organization_id, status);

create index if not exists units_compound_status_idx
  on public.units (compound_id, status);

create index if not exists installment_contracts_org_status_idx
  on public.installment_contracts (organization_id, contract_status);

create index if not exists installment_schedules_org_due_status_idx
  on public.installment_schedules (organization_id, due_date, status);

create index if not exists utility_subscriptions_org_status_next_bill_idx
  on public.utility_subscriptions (organization_id, status, next_billing_date);

create index if not exists meter_readings_org_meter_date_idx
  on public.meter_readings (organization_id, meter_id, reading_date desc);

create index if not exists audit_log_org_table_row_idx
  on public.audit_log (organization_id, table_name, row_id, created_at desc);

create index if not exists audit_log_actor_created_idx
  on public.audit_log (actor_id, created_at desc) where actor_id is not null;

create index if not exists saas_invoices_org_due_status_idx
  on public.saas_invoices (organization_id, due_date, status);

create index if not exists analytics_kpi_org_compound_date_idx
  on public.analytics_daily_kpi (organization_id, compound_id, kpi_date desc);

create index if not exists marketplace_orders_org_status_created_idx
  on public.marketplace_orders (organization_id, order_status, created_at desc);

create index if not exists provider_payouts_org_status_period_idx
  on public.provider_payouts (organization_id, status, period_start desc);

create index if not exists device_events_org_kind_time_idx
  on public.device_events (organization_id, event_kind, occurred_at desc);

create index if not exists access_logs_org_compound_outcome_idx
  on public.access_logs (organization_id, compound_id, outcome, occurred_at desc);

create index if not exists journal_entries_org_status_date_idx
  on public.journal_entries (organization_id, status, entry_date desc);

create index if not exists notifications_user_entity_idx
  on public.notifications (user_id, entity_type, entity_id) where entity_id is not null;

-- ─── 4. updated_at + audit triggers on new tables ──────────────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'utility_meter_readings',          -- append-only-ish; safe to track updated_at? skip — it's create-once
    'utility_usage_events',            -- append-only
    'utility_usage_aggregates',
    'provider_credentials',
    'sync_jobs',
    'sync_job_logs',                   -- append-only
    'external_reference_mapping',
    'utility_payment_allocation',
    'payment_method_registry',
    'service_overdue_actions',
    'idempotency_keys'
  ])
  loop
    -- updated_at trigger (skip for append-only / immutable tables)
    if t not in ('utility_meter_readings','utility_usage_events','sync_job_logs',
                 'external_reference_mapping','utility_payment_allocation',
                 'service_overdue_actions','idempotency_keys') then
      execute format(
        'drop trigger if exists %I_set_updated_at on public.%I;
         create trigger %I_set_updated_at before update on public.%I
           for each row execute function public.set_updated_at();', t, t, t, t
      );
    end if;

    -- audit trigger — every table feeds the central audit_log
    execute format(
      'drop trigger if exists %I_audit on public.%I;
       create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_row();', t, t, t, t
    );
  end loop;
end $$;

-- 4.1 admin_action_log view does not have triggers (it's a view).

-- ─── 5. RLS — enable + force on every new table ────────────────────────────

alter table public.utility_meter_readings    enable row level security;
alter table public.utility_usage_events      enable row level security;
alter table public.utility_usage_aggregates  enable row level security;
alter table public.provider_credentials      enable row level security;
alter table public.sync_jobs                 enable row level security;
alter table public.sync_job_logs             enable row level security;
alter table public.external_reference_mapping enable row level security;
alter table public.utility_payment_allocation enable row level security;
alter table public.payment_method_registry   enable row level security;
alter table public.service_overdue_actions   enable row level security;
alter table public.idempotency_keys          enable row level security;

alter table public.utility_meter_readings    force row level security;
alter table public.utility_usage_events      force row level security;
alter table public.utility_usage_aggregates  force row level security;
alter table public.provider_credentials      force row level security;
alter table public.sync_jobs                 force row level security;
alter table public.sync_job_logs             force row level security;
alter table public.external_reference_mapping force row level security;
alter table public.utility_payment_allocation force row level security;
alter table public.payment_method_registry   force row level security;
alter table public.service_overdue_actions   force row level security;
alter table public.idempotency_keys          force row level security;

-- 5.1 utility_meter_readings policies

create policy utility_meter_readings_rls_v2_select on public.utility_meter_readings
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.user_id = auth.uid()
        and r.unit_id = (select unit_id from public.electricity_meters m where m.id = utility_meter_readings.meter_id)
    )
  );

create policy utility_meter_readings_rls_v2_insert on public.utility_meter_readings
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

create policy utility_meter_readings_rls_v2_update on public.utility_meter_readings
  for update to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

create policy utility_meter_readings_rls_v2_delete on public.utility_meter_readings
  for delete to authenticated
  using (public.is_super_admin());

-- 5.2 utility_usage_events policies

create policy utility_usage_events_rls_v2_select on public.utility_usage_events
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.residents r
      where r.user_id = auth.uid()
        and r.id = (select resident_id from public.utility_subscriptions s where s.id = utility_usage_events.subscription_id)
    )
  );

create policy utility_usage_events_rls_v2_insert on public.utility_usage_events
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

create policy utility_usage_events_rls_v2_update on public.utility_usage_events
  for update to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

create policy utility_usage_events_rls_v2_delete on public.utility_usage_events
  for delete to authenticated
  using (public.is_super_admin());

-- 5.3 utility_usage_aggregates — management roles only

create policy utility_usage_aggregates_rls_v2_select on public.utility_usage_aggregates
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

create policy utility_usage_aggregates_rls_v2_modify on public.utility_usage_aggregates
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

-- 5.4 provider_credentials — super_admin + developer_admin only

create policy provider_credentials_rls_v2_select on public.provider_credentials
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = provider_credentials.organization_id
        and ur.role = 'developer_admin'
    )
  );

create policy provider_credentials_rls_v2_modify on public.provider_credentials
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = provider_credentials.organization_id
        and ur.role = 'developer_admin'
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = provider_credentials.organization_id
        and ur.role = 'developer_admin'
    )
  );

-- 5.5 sync_jobs / sync_job_logs — management roles only

create policy sync_jobs_rls_v2_select on public.sync_jobs
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

create policy sync_jobs_rls_v2_modify on public.sync_jobs
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, null)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, null)
  );

create policy sync_job_logs_rls_v2_select on public.sync_job_logs
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
  );

-- sync_job_logs are written by the SECURITY DEFINER worker only — no write policy needed.

-- 5.6 external_reference_mapping — admin only

create policy erm_rls_v2_select on public.external_reference_mapping
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = external_reference_mapping.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

create policy erm_rls_v2_modify on public.external_reference_mapping
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = external_reference_mapping.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = external_reference_mapping.organization_id
        and ur.role in ('developer_admin','compound_manager')
    )
  );

-- 5.7 utility_payment_allocation — management roles, residents read their own

create policy upa_rls_v2_select on public.utility_payment_allocation
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.utility_bills b
      join public.residents r on r.id = b.resident_id
      where b.id = utility_payment_allocation.utility_bill_id
        and r.user_id = auth.uid()
    )
  );

create policy upa_rls_v2_modify on public.utility_payment_allocation
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = utility_payment_allocation.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = utility_payment_allocation.organization_id
        and ur.role in ('developer_admin','compound_manager','finance_officer')
    )
  );

-- 5.8 payment_method_registry — residents see active rows only

create policy pmr_rls_v2_select on public.payment_method_registry
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      organization_id in (select public.user_organization_ids())
    )
    or (
      is_active = true and exists (
        select 1 from public.residents r
        where r.user_id = auth.uid()
          and r.organization_id = payment_method_registry.organization_id
      )
    )
  );

create policy pmr_rls_v2_modify on public.payment_method_registry
  for all to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = payment_method_registry.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.organization_id = payment_method_registry.organization_id
        and ur.role in ('developer_admin','finance_officer')
    )
  );

-- 5.9 service_overdue_actions

create policy soa_rls_v2_select on public.service_overdue_actions
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (
      select 1 from public.utility_subscriptions s
      join public.residents r on r.id = s.resident_id
      where s.id = service_overdue_actions.subscription_id
        and r.user_id = auth.uid()
    )
  );

create policy soa_rls_v2_modify on public.service_overdue_actions
  for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  )
  with check (
    public.is_super_admin()
    or public.user_has_management_role(organization_id, compound_id)
  );

-- 5.10 idempotency_keys — service_role only

create policy idempotency_keys_rls_v2_super on public.idempotency_keys
  for select to authenticated
  using (public.is_super_admin());

-- 5.11 financial_transactions hardening (RLS hole)

alter table public.financial_transactions enable row level security;
alter table public.financial_transactions force row level security;

drop policy if exists financial_transactions_rls_v2_select on public.financial_transactions;
create policy financial_transactions_rls_v2_select on public.financial_transactions
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id in (select public.user_organization_ids())
        and exists (
          select 1 from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.organization_id = financial_transactions.organization_id
            and ur.role in ('developer_admin','compound_manager','finance_officer')
        ))
  );

-- 5.12 contract_templates hardening — keep the existing global policy,
-- but ADD a tenant-scoped one so the eventual switch in section 12 is a
-- one-line drop.

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='contract_templates') then
    alter table public.contract_templates enable row level security;
    alter table public.contract_templates force row level security;

    if not exists (select 1 from pg_policies where schemaname='public' and tablename='contract_templates' and policyname='ct_select_v2_tenant') then
      create policy ct_select_v2_tenant on public.contract_templates
        for select to authenticated
        using (
          public.is_super_admin()
          or organization_id is null
          or organization_id in (select public.user_organization_ids())
        );
    end if;
  end if;
end $$;

-- 5.13 audit_log read policy — versioned, additive

drop policy if exists audit_log_rls_v2_admin_action_select on public.audit_log;
create policy audit_log_rls_v2_admin_action_select on public.audit_log
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id is not null
        and exists (
          select 1 from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.organization_id = audit_log.organization_id
            and ur.role in ('developer_admin','compound_manager','finance_officer')
        ))
  );

-- ─── 6. COMMENT ON TABLE for the new tables ────────────────────────────────

comment on table public.utility_usage_events       is 'Period-bounded utility usage facts. Derived from raw readings or pushed by provider APIs.';
comment on table public.utility_usage_aggregates   is 'Roll-ups over usage events, scoped per (meter | subscription, period). Frozen once a bill references them.';
comment on table public.provider_credentials       is 'Reference-only credentials. vault_key OR env_var_name — never plaintext.';
comment on table public.sync_jobs                  is 'Worker-agnostic job header. One row per logical sync attempt; idempotent by (organization_id, idempotency_key).';
comment on table public.sync_job_logs              is 'Append-only granular log of every adapter call inside a sync_job.';
comment on table public.external_reference_mapping is 'Provider external_id → SRP internal id. One mapping per (provider, external_id) per org.';
comment on table public.utility_payment_allocation is 'Allocations of a payment to one or many utility_bills (parallel to payment_allocations for installments).';
comment on table public.payment_method_registry    is 'Tenant-defined payment methods (Stripe, FastPay, ZainCash, cash-at-office, …).';
comment on table public.service_overdue_actions    is 'Dunning trail per subscription/bill — every reminder / grace / suspension action lands here.';
comment on table public.idempotency_keys           is 'Server-side idempotency table for SECURITY DEFINER RPCs. Not directly writable by clients.';

-- ─── 7. Migration audit row (so the migration itself is logged) ────────────

insert into public.audit_log (actor_id, organization_id, table_name, row_id, action, diff, business_action)
values (
  null, null, 'schema', null, 'insert',
  jsonb_build_object('migration','20260513000000_phase12_metering_billing_hardening',
                     'applied_at', now()),
  'schema_migration_applied'
);

-- end of migration
```

---

## 8. RPC functions SQL

> File: `supabase/migrations/20260513000100_phase12_rpc_functions.sql`
>
> All functions are `language plpgsql security definer set search_path = public`.
> They perform their own tenant + role checks because `security definer`
> bypasses RLS.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 12 — RPC functions
-- ─────────────────────────────────────────────────────────────────────────────
-- Conventions:
--   • Every function performs tenant_id resolution from auth.uid() before any
--     write. is_super_admin() is the only bypass.
--   • Functions write to audit_log via audit_admin_action() at every privileged
--     step.
--   • Idempotency uses public.idempotency_keys (RPC-side dedup) and
--     UNIQUE constraints in the data layer (defence in depth).
--   • Errors carry HINT/DETAIL so the UI can surface meaningful messages.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── 0. Helper: resolve actor context ─────────────────────────────────────

create or replace function public._actor_context()
returns table (user_id uuid, role public.app_role, organization_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    coalesce((select role from public.user_roles where user_id = u.id order by case when role = 'super_admin' then 0 else 1 end limit 1), null),
    coalesce((select organization_id from public.user_roles where user_id = u.id and organization_id is not null limit 1), null),
    u.email
  from auth.users u
  where u.id = auth.uid()
$$;

grant execute on function public._actor_context() to authenticated;

-- ─── 0.1 audit_admin_action — labelled business-event logger ──────────────
-- Writes a row to audit_log with business_action set. Used by every RPC
-- below at significant steps.

create or replace function public.audit_admin_action(
  p_business_action text,
  p_target_table    text,
  p_target_id       uuid,
  p_organization_id uuid,
  p_compound_id     uuid default null,
  p_reason          text default null,
  p_payload         jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role  text;
  v_email text;
  v_id    bigint;
begin
  if v_actor is null then
    raise exception 'audit_admin_action requires an authenticated user'
      using errcode = '28000';
  end if;

  select coalesce(ur.role::text, 'unknown'),
         (select email from auth.users where id = v_actor)
    into v_role, v_email
  from public.user_roles ur
  where ur.user_id = v_actor
  order by case when ur.role = 'super_admin' then 0 else 1 end
  limit 1;

  insert into public.audit_log (
    actor_id, actor_role, actor_email,
    organization_id, compound_id,
    table_name, row_id, action, diff, business_action,
    request_id, client_ip, user_agent
  )
  values (
    v_actor, v_role, v_email,
    p_organization_id, p_compound_id,
    p_target_table, p_target_id, 'admin',
    jsonb_build_object(
      'reason',  p_reason,
      'payload', coalesce(p_payload, '{}'::jsonb)
    ),
    p_business_action,
    current_setting('app.request_id', true),
    current_setting('app.client_ip',  true),
    current_setting('app.user_agent', true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.audit_admin_action(text,text,uuid,uuid,uuid,text,jsonb) to authenticated;

-- ─── 0.2 internal idempotency guard ───────────────────────────────────────

create or replace function public._idempotency_begin(
  p_key text, p_scope text, p_org uuid, p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.idempotency_keys;
begin
  if p_key is null or length(p_key) = 0 then
    return null;
  end if;

  insert into public.idempotency_keys (key, scope, organization_id, request_hash, status)
  values (p_key, p_scope, p_org, p_request_hash, 'pending')
  on conflict (key) do nothing;

  select * into v_row from public.idempotency_keys where key = p_key;

  -- Already completed? Return the cached response — caller short-circuits.
  if v_row.status = 'succeeded' then
    return v_row.response;
  end if;

  -- Failed previously: allow retry by resetting to pending only if same hash.
  if v_row.status = 'failed' then
    if v_row.request_hash is distinct from p_request_hash then
      raise exception 'Idempotency key % already used with different inputs', p_key
        using errcode = '23505';
    end if;
    update public.idempotency_keys set status='pending', completed_at=null where key = p_key;
  end if;

  return null;
end;
$$;

create or replace function public._idempotency_complete(
  p_key text, p_response jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null then return; end if;
  update public.idempotency_keys
     set status='succeeded', completed_at=now(), response=p_response
   where key = p_key;
end;
$$;

create or replace function public._idempotency_fail(
  p_key text, p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null then return; end if;
  update public.idempotency_keys
     set status='failed', completed_at=now(),
         response=jsonb_build_object('error', p_error)
   where key = p_key;
end;
$$;

-- ─── 1. create_meter_reading ──────────────────────────────────────────────
-- Inserts a row into utility_meter_readings and optionally derives a usage
-- event between the previous reading and this one.

create or replace function public.create_meter_reading(
  p_meter_id        uuid,
  p_reading_value   numeric,
  p_reading_at      timestamptz default now(),
  p_source          public.reading_source default 'manual',
  p_external_id     text default null,
  p_raw_payload     jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_meter   public.electricity_meters;
  v_prev    public.utility_meter_readings;
  v_id      uuid;
  v_cached  jsonb;
  v_hash    text;
begin
  if v_actor is null then
    raise exception 'create_meter_reading requires authentication' using errcode = '28000';
  end if;

  select * into v_meter from public.electricity_meters where id = p_meter_id;
  if v_meter.id is null then
    raise exception 'Meter % not found', p_meter_id using errcode = '23503';
  end if;

  -- Permission: management role in the meter's org OR super_admin.
  if not (public.is_super_admin() or public.user_has_management_role(v_meter.organization_id, v_meter.compound_id)) then
    raise exception 'Not authorized to record readings for org %', v_meter.organization_id
      using errcode = '42501';
  end if;

  -- Validate
  if p_reading_value is null or p_reading_value < 0 then
    raise exception 'reading_value must be >= 0' using errcode = '22000';
  end if;

  -- Idempotency
  v_hash := encode(digest(p_meter_id::text || ':' || p_reading_at::text || ':' || p_reading_value::text, 'sha256'), 'hex');
  v_cached := public._idempotency_begin(p_idempotency_key, 'create_meter_reading', v_meter.organization_id, v_hash);
  if v_cached is not null then
    return (v_cached->>'id')::uuid;
  end if;

  -- Get the most recent prior reading (for usage event derivation)
  select * into v_prev
  from public.utility_meter_readings
  where meter_id = p_meter_id and reading_at < p_reading_at
  order by reading_at desc
  limit 1;

  insert into public.utility_meter_readings (
    organization_id, compound_id, meter_id, utility_type,
    reading_value, reading_unit, reading_at, source, raw_payload, external_reading_id,
    created_by
  )
  values (
    v_meter.organization_id, v_meter.compound_id, p_meter_id, v_meter.utility_type,
    p_reading_value, v_meter.reading_unit, p_reading_at, p_source, p_raw_payload, p_external_id,
    v_actor
  )
  returning id into v_id;

  -- Snapshot last_reading on the meter so the billing engine can read it.
  update public.electricity_meters
     set last_reading = current_reading,
         current_reading = p_reading_value,
         last_sync_at = now(),
         sync_status = 'ok'
   where id = p_meter_id;

  -- Derived usage event when we have a prior reading
  if v_prev.id is not null and p_reading_value >= v_prev.reading_value then
    insert into public.utility_usage_events (
      organization_id, compound_id, meter_id, unit_id, utility_type,
      period_start, period_end, quantity, quantity_unit,
      derived_from_reading_id, source, created_by
    )
    values (
      v_meter.organization_id, v_meter.compound_id, p_meter_id, v_meter.unit_id, v_meter.utility_type,
      v_prev.reading_at, p_reading_at, p_reading_value - v_prev.reading_value, v_meter.reading_unit,
      v_id, 'computed', v_actor
    );
  end if;

  perform public.audit_admin_action(
    'meter_reading_created', 'utility_meter_readings', v_id,
    v_meter.organization_id, v_meter.compound_id,
    'create_meter_reading RPC',
    jsonb_build_object('meter_id', p_meter_id, 'value', p_reading_value, 'source', p_source)
  );

  perform public._idempotency_complete(p_idempotency_key, jsonb_build_object('id', v_id));
  return v_id;
exception when others then
  perform public._idempotency_fail(p_idempotency_key, sqlerrm);
  raise;
end;
$$;

grant execute on function public.create_meter_reading(uuid,numeric,timestamptz,public.reading_source,text,jsonb,text) to authenticated;

-- ─── 2. calculate_usage_for_period ────────────────────────────────────────
-- Reads utility_usage_events and produces a utility_usage_aggregates row.

create or replace function public.calculate_usage_for_period(
  p_meter_id        uuid,
  p_subscription_id uuid default null,
  p_period_start    date  default null,
  p_period_end      date  default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meter      public.electricity_meters;
  v_total      numeric(14,4) := 0;
  v_count      integer := 0;
  v_aggregate_id uuid;
begin
  if p_period_start is null or p_period_end is null then
    raise exception 'period_start and period_end are required' using errcode = '22000';
  end if;
  if p_period_end < p_period_start then
    raise exception 'period_end must be >= period_start' using errcode = '22000';
  end if;

  select * into v_meter from public.electricity_meters where id = p_meter_id;
  if v_meter.id is null then
    raise exception 'Meter % not found', p_meter_id using errcode = '23503';
  end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_meter.organization_id, v_meter.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Sum
  select coalesce(sum(quantity), 0), count(*)
  into v_total, v_count
  from public.utility_usage_events
  where meter_id = p_meter_id
    and (p_subscription_id is null or subscription_id = p_subscription_id)
    and period_start >= p_period_start::timestamptz
    and period_end   <= (p_period_end + 1)::timestamptz;

  insert into public.utility_usage_aggregates (
    organization_id, compound_id, meter_id, subscription_id, utility_type,
    period_start, period_end, total_quantity, quantity_unit, event_count
  )
  values (
    v_meter.organization_id, v_meter.compound_id, p_meter_id, p_subscription_id, v_meter.utility_type,
    p_period_start, p_period_end, v_total, v_meter.reading_unit, v_count
  )
  on conflict (organization_id,
               coalesce(meter_id, '00000000-0000-0000-0000-000000000000'::uuid),
               coalesce(subscription_id, '00000000-0000-0000-0000-000000000000'::uuid),
               utility_type, period_start, period_end)
  do update
     set total_quantity = excluded.total_quantity,
         event_count    = excluded.event_count,
         computed_at    = now(),
         is_frozen      = utility_usage_aggregates.is_frozen   -- keep frozen flag
  returning id into v_aggregate_id;

  perform public.audit_admin_action(
    'usage_aggregate_computed', 'utility_usage_aggregates', v_aggregate_id,
    v_meter.organization_id, v_meter.compound_id,
    'calculate_usage_for_period RPC',
    jsonb_build_object(
      'meter_id', p_meter_id,
      'subscription_id', p_subscription_id,
      'period_start', p_period_start,
      'period_end',   p_period_end,
      'total', v_total,
      'event_count', v_count
    )
  );

  return v_aggregate_id;
end;
$$;

grant execute on function public.calculate_usage_for_period(uuid,uuid,date,date) to authenticated;

-- ─── 3. generate_utility_bill ─────────────────────────────────────────────
-- Combines an aggregate × tariff to produce a utility_bills row.

create or replace function public.generate_utility_bill(
  p_subscription_id uuid,
  p_period_start    date,
  p_period_end      date,
  p_due_date        date default null,
  p_tariff_id       uuid default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub      public.utility_subscriptions;
  v_meter    public.electricity_meters;
  v_agg      public.utility_usage_aggregates;
  v_tariff   public.electricity_tariffs;
  v_rate     numeric(10,4) := 0;
  v_subtotal numeric(12,2) := 0;
  v_due      date;
  v_bill_id  uuid;
  v_idem     text;
  v_cached   jsonb;
  v_hash     text;
begin
  select * into v_sub from public.utility_subscriptions where id = p_subscription_id;
  if v_sub.id is null then
    raise exception 'Subscription % not found', p_subscription_id using errcode = '23503';
  end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_sub.organization_id, v_sub.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Computed idempotency key — survives concurrent worker hits.
  v_idem := coalesce(p_idempotency_key,
    encode(digest(p_subscription_id::text || ':' || p_period_start::text || ':' || p_period_end::text, 'sha256'), 'hex'));
  v_hash := v_idem;

  v_cached := public._idempotency_begin(v_idem, 'generate_utility_bill', v_sub.organization_id, v_hash);
  if v_cached is not null then
    return (v_cached->>'id')::uuid;
  end if;

  -- Find the meter that owns the subscription's usage (best-effort)
  select * into v_meter
  from public.electricity_meters
  where organization_id = v_sub.organization_id
    and unit_id = v_sub.unit_id
    and (provider_id is null or provider_id = v_sub.provider_id)
    and utility_type = v_sub.subscription_type
  limit 1;

  -- Get the relevant aggregate (compute if missing)
  select * into v_agg
  from public.utility_usage_aggregates
  where organization_id = v_sub.organization_id
    and (v_meter.id is null or meter_id = v_meter.id)
    and (subscription_id = p_subscription_id or subscription_id is null)
    and period_start = p_period_start
    and period_end   = p_period_end
  order by computed_at desc
  limit 1;

  if v_agg.id is null and v_meter.id is not null then
    -- Compute on demand
    perform public.calculate_usage_for_period(v_meter.id, p_subscription_id, p_period_start, p_period_end);
    select * into v_agg
    from public.utility_usage_aggregates
    where organization_id = v_sub.organization_id and meter_id = v_meter.id
      and (subscription_id = p_subscription_id or subscription_id is null)
      and period_start = p_period_start and period_end = p_period_end
    order by computed_at desc limit 1;
  end if;

  -- Tariff
  if p_tariff_id is not null then
    select * into v_tariff from public.electricity_tariffs where id = p_tariff_id;
  else
    select * into v_tariff
    from public.electricity_tariffs
    where provider_id = v_sub.provider_id
      and effective_from <= p_period_end
      and (effective_to is null or effective_to >= p_period_start)
    order by effective_from desc limit 1;
  end if;

  v_rate := coalesce(v_tariff.rate_per_unit, 0);

  if v_sub.subscription_type = 'internet' then
    -- Internet is a flat monthly fee on the subscription
    v_subtotal := v_sub.monthly_fee;
  else
    v_subtotal := coalesce(v_agg.total_quantity, 0) * v_rate + coalesce(v_tariff.service_fee, 0);
  end if;

  v_due := coalesce(p_due_date, p_period_end + interval '14 days');

  insert into public.utility_bills (
    organization_id, compound_id, unit_id, resident_id, subscription_id,
    provider_id, meter_id,
    utility_type, billing_period_start, billing_period_end, due_date,
    previous_reading, current_reading, consumption, rate_per_unit,
    subtotal, tax_amount, penalty_amount, paid_amount, total_amount,
    currency, status,
    tariff_id, idempotency_key, generated_by_rpc, consumption_aggregate_id
  )
  values (
    v_sub.organization_id, v_sub.compound_id, v_sub.unit_id, v_sub.resident_id, v_sub.id,
    v_sub.provider_id, v_meter.id,
    v_sub.subscription_type, p_period_start, p_period_end, v_due,
    nullif(v_meter.last_reading, 0), v_meter.current_reading, v_agg.total_quantity, v_rate,
    v_subtotal, 0, 0, 0, v_subtotal,
    coalesce(v_tariff.currency, v_sub.currency, 'USD'), 'issued',
    v_tariff.id, v_idem, 'generate_utility_bill_v1', v_agg.id
  )
  returning id into v_bill_id;

  -- Freeze the aggregate and tie it back to the bill
  if v_agg.id is not null then
    update public.utility_usage_aggregates
       set is_frozen = true, bill_id = v_bill_id
     where id = v_agg.id;
  end if;

  -- Move next_billing_date forward (best-effort; cron can also handle this)
  update public.utility_subscriptions
     set last_billed_at = p_period_end,
         next_billing_date = case
           when billing_cycle = 'monthly'   then (p_period_end + interval '1 month')::date
           when billing_cycle = 'quarterly' then (p_period_end + interval '3 months')::date
           when billing_cycle = 'biannual'  then (p_period_end + interval '6 months')::date
           when billing_cycle = 'annual'    then (p_period_end + interval '1 year')::date
           else next_billing_date
         end
   where id = p_subscription_id;

  perform public.audit_admin_action(
    'utility_bill_generated', 'utility_bills', v_bill_id,
    v_sub.organization_id, v_sub.compound_id,
    'generate_utility_bill RPC',
    jsonb_build_object(
      'subscription_id', p_subscription_id,
      'period_start', p_period_start,
      'period_end',   p_period_end,
      'subtotal', v_subtotal,
      'tariff_id', v_tariff.id
    )
  );

  perform public._idempotency_complete(v_idem, jsonb_build_object('id', v_bill_id));
  return v_bill_id;
exception when others then
  perform public._idempotency_fail(v_idem, sqlerrm);
  raise;
end;
$$;

grant execute on function public.generate_utility_bill(uuid,date,date,date,uuid,text) to authenticated;

-- ─── 4. mark_bill_as_paid ─────────────────────────────────────────────────

create or replace function public.mark_bill_as_paid(
  p_bill_id          uuid,
  p_amount           numeric,
  p_payment_method   public.payment_method,
  p_payment_method_code text default null,
  p_gateway_provider text default null,
  p_gateway_payment_intent text default null,
  p_payment_reference text default null,
  p_idempotency_key  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill     public.utility_bills;
  v_payment_id uuid;
  v_alloc_id  uuid;
  v_idem      text;
  v_cached    jsonb;
  v_hash      text;
  v_reference text;
begin
  select * into v_bill from public.utility_bills where id = p_bill_id;
  if v_bill.id is null then
    raise exception 'Bill % not found', p_bill_id using errcode = '23503';
  end if;

  if not (public.is_super_admin()
          or public.user_has_management_role(v_bill.organization_id, v_bill.compound_id)
          or exists (
              select 1 from public.residents r
              where r.id = v_bill.resident_id and r.user_id = auth.uid()
          )) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be > 0' using errcode = '22000';
  end if;
  if p_amount > (v_bill.total_amount - v_bill.paid_amount) + 0.01 then
    raise exception 'Payment amount % exceeds remaining balance %', p_amount, (v_bill.total_amount - v_bill.paid_amount)
      using errcode = '22000';
  end if;

  v_idem := coalesce(p_idempotency_key,
    encode(digest(p_bill_id::text || ':' || p_amount::text || ':' || coalesce(p_gateway_payment_intent, '')::text, 'sha256'), 'hex'));
  v_hash := v_idem;

  v_cached := public._idempotency_begin(v_idem, 'mark_bill_as_paid', v_bill.organization_id, v_hash);
  if v_cached is not null then
    return (v_cached->>'payment_id')::uuid;
  end if;

  v_reference := coalesce(p_payment_reference,
    'UB-PMT-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.payments (
    organization_id, compound_id, contract_id, resident_id,
    payment_reference, payment_date, payment_method, payment_amount, payment_status,
    utility_bill_id, idempotency_key, payment_method_code, gateway_provider, gateway_payment_intent
  )
  -- We have no installment contract for utility bills — re-use the bill's
  -- resident; contract_id is required by the column NOT NULL, so we pick a
  -- well-known sentinel via the bill's installment ties (utility bills have
  -- no contract — we relax this by using NULL via the override below).
  -- NOTE: schema requires contract_id NOT NULL — we work around this by
  -- inserting the bill's subscription as a synthetic contract reference is
  -- not possible. Instead we insert via a dedicated "utility payment" path
  -- that REQUIRES section 12's relaxation. See Dangerous changes.
  values (
    v_bill.organization_id, v_bill.compound_id,
    -- HACK: payments.contract_id is NOT NULL. We pick the resident's first
    -- contract if any; otherwise we raise. Section 12 covers the relaxation.
    coalesce(
      (select id from public.installment_contracts
        where resident_id = v_bill.resident_id and organization_id = v_bill.organization_id
        order by created_at desc limit 1),
      (select '00000000-0000-0000-0000-000000000000'::uuid)
    ),
    v_bill.resident_id,
    v_reference, current_date, p_payment_method, p_amount, 'confirmed',
    p_bill_id, v_idem, p_payment_method_code, p_gateway_provider, p_gateway_payment_intent
  )
  returning id into v_payment_id;

  -- Allocate against the utility bill
  insert into public.utility_payment_allocation (organization_id, payment_id, utility_bill_id, amount, applied_to)
  values (v_bill.organization_id, v_payment_id, p_bill_id, p_amount, 'subtotal')
  returning id into v_alloc_id;

  -- Update the bill
  update public.utility_bills
     set paid_amount = paid_amount + p_amount,
         status = case when (paid_amount + p_amount) >= total_amount - 0.01 then 'paid'::public.utility_bill_status
                       else 'partial'::public.utility_bill_status end,
         paid_at = case when (paid_amount + p_amount) >= total_amount - 0.01 then now() else paid_at end,
         payment_id = case when (paid_amount + p_amount) >= total_amount - 0.01 then v_payment_id else payment_id end
   where id = p_bill_id;

  -- Record the receipt (1:1 with payment).
  insert into public.receipts (organization_id, payment_id, receipt_number, issued_at, issued_by)
  values (v_bill.organization_id, v_payment_id,
          'RCP-UB-' || to_char(now(),'YYYY') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8),
          now(), auth.uid())
  on conflict do nothing;

  -- External reference mapping
  if p_gateway_payment_intent is not null then
    insert into public.external_reference_mapping (organization_id, provider, external_id, srp_table, srp_id)
    values (v_bill.organization_id, coalesce(p_gateway_provider, 'unknown'), p_gateway_payment_intent, 'payments', v_payment_id)
    on conflict do nothing;
  end if;

  perform public.audit_admin_action(
    'utility_bill_paid', 'utility_bills', p_bill_id,
    v_bill.organization_id, v_bill.compound_id,
    'mark_bill_as_paid RPC',
    jsonb_build_object('payment_id', v_payment_id, 'amount', p_amount, 'method', p_payment_method)
  );

  perform public._idempotency_complete(v_idem, jsonb_build_object('payment_id', v_payment_id));
  return v_payment_id;
exception when others then
  perform public._idempotency_fail(v_idem, sqlerrm);
  raise;
end;
$$;

grant execute on function public.mark_bill_as_paid(uuid,numeric,public.payment_method,text,text,text,text,text) to authenticated;

-- ─── 5. sync_meter_reading_from_provider ──────────────────────────────────
-- Creates a sync_jobs row + a single utility_meter_readings row in one
-- transaction. Designed to be called by an external worker that already
-- talked to the adapter.

create or replace function public.sync_meter_reading_from_provider(
  p_meter_id          uuid,
  p_external_id       text,
  p_reading_value     numeric,
  p_reading_at        timestamptz,
  p_integration_id    uuid default null,
  p_raw_payload       jsonb default '{}'::jsonb,
  p_idempotency_key   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meter   public.electricity_meters;
  v_job_id  uuid;
  v_read_id uuid;
  v_idem    text;
  v_cached  jsonb;
begin
  select * into v_meter from public.electricity_meters where id = p_meter_id;
  if v_meter.id is null then
    raise exception 'Meter % not found', p_meter_id using errcode = '23503';
  end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_meter.organization_id, v_meter.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_idem := coalesce(p_idempotency_key, p_external_id);
  v_cached := public._idempotency_begin(v_idem, 'sync_meter_reading_from_provider', v_meter.organization_id, v_idem);
  if v_cached is not null then
    return (v_cached->>'reading_id')::uuid;
  end if;

  -- Sync job header
  insert into public.sync_jobs (
    organization_id, integration_id, provider_id,
    kind, status, scheduled_for, started_at,
    idempotency_key, request_payload
  )
  values (
    v_meter.organization_id, p_integration_id, v_meter.provider_id,
    'pull_readings', 'running', now(), now(),
    v_idem,
    jsonb_build_object('meter_id', p_meter_id, 'external_id', p_external_id, 'reading_at', p_reading_at)
  )
  returning id into v_job_id;

  -- The reading itself
  v_read_id := public.create_meter_reading(
    p_meter_id, p_reading_value, p_reading_at, 'imported',
    p_external_id, p_raw_payload, v_idem || ':reading'
  );

  -- Close the job
  update public.sync_jobs
     set status='succeeded', finished_at=now(), attempts=attempts+1,
         result_payload=jsonb_build_object('reading_id', v_read_id)
   where id = v_job_id;

  insert into public.sync_job_logs (
    organization_id, sync_job_id, step, outcome, response_payload
  ) values (
    v_meter.organization_id, v_job_id, 'reading_imported', 'success',
    jsonb_build_object('reading_id', v_read_id, 'value', p_reading_value)
  );

  perform public.audit_admin_action(
    'meter_reading_synced', 'utility_meter_readings', v_read_id,
    v_meter.organization_id, v_meter.compound_id,
    'sync_meter_reading_from_provider RPC',
    jsonb_build_object('external_id', p_external_id, 'value', p_reading_value, 'job_id', v_job_id)
  );

  perform public._idempotency_complete(v_idem, jsonb_build_object('reading_id', v_read_id, 'job_id', v_job_id));
  return v_read_id;
exception when others then
  -- Update job to failed (best-effort)
  if v_job_id is not null then
    update public.sync_jobs
       set status='failed', finished_at=now(), last_error=sqlerrm
     where id = v_job_id;
    insert into public.sync_job_logs (organization_id, sync_job_id, step, outcome, error_message)
    values (v_meter.organization_id, v_job_id, 'reading_import', 'failure', sqlerrm);
  end if;
  perform public._idempotency_fail(v_idem, sqlerrm);
  raise;
end;
$$;

grant execute on function public.sync_meter_reading_from_provider(uuid,text,numeric,timestamptz,uuid,jsonb,text) to authenticated;

-- ─── 6. get_unit_utility_summary ──────────────────────────────────────────

create or replace function public.get_unit_utility_summary(p_unit_id uuid)
returns table (
  utility_type            public.utility_type,
  current_reading         numeric,
  last_reading            numeric,
  unit_label              text,
  open_bill_count         integer,
  open_amount             numeric,
  last_bill_at            timestamptz,
  last_bill_id            uuid,
  service_overdue_state   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit public.units;
begin
  select * into v_unit from public.units where id = p_unit_id;
  if v_unit.id is null then raise exception 'Unit not found' using errcode = '23503'; end if;

  if not (public.is_super_admin()
          or v_unit.organization_id in (select public.user_organization_ids())
          or v_unit.compound_id in (select public.user_compound_ids())
          or exists (select 1 from public.residents r where r.user_id = auth.uid() and r.unit_id = v_unit.id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
    with meters as (
      select * from public.electricity_meters where unit_id = p_unit_id
    ), bills as (
      select utility_type, count(*) filter (where status in ('issued','partial','overdue')) as open_count,
             coalesce(sum(case when status in ('issued','partial','overdue') then total_amount - paid_amount else 0 end), 0) as open_amount,
             max(created_at) as last_bill_at,
             (array_agg(id order by created_at desc))[1] as last_bill_id
      from public.utility_bills
      where unit_id = p_unit_id
      group by utility_type
    ), subs as (
      select subscription_type as utility_type, max(service_overdue_state) as overdue_state
      from public.utility_subscriptions where unit_id = p_unit_id
      group by subscription_type
    )
    select
      m.utility_type, m.current_reading, m.last_reading, m.reading_unit as unit_label,
      coalesce(b.open_count, 0)::integer, coalesce(b.open_amount, 0),
      b.last_bill_at, b.last_bill_id, s.overdue_state
    from meters m
    left join bills b on b.utility_type = m.utility_type
    left join subs  s on s.utility_type = m.utility_type;
end;
$$;

grant execute on function public.get_unit_utility_summary(uuid) to authenticated;

-- ─── 7. get_resident_dashboard_summary ────────────────────────────────────

create or replace function public.get_resident_dashboard_summary(p_resident_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resident public.residents;
  v_summary  jsonb;
begin
  if p_resident_id is null then
    select * into v_resident from public.residents where user_id = auth.uid() limit 1;
  else
    select * into v_resident from public.residents where id = p_resident_id;
  end if;

  if v_resident.id is null then
    return jsonb_build_object('error', 'resident_not_found');
  end if;

  -- Permission: self, OR management in scope
  if not (public.is_super_admin()
          or v_resident.user_id = auth.uid()
          or public.user_has_management_role(v_resident.organization_id, v_resident.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'resident', jsonb_build_object('id', v_resident.id, 'first_name', v_resident.first_name, 'last_name', v_resident.last_name),
    'unit',     (select to_jsonb(u) from public.units u where u.id = v_resident.unit_id),
    'open_bills', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'utility_type', b.utility_type, 'due_date', b.due_date,
        'total', b.total_amount, 'paid', b.paid_amount, 'status', b.status
      ) order by b.due_date), '[]'::jsonb)
      from public.utility_bills b
      where b.resident_id = v_resident.id and b.status in ('issued','partial','overdue')
    ),
    'open_installments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'installment_number', s.installment_number,
        'due_date', s.due_date, 'total_due', s.total_due, 'paid_amount', s.paid_amount, 'status', s.status
      ) order by s.due_date), '[]'::jsonb)
      from public.installment_schedules s
      join public.installment_contracts c on c.id = s.contract_id
      where c.resident_id = v_resident.id and s.status in ('pending','partial','overdue')
    ),
    'subscriptions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', us.id, 'type', us.subscription_type, 'status', us.status,
        'overdue_state', us.service_overdue_state, 'next_billing_date', us.next_billing_date
      )), '[]'::jsonb)
      from public.utility_subscriptions us
      where us.resident_id = v_resident.id and us.status = 'active'
    ),
    'tickets_open', (
      select count(*) from public.tickets t where t.resident_id = v_resident.id and t.status not in ('resolved','closed')
    ),
    'unread_notifications', (
      select count(*) from public.notifications n where n.user_id = v_resident.user_id and n.read_at is null
    )
  ) into v_summary;

  return v_summary;
end;
$$;

grant execute on function public.get_resident_dashboard_summary(uuid) to authenticated;

-- ─── 8. suspend_service_for_overdue_bill ──────────────────────────────────

create or replace function public.suspend_service_for_overdue_bill(
  p_bill_id uuid,
  p_reason  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.utility_bills;
  v_sub  public.utility_subscriptions;
  v_sus_id uuid;
begin
  select * into v_bill from public.utility_bills where id = p_bill_id;
  if v_bill.id is null then raise exception 'Bill not found' using errcode = '23503'; end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_bill.organization_id, v_bill.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_bill.subscription_id is null then
    raise exception 'Bill has no subscription — cannot suspend service' using errcode = '22000';
  end if;

  select * into v_sub from public.utility_subscriptions where id = v_bill.subscription_id;

  if v_sub.status <> 'active' then
    raise exception 'Subscription is not active (status=%)', v_sub.status using errcode = '22000';
  end if;

  -- Create suspension row (exclude constraint prevents duplicates)
  insert into public.service_suspensions (
    organization_id, compound_id, subscription_id, unit_id, resident_id,
    utility_type, reason, reason_notes, initiated_by
  )
  values (
    v_bill.organization_id, v_bill.compound_id, v_sub.id, v_bill.unit_id, v_bill.resident_id,
    v_bill.utility_type, 'overdue', p_reason, auth.uid()
  )
  returning id into v_sus_id;

  update public.utility_subscriptions
     set status = 'suspended',
         service_overdue_state = 'suspended',
         dunning_step = greatest(dunning_step, 3)
   where id = v_sub.id;

  update public.utility_bills set suspended_at = now() where id = p_bill_id;

  insert into public.service_overdue_actions (
    organization_id, compound_id, subscription_id, utility_bill_id,
    action_kind, dunning_step, outcome, payload, actor_id
  )
  values (
    v_bill.organization_id, v_bill.compound_id, v_sub.id, p_bill_id,
    'suspended', 3, 'service_suspended', jsonb_build_object('reason', p_reason), auth.uid()
  );

  perform public.audit_admin_action(
    'service_suspended', 'service_suspensions', v_sus_id,
    v_bill.organization_id, v_bill.compound_id,
    p_reason,
    jsonb_build_object('bill_id', p_bill_id, 'subscription_id', v_sub.id)
  );

  return v_sus_id;
end;
$$;

grant execute on function public.suspend_service_for_overdue_bill(uuid,text) to authenticated;

-- ─── 9. restore_service_after_payment ─────────────────────────────────────

create or replace function public.restore_service_after_payment(
  p_subscription_id uuid,
  p_reason          text default 'payment received'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub  public.utility_subscriptions;
  v_open_count integer;
begin
  select * into v_sub from public.utility_subscriptions where id = p_subscription_id;
  if v_sub.id is null then raise exception 'Subscription not found' using errcode = '23503'; end if;

  if not (public.is_super_admin() or public.user_has_management_role(v_sub.organization_id, v_sub.compound_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Are there still open overdue bills?
  select count(*) into v_open_count
  from public.utility_bills
  where subscription_id = p_subscription_id
    and status in ('overdue','partial');

  if v_open_count > 0 then
    raise exception 'Cannot restore — % bill(s) still unpaid', v_open_count using errcode = '22000';
  end if;

  update public.service_suspensions
     set status = 'released', released_at = now()
   where subscription_id = p_subscription_id and status = 'active';

  update public.utility_subscriptions
     set status = 'active',
         service_overdue_state = 'restored',
         dunning_step = 0
   where id = p_subscription_id;

  insert into public.service_overdue_actions (
    organization_id, compound_id, subscription_id,
    action_kind, dunning_step, outcome, payload, actor_id
  )
  values (
    v_sub.organization_id, v_sub.compound_id, v_sub.id,
    'restored', 0, 'service_restored', jsonb_build_object('reason', p_reason), auth.uid()
  );

  perform public.audit_admin_action(
    'service_restored', 'utility_subscriptions', v_sub.id,
    v_sub.organization_id, v_sub.compound_id,
    p_reason, '{}'::jsonb
  );

  return true;
end;
$$;

grant execute on function public.restore_service_after_payment(uuid,text) to authenticated;

-- ─── 10. audit_admin_action — already defined above (section 0.1) ─────────
-- (no-op; this is the function the user listed at #10)

```

---

## 9. Test queries

Run these in the Supabase SQL editor as `super_admin` after applying both
migrations.

```sql
-- 9.1  Schema sanity
select table_name from information_schema.tables
 where table_schema='public'
   and table_name in (
     'utility_meter_readings','utility_usage_events','utility_usage_aggregates',
     'provider_credentials','sync_jobs','sync_job_logs',
     'external_reference_mapping','utility_payment_allocation',
     'payment_method_registry','service_overdue_actions','idempotency_keys'
   )
 order by table_name;
-- expect: all 11 rows

-- 9.2  Column additions
select column_name from information_schema.columns
 where table_schema='public' and table_name='electricity_meters'
   and column_name in (
     'meter_type','utility_type','provider_id','external_meter_id','api_provider',
     'last_reading','reading_unit','installation_date','last_sync_at','sync_status'
   )
 order by column_name;
-- expect: 10 rows

-- 9.3  RLS is enabled on every new table
select c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname='public'
   and c.relname in (
     'utility_meter_readings','utility_usage_events','utility_usage_aggregates',
     'provider_credentials','sync_jobs','sync_job_logs',
     'external_reference_mapping','utility_payment_allocation',
     'payment_method_registry','service_overdue_actions','idempotency_keys'
   )
 order by c.relname;
-- expect: every row relrowsecurity=t AND relforcerowsecurity=t

-- 9.4  RLS policies use v2 names
select tablename, policyname, cmd
  from pg_policies
 where schemaname='public'
   and policyname like '%_rls_v2_%'
 order by tablename, policyname;

-- 9.5  audit_log has new columns
select column_name from information_schema.columns
 where table_schema='public' and table_name='audit_log'
   and column_name in ('actor_role','actor_email','request_id','client_ip','user_agent','business_action')
 order by column_name;

-- 9.6  audit_admin_action smoke
select public.audit_admin_action(
  'test_smoke', 'organizations', null, null, null, 'smoke from sql editor', '{}'::jsonb
);
select id, business_action, actor_role, actor_email from public.audit_log
 where business_action='test_smoke' order by id desc limit 1;

-- 9.7  Generic meter reading round-trip
-- (replace METER_UUID with a real meter id)
select public.create_meter_reading(
  p_meter_id      := 'METER_UUID'::uuid,
  p_reading_value := 1234.5,
  p_reading_at    := now()
);
select id, reading_value, reading_at, utility_type
  from public.utility_meter_readings
 order by created_at desc limit 1;

-- 9.8  Aggregation
select public.calculate_usage_for_period(
  p_meter_id     := 'METER_UUID'::uuid,
  p_period_start := date_trunc('month', current_date)::date,
  p_period_end   := (date_trunc('month', current_date) + interval '1 month - 1 day')::date
);
select * from public.utility_usage_aggregates order by computed_at desc limit 1;

-- 9.9  Bill generation idempotency
-- Run the same call twice — second call should return the same uuid.
select public.generate_utility_bill(
  p_subscription_id := 'SUB_UUID'::uuid,
  p_period_start    := date_trunc('month', current_date)::date,
  p_period_end      := (date_trunc('month', current_date) + interval '1 month - 1 day')::date
) as first_call;

select public.generate_utility_bill(
  p_subscription_id := 'SUB_UUID'::uuid,
  p_period_start    := date_trunc('month', current_date)::date,
  p_period_end      := (date_trunc('month', current_date) + interval '1 month - 1 day')::date
) as second_call;
-- expect: first_call = second_call

-- 9.10  Tenant isolation
-- (impersonate an org-1 user via SET ROLE or by issuing a JWT)
select count(*) from public.utility_bills;
-- expect: only the tenant's bills

-- 9.11  Resident self-access
-- (impersonate a resident user)
select * from public.get_resident_dashboard_summary();
-- expect: their unit, their bills, their subscriptions only

-- 9.12  Suspension & restoration flow
select public.suspend_service_for_overdue_bill('BILL_UUID'::uuid, 'failed payment');
select status, service_overdue_state, dunning_step from public.utility_subscriptions where id = 'SUB_UUID'::uuid;
-- expect: status='suspended', service_overdue_state='suspended', dunning_step=3

select public.restore_service_after_payment('SUB_UUID'::uuid);
select status, service_overdue_state, dunning_step from public.utility_subscriptions where id = 'SUB_UUID'::uuid;
-- expect: status='active', service_overdue_state='restored', dunning_step=0

-- 9.13  audit trail completeness
select business_action, count(*) from public.audit_log
 where created_at > now() - interval '10 minutes'
 group by business_action order by business_action;
-- expect: rows for meter_reading_created, usage_aggregate_computed,
--         utility_bill_generated, utility_bill_paid, service_suspended,
--         service_restored

-- 9.14  External reference mapping uniqueness
insert into public.external_reference_mapping (organization_id, provider, external_id, srp_table, srp_id)
values ('ORG_UUID'::uuid, 'stripe', 'pi_test_999', 'payments', gen_random_uuid());
insert into public.external_reference_mapping (organization_id, provider, external_id, srp_table, srp_id)
values ('ORG_UUID'::uuid, 'stripe', 'pi_test_999', 'payments', gen_random_uuid());
-- expect: second insert fails with unique_violation

-- 9.15  Idempotency key reuse with different inputs is rejected
select public._idempotency_begin('test_idem_key_1', 'create_meter_reading', null, 'hash_a');
select public._idempotency_begin('test_idem_key_1', 'create_meter_reading', null, 'hash_b');
-- expect: second call raises 23505 (different request_hash)
```

---

## 10. Supabase checklist (after applying)

After running both migrations in the Supabase SQL editor:

1. **Schema inspector**
   `Database → Tables` — confirm the 11 new tables are present.

2. **RLS check**
   `Authentication → Policies` — filter by table name; every new table
   shows 2 – 5 policies, all with names containing `_rls_v2_`.

3. **Functions tab**
   `Database → Functions` — confirm:
   - `audit_admin_action(text, text, uuid, uuid, uuid, text, jsonb)`
   - `create_meter_reading(uuid, numeric, timestamptz, public.reading_source, text, jsonb, text)`
   - `calculate_usage_for_period(uuid, uuid, date, date)`
   - `generate_utility_bill(uuid, date, date, date, uuid, text)`
   - `mark_bill_as_paid(uuid, numeric, public.payment_method, text, text, text, text, text)`
   - `sync_meter_reading_from_provider(uuid, text, numeric, timestamptz, uuid, jsonb, text)`
   - `get_unit_utility_summary(uuid)`
   - `get_resident_dashboard_summary(uuid)`
   - `suspend_service_for_overdue_bill(uuid, text)`
   - `restore_service_after_payment(uuid, text)`
   - `_actor_context()` / `_idempotency_begin/_complete/_fail` (helpers)

4. **Triggers tab**
   `Database → Triggers` — every new table has both
   `<table>_set_updated_at` (where applicable) and `<table>_audit`.

5. **Indexes**
   `Database → Indexes` — confirm at least:
   - `utility_bills_idempotency_uidx`
   - `payments_idempotency_uidx`
   - `meters_provider_idx`
   - `utility_bills_org_status_due_idx`
   - `audit_log_business_action_idx`

6. **Audit smoke**
   Run query 9.6. Confirm a row lands in `audit_log` with
   `business_action = 'test_smoke'` and `actor_role` populated.

7. **Realtime**
   If you are using Supabase Realtime, add the new tables to the
   `supabase_realtime` publication if you want clients to subscribe.
   Example:
   ```sql
   alter publication supabase_realtime add table public.utility_meter_readings;
   alter publication supabase_realtime add table public.utility_bills;
   alter publication supabase_realtime add table public.service_overdue_actions;
   ```

8. **Vault for credentials**
   In `Settings → Vault`, add entries for each adapter that has a real
   secret. Reference them from `provider_credentials.vault_key` (the
   string of the Vault key id). **No plaintext secret stored in the
   table.**

9. **Type regeneration**
   ```
   npx supabase gen types typescript --project-id <project> > src/lib/supabase/database.types.ts
   ```
   Or rerun the existing helper script in the repo.

---

## 11. Frontend / API impact list

The following files in `src/lib/api/` and `src/app/` need an update because
of new column names / new tables / new RPCs.

### `src/lib/api/utilities.ts`
- Add `getMeterUsageHistory(meterId)` that queries `utility_meter_readings`.
- Replace direct inserts into `meter_readings` (electricity) with calls to
  RPC `create_meter_reading`.
- Add `getUnitUtilitySummary(unitId)` calling
  RPC `get_unit_utility_summary`.

### `src/lib/api/billing-run.ts`
- Switch from direct `insert into utility_bills` to RPC
  `generate_utility_bill` for idempotency.
- Pipe the `idempotency_key` through from the cron header.

### `src/lib/api/utility-bill-actions.ts`
- Replace direct payment insertion with RPC `mark_bill_as_paid`.
- Pass `gateway_payment_intent` for Stripe webhook flows.

### `src/lib/api/resident-payments.ts`
- Call `mark_bill_as_paid` with `gateway_provider='stripe'` after webhook
  verification.
- Drop manual `external_reference_mapping` upserts — the RPC handles
  them.

### `src/lib/api/resident-mobile.ts`
- Replace dashboard queries with a single
  `supabase.rpc('get_resident_dashboard_summary')` call.

### `src/lib/api/utility-stats.ts`
- Read from `utility_usage_aggregates` rather than re-summing
  `meter_readings`.

### `src/lib/api/audit.ts`
- Add a `getAdminActions()` query against the new
  `public.admin_action_log` view, filtering by
  `business_action`.

### `src/app/(dashboard)/meters/*`
- The Meters CRUD page must surface the new columns: `meter_type`,
  `utility_type`, `provider_id`, `external_meter_id`, `last_reading`,
  `sync_status`, `last_sync_at`.
- A "Resync now" button calls RPC `sync_meter_reading_from_provider`.

### `src/app/(dashboard)/utility-bills/*`
- Bill detail shows `tariff_id`, `consumption_aggregate_id`, link to the
  underlying `utility_usage_aggregates` row, and `external_invoice_id` if
  set.
- Add an "Allocations" tab fed from `utility_payment_allocation`.

### `src/app/(dashboard)/providers/[id]/integrations`
- Read `provider_credentials` (without the `vault_key` value — show only
  whether a credential exists and its name).
- Show last `sync_jobs` row + recent `sync_job_logs`.

### `src/app/(dashboard)/payments/*`
- Display the new `payment_method_code`, `gateway_provider`, and
  `gateway_payment_intent`.
- Detail page shows `utility_bill_id` link when set.

### `src/app/(dashboard)/audit-log/page.tsx`
- Add a filter by `business_action`.
- New columns `actor_role`, `actor_email`, `request_id`, `client_ip`.

### `src/middleware.ts`
- Before handing off to the route, call:
  ```ts
  await supabase.rpc('set_request_context', { req_id, ip, ua });
  ```
  Or set them as session GUCs via a SECURITY DEFINER helper:
  ```sql
  create or replace function public.set_request_context(
    p_request_id text, p_client_ip text, p_user_agent text
  ) returns void language sql as $$
    select set_config('app.request_id', coalesce(p_request_id,''), true),
           set_config('app.client_ip',  coalesce(p_client_ip,''), true),
           set_config('app.user_agent', coalesce(p_user_agent,''), true)
  $$;
  ```
  (Add to migration 7 if you want — left out by default to keep the
  migration tightly scoped.)

### `src/lib/supabase/database.types.ts`
- **Regenerate** after migration applies. The generated types are
  consumed by every API file in `src/lib/api/`.

### `src/lib/validations/*.ts`
- Add Zod schemas for `MeterReadingInsert`, `UsageEventInsert`,
  `UtilityPaymentAllocationInsert`, `PaymentMethodRegistryInsert`,
  `ProviderCredentialInsert`. None of them should accept plaintext
  passwords.

---

## 12. Dangerous changes — do **not** run without confirmation

These are explicitly **not** included in the Phase 12 migration. They
are recorded here so you can decide whether to run them later, in
isolated migrations.

### 12.1 Rename `electricity_meters` → `utility_meters`

The table name is electricity-flavoured; logically it now stores any
utility's meter. We chose **not** to rename it in Phase 12 because:

- It would break every API file that queries `from('electricity_meters')`.
- It would break the Supabase generated types.
- It would break any RLS policy or trigger that references the table
  name literally.

If you want to rename:

```sql
-- DO NOT RUN without verifying every caller has been updated.
alter table public.electricity_meters rename to utility_meters;
-- Then create a backwards-compat view:
create view public.electricity_meters as select * from public.utility_meters;
-- And re-apply triggers if Postgres detached them on rename (it doesn't, but verify).
```

**Recovery if mis-run:** `alter table public.utility_meters rename to
electricity_meters;` then drop the compat view.

### 12.2 Add `viewer` to the `public.app_role` enum

The user mentioned a `viewer` role. `alter type … add value` cannot run
inside the same transaction as other DDL that references the enum, so we
left it out of Phase 12.

```sql
-- DO NOT RUN inside a transaction with other DDL.
alter type public.app_role add value 'viewer';
```

Then add the policy template:

```sql
-- viewer = read-only across the org, no writes
create policy <table>_rls_v3_viewer_select on public.<table>
  for select to authenticated
  using (
    public.is_super_admin()
    or organization_id in (select public.user_organization_ids())
    or exists (select 1 from public.user_roles ur
                where ur.user_id=auth.uid() and ur.role='viewer' and ur.organization_id=<table>.organization_id)
  );
```

### 12.3 Drop the over-permissive `ct_read` policy on `contract_templates`

`install-contract-templates.sql` declared:

```sql
create policy ct_read on public.contract_templates
  for select to authenticated using (true);
```

Phase 12 added a tenant-scoped `ct_select_v2_tenant` policy that
co-exists with it. To enforce strict tenant scoping:

```sql
-- DO NOT RUN without checking nothing relies on cross-tenant template reads.
drop policy ct_read on public.contract_templates;
```

**Recovery:** re-create the original policy.

### 12.4 Relax `payments.contract_id NOT NULL`

The `mark_bill_as_paid` RPC has a comment marking this as a hack: it
falls back to picking *some* installment contract for the resident
because the column is `NOT NULL`. The correct fix is:

```sql
-- DO NOT RUN without confirming downstream readers handle NULL.
alter table public.payments alter column contract_id drop not null;
```

Every existing `select … from payments where contract_id = …` survives,
but queries that assume non-null need defensive coding. After this you
can also drop the synthetic fallback in `mark_bill_as_paid`.

**Recovery:**

```sql
alter table public.payments alter column contract_id set not null;
```
(only possible if every row has a non-null `contract_id`).

### 12.5 Drop the deprecated `meter_readings` table

`utility_meter_readings` supersedes `meter_readings`. The old table is
still referenced by `phase5_functions.sql` and possibly by the UI. **Do
not drop** until every reader has been migrated. When ready:

```sql
-- DO NOT RUN before migrating every meter_readings reader.
drop table public.meter_readings;
```

**Recovery:** restore from backup. There is no schema-only roll-back.

### 12.6 Backfill historical bills with `consumption_aggregate_id`

Phase 12 sets `consumption_aggregate_id` only for newly generated bills.
Historical bills have NULL. A one-shot backfill is possible but slow on
large data sets and recomputes aggregates that may diverge from what was
originally billed.

```sql
-- DO NOT RUN on production without taking a snapshot first.
do $$
declare b record;
        v_agg uuid;
begin
  for b in select id, subscription_id, billing_period_start, billing_period_end
             from public.utility_bills where consumption_aggregate_id is null
  loop
    begin
      select public.calculate_usage_for_period(
        (select id from public.electricity_meters em
          join public.utility_subscriptions us on us.unit_id = em.unit_id
          where us.id = b.subscription_id limit 1),
        b.subscription_id, b.billing_period_start, b.billing_period_end
      ) into v_agg;
      update public.utility_bills set consumption_aggregate_id = v_agg where id = b.id;
    exception when others then
      raise notice 'Skipped bill % (% rows): %', b.id, sqlerrm;
    end;
  end loop;
end $$;
```

### 12.7 Vault-only credentials enforcement

After populating `provider_credentials.vault_key`, the natural next step
is to require it:

```sql
-- DO NOT RUN until every integration row has a vault_key OR env_var_name set.
alter table public.provider_credentials
  drop constraint provider_credentials_no_plaintext;
alter table public.provider_credentials
  add constraint provider_credentials_vault_required
  check (vault_key is not null);
```

Make sure no production row has only `env_var_name` filled before this.

---

## Migration application order

Recommended order in the Supabase SQL editor:

1. `20260513000000_phase12_metering_billing_hardening.sql`
   — runs all DDL + policies idempotently.
2. `20260513000100_phase12_rpc_functions.sql`
   — installs the 10 RPCs + helpers.
3. Run sections 9.1 – 9.6 (schema sanity, RLS, audit smoke).
4. Run a controlled section 9.7 – 9.12 against a single test meter /
   subscription.
5. Backfill (`provider_credentials` rows), regenerate types, deploy
   frontend.

---

## End of deliverable

