-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — Gates / Parking / Access Control / Intercom providers
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds 28 vendors covering compound physical security & parking:
--   • Gate automation: FAAC, CAME, BFT, Nice, Roger
--   • Access control: HID, Suprema, ZKTeco, Hikvision, Dahua, Paxton, LenelS2
--   • Intercoms: 2N, Aiphone, Akuvox, Comelit
--   • Parking gates: Skidata, Designa, HUB, Scheidt & Bachmann, Amano McGann
--   • ANPR (license plate): Tattile, AutoVu, ARH, Survision
--   • Mobile parking apps (MENA): Mawqif (SA), ParkOn (Iraq)
--   • EV chargers: ChargePoint, ABB Terra, Tesla Wall, Wallbox
--
-- Each is wired to the correct adapter_kind so the platform can integrate
-- without code changes — just enter credentials in /integrations.
--
-- All rows use utility_type='other' (gate/parking aren't in the type enum).
-- The actual category lives in metadata.category for filtering in the UI.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_org_id      uuid;
  v_provider_id uuid;
  -- name | name_ar | category | billing | code | adapter | endpoint | notes | country
  v_providers   text[][] := array[
    -- ── Gate automation operators (swing/sliding/barrier gates) ────────────
    array['FAAC',                       'فاك',                'gate_automation','flat','FAAC',         'rest',     'https://api.faac.it/v1',                'Swing + sliding gate operators',          'IT'],
    array['CAME',                       'كامي',               'gate_automation','flat','CAME',         'rest',     'https://api.came.com/v1',               'Connected gate cloud',                    'IT'],
    array['BFT',                        'بي إف تي',           'gate_automation','flat','BFT',          'rest',     'https://api.bft-automation.com/v1',     'U-Connect cloud API',                     'IT'],
    array['Nice S.p.A.',                'نايس',               'gate_automation','flat','NICE',         'rest',     'https://api.niceforyou.com/v1',         'Yubii cloud gateway',                     'IT'],
    array['Roger Technology',           'روجر تكنولوجي',      'gate_automation','flat','ROGER',        'generic',  '',                                      'RS-485 local controller',                 'IT'],

    -- ── Access control (cards / fobs / biometric / mobile credentials) ────
    array['HID Global — Origo',         'HID جلوبال',         'access_control','flat','HID-ORIGO',    'rest',     'https://api.origo.hidglobal.com/v1',    'Mobile + card credentials',               'US'],
    array['Suprema BioStar 2',          'سوبريما',             'access_control','flat','SUPREMA',      'rest',     'https://api.biostar2.com/v1',           'Biometric face/finger + cards',           'KR'],
    array['ZKTeco BioTime',             'زدكيتيكو',            'access_control','flat','ZKTECO',       'rest',     'https://api.zkteco.com/v1',             'Very popular in MENA — face/finger',      'CN'],
    array['Hikvision Access Control',   'هيكفيجن',             'access_control','flat','HIK-ACS',      'rest',     'https://open.hikvision.com/v1',         'Cameras + ACS combined',                  'CN'],
    array['Dahua DSS Pro',              'داهوا',               'access_control','flat','DAHUA-DSS',    'rest',     'https://api.dahuatech.com/v1',          'Cameras + ACS combined',                  'CN'],
    array['Paxton Net2',                'باكستون',             'access_control','flat','PAXTON',       'rest',     'https://api.paxton-online.com/v1',      'UK access control — popular small sites', 'UK'],
    array['LenelS2 OnGuard (Carrier)',  'لينيل S2',            'access_control','flat','LENEL',        'rest',     'https://api.lenels2.com/v1',            'Enterprise — large compounds',            'US'],

    -- ── IP intercoms (video door entry + mobile call routing) ──────────────
    array['2N IP Intercoms',            'تو-إن انتركوم',       'intercom',     'flat','2N',           'rest',     'https://api.2n.com/v1',                 'Video intercom + SIP',                    'CZ'],
    array['Aiphone IXG',                'أيفون انتركوم',       'intercom',     'flat','AIPHONE',      'rest',     'https://api.aiphone.com/v1',            'Apartment intercom systems',              'JP'],
    array['Akuvox SmartPlus',           'أكوفوكس',             'intercom',     'flat','AKUVOX',       'rest',     'https://api.akuvox.com/v1',             'SIP intercoms + mobile app',              'CN'],
    array['Comelit ViP',                'كوميليت',             'intercom',     'flat','COMELIT',      'rest',     'https://api.comelitgroup.com/v1',       'Italian intercom + access',               'IT'],

    -- ── Parking management (barriers + ticket/permit) ──────────────────────
    array['Skidata',                    'سكيداتا',             'parking',      'metered','SKIDATA',    'rest',     'https://api.skidata.com/v1',            'Parking gates + payment terminals',       'AT'],
    array['Designa',                    'ديزاينا',             'parking',      'metered','DESIGNA',    'rest',     'https://api.designa.com/v1',            'Enterprise parking management',           'DE'],
    array['HUB Parking Technology',     'هاب باركينج',         'parking',      'metered','HUB-PARK',   'rest',     'https://api.hubparking.com/v1',         'Modular parking systems',                 'IT'],
    array['Scheidt & Bachmann',         'شايدت آند باخمان',    'parking',      'metered','SB-PARK',    'rest',     'https://api.scheidt-bachmann.de/v1',    'Premium parking systems',                 'DE'],
    array['Amano McGann',               'أمانو ماك غان',       'parking',      'metered','AMANO',      'rest',     'https://api.amanomcgann.com/v1',        'Parking + revenue control',               'US'],

    -- ── ANPR / License plate recognition (auto-open for residents) ─────────
    array['Tattile Vega',               'تاتيلي فيغا',         'anpr',         'flat','TATTILE',      'webhook',  '',                                      'License plate events via webhook',        'IT'],
    array['Genetec AutoVu',             'جينيتك أوتوفيو',       'anpr',         'flat','AUTOVU',       'rest',     'https://api.genetec.com/v1',            'Mobile + fixed ANPR cameras',             'CA'],
    array['Adaptive Recognition (ARH)', 'ARH',                'anpr',         'flat','ARH-ANPR',     'rest',     'https://api.adaptiverecognition.com/v1','Carmen ANPR engine',                      'HU'],
    array['Survision',                  'سيرفجن',              'anpr',         'flat','SURVISION',    'webhook',  '',                                      'Embedded ANPR with webhooks',             'FR'],

    -- ── Mobile parking apps (regional) ─────────────────────────────────────
    array['Mawqif (KSA)',               'موقف',                'parking_app',  'metered','MAWQIF-SA',  'rest',     'https://api.mawqif.com.sa/v1',          'Saudi parking payments',                  'SA'],
    array['ParkOn (Iraq)',              'باركون',              'parking_app',  'metered','PARKON-IQ',  'rest',     'https://api.parkon.iq/v1',              'Iraq mobile parking payments',            'IQ'],

    -- ── EV charging stations (co-located with parking) ─────────────────────
    array['ChargePoint',                'تشارج بوينت',         'ev_charging',  'metered','CHARGEPOINT','rest',     'https://api.chargepoint.com/v1',        'OCPP + REST API',                         'US'],
    array['ABB Terra DC Wallbox',       'ABB تيرا',            'ev_charging',  'metered','ABB-TERRA',  'modbus',   'modbus://terra.local:502',              'DC fast chargers via Modbus + OCPP',      'CH'],
    array['Tesla Wall Connector',       'تيسلا وول كونيكتر',   'ev_charging',  'metered','TESLA-WALL', 'rest',     'https://api.tesla.com/v1',              'Tesla cloud API',                         'US'],
    array['Wallbox',                    'وول بوكس',            'ev_charging',  'metered','WALLBOX',    'rest',     'https://api.wall-box.com/v1',           'EV chargers + myWallbox API',             'ES']
  ];
begin
  select id into v_org_id
  from public.organizations
  where status = 'active'
  order by created_at
  limit 1;

  if v_org_id is null then
    raise exception 'No active organization found.';
  end if;

  raise notice 'Seeding gates/parking/access providers into organization %', v_org_id;

  for i in 1 .. array_length(v_providers, 1) loop
    select id into v_provider_id
    from public.utility_providers
    where organization_id = v_org_id and provider_code = v_providers[i][5]
    limit 1;

    if v_provider_id is null then
      insert into public.utility_providers (
        organization_id, provider_name, provider_type, provider_code,
        billing_method, tariff_type, provider_status,
        adapter_kind, adapter_config, metadata
      ) values (
        v_org_id,
        v_providers[i][1],
        'other'::public.utility_type,    -- type enum doesn't have gate/parking
        v_providers[i][5],
        v_providers[i][4]::public.billing_method,
        'fixed'::public.tariff_type,
        'active',
        v_providers[i][6],
        jsonb_build_object('endpoint_url', v_providers[i][7], 'notes', v_providers[i][8]),
        jsonb_build_object(
          'name_ar',  v_providers[i][2],
          'country',  v_providers[i][9],
          'category', v_providers[i][3],   -- gate_automation / access_control / intercom / parking / anpr / parking_app / ev_charging
          'physical_infra', true
        )
      )
      returning id into v_provider_id;
    end if;

    if not exists (
      select 1 from public.provider_integrations
      where provider_id = v_provider_id and adapter_kind = v_providers[i][6]
    ) then
      insert into public.provider_integrations (
        organization_id, provider_id, adapter_kind, name,
        endpoint_url, config, status, is_active
      ) values (
        v_org_id,
        v_provider_id,
        v_providers[i][6],
        v_providers[i][1] || ' — ' || upper(v_providers[i][6]) || ' adapter',
        nullif(v_providers[i][7], ''),
        jsonb_build_object(
          'protocol', v_providers[i][6],
          'endpoint', v_providers[i][7],
          'category', v_providers[i][3],
          'country',  v_providers[i][9],
          'notes',    v_providers[i][8]
        ),
        'configured',
        true
      );
    end if;
  end loop;

  raise notice 'Done. % gate/parking/access providers seeded.', array_length(v_providers, 1);
end $$;

-- Quick view — group by physical infrastructure category
select
  p.metadata->>'category' as category,
  count(*) as providers,
  string_agg(p.provider_name, ', ' order by p.provider_name) as names
from public.utility_providers p
where (p.metadata->>'physical_infra')::boolean is true
group by p.metadata->>'category'
order by category;
