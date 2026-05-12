-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — Iraqi utility providers seed
-- ─────────────────────────────────────────────────────────────────────────────
-- Inserts all major Iraqi utility/telecom providers into utility_providers
-- and creates a matching provider_integrations row with the correct adapter
-- type (mikrotik / unifi / modbus / mqtt / rest / radius / webhook / generic).
--
-- Run as super_admin in Supabase SQL Editor. Idempotent — safe to re-run.
-- Picks the FIRST organization in your DB unless you change `v_org_id` below.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_org_id      uuid;
  v_provider_id uuid;
  r             record;
  -- Format: name | name_ar | type | billing | tariff | code | adapter | endpoint | notes
  v_providers   text[][] := array[
    -- ── Electricity (national + regional + private) ───────────────────────
    array['Ministry of Electricity (Federal)', 'وزارة الكهرباء الاتحادية',  'electricity','metered','tiered','MOE-IQ',     'rest',     'https://moelc.gov.iq/api',                   'National electricity grid'],
    array['Baghdad Electricity Distribution',   'كهرباء بغداد',              'electricity','metered','tiered','BAG-ELEC',   'modbus',   'modbus://10.0.0.1:502',                      'Modbus TCP smart meters'],
    array['Basra Electricity Distribution',     'كهرباء البصرة',             'electricity','metered','tiered','BAS-ELEC',   'modbus',   'modbus://10.0.0.2:502',                      'Modbus TCP smart meters'],
    array['Nineveh Electricity Distribution',   'كهرباء نينوى',              'electricity','metered','tiered','NIN-ELEC',   'modbus',   'modbus://10.0.0.3:502',                      'Modbus TCP smart meters'],
    array['KRG Ministry of Electricity',        'وزارة كهرباء إقليم كوردستان','electricity','metered','tiered','KRG-MOE',    'rest',     'https://moe.gov.krd/api',                    'Kurdistan Regional Government'],
    array['Erbil Electricity Directorate',      'مديرية كهرباء أربيل',       'electricity','metered','tiered','ERB-ELEC',   'modbus',   'modbus://10.1.0.1:502',                      'Erbil city'],
    array['Sulaymaniyah Electricity Directorate','مديرية كهرباء السليمانية',  'electricity','metered','tiered','SUL-ELEC',   'modbus',   'modbus://10.1.0.2:502',                      'Sulaymaniyah city'],
    array['Duhok Electricity Directorate',      'مديرية كهرباء دهوك',        'electricity','metered','tiered','DOH-ELEC',   'modbus',   'modbus://10.1.0.3:502',                      'Duhok city'],
    array['Private Generator (Mahalla)',        'مولّدة المحلة الأهلية',     'generator',  'metered','fixed', 'GEN-LOCAL',  'mqtt',     'mqtt://broker.local:1883',                   'Local neighborhood generator — MQTT IoT meter'],

    -- ── Water ──────────────────────────────────────────────────────────────
    array['Baghdad Water Authority',            'مديرية ماء بغداد',          'water',      'metered','tiered','BAG-WATER',  'modbus',   'modbus://10.0.1.1:502',                      'Baghdad municipal water'],
    array['Basra Water Directorate',            'مديرية ماء البصرة',         'water',      'metered','tiered','BAS-WATER',  'modbus',   'modbus://10.0.1.2:502',                      'Basra municipal water'],
    array['Erbil Water Directorate',            'مديرية ماء أربيل',          'water',      'metered','tiered','ERB-WATER',  'modbus',   'modbus://10.1.1.1:502',                      'Erbil municipal water'],
    array['Sulaymaniyah Water Directorate',     'مديرية ماء السليمانية',     'water',      'metered','tiered','SUL-WATER',  'modbus',   'modbus://10.1.1.2:502',                      'Sulaymaniyah municipal water'],
    array['Duhok Water Directorate',            'مديرية ماء دهوك',           'water',      'metered','tiered','DOH-WATER',  'modbus',   'modbus://10.1.1.3:502',                      'Duhok municipal water'],

    -- ── Gas (LPG cylinders) ────────────────────────────────────────────────
    array['State Co. for Gas Filling',          'الشركة العامة لتعبئة الغاز','gas',        'flat',   'fixed', 'IQ-GAS',     'generic',  '',                                           'Cylinder delivery — manual billing'],

    -- ── Internet (ISP — fixed broadband + fiber) ───────────────────────────
    array['Earthlink Telecommunications',       'إيرث لنك',                  'internet',   'flat',   'fixed', 'EARTHLINK',  'radius',   'radius://radius.earthlink.iq:1812',          'Largest fixed ISP — RADIUS auth'],
    array['IQ Networks',                        'IQ نتوركس',                 'internet',   'flat',   'fixed', 'IQNET',      'mikrotik', 'https://api.iqnetworks.iq',                  'Mikrotik RouterOS — auto disconnect on overdue'],
    array['Newroz Telecom',                     'نوروز تيليكوم',             'internet',   'flat',   'fixed', 'NEWROZ',     'rest',     'https://api.newroztelecom.com',              'KRG ISP — REST API'],
    array['HulumTele',                          'هولوم تيلي',                'internet',   'flat',   'fixed', 'HULUM',      'unifi',    'https://unifi.hulumtele.iq:8443',            'UniFi Controller for managed APs'],
    array['Fastlink',                           'فاست لنك',                  'internet',   'flat',   'fixed', 'FASTLINK',   'mikrotik', 'https://api.fastlink.iq',                    'Mikrotik subscriber API'],
    array['Atheer Telecom',                     'أثير تيليكوم',              'internet',   'flat',   'fixed', 'ATHEER',     'webhook',  '',                                           'Receives webhooks for usage events'],

    -- ── Mobile operators (for SMS notifications + data packages) ───────────
    array['Zain Iraq',                          'زين العراق',                'internet',   'flat',   'fixed', 'ZAIN-IQ',    'rest',     'https://api.iq.zain.com',                    'Mobile + data + SMS gateway'],
    array['Asiacell',                           'آسياسيل',                   'internet',   'flat',   'fixed', 'ASIACELL',   'rest',     'https://api.asiacell.com',                   'Mobile + data + SMS gateway'],
    array['Korek Telecom',                      'كورك تيليكوم',              'internet',   'flat',   'fixed', 'KOREK',      'rest',     'https://api.korektel.com',                   'Mobile + data + KRG fiber']
  ];
begin
  -- Pick the first active organization (change this if you have multiple)
  select id into v_org_id
  from public.organizations
  where status = 'active'
  order by created_at
  limit 1;

  if v_org_id is null then
    raise exception 'No active organization found. Create an organization first.';
  end if;

  raise notice 'Seeding Iraqi providers into organization %', v_org_id;

  for i in 1 .. array_length(v_providers, 1) loop
    -- Skip if provider with this code already exists for this org
    select id into v_provider_id
    from public.utility_providers
    where organization_id = v_org_id and provider_code = v_providers[i][6]
    limit 1;

    if v_provider_id is null then
      insert into public.utility_providers (
        organization_id, provider_name, provider_type, provider_code,
        billing_method, tariff_type, provider_status,
        adapter_kind, adapter_config,
        metadata
      ) values (
        v_org_id,
        v_providers[i][1],
        v_providers[i][3]::public.utility_type,
        v_providers[i][6],
        v_providers[i][4]::public.billing_method,
        v_providers[i][5]::public.tariff_type,
        'active',
        v_providers[i][7],
        jsonb_build_object('endpoint_url', v_providers[i][8], 'notes', v_providers[i][9]),
        jsonb_build_object('name_ar', v_providers[i][2], 'country', 'IQ')
      )
      returning id into v_provider_id;
    end if;

    -- Create or upsert the matching provider_integration row
    if not exists (
      select 1 from public.provider_integrations
      where provider_id = v_provider_id and adapter_kind = v_providers[i][7]
    ) then
      insert into public.provider_integrations (
        organization_id, provider_id, adapter_kind, name,
        endpoint_url, config, status, is_active
      ) values (
        v_org_id,
        v_provider_id,
        v_providers[i][7],
        v_providers[i][1] || ' — ' || upper(v_providers[i][7]) || ' adapter',
        nullif(v_providers[i][8], ''),
        jsonb_build_object(
          'protocol', v_providers[i][7],
          'endpoint', v_providers[i][8],
          'notes',    v_providers[i][9],
          'country',  'IQ'
        ),
        'configured',
        true
      );
    end if;
  end loop;

  raise notice 'Done. % providers seeded for org %.', array_length(v_providers, 1), v_org_id;
end $$;

-- Quick view of what was created
select
  p.provider_name,
  p.provider_type,
  p.adapter_kind,
  i.endpoint_url,
  i.status as integration_status
from public.utility_providers p
left join public.provider_integrations i on i.provider_id = p.id
where p.metadata->>'country' = 'IQ'
order by p.provider_type, p.provider_name;
