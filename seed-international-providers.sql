-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — International / Regional providers seed
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds 25 external providers commonly used by Iraq-based compounds:
--   • GCC utilities (DEWA, ADDC, SEC, KAHRAMAA, KEWA, EWA, PAEW, NEPCO, EDL)
--   • Cross-border ISPs (Starlink, Turk Telekom, Türkcell, Etisalat, STC,
--     Du, Ooredoo, Orange)
--   • Global IoT / building platforms (Schneider, Siemens, ABB, Honeywell)
--   • SMS gateways + payment processors (Twilio, Vonage, Stripe, PayPal)
--
-- Each provider is linked to the right adapter_kind so the platform can
-- talk to it the moment credentials are entered. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_org_id      uuid;
  v_provider_id uuid;
  -- Format: name | name_ar | type | billing | tariff | code | adapter | endpoint | notes | country
  v_providers   text[][] := array[
    -- ── GCC Electricity / Water (have public REST APIs) ───────────────────
    array['DEWA — Dubai Electricity & Water', 'دبي للكهرباء والماء',          'electricity','metered','tiered','DEWA',       'rest',     'https://www.dewa.gov.ae/api/v1',          'UAE — Dubai utility',           'AE'],
    array['ADDC — Abu Dhabi Distribution',    'توزيع كهرباء أبو ظبي',          'electricity','metered','tiered','ADDC',       'rest',     'https://api.addc.ae/v1',                  'UAE — Abu Dhabi',                'AE'],
    array['SEC — Saudi Electricity',          'الشركة السعودية للكهرباء',       'electricity','metered','tiered','SEC',        'rest',     'https://api.se.com.sa/v1',                'Saudi Arabia',                   'SA'],
    array['KAHRAMAA — Qatar Electricity & Water','مؤسسة كهرماء قطر',           'electricity','metered','tiered','KAHRAMAA',   'rest',     'https://api.km.qa/v1',                    'Qatar — electricity + water',    'QA'],
    array['KEWA — Kuwait Electricity & Water','وزارة الكهرباء والماء الكويتية', 'electricity','metered','tiered','KEWA',       'rest',     'https://api.mew.gov.kw/v1',               'Kuwait',                         'KW'],
    array['EWA — Bahrain Electricity & Water','هيئة كهرباء وماء البحرين',       'electricity','metered','tiered','EWA-BH',     'rest',     'https://api.ewa.bh/v1',                   'Bahrain',                        'BH'],
    array['PAEW — Oman Public Authority',     'الهيئة العامة للكهرباء عمان',    'electricity','metered','tiered','PAEW-OM',    'rest',     'https://api.paew.om/v1',                  'Oman',                           'OM'],
    array['NEPCO — Jordan Electric Power',    'شركة الكهرباء الوطنية الأردنية',  'electricity','metered','tiered','NEPCO-JO',   'rest',     'https://api.nepco.com.jo/v1',             'Jordan',                         'JO'],
    array['EDL — Électricité du Liban',       'كهرباء لبنان',                  'electricity','metered','tiered','EDL-LB',     'rest',     'https://api.edl.gov.lb/v1',               'Lebanon',                        'LB'],

    -- ── Regional / Cross-border ISPs ──────────────────────────────────────
    array['Starlink — SpaceX',                'ستارلنك',                       'internet',   'flat',   'fixed', 'STARLINK',   'rest',     'https://api.starlink.com/v1',             'Satellite — popular in Iraq',     'US'],
    array['Türk Telekom',                     'تورك تيلكوم',                   'internet',   'flat',   'fixed', 'TT-TR',      'radius',   'radius://radius.turktelekom.com.tr:1812', 'Turkey — fixed broadband',        'TR'],
    array['Türkcell Superonline',             'تيركسل سوبر أونلاين',           'internet',   'flat',   'fixed', 'TCELL-FIBER','rest',     'https://api.superonline.net',             'Turkey — fiber + mobile',         'TR'],
    array['Etisalat by e&',                   'اتصالات الإمارات',              'internet',   'flat',   'fixed', 'ETISALAT-AE','rest',     'https://api.etisalat.ae/v1',              'UAE — fiber + mobile',            'AE'],
    array['Du — EITC',                        'دو',                            'internet',   'flat',   'fixed', 'DU-AE',      'rest',     'https://api.du.ae/v1',                    'UAE — fiber + mobile',            'AE'],
    array['STC — Saudi Telecom',              'الاتصالات السعودية',            'internet',   'flat',   'fixed', 'STC-SA',     'rest',     'https://api.stc.com.sa/v1',               'Saudi — fiber + mobile + SMS',    'SA'],
    array['Ooredoo Qatar',                    'أوريدو قطر',                    'internet',   'flat',   'fixed', 'OOREDOO-QA', 'rest',     'https://api.ooredoo.qa/v1',               'Qatar + regional fiber',          'QA'],
    array['Orange MEA',                       'أورانج الشرق الأوسط',           'internet',   'flat',   'fixed', 'ORANGE-MEA', 'rest',     'https://api.orange-business.com/v1',      'Pan-MENA business connectivity',  'FR'],
    array['Vodafone Business MEA',            'فودافون الأعمال',               'internet',   'flat',   'fixed', 'VODA-MEA',   'rest',     'https://api.vodafone.com/business/v1',    'Pan-regional B2B comms',          'UK'],

    -- ── Global IoT / building automation (industrial Modbus + cloud REST) ─
    array['Schneider EcoStruxure',            'شنايدر إيكوستراكتشر',           'electricity','metered','tiered','SCHNEIDER',  'modbus',   'modbus://schneider.local:502',            'Smart buildings — Modbus + cloud','FR'],
    array['Siemens Building Tech',            'سيمنز للمباني',                 'electricity','metered','tiered','SIEMENS',    'modbus',   'modbus://siemens.local:502',              'BMS — Desigo CC, Modbus TCP',     'DE'],
    array['ABB Ability',                      'ABB أبيليتي',                   'electricity','metered','tiered','ABB',        'mqtt',     'mqtt://ability.abb.com:8883',             'Industrial IoT — MQTT over TLS',  'CH'],
    array['Honeywell Forge',                  'هانيويل فورج',                  'electricity','metered','tiered','HONEYWELL',  'rest',     'https://api.honeywellforge.ai/v1',        'Building optimization platform',  'US'],

    -- ── SMS / payment gateways (for notifications + billing) ──────────────
    array['Twilio',                           'تويليو',                        'internet',   'flat',   'fixed', 'TWILIO',     'rest',     'https://api.twilio.com/2010-04-01',       'Global SMS + voice + WhatsApp',   'US'],
    array['Vonage (Nexmo)',                   'فوناج',                         'internet',   'flat',   'fixed', 'VONAGE',     'rest',     'https://rest.nexmo.com/sms',              'SMS + verify API',                 'US'],
    array['Stripe',                           'سترايب',                        'internet',   'flat',   'fixed', 'STRIPE',     'webhook',  '',                                          'Card payments — incoming webhooks','US'],
    array['PayPal',                           'باي بال',                       'internet',   'flat',   'fixed', 'PAYPAL',     'webhook',  '',                                          'Wallet + card — IPN webhooks',    'US']
  ];
begin
  -- Pick the first active organization
  select id into v_org_id
  from public.organizations
  where status = 'active'
  order by created_at
  limit 1;

  if v_org_id is null then
    raise exception 'No active organization found.';
  end if;

  raise notice 'Seeding international providers into organization %', v_org_id;

  for i in 1 .. array_length(v_providers, 1) loop
    select id into v_provider_id
    from public.utility_providers
    where organization_id = v_org_id and provider_code = v_providers[i][6]
    limit 1;

    if v_provider_id is null then
      insert into public.utility_providers (
        organization_id, provider_name, provider_type, provider_code,
        billing_method, tariff_type, provider_status,
        adapter_kind, adapter_config, metadata
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
        jsonb_build_object('name_ar', v_providers[i][2], 'country', v_providers[i][10], 'international', true)
      )
      returning id into v_provider_id;
    end if;

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
          'country',  v_providers[i][10],
          'international', true
        ),
        'configured',
        true
      );
    end if;
  end loop;

  raise notice 'Done. % international providers seeded.', array_length(v_providers, 1);
end $$;

-- Verify both Iraqi + international are present
select
  coalesce(p.metadata->>'country','??') as country,
  p.provider_type,
  p.provider_name,
  p.adapter_kind,
  case when (p.metadata->>'international')::boolean then 'INTL' else 'IQ' end as scope
from public.utility_providers p
order by scope desc, country, p.provider_type, p.provider_name;
