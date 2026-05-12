-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 9: SaaS functions — provisioning, feature checks, usage metering
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── has_feature ──────────────────────────────────────────────────────────
-- Checks if an organization has a feature enabled. Resolution order:
--   1. organization_feature_overrides (if not expired)
--   2. plan_features (via active subscription)
--   3. feature_catalog.default_enabled

create or replace function public.has_feature(p_org_id uuid, p_feature text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_override record;
  v_plan_id uuid;
  v_enabled boolean;
begin
  -- 1. Override
  select * into v_override
  from public.organization_feature_overrides
  where organization_id = p_org_id and feature = p_feature
    and (expires_at is null or expires_at > now())
  limit 1;
  if found then return v_override.is_enabled; end if;

  -- 2. Active plan
  select plan_id into v_plan_id
  from public.organization_subscriptions
  where organization_id = p_org_id
    and status in ('trialing','active','past_due')
  order by created_at desc
  limit 1;

  if v_plan_id is not null then
    select is_enabled into v_enabled
    from public.plan_features
    where plan_id = v_plan_id and feature = p_feature
    limit 1;
    if v_enabled is not null then return v_enabled; end if;
  end if;

  -- 3. Catalog default
  select default_enabled into v_enabled
  from public.feature_catalog where key = p_feature;
  return coalesce(v_enabled, false);
end;
$$;

grant execute on function public.has_feature(uuid,text) to authenticated;

-- ─── record_usage ─────────────────────────────────────────────────────────

create or replace function public.record_usage(
  p_org_id    uuid,
  p_metric    public.usage_metric,
  p_amount    numeric default 1,
  p_context   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := current_date;
begin
  insert into public.usage_events (organization_id, metric, amount, context)
  values (p_org_id, p_metric, p_amount, p_context);

  insert into public.usage_aggregates (organization_id, metric, period_date, total_amount, event_count, computed_at)
  values (p_org_id, p_metric, v_date, p_amount, 1, now())
  on conflict (organization_id, metric, period_date) do update
    set total_amount = usage_aggregates.total_amount + excluded.total_amount,
        event_count  = usage_aggregates.event_count + 1,
        computed_at  = now();
end;
$$;

grant execute on function public.record_usage(uuid, public.usage_metric, numeric, jsonb) to authenticated;

-- ─── provision_organization ───────────────────────────────────────────────
-- One-shot tenant provisioning. Super-admins call this from the SaaS console.
-- Creates the org + settings + branding + a trial subscription on the chosen plan.

create or replace function public.provision_organization(
  p_name           text,
  p_slug           text,
  p_plan_code      text default 'starter',
  p_contact_email  text default null,
  p_country_code   text default null,
  p_default_locale text default 'en',
  p_timezone       text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_plan_id uuid;
  v_price   numeric(10,2);
  v_curr    text;
begin
  if not public.is_super_admin() then
    raise exception 'provision_organization: only super_admin can provision tenants';
  end if;

  if p_slug !~ '^[a-z0-9-]{2,64}$' then
    raise exception 'provision_organization: invalid slug %', p_slug;
  end if;

  -- 1. organization
  insert into public.organizations (name, slug, status, contact_email, country_code)
  values (p_name, p_slug, 'active', p_contact_email, p_country_code)
  returning id into v_org_id;

  -- 2. branding defaults
  insert into public.organization_branding (organization_id) values (v_org_id);

  -- 3. settings
  insert into public.organization_settings (organization_id, default_locale, timezone,
                                            supported_locales, rtl_enabled)
  values (
    v_org_id, p_default_locale, p_timezone,
    array[p_default_locale]::text[],
    p_default_locale in ('ar','ku')
  );

  -- 4. default primary domain (slug.srp.app)
  insert into public.organization_domains (organization_id, host, is_primary, ssl_status, verified_at)
  values (v_org_id, p_slug || '.srp.app', true, 'issued', now())
  on conflict (host) do nothing;

  -- 5. subscription on the chosen plan (14-day trial)
  select id, monthly_price, currency into v_plan_id, v_price, v_curr
  from public.subscription_plans where code = p_plan_code and is_active limit 1;
  if v_plan_id is null then
    raise exception 'provision_organization: plan % not found', p_plan_code;
  end if;
  insert into public.organization_subscriptions (
    organization_id, plan_id, status, billing_cycle, unit_price, currency,
    trial_ends_at, current_period_start, current_period_end
  )
  values (
    v_org_id, v_plan_id, 'trialing', 'monthly', v_price, v_curr,
    now() + interval '14 days', now(), now() + interval '14 days'
  );

  return v_org_id;
end;
$$;

revoke all on function public.provision_organization(text,text,text,text,text,text,text) from public;
grant execute on function public.provision_organization(text,text,text,text,text,text,text) to authenticated;

-- ─── resolve_organization_by_host ─────────────────────────────────────────
-- Used by middleware-style lookups. Returns the org for a given host or null.

create or replace function public.resolve_organization_by_host(p_host text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_domains
  where host = lower(p_host)
  limit 1;
$$;

grant execute on function public.resolve_organization_by_host(text) to anon, authenticated;
