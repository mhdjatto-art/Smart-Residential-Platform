-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 8: Analytics, automation, jobs, alerts, AI prep
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables in this phase
--   analytics_daily_kpi      — denormalized KPI snapshot per org+compound+day
--   automation_rules         — declarative rules ("when X, do Y")
--   automation_runs          — execution log
--   job_queue                — generic async job queue (worker-agnostic)
--   system_alerts            — operational alerts surfaced in Control Center
--   ai_predictions           — output of future ML / heuristic predictors
--   report_definitions       — saved report shapes for scheduled exports
--   report_runs              — historical report executions
--
-- All tables are tenant-scoped (organization_id) with FORCE RLS in the
-- companion migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── enums ────────────────────────────────────────────────────────────────

create type public.automation_trigger as enum (
  'cron',                       -- scheduled
  'event_insert','event_update','event_delete',
  'condition_threshold'         -- e.g. overdue_count > 10
);

create type public.automation_action as enum (
  'send_notification','send_reminder','apply_penalty','suspend_service',
  'escalate_ticket','create_job','assign_technician','export_report',
  'webhook'
);

create type public.automation_status as enum ('active','paused','disabled');

create type public.job_status as enum ('queued','processing','succeeded','failed','dead');

create type public.alert_severity as enum ('info','warning','critical');
create type public.alert_status   as enum ('open','acknowledged','resolved','snoozed');

create type public.prediction_kind as enum (
  'overdue_risk','churn_risk','utility_anomaly','maintenance_risk',
  'cashflow_forecast','satisfaction_score'
);

create type public.report_kind as enum (
  'financial','utility','maintenance','occupancy','resident','marketplace','custom'
);

-- ─── analytics_daily_kpi ─────────────────────────────────────────────────
-- One row per (organization, compound, kpi_date). Populated by a refresh
-- function (see phase8_functions). Reporting reads this instead of pounding
-- transactional tables — preserves operational performance.

create table public.analytics_daily_kpi (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  compound_id             uuid references public.compounds(id) on delete cascade,
  kpi_date                date not null,

  active_residents        integer not null default 0,
  occupancy_rate          numeric(5,2) not null default 0,        -- 0..100
  outstanding_balance     numeric(14,2) not null default 0,
  collections_today       numeric(14,2) not null default 0,
  collections_mtd         numeric(14,2) not null default 0,
  overdue_amount          numeric(14,2) not null default 0,
  overdue_count           integer not null default 0,
  utility_bills_unpaid    integer not null default 0,
  utility_amount_unpaid   numeric(14,2) not null default 0,
  active_tickets          integer not null default 0,
  sla_breached            integer not null default 0,
  pending_visitors        integer not null default 0,
  marketplace_orders_open integer not null default 0,
  marketplace_revenue_today numeric(14,2) not null default 0,
  marketplace_commission_today numeric(14,2) not null default 0,
  satisfaction_avg        numeric(3,2) not null default 0,
  currency                text not null default 'USD',

  computed_at             timestamptz not null default now(),

  constraint kpi_unique_per_scope unique (organization_id, compound_id, kpi_date)
);

create index kpi_org_date_idx      on public.analytics_daily_kpi (organization_id, kpi_date desc);
create index kpi_compound_date_idx on public.analytics_daily_kpi (compound_id, kpi_date desc) where compound_id is not null;

-- ─── automation_rules ────────────────────────────────────────────────────

create table public.automation_rules (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  compound_id             uuid references public.compounds(id) on delete cascade,
  name                    text not null,
  description             text,
  trigger_kind            public.automation_trigger not null,
  trigger_config          jsonb not null default '{}'::jsonb,    -- {cron:"0 9 * * *", table:"tickets", filter:"...", threshold:{}}
  action                  public.automation_action not null,
  action_config           jsonb not null default '{}'::jsonb,    -- e.g. {channel:"in_app", template_id:"...", webhook_url:"..."}
  status                  public.automation_status not null default 'active',
  last_run_at             timestamptz,
  next_run_at             timestamptz,
  run_count               integer not null default 0,
  failure_count           integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id) on delete set null,
  updated_by              uuid references auth.users(id) on delete set null,

  constraint automation_unique_name_per_org unique (organization_id, name)
);

create index ar_org_idx     on public.automation_rules (organization_id);
create index ar_status_idx  on public.automation_rules (status);
create index ar_nextrun_idx on public.automation_rules (next_run_at) where status = 'active';

-- ─── automation_runs ─────────────────────────────────────────────────────

create table public.automation_runs (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  rule_id                 uuid not null references public.automation_rules(id) on delete cascade,
  triggered_at            timestamptz not null default now(),
  trigger_context         jsonb not null default '{}'::jsonb,
  outcome                 text not null check (outcome in ('success','failure','noop')),
  rows_affected           integer not null default 0,
  error_message           text,
  duration_ms             integer,
  created_at              timestamptz not null default now()
);

create index runs_rule_idx on public.automation_runs (rule_id, triggered_at desc);
create index runs_org_idx  on public.automation_runs (organization_id, triggered_at desc);
create index runs_failed_idx on public.automation_runs (organization_id, triggered_at desc) where outcome = 'failure';

-- ─── job_queue ────────────────────────────────────────────────────────────
-- Worker-agnostic queue. A future worker (Edge Function, Vercel cron, BullMQ
-- consumer, etc.) picks the next 'queued' job, sets it to 'processing',
-- updates result + status when done. Idempotency via dedup_key.

create table public.job_queue (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid references public.organizations(id) on delete cascade,
  job_kind                text not null,
  payload                 jsonb not null default '{}'::jsonb,
  status                  public.job_status not null default 'queued',
  scheduled_for           timestamptz not null default now(),
  started_at              timestamptz,
  finished_at             timestamptz,
  attempts                integer not null default 0,
  max_attempts            integer not null default 5,
  last_error              text,
  dedup_key               text,
  source_rule_id          uuid references public.automation_rules(id) on delete set null,
  created_at              timestamptz not null default now(),

  constraint job_dedup_unique unique (organization_id, dedup_key)
);

create index job_status_due_idx on public.job_queue (status, scheduled_for) where status in ('queued','processing');
create index job_kind_idx       on public.job_queue (job_kind);
create index job_org_idx        on public.job_queue (organization_id, created_at desc) where organization_id is not null;

-- ─── system_alerts ───────────────────────────────────────────────────────

create table public.system_alerts (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid references public.organizations(id) on delete cascade,
  compound_id             uuid references public.compounds(id) on delete cascade,
  kind                    text not null,                       -- 'overdue_spike','utility_anomaly','sla_violation','payment_failure'
  severity                public.alert_severity not null default 'warning',
  status                  public.alert_status not null default 'open',
  title                   text not null,
  body                    text,
  entity_table            text,
  entity_id               uuid,
  metric                  jsonb not null default '{}'::jsonb,   -- {observed: 42, threshold: 10}
  acknowledged_at         timestamptz,
  acknowledged_by         uuid references auth.users(id) on delete set null,
  resolved_at             timestamptz,
  resolved_by             uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now()
);

create index alerts_org_status_idx on public.system_alerts (organization_id, status, created_at desc);
create index alerts_open_idx       on public.system_alerts (organization_id, severity, created_at desc) where status = 'open';

-- ─── ai_predictions ──────────────────────────────────────────────────────

create table public.ai_predictions (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  compound_id             uuid references public.compounds(id) on delete cascade,
  prediction_kind         public.prediction_kind not null,
  subject_table           text,                                 -- e.g. 'residents'
  subject_id              uuid,
  score                   numeric(5,4) not null check (score >= 0 and score <= 1),
  band                    text check (band in ('low','medium','high','critical')),
  rationale               jsonb not null default '{}'::jsonb,   -- feature contributions / explanation
  predicted_at            timestamptz not null default now(),
  valid_until             timestamptz,
  model_version           text not null default 'heuristic-v1',
  created_at              timestamptz not null default now()
);

create index pred_org_kind_idx  on public.ai_predictions (organization_id, prediction_kind, predicted_at desc);
create index pred_subject_idx   on public.ai_predictions (subject_table, subject_id) where subject_id is not null;

-- ─── report_definitions + report_runs ────────────────────────────────────

create table public.report_definitions (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  name                    text not null,
  description             text,
  report_kind             public.report_kind not null,
  parameters              jsonb not null default '{}'::jsonb,   -- date_range, filters, columns
  schedule_cron           text,                                 -- null = on-demand only
  recipients              text[] not null default '{}',
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id) on delete set null
);

create table public.report_runs (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  report_id               uuid references public.report_definitions(id) on delete set null,
  report_kind             public.report_kind not null,
  parameters              jsonb not null default '{}'::jsonb,
  output_format           text not null check (output_format in ('csv','pdf','xlsx','json')),
  storage_path            text,
  row_count               integer,
  status                  text not null default 'pending' check (status in ('pending','running','succeeded','failed')),
  error_message           text,
  started_at              timestamptz,
  completed_at            timestamptz,
  created_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id) on delete set null
);

create index reports_org_idx     on public.report_definitions (organization_id);
create index report_runs_org_idx on public.report_runs (organization_id, created_at desc);

-- ─── triggers ─────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  for t in select unnest(array[
    'analytics_daily_kpi','automation_rules','system_alerts',
    'report_definitions','report_runs'
  ])
  loop
    execute format(
      'drop trigger if exists %I_set_updated_at on public.%I;
       create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t, t, t, t
    );
  end loop;
end $$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'automation_rules','automation_runs','system_alerts','ai_predictions',
    'report_definitions','report_runs'
  ])
  loop
    execute format(
      'drop trigger if exists %I_audit on public.%I;
       create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_row();', t, t, t, t
    );
  end loop;
end $$;
