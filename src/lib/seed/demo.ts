/**
 * SRP Demo Seed
 * ─────────────
 * Wipes every `@bonyan.demo` auth user and the demo organization, then
 * recreates a full slice of the platform with one user per role plus
 * realistic financial / utility / ticket data.
 *
 * Safe to re-run — destroys only data inside the demo organization and
 * auth users with `@bonyan.demo` emails. Real production data is untouched.
 *
 * Called from `POST /api/admin/seed-demo` (super_admin only).
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Constants ──────────────────────────────────────────────────────────────

const DEMO_EMAIL_DOMAIN = "bonyan.demo";
const DEMO_PASSWORD = "Demo!2026";
const DEMO_ORG_SLUG = "bonyan-demo";
const DEMO_COMPOUND_SLUG = "bonyan-city-demo";

// One canonical list. Order matters: super_admin first so the demo super
// exists before any compound is created.
const DEMO_USERS = [
  { email: "super@bonyan.demo",       role: "super_admin",       first: "Sara",    last: "Al-Saadi",    phone: "+9647700000001", tenancy: null,          unit: null   },
  { email: "dev@bonyan.demo",         role: "developer_admin",   first: "Daniel",  last: "Hassan",      phone: "+9647700000002", tenancy: null,          unit: null   },
  { email: "manager@bonyan.demo",     role: "compound_manager",  first: "Mariam",  last: "Karim",       phone: "+9647700000003", tenancy: null,          unit: null   },
  { email: "finance@bonyan.demo",     role: "finance_officer",   first: "Faisal",  last: "Othman",      phone: "+9647700000004", tenancy: null,          unit: null   },
  { email: "maintenance@bonyan.demo", role: "maintenance_staff", first: "Mustafa", last: "Jaber",       phone: "+9647700000005", tenancy: null,          unit: null   },
  { email: "security@bonyan.demo",    role: "security_staff",    first: "Saif",    last: "Nuri",        phone: "+9647700000006", tenancy: null,          unit: null   },
  { email: "owner1@bonyan.demo",      role: "resident",          first: "Omar",    last: "Al-Rashid",   phone: "+9647700000011", tenancy: "owner",       unit: "A-101" },
  { email: "owner2@bonyan.demo",      role: "resident",          first: "Layla",   last: "Tariq",       phone: "+9647700000012", tenancy: "owner",       unit: "A-201" },
  { email: "tenant1@bonyan.demo",     role: "resident",          first: "Ahmed",   last: "Sabri",       phone: "+9647700000013", tenancy: "tenant",      unit: "A-102" },
  { email: "tenant2@bonyan.demo",     role: "resident",          first: "Noor",    last: "Salim",       phone: "+9647700000014", tenancy: "tenant",      unit: "B-101" },
  { email: "tenant3@bonyan.demo",     role: "resident",          first: "Hassan",  last: "Mahmoud",     phone: "+9647700000015", tenancy: "tenant",      unit: "B-102" },
  { email: "tenant4@bonyan.demo",     role: "resident",          first: "Zainab",  last: "Khalil",      phone: "+9647700000016", tenancy: "tenant",      unit: "C-101" },
] as const;

type DemoUser = typeof DEMO_USERS[number];

const BUILDINGS = [
  { name: "Building A", code: "A", floors: 4 },
  { name: "Building B", code: "B", floors: 3 },
  { name: "Building C", code: "C", floors: 2 },
];

const UNITS: Array<{
  building: "A" | "B" | "C";
  number: string;
  floor: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  type: "apartment" | "villa" | "townhouse" | "studio" | "duplex" | "penthouse";
}> = [
  { building: "A", number: "A-101", floor: 1, area: 95.0,  bedrooms: 2, bathrooms: 2, type: "apartment" },
  { building: "A", number: "A-102", floor: 1, area: 110.0, bedrooms: 3, bathrooms: 2, type: "apartment" },
  { building: "A", number: "A-201", floor: 2, area: 140.0, bedrooms: 3, bathrooms: 2, type: "duplex"    },
  { building: "B", number: "B-101", floor: 1, area: 80.0,  bedrooms: 1, bathrooms: 1, type: "studio"    },
  { building: "B", number: "B-102", floor: 1, area: 100.0, bedrooms: 2, bathrooms: 2, type: "apartment" },
  { building: "C", number: "C-101", floor: 1, area: 220.0, bedrooms: 4, bathrooms: 3, type: "villa"     },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

type Admin = ReturnType<typeof createAdminClient>;

interface SeedSummary {
  org_id: string;
  compound_id: string;
  buildings: number;
  units: number;
  users: number;
  residents: number;
  contracts: number;
  payments: number;
  utility_bills: number;
  tickets: number;
  notifications: number;
  credentials: Array<{ email: string; password: string; role: string; unit?: string | null }>;
  warnings: string[];
}

/** Find an existing auth user by email, paginating once if needed. */
async function findUserByEmail(admin: Admin, email: string): Promise<string | null> {
  // Single page of up to 1000 covers any demo-sized auth table comfortably.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const match = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

/** Create or rotate password on an auth user; returns its UUID. */
async function upsertAuthUser(admin: Admin, u: DemoUser): Promise<string> {
  const full_name = `${u.first} ${u.last}`;
  const existingId = await findUserByEmail(admin, u.email);
  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (error) throw new Error(`updateUser(${u.email}): ${error.message}`);
    return existingId;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error || !data.user) throw new Error(`createUser(${u.email}): ${error?.message ?? "no user returned"}`);
  return data.user.id;
}

/** Delete an auth user; ignores "not found". */
async function deleteAuthUserSafe(admin: Admin, userId: string): Promise<void> {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // ignore — user may have already been cascaded via user_roles cleanup
  }
}

// ─── WIPE ───────────────────────────────────────────────────────────────────

async function wipe(admin: Admin, callerEmail: string | null): Promise<string[]> {
  const warnings: string[] = [];

  if (callerEmail && callerEmail.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`)) {
    throw new Error(
      "You are logged in as a demo user. The seed would delete your own account. " +
        "Log in as a real super-admin first.",
    );
  }

  // 1. Drop the demo organization. CASCADE removes compounds, buildings,
  //    units, residents, contracts, schedules, payments, utility_bills,
  //    tickets, notifications scoped to it.
  const { data: existingOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", DEMO_ORG_SLUG)
    .maybeSingle();
  if (existingOrg?.id) {
    const { error } = await admin.from("organizations").delete().eq("id", existingOrg.id);
    if (error) warnings.push(`organization delete: ${error.message}`);
  }

  // 2. Find every @bonyan.demo auth user.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw new Error(`listUsers (wipe): ${listErr.message}`);
  const demoUsers = list.users.filter((u) =>
    (u.email ?? "").toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`),
  );

  // 3. Delete their user_roles first (super_admin rows have org_id=null so
  //    they aren't cascaded by the org delete above).
  for (const u of demoUsers) {
    const { error } = await admin.from("user_roles").delete().eq("user_id", u.id);
    if (error) warnings.push(`user_roles delete for ${u.email}: ${error.message}`);
  }

  // 4. Delete the auth users themselves.
  for (const u of demoUsers) {
    await deleteAuthUserSafe(admin, u.id);
  }

  return warnings;
}

// ─── SEED ───────────────────────────────────────────────────────────────────

async function seed(admin: Admin, warnings: string[]): Promise<SeedSummary> {
  // Step 1 — organization
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name: "Bonyan Demo Group",
      slug: DEMO_ORG_SLUG,
      status: "active",
      contact_email: "support@bonyan.demo",
      contact_phone: "+9647700000000",
      country_code: "IQ",
      metadata: { demo: true, currency: "USD" },
    })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`organization insert: ${orgErr?.message}`);
  const orgId = org.id;

  // Step 2 — compound
  const { data: compound, error: compErr } = await admin
    .from("compounds")
    .insert({
      organization_id: orgId,
      name: "Bonyan City Demo",
      slug: DEMO_COMPOUND_SLUG,
      status: "active",
      address_line1: "Demo Plot 12, Erbil",
      city: "Erbil",
      country_code: "IQ",
      timezone: "Asia/Baghdad",
      metadata: { demo: true },
    })
    .select("id")
    .single();
  if (compErr || !compound) throw new Error(`compound insert: ${compErr?.message}`);
  const compoundId = compound.id;

  // Step 3 — buildings
  const buildingByCode: Record<string, string> = {};
  for (const b of BUILDINGS) {
    const { data, error } = await admin
      .from("buildings")
      .insert({
        organization_id: orgId,
        compound_id: compoundId,
        name: b.name,
        code: b.code,
        floors: b.floors,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`building ${b.code} insert: ${error?.message}`);
    buildingByCode[b.code] = data.id;
  }

  // Step 4 — units
  const unitByNumber: Record<string, { id: string; building: string }> = {};
  for (const u of UNITS) {
    const { data, error } = await admin
      .from("units")
      .insert({
        organization_id: orgId,
        compound_id: compoundId,
        building_id: buildingByCode[u.building],
        unit_number: u.number,
        unit_type: u.type,
        status: "vacant",
        floor: u.floor,
        area_sqm: u.area,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`unit ${u.number} insert: ${error?.message}`);
    unitByNumber[u.number] = { id: data.id, building: u.building };
  }

  // Step 5 — auth users + user_roles
  const userIdByEmail: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const userId = await upsertAuthUser(admin, u);
    userIdByEmail[u.email] = userId;

    // Build the role scope based on the role type.
    const scope: { organization_id: string | null; compound_id: string | null } =
      u.role === "super_admin"
        ? { organization_id: null,  compound_id: null }
        : u.role === "developer_admin"
        ? { organization_id: orgId, compound_id: null }
        : { organization_id: orgId, compound_id: compoundId };

    const { error } = await admin.from("user_roles").insert({
      user_id: userId,
      organization_id: scope.organization_id,
      compound_id: scope.compound_id,
      role: u.role,
      is_primary: true,
    });
    if (error) throw new Error(`user_roles insert for ${u.email}: ${error.message}`);
  }

  // Step 6 — residents (only for users with tenancy != null)
  const residentByEmail: Record<string, { id: string; unit_id: string; full_name: string }> = {};
  for (const u of DEMO_USERS) {
    if (!u.tenancy || !u.unit) continue;
    const unit = unitByNumber[u.unit];
    if (!unit) {
      warnings.push(`Unit ${u.unit} missing for ${u.email}`);
      continue;
    }
    const { data, error } = await admin
      .from("residents")
      .insert({
        organization_id: orgId,
        compound_id: compoundId,
        unit_id: unit.id,
        user_id: userIdByEmail[u.email],
        first_name: u.first,
        last_name: u.last,
        email: u.email,
        phone: u.phone,
        tenancy_type: u.tenancy,
        status: "active",
        move_in_date: new Date(Date.now() - 90 * 86400 * 1000).toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`resident insert for ${u.email}: ${error?.message}`);
    residentByEmail[u.email] = { id: data.id, unit_id: unit.id, full_name: `${u.first} ${u.last}` };
    // Mark unit occupied
    await admin.from("units").update({ status: "occupied" }).eq("id", unit.id);
  }

  // Step 7 — financial + operations data
  let contracts = 0, payments = 0, bills = 0, tickets = 0, notifications = 0;
  const residentEmails = Object.keys(residentByEmail);

  for (let i = 0; i < residentEmails.length; i++) {
    const email = residentEmails[i];
    const res = residentByEmail[email];
    const userId = userIdByEmail[email];
    const isOwner = email.startsWith("owner");

    // ── Installment contract (owners get sale, tenants get rental) ──
    const contractType = isOwner ? "property_sale" : "rental";
    const total = isOwner ? 120_000 : 12_000;       // USD
    const down = isOwner ? 30_000 : 1_200;
    const months = isOwner ? 36 : 12;
    const contractNumber = `DEMO-${contractType.toUpperCase()}-${(i + 1).toString().padStart(3, "0")}`;

    const { data: contract, error: cErr } = await admin
      .from("installment_contracts")
      .insert({
        organization_id: orgId,
        compound_id: compoundId,
        unit_id: res.unit_id,
        resident_id: res.id,
        contract_number: contractNumber,
        contract_type: contractType,
        contract_status: "draft",
        contract_start_date: new Date(Date.now() - 60 * 86400 * 1000).toISOString().slice(0, 10),
        total_property_price: total,
        down_payment: down,
        installment_frequency: "monthly",
        installment_count: months,
        annual_interest_rate: 0,
        late_penalty_type: "fixed",
        late_penalty_value: 25,
        grace_period_days: 5,
      })
      .select("id")
      .single();
    if (cErr || !contract) {
      warnings.push(`contract for ${email}: ${cErr?.message}`);
      continue;
    }
    contracts++;

    // Generate schedule + activate (uses existing SQL functions)
    {
      const { error: e1 } = await admin.rpc("generate_installment_schedule", { p_contract_id: contract.id });
      if (e1) warnings.push(`generate_installment_schedule ${contractNumber}: ${e1.message}`);
      const { error: e2 } = await admin.rpc("activate_contract", { p_contract_id: contract.id });
      if (e2) warnings.push(`activate_contract ${contractNumber}: ${e2.message}`);
    }

    // ── Record one payment for the first 1-2 residents to show varied state ──
    if (i % 2 === 0) {
      const { error: pErr } = await admin.rpc("record_payment", {
        p_contract_id: contract.id,
        p_amount: isOwner ? 2_800 : 1_100,
        p_payment_method: "bank_transfer",
        p_payment_date: new Date().toISOString().slice(0, 10),
        p_external_ref: `REF-${contractNumber}`,
        p_notes: "Demo seed payment",
      });
      if (pErr) warnings.push(`record_payment ${contractNumber}: ${pErr.message}`);
      else payments++;
    }

    // ── Utility bill (electricity) ──
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 30 * 86400 * 1000);
    const dueDate = new Date(periodEnd.getTime() + 14 * 86400 * 1000);
    const subtotal = 75 + (i * 5);
    const tax = +(subtotal * 0.05).toFixed(2);
    const totalAmt = +(subtotal + tax).toFixed(2);
    const billNumber = `DEMO-ELEC-${(i + 1).toString().padStart(3, "0")}`;
    const billStatus = i === 0 ? "paid" : i === 1 ? "partial" : "issued";
    const paidAmt = billStatus === "paid" ? totalAmt : billStatus === "partial" ? +(totalAmt / 2).toFixed(2) : 0;

    const { error: bErr } = await admin.from("utility_bills").insert({
      organization_id: orgId,
      compound_id: compoundId,
      unit_id: res.unit_id,
      resident_id: res.id,
      bill_number: billNumber,
      utility_type: "electricity",
      billing_period_start: periodStart.toISOString().slice(0, 10),
      billing_period_end: periodEnd.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
      previous_reading: 1200 + i * 50,
      current_reading: 1380 + i * 50,
      consumption: 180,
      rate_per_unit: 0.42,
      subtotal,
      tax_amount: tax,
      paid_amount: paidAmt,
      total_amount: totalAmt,
      currency: "USD",
      status: billStatus,
    });
    if (bErr) warnings.push(`utility_bill for ${email}: ${bErr.message}`);
    else bills++;

    // ── Ticket: alternates between open and resolved ──
    const tStatus = i % 3 === 0 ? "open" : i % 3 === 1 ? "in_progress" : "resolved";
    const tCategory = ["electricity", "water", "maintenance", "internet", "cleaning"][i % 5] as
      | "electricity" | "water" | "maintenance" | "internet" | "cleaning";
    const tNumber = `DEMO-TKT-${(i + 1).toString().padStart(4, "0")}`;
    const { error: tErr } = await admin.from("tickets").insert({
      organization_id: orgId,
      compound_id: compoundId,
      resident_id: res.id,
      unit_id: res.unit_id,
      ticket_number: tNumber,
      category: tCategory,
      priority: i % 2 === 0 ? "medium" : "high",
      status: tStatus,
      subject: `Demo issue in ${res.full_name}'s unit`,
      description: "Auto-generated by the demo seed. Replace with real ticket content.",
      ...(tStatus === "resolved" ? { resolved_at: new Date().toISOString(), resolution_notes: "Resolved by demo seed." } : {}),
    });
    if (tErr) warnings.push(`ticket for ${email}: ${tErr.message}`);
    else tickets++;

    // ── Notifications (2 per resident) ──
    const notifs = [
      {
        organization_id: orgId,
        user_id: userId,
        kind: "ticket_update" as const,
        title: "Welcome to Bonyan City",
        body: "Your account is ready. Explore your dashboard.",
      },
      {
        organization_id: orgId,
        user_id: userId,
        kind: "ticket_update" as const,
        title: "Demo data loaded",
        body: "This account is pre-populated for demo purposes.",
      },
    ];
    for (const n of notifs) {
      const { error: nErr } = await admin.from("notifications").insert(n);
      if (nErr) warnings.push(`notification for ${email}: ${nErr.message}`);
      else notifications++;
    }
  }

  return {
    org_id: orgId,
    compound_id: compoundId,
    buildings: BUILDINGS.length,
    units: UNITS.length,
    users: DEMO_USERS.length,
    residents: residentEmails.length,
    contracts,
    payments,
    utility_bills: bills,
    tickets,
    notifications,
    credentials: DEMO_USERS.map((u) => ({
      email: u.email,
      password: DEMO_PASSWORD,
      role: u.role,
      unit: u.unit ?? null,
    })),
    warnings,
  };
}

// ─── Public entry point ─────────────────────────────────────────────────────

export async function runDemoSeed(callerEmail: string | null): Promise<SeedSummary> {
  const admin = createAdminClient();
  const wipeWarnings = await wipe(admin, callerEmail);
  return seed(admin, wipeWarnings);
}

export const DEMO_SEED_INFO = {
  domain: DEMO_EMAIL_DOMAIN,
  password: DEMO_PASSWORD,
  org_slug: DEMO_ORG_SLUG,
  compound_slug: DEMO_COMPOUND_SLUG,
  users: DEMO_USERS.map((u) => ({
    email: u.email,
    role: u.role,
    full_name: `${u.first} ${u.last}`,
    unit: u.unit ?? null,
    tenancy: u.tenancy ?? null,
  })),
};
