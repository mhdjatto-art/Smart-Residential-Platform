-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — Additional contract templates (services + lease-to-own)
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds 4 templates that were missing from the initial install:
--   • service       (EN + AR)  — generic service / maintenance agreement
--   • lease_to_own  (EN + AR)  — rent-to-own contract
--
-- The contract_templates table CHECK constraint already allows lease_to_own.
-- For 'service' we extend the CHECK additively below (drop+recreate of the
-- check is needed because Postgres does not support ALTER CONSTRAINT for
-- CHECK predicates).
--
-- Safe to run multiple times — uses ON CONFLICT DO NOTHING on the seed inserts
-- (relies on the (kind, locale, name) uniqueness we add).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend the kind CHECK to include 'service'

do $blk_kind$
begin
  -- Drop the original kind check if present.
  if exists (
    select 1 from pg_constraint
    where conname = 'contract_templates_kind_check'
       or conname like 'contract_templates_kind_%'
  ) then
    -- Try common names — Postgres auto-names checks as <table>_<col>_check.
    begin
      alter table public.contract_templates drop constraint contract_templates_kind_check;
    exception when undefined_object then
      null;
    end;
  end if;

  -- Re-create the check with the new value 'service' included.
  if not exists (
    select 1 from pg_constraint where conname = 'contract_templates_kind_v2_chk'
  ) then
    alter table public.contract_templates
      add constraint contract_templates_kind_v2_chk
      check (kind in ('property_sale','purchase','rental','lease_to_own','service'));
  end if;
end
$blk_kind$;

-- 2. Add a uniqueness guard so re-runs of this script don't duplicate templates.

do $blk_uniq$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contract_templates_kind_locale_name_uq'
  ) then
    alter table public.contract_templates
      add constraint contract_templates_kind_locale_name_uq
      unique (kind, locale, name);
  end if;
end
$blk_uniq$;

-- ─── 3. Seed the 4 new templates ─────────────────────────────────────────────

insert into public.contract_templates (kind, name, locale, body_html, is_default)
values

-- ─── SERVICE (EN) ──────────────────────────────────────────────────────────
('service', 'Service Agreement (EN)', 'en',
$svc_en$<h1 style="text-align:center;margin-bottom:24px;">SERVICE AGREEMENT</h1>
<p>Agreement No.: <strong>{{contract.contract_number}}</strong></p>
<p>Date: <strong>{{contract.contract_start_date}}</strong></p>

<h2>Parties</h2>
<p><strong>Service Provider:</strong> {{organization.name}}
   (registered address: {{compound.address_line1}}, {{compound.city}})</p>
<p><strong>Customer:</strong> {{resident.full_name}}
   (ID: ____________, email: {{resident.email}}, phone: {{resident.phone}})</p>

<h2>Service Location</h2>
<ul>
  <li>Compound: <strong>{{compound.name}}</strong>, {{compound.city}}</li>
  <li>Building: <strong>{{building.name}}</strong></li>
  <li>Unit: <strong>{{unit.unit_number}}</strong></li>
</ul>

<h2>Services Provided</h2>
<p>The Service Provider agrees to deliver the following services to the
Customer at the location above:</p>
<ul>
  <li>Routine maintenance and minor repairs of building common services</li>
  <li>24/7 security monitoring of the compound</li>
  <li>Cleaning of shared corridors, stairwells, and public areas</li>
  <li>Waste collection per the compound's scheduled rounds</li>
  <li>Landscape and garden upkeep</li>
  <li>Pest control as required</li>
  <li>Other services as listed in the compound's House Rules</li>
</ul>

<h2>Financial Terms</h2>
<p>Service Fee: <strong>{{contract.monthly_amount}} {{contract.currency}}</strong> per
   {{contract.installment_frequency}}.</p>
<p>Billing cycle: {{contract.installment_frequency}}</p>
<p>Total contract period: from <strong>{{contract.contract_start_date}}</strong>
   to <strong>{{contract.contract_end_date}}</strong>.</p>
<p>Late payment penalty: {{contract.late_penalty_value}} ({{contract.late_penalty_type}})
   if not paid within {{contract.grace_period_days}} days of the due date.</p>

<h2>Customer Obligations</h2>
<ul>
  <li>Pay all service fees by their due date via the SRP platform.</li>
  <li>Allow reasonable access for routine maintenance with prior notice.</li>
  <li>Report service issues through the compound's ticket system.</li>
  <li>Abide by the compound's house rules and community guidelines.</li>
</ul>

<h2>Service Provider Obligations</h2>
<ul>
  <li>Deliver the services described above with reasonable skill and care.</li>
  <li>Respond to logged complaints within the published SLA windows.</li>
  <li>Provide notice of any scheduled service interruption.</li>
  <li>Maintain insurance covering the staff performing the services.</li>
</ul>

<h2>Term & Termination</h2>
<p>This agreement is valid for the contract period above and renews
{{contract.installment_frequency}} unless terminated with 30 days written
notice from either party. Termination for breach is possible if the breach
is not cured within 14 days of written notice.</p>

<h2>Signatures</h2>
<table style="width:100%;margin-top:48px;"><tr>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">
  Service Provider<br/><strong>{{organization.name}}</strong>
</td>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">
  Customer<br/><strong>{{resident.full_name}}</strong>
</td>
</tr></table>$svc_en$,
true),

-- ─── SERVICE (AR) ──────────────────────────────────────────────────────────
('service', 'عقد خدمات (AR)', 'ar',
$svc_ar$<div dir="rtl" style="text-align:right;">
<h1 style="text-align:center;margin-bottom:24px;">عقد خدمات</h1>
<p>رقم العقد: <strong>{{contract.contract_number}}</strong></p>
<p>التاريخ: <strong>{{contract.contract_start_date}}</strong></p>

<h2>أطراف العقد</h2>
<p><strong>مقدّم الخدمة:</strong> {{organization.name}}
   (العنوان: {{compound.address_line1}}، {{compound.city}})</p>
<p><strong>العميل:</strong> {{resident.full_name}}
   (الهوية: ____________، البريد: {{resident.email}}، الهاتف: {{resident.phone}})</p>

<h2>موقع تقديم الخدمة</h2>
<ul>
  <li>المجمع: <strong>{{compound.name}}</strong>، {{compound.city}}</li>
  <li>المبنى: <strong>{{building.name}}</strong></li>
  <li>الوحدة: <strong>{{unit.unit_number}}</strong></li>
</ul>

<h2>الخدمات المُقدَّمة</h2>
<p>يتعهد مقدّم الخدمة بتقديم الخدمات التالية للعميل في الموقع المذكور أعلاه:</p>
<ul>
  <li>الصيانة الدورية والإصلاحات البسيطة للخدمات المشتركة في المبنى</li>
  <li>المراقبة الأمنية للمجمع على مدار 24/7</li>
  <li>تنظيف الممرات المشتركة والسلالم والمناطق العامة</li>
  <li>جمع النفايات وفقاً للجدول الزمني للمجمع</li>
  <li>صيانة الحدائق والمساحات الخضراء</li>
  <li>مكافحة الحشرات عند الحاجة</li>
  <li>أي خدمات أخرى مذكورة في لوائح المجمع</li>
</ul>

<h2>الشروط المالية</h2>
<p>رسوم الخدمة: <strong>{{contract.monthly_amount}} {{contract.currency}}</strong>
   عن كل {{contract.installment_frequency}}.</p>
<p>دورية الفوترة: {{contract.installment_frequency}}</p>
<p>مدة العقد: من <strong>{{contract.contract_start_date}}</strong>
   إلى <strong>{{contract.contract_end_date}}</strong>.</p>
<p>غرامة التأخير: {{contract.late_penalty_value}} ({{contract.late_penalty_type}})
   إذا لم تُسدَّد الرسوم خلال {{contract.grace_period_days}} يوماً من تاريخ الاستحقاق.</p>

<h2>التزامات العميل</h2>
<ul>
  <li>سداد جميع رسوم الخدمة في موعدها عبر منصة SRP.</li>
  <li>السماح بالوصول المعقول للصيانة الدورية مع إشعار مسبق.</li>
  <li>الإبلاغ عن مشاكل الخدمة عبر نظام التذاكر في المجمع.</li>
  <li>الالتزام بقوانين المجمع وإرشادات المجتمع.</li>
</ul>

<h2>التزامات مقدّم الخدمة</h2>
<ul>
  <li>تقديم الخدمات المذكورة أعلاه بمهارة وعناية معقولة.</li>
  <li>الاستجابة للشكاوى المسجّلة وفق اتفاقيات مستوى الخدمة المعلنة.</li>
  <li>توفير إشعار مسبق لأي انقطاع مجدول للخدمة.</li>
  <li>توفير تأمين يغطي الموظفين الذين يؤدّون الخدمات.</li>
</ul>

<h2>المدة وإنهاء العقد</h2>
<p>هذا العقد ساري المفعول لمدة العقد أعلاه ويُجدَّد كل {{contract.installment_frequency}}
ما لم يُنهَ بإشعار خطّي قبل 30 يوماً من أحد الطرفين. يجوز الإنهاء بسبب الإخلال
إذا لم يُعالَج خلال 14 يوماً من الإشعار الخطّي.</p>

<h2>التوقيعات</h2>
<table style="width:100%;margin-top:48px;"><tr>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">
  مقدّم الخدمة<br/><strong>{{organization.name}}</strong>
</td>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">
  العميل<br/><strong>{{resident.full_name}}</strong>
</td>
</tr></table>
</div>$svc_ar$,
true),

-- ─── LEASE TO OWN (EN) ─────────────────────────────────────────────────────
('lease_to_own', 'Lease-to-Own Agreement (EN)', 'en',
$lto_en$<h1 style="text-align:center;margin-bottom:24px;">LEASE-TO-OWN AGREEMENT</h1>
<p>Contract No.: <strong>{{contract.contract_number}}</strong></p>
<p>Date: <strong>{{contract.contract_start_date}}</strong></p>

<h2>Parties</h2>
<p><strong>Seller / Lessor:</strong> {{organization.name}}
   (registered address: {{compound.address_line1}}, {{compound.city}})</p>
<p><strong>Buyer / Lessee:</strong> {{resident.full_name}}
   (ID: ____________, email: {{resident.email}}, phone: {{resident.phone}})</p>

<h2>The Property</h2>
<ul>
  <li>Compound: <strong>{{compound.name}}</strong>, {{compound.city}}</li>
  <li>Building: <strong>{{building.name}}</strong></li>
  <li>Unit: <strong>{{unit.unit_number}}</strong></li>
  <li>Type: {{unit.unit_type}}</li>
  <li>Area: {{unit.area_sqm}} m²</li>
  <li>Bedrooms / Bathrooms: {{unit.bedrooms}} / {{unit.bathrooms}}</li>
</ul>

<h2>Nature of the Agreement</h2>
<p>The Buyer agrees to lease the property described above with an option
to acquire ownership at the end of the contract term, conditional upon
full payment of the financial terms set out below.</p>

<h2>Financial Terms</h2>
<p>Total Property Price: <strong>{{contract.total_property_price}} {{contract.currency}}</strong></p>
<p>Down Payment (paid at signing):
   <strong>{{contract.down_payment}} {{contract.currency}}</strong></p>
<p>Financed Amount:
   <strong>{{contract.financed_amount}} {{contract.currency}}</strong></p>
<p>Number of Installments:
   <strong>{{contract.installment_count}} ({{contract.installment_frequency}})</strong></p>
<p>Monthly Installment:
   <strong>{{contract.monthly_amount}} {{contract.currency}}</strong></p>
<p>Annual Interest Rate: {{contract.annual_interest_rate}}%</p>
<p>Contract Term: from <strong>{{contract.contract_start_date}}</strong>
   to <strong>{{contract.contract_end_date}}</strong></p>

<h2>Title Transfer</h2>
<p>Title to the property remains with the Seller until the final
installment has been paid and acknowledged. Upon full payment, the Seller
will execute the title transfer documents within 30 working days in
accordance with the applicable local property registration rules.</p>

<h2>Default & Repossession</h2>
<p>If the Buyer misses {{contract.grace_period_days}} days past any
installment due date, a late penalty of {{contract.late_penalty_value}}
({{contract.late_penalty_type}}) shall apply. If three consecutive
installments are missed, the Seller has the right to terminate this
agreement and reclaim the property; previously paid amounts may be partially
forfeited per the terms below.</p>

<h2>Tenant Obligations During Lease Period</h2>
<ul>
  <li>Maintain the property in good condition.</li>
  <li>Pay all utility bills as billed via the SRP platform.</li>
  <li>Permit reasonable inspections by the Seller with prior notice.</li>
  <li>Refrain from substantial alterations without written consent.</li>
</ul>

<h2>Signatures</h2>
<table style="width:100%;margin-top:48px;"><tr>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">
  Seller<br/><strong>{{organization.name}}</strong>
</td>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">
  Buyer / Lessee<br/><strong>{{resident.full_name}}</strong>
</td>
</tr></table>$lto_en$,
true),

-- ─── LEASE TO OWN (AR) ─────────────────────────────────────────────────────
('lease_to_own', 'عقد إيجار منتهٍ بالتمليك (AR)', 'ar',
$lto_ar$<div dir="rtl" style="text-align:right;">
<h1 style="text-align:center;margin-bottom:24px;">عقد إيجار منتهٍ بالتمليك</h1>
<p>رقم العقد: <strong>{{contract.contract_number}}</strong></p>
<p>التاريخ: <strong>{{contract.contract_start_date}}</strong></p>

<h2>أطراف العقد</h2>
<p><strong>البائع / المؤجِّر:</strong> {{organization.name}}
   (العنوان: {{compound.address_line1}}، {{compound.city}})</p>
<p><strong>المشتري / المستأجر:</strong> {{resident.full_name}}
   (الهوية: ____________، البريد: {{resident.email}}، الهاتف: {{resident.phone}})</p>

<h2>العقار</h2>
<ul>
  <li>المجمع: <strong>{{compound.name}}</strong>، {{compound.city}}</li>
  <li>المبنى: <strong>{{building.name}}</strong></li>
  <li>الوحدة: <strong>{{unit.unit_number}}</strong></li>
  <li>نوع الوحدة: {{unit.unit_type}}</li>
  <li>المساحة: {{unit.area_sqm}} م²</li>
  <li>غرف النوم / الحمامات: {{unit.bedrooms}} / {{unit.bathrooms}}</li>
</ul>

<h2>طبيعة العقد</h2>
<p>يتعهد المشتري باستئجار العقار الموصوف أعلاه مع خيار تملّكه في نهاية مدة
العقد، بشرط سداد كامل الشروط المالية المُبيَّنة أدناه.</p>

<h2>الشروط المالية</h2>
<p>إجمالي سعر العقار:
   <strong>{{contract.total_property_price}} {{contract.currency}}</strong></p>
<p>الدفعة المقدمة (تُدفع عند التوقيع):
   <strong>{{contract.down_payment}} {{contract.currency}}</strong></p>
<p>المبلغ المُموَّل:
   <strong>{{contract.financed_amount}} {{contract.currency}}</strong></p>
<p>عدد الأقساط:
   <strong>{{contract.installment_count}} ({{contract.installment_frequency}})</strong></p>
<p>القسط الشهري:
   <strong>{{contract.monthly_amount}} {{contract.currency}}</strong></p>
<p>سعر الفائدة السنوي: {{contract.annual_interest_rate}}%</p>
<p>مدة العقد: من <strong>{{contract.contract_start_date}}</strong>
   إلى <strong>{{contract.contract_end_date}}</strong></p>

<h2>نقل الملكية</h2>
<p>تبقى ملكية العقار باسم البائع حتى يتم سداد القسط الأخير والإقرار به.
عند السداد الكامل، يقوم البائع بتنفيذ مستندات نقل الملكية خلال 30 يوم عمل
وفقاً لأنظمة التسجيل العقاري المحلية المعمول بها.</p>

<h2>الإخلال واستعادة العقار</h2>
<p>إذا تأخّر المشتري {{contract.grace_period_days}} يوماً عن أي قسط، تُطبَّق
غرامة تأخير بقيمة {{contract.late_penalty_value}} ({{contract.late_penalty_type}}).
إذا تعذّر سداد ثلاثة أقساط متتالية، يحق للبائع إنهاء هذا العقد واستعادة
العقار؛ وقد تُحتجز جزء من المبالغ المسدّدة سابقاً وفقاً للشروط أدناه.</p>

<h2>التزامات المستأجر خلال مدة الإيجار</h2>
<ul>
  <li>المحافظة على العقار بحالة جيدة.</li>
  <li>سداد جميع فواتير المرافق عبر منصة SRP.</li>
  <li>السماح بالمعاينات المعقولة من البائع مع إشعار مسبق.</li>
  <li>عدم إجراء تعديلات جوهرية بدون موافقة خطّية.</li>
</ul>

<h2>التوقيعات</h2>
<table style="width:100%;margin-top:48px;"><tr>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">
  البائع<br/><strong>{{organization.name}}</strong>
</td>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">
  المشتري / المستأجر<br/><strong>{{resident.full_name}}</strong>
</td>
</tr></table>
</div>$lto_ar$,
true)

on conflict (kind, locale, name) do nothing;

-- ─── 4. Verify

select kind, locale, name, is_default, length(body_html) as body_chars
from public.contract_templates
order by kind, locale, name;
