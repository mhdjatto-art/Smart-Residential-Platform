-- ─────────────────────────────────────────────────────────────────────────────
-- SRP — Contract templates (sale / purchase / rental)
-- ─────────────────────────────────────────────────────────────────────────────
-- HTML templates with {{placeholders}} that the app fills in from the
-- installment_contracts row + its joined entities (unit, building, compound,
-- organization, resident).
--
-- Run as super_admin in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.contract_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  kind            text not null check (kind in ('property_sale','purchase','rental','lease_to_own')),
  name            text not null,
  locale          text not null default 'en',
  body_html       text not null,
  is_active       boolean not null default true,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ct_kind_idx on public.contract_templates (kind, locale, is_active);
create index if not exists ct_org_idx  on public.contract_templates (organization_id) where organization_id is not null;

alter table public.contract_templates enable row level security;
alter table public.contract_templates force row level security;

drop policy if exists ct_read on public.contract_templates;
create policy ct_read on public.contract_templates
  for select to authenticated using (true);

drop policy if exists ct_write on public.contract_templates;
create policy ct_write on public.contract_templates
  for all to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('super_admin','developer_admin','compound_manager')
  ))
  with check (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('super_admin','developer_admin','compound_manager')
  ));

-- ─── Seed: 3 default templates (English + Arabic) ────────────────────────────

insert into public.contract_templates (kind, name, locale, body_html, is_default)
values
('property_sale', 'Property Sale Agreement (EN)', 'en',
$$<h1 style="text-align:center;margin-bottom:24px;">PROPERTY SALE AGREEMENT</h1>
<p>Contract No.: <strong>{{contract.contract_number}}</strong></p>
<p>Date: <strong>{{contract.contract_start_date}}</strong></p>

<h2>Parties</h2>
<p><strong>Seller:</strong> {{organization.name}} (registered address: {{compound.address_line1}}, {{compound.city}})</p>
<p><strong>Buyer:</strong> {{resident.full_name}} (ID: ____________ , email: {{resident.email}}, phone: {{resident.phone}})</p>

<h2>Subject of Sale</h2>
<p>The Seller agrees to sell, and the Buyer agrees to purchase, the residential unit described below:</p>
<ul>
  <li>Compound: <strong>{{compound.name}}</strong>, {{compound.city}}</li>
  <li>Building: <strong>{{building.name}}</strong></li>
  <li>Unit number: <strong>{{unit.unit_number}}</strong></li>
  <li>Unit type: {{unit.unit_type}}</li>
  <li>Floor: {{unit.floor}}</li>
  <li>Area: {{unit.area_sqm}} m²</li>
  <li>Bedrooms / Bathrooms: {{unit.bedrooms}} / {{unit.bathrooms}}</li>
</ul>

<h2>Financial Terms</h2>
<p>Total Property Price: <strong>{{contract.total_property_price}} {{contract.currency}}</strong></p>
<p>Down Payment: <strong>{{contract.down_payment}} {{contract.currency}}</strong></p>
<p>Financed Amount: <strong>{{contract.financed_amount}} {{contract.currency}}</strong></p>
<p>Number of Installments: <strong>{{contract.installment_count}} ({{contract.installment_frequency}})</strong></p>
<p>Monthly Installment: <strong>{{contract.monthly_amount}} {{contract.currency}}</strong></p>
<p>Annual Interest Rate: {{contract.annual_interest_rate}}%</p>

<h2>Late Payment</h2>
<p>If any installment is unpaid for more than {{contract.grace_period_days}} days, a late penalty of {{contract.late_penalty_value}} ({{contract.late_penalty_type}}) shall be applied.</p>

<h2>Signatures</h2>
<table style="width:100%;margin-top:48px;"><tr>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">Seller<br/><strong>{{organization.name}}</strong></td>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">Buyer<br/><strong>{{resident.full_name}}</strong></td>
</tr></table>$$,
true),

('property_sale', 'عقد بيع عقار (AR)', 'ar',
$$<div dir="rtl" style="text-align:right;">
<h1 style="text-align:center;margin-bottom:24px;">عقد بيع عقار</h1>
<p>رقم العقد: <strong>{{contract.contract_number}}</strong></p>
<p>التاريخ: <strong>{{contract.contract_start_date}}</strong></p>

<h2>أطراف العقد</h2>
<p><strong>البائع:</strong> {{organization.name}} (العنوان: {{compound.address_line1}}، {{compound.city}})</p>
<p><strong>المشتري:</strong> {{resident.full_name}} (الهوية: ____________، البريد: {{resident.email}}، الهاتف: {{resident.phone}})</p>

<h2>موضوع البيع</h2>
<p>يتعهد البائع ببيع، ويتعهد المشتري بشراء الوحدة السكنية الموصوفة أدناه:</p>
<ul>
  <li>المجمع: <strong>{{compound.name}}</strong>، {{compound.city}}</li>
  <li>المبنى: <strong>{{building.name}}</strong></li>
  <li>رقم الوحدة: <strong>{{unit.unit_number}}</strong></li>
  <li>نوع الوحدة: {{unit.unit_type}}</li>
  <li>الطابق: {{unit.floor}}</li>
  <li>المساحة: {{unit.area_sqm}} م²</li>
  <li>غرف النوم / الحمامات: {{unit.bedrooms}} / {{unit.bathrooms}}</li>
</ul>

<h2>الشروط المالية</h2>
<p>إجمالي سعر العقار: <strong>{{contract.total_property_price}} {{contract.currency}}</strong></p>
<p>الدفعة المقدمة: <strong>{{contract.down_payment}} {{contract.currency}}</strong></p>
<p>المبلغ المُموَّل: <strong>{{contract.financed_amount}} {{contract.currency}}</strong></p>
<p>عدد الأقساط: <strong>{{contract.installment_count}} ({{contract.installment_frequency}})</strong></p>
<p>القسط الشهري: <strong>{{contract.monthly_amount}} {{contract.currency}}</strong></p>
<p>سعر الفائدة السنوي: {{contract.annual_interest_rate}}%</p>

<h2>التأخير في السداد</h2>
<p>إذا لم يُسدَّد أي قسط لأكثر من {{contract.grace_period_days}} يوماً، تُطبَّق غرامة تأخير بقيمة {{contract.late_penalty_value}} ({{contract.late_penalty_type}}).</p>

<h2>التوقيعات</h2>
<table style="width:100%;margin-top:48px;"><tr>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">البائع<br/><strong>{{organization.name}}</strong></td>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">المشتري<br/><strong>{{resident.full_name}}</strong></td>
</tr></table>
</div>$$,
true),

('rental', 'Rental Lease Agreement (EN)', 'en',
$$<h1 style="text-align:center;margin-bottom:24px;">RESIDENTIAL LEASE AGREEMENT</h1>
<p>Contract No.: <strong>{{contract.contract_number}}</strong></p>
<p>Date: <strong>{{contract.contract_start_date}}</strong></p>

<h2>Parties</h2>
<p><strong>Landlord:</strong> {{organization.name}}</p>
<p><strong>Tenant:</strong> {{resident.full_name}} (email: {{resident.email}}, phone: {{resident.phone}})</p>

<h2>Premises</h2>
<p>The Landlord agrees to lease to the Tenant the following residential unit:</p>
<ul>
  <li>Compound: <strong>{{compound.name}}</strong></li>
  <li>Building: <strong>{{building.name}}</strong>, Unit <strong>{{unit.unit_number}}</strong></li>
  <li>Area: {{unit.area_sqm}} m² · {{unit.bedrooms}} bed / {{unit.bathrooms}} bath</li>
</ul>

<h2>Term & Rent</h2>
<p>Lease term: from <strong>{{contract.contract_start_date}}</strong> to <strong>{{contract.contract_end_date}}</strong></p>
<p>Monthly rent: <strong>{{contract.monthly_amount}} {{contract.currency}}</strong></p>
<p>Security deposit: <strong>{{contract.down_payment}} {{contract.currency}}</strong></p>
<p>Payment frequency: {{contract.installment_frequency}}</p>

<h2>Late Payment Penalty</h2>
<p>Grace period: {{contract.grace_period_days}} days. Late fee: {{contract.late_penalty_value}} ({{contract.late_penalty_type}}).</p>

<h2>Tenant Obligations</h2>
<ul>
  <li>Maintain the premises in good condition.</li>
  <li>Pay all utility bills as billed via the SRP platform.</li>
  <li>Notify the Landlord of any maintenance issues promptly.</li>
  <li>Abide by all compound rules and community guidelines.</li>
</ul>

<h2>Signatures</h2>
<table style="width:100%;margin-top:48px;"><tr>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">Landlord<br/><strong>{{organization.name}}</strong></td>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">Tenant<br/><strong>{{resident.full_name}}</strong></td>
</tr></table>$$,
true),

('rental', 'عقد إيجار سكني (AR)', 'ar',
$$<div dir="rtl" style="text-align:right;">
<h1 style="text-align:center;margin-bottom:24px;">عقد إيجار سكني</h1>
<p>رقم العقد: <strong>{{contract.contract_number}}</strong></p>
<p>التاريخ: <strong>{{contract.contract_start_date}}</strong></p>

<h2>أطراف العقد</h2>
<p><strong>المؤجِّر:</strong> {{organization.name}}</p>
<p><strong>المستأجر:</strong> {{resident.full_name}} (البريد: {{resident.email}}، الهاتف: {{resident.phone}})</p>

<h2>العين المؤجَّرة</h2>
<p>يوافق المؤجِّر على تأجير الوحدة السكنية التالية إلى المستأجر:</p>
<ul>
  <li>المجمع: <strong>{{compound.name}}</strong></li>
  <li>المبنى: <strong>{{building.name}}</strong>، الوحدة <strong>{{unit.unit_number}}</strong></li>
  <li>المساحة: {{unit.area_sqm}} م² · {{unit.bedrooms}} غرف / {{unit.bathrooms}} حمامات</li>
</ul>

<h2>المدة والأجرة</h2>
<p>مدة الإيجار: من <strong>{{contract.contract_start_date}}</strong> إلى <strong>{{contract.contract_end_date}}</strong></p>
<p>الأجرة الشهرية: <strong>{{contract.monthly_amount}} {{contract.currency}}</strong></p>
<p>التأمين: <strong>{{contract.down_payment}} {{contract.currency}}</strong></p>
<p>دورية الدفع: {{contract.installment_frequency}}</p>

<h2>غرامة التأخير</h2>
<p>فترة السماح: {{contract.grace_period_days}} يوماً. غرامة التأخير: {{contract.late_penalty_value}} ({{contract.late_penalty_type}}).</p>

<h2>التزامات المستأجر</h2>
<ul>
  <li>المحافظة على الوحدة بحالة جيدة.</li>
  <li>سداد جميع فواتير المرافق عبر منصة SRP.</li>
  <li>إبلاغ المؤجِّر فوراً بأي مشاكل صيانة.</li>
  <li>الالتزام بقوانين المجمع والإرشادات.</li>
</ul>

<h2>التوقيعات</h2>
<table style="width:100%;margin-top:48px;"><tr>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">المؤجِّر<br/><strong>{{organization.name}}</strong></td>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">المستأجر<br/><strong>{{resident.full_name}}</strong></td>
</tr></table>
</div>$$,
true),

('purchase', 'Purchase Offer (EN)', 'en',
$$<h1 style="text-align:center;margin-bottom:24px;">PURCHASE OFFER</h1>
<p>Reference: <strong>{{contract.contract_number}}</strong></p>
<p>Date: <strong>{{contract.contract_start_date}}</strong></p>

<h2>Buyer</h2>
<p>I, <strong>{{resident.full_name}}</strong> (email: {{resident.email}}, phone: {{resident.phone}}), hereby offer to purchase the following unit:</p>

<ul>
  <li>Compound: <strong>{{compound.name}}</strong></li>
  <li>Building: <strong>{{building.name}}</strong>, Unit <strong>{{unit.unit_number}}</strong></li>
  <li>Area: {{unit.area_sqm}} m²</li>
</ul>

<h2>Offered Terms</h2>
<p>Offered Price: <strong>{{contract.total_property_price}} {{contract.currency}}</strong></p>
<p>Down Payment: <strong>{{contract.down_payment}} {{contract.currency}}</strong></p>
<p>Financing: {{contract.installment_count}} × {{contract.monthly_amount}} {{contract.currency}}</p>

<p style="margin-top:24px;">This offer is valid for 14 days from the date above.</p>

<h2>Signature</h2>
<table style="width:100%;margin-top:48px;"><tr>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">Buyer<br/><strong>{{resident.full_name}}</strong></td>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">Accepted by<br/><strong>{{organization.name}}</strong></td>
</tr></table>$$,
true),

('purchase', 'عرض شراء (AR)', 'ar',
$$<div dir="rtl" style="text-align:right;">
<h1 style="text-align:center;margin-bottom:24px;">عرض شراء</h1>
<p>المرجع: <strong>{{contract.contract_number}}</strong></p>
<p>التاريخ: <strong>{{contract.contract_start_date}}</strong></p>

<h2>المشتري</h2>
<p>أنا الموقّع أدناه، <strong>{{resident.full_name}}</strong> (البريد: {{resident.email}}، الهاتف: {{resident.phone}})، أتقدّم بعرض لشراء الوحدة التالية:</p>

<ul>
  <li>المجمع: <strong>{{compound.name}}</strong></li>
  <li>المبنى: <strong>{{building.name}}</strong>، الوحدة <strong>{{unit.unit_number}}</strong></li>
  <li>المساحة: {{unit.area_sqm}} م²</li>
</ul>

<h2>الشروط المعروضة</h2>
<p>السعر المعروض: <strong>{{contract.total_property_price}} {{contract.currency}}</strong></p>
<p>الدفعة المقدمة: <strong>{{contract.down_payment}} {{contract.currency}}</strong></p>
<p>التمويل: {{contract.installment_count}} × {{contract.monthly_amount}} {{contract.currency}}</p>

<p style="margin-top:24px;">هذا العرض صالح لمدة ١٤ يوماً من تاريخ التحرير.</p>

<h2>التوقيع</h2>
<table style="width:100%;margin-top:48px;"><tr>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">المشتري<br/><strong>{{resident.full_name}}</strong></td>
<td style="width:50%;border-top:1px solid #000;padding-top:8px;text-align:center;">قُبل من<br/><strong>{{organization.name}}</strong></td>
</tr></table>
</div>$$,
true)
on conflict do nothing;
