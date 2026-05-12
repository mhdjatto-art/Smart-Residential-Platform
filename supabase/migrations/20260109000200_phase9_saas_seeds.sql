-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 9: seed default feature catalog + plans
-- ─────────────────────────────────────────────────────────────────────────────
-- Idempotent: uses on conflict do nothing so re-running this migration won't
-- duplicate rows. Update the catalog by re-running with new entries.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── feature_catalog ──────────────────────────────────────────────────────

insert into public.feature_catalog (key, name, category, description, is_premium, default_enabled) values
  ('core_residents',         'Residents & units',         'core',        'Resident, unit, building, compound management.', false, true),
  ('core_contracts',         'Contracts & installments',  'finance',     'Contracts, installments, penalties, receipts.',   false, true),
  ('finance_reminders',      'Payment reminders',         'finance',     'Automated due-date reminders.',                   false, true),
  ('finance_multi_currency', 'Multi-currency',            'finance',     'USD + IQD + extended currencies.',                false, true),
  ('operations_tickets',     'Tickets & maintenance',     'operations',  'Complaint and maintenance workflow.',             false, true),
  ('operations_visitors',    'Visitors',                  'operations',  'Visitor pre-registration and access control.',    false, true),
  ('operations_facilities',  'Facility bookings',         'operations',  'Bookable amenities + scheduling.',                false, true),
  ('utilities_electricity',  'Electricity meters',        'utilities',   'Meters, readings, tariffs, bills.',               false, true),
  ('utilities_internet',     'Internet packages',         'utilities',   'Internet plans + subscriptions + suspension.',    false, true),
  ('utilities_gas',          'Gas orders',                'utilities',   'Manual + adapter-driven gas delivery.',           false, true),
  ('utilities_adapters',     'IoT adapter integrations',  'utilities',   'Modbus/MQTT/MikroTik/UniFi adapters.',            true,  false),
  ('marketplace_basic',      'Marketplace',               'marketplace', 'Service providers, catalog, orders, reviews.',    false, true),
  ('marketplace_commissions','Commissions & payouts',     'marketplace', 'Commission ledger + provider payouts.',           true,  false),
  ('mobile_pwa',             'Mobile PWA',                'mobile',      'Installable PWA + offline shell.',                false, true),
  ('mobile_push',            'Push notifications',        'mobile',      'Browser + native push notifications.',            true,  false),
  ('analytics_kpi',          'Daily KPI snapshots',       'analytics',   'analytics_daily_kpi + executive trends.',         false, true),
  ('analytics_predictive',   'Predictive analytics',      'analytics',   'AI predictions (overdue risk, churn, anomalies).', true, false),
  ('automation_rules',       'Automation rules',          'automation',  'Triggers + actions + job queue.',                 true,  false),
  ('alerts_center',          'Alerts & monitoring',       'analytics',   'System-detected anomalies and SLA violations.',   false, true),
  ('audit_log',              'Audit log',                 'compliance',  'Immutable change log across the platform.',       false, true),
  ('white_label_branding',   'White-label branding',      'saas',        'Per-org logo, colors, fonts, custom CSS.',        true,  false),
  ('custom_domains',         'Custom domains',            'saas',        'CNAME-based custom hostnames per org.',           true,  false),
  ('saas_console',           'SaaS console',              'saas',        'Platform-wide tenant + revenue console.',         false, true),
  ('multi_language',         'Multi-language',            'saas',        'EN/AR/KU/FR/ES with RTL support.',                false, true)
on conflict (key) do nothing;

-- ─── subscription_plans ───────────────────────────────────────────────────

insert into public.subscription_plans (
  code, name, tier, description, monthly_price, annual_price, currency,
  max_compounds, max_units, max_residents, max_admin_users, max_storage_mb, max_api_calls_per_month,
  display_order
) values
  ('starter',      'Starter',      'starter',      'For single small compounds getting started.',
   99,   990,   'USD',  1,   100,   200,   3,   2048,   100000, 1),
  ('professional', 'Professional', 'professional', 'For growing operators with multi-compound needs.',
   399, 3990,   'USD',  5,  1000,  2500,  10,  20480,  1000000, 2),
  ('enterprise',   'Enterprise',   'enterprise',   'For large developers and enterprise integrations.',
   1499, 14990, 'USD',  null, null, null, null, 204800, null,   3),
  ('custom',       'Custom',       'custom',       'Negotiated terms — contact sales.',
   0, 0, 'USD',  null, null, null, null, null, null, 99)
on conflict (code) do nothing;

-- ─── plan_features ────────────────────────────────────────────────────────
-- Starter: everything except premium gates.
-- Professional: everything except IoT adapters + predictive AI + push.
-- Enterprise: everything.
-- Custom: configured manually.

do $$
declare
  v_starter uuid; v_pro uuid; v_ent uuid;
begin
  select id into v_starter from public.subscription_plans where code = 'starter';
  select id into v_pro     from public.subscription_plans where code = 'professional';
  select id into v_ent     from public.subscription_plans where code = 'enterprise';

  -- Wipe and re-seed (idempotent reseed for these three known plans).
  delete from public.plan_features where plan_id in (v_starter, v_pro, v_ent);

  -- Starter: all non-premium features enabled
  insert into public.plan_features (plan_id, feature, is_enabled)
    select v_starter, key, true from public.feature_catalog where not is_premium;

  -- Professional: starter set + marketplace_commissions + automation_rules + analytics_predictive
  insert into public.plan_features (plan_id, feature, is_enabled)
    select v_pro, key, true from public.feature_catalog
    where not is_premium
       or key in ('marketplace_commissions','automation_rules','analytics_predictive','white_label_branding');

  -- Enterprise: everything
  insert into public.plan_features (plan_id, feature, is_enabled)
    select v_ent, key, true from public.feature_catalog;
end $$;
