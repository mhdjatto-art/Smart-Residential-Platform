"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole } from "@/lib/auth/guards";
import { facilitySchema, bookingSchema, type FacilityInput, type BookingInput } from "@/lib/validations/operations";

export interface FacilityRow {
  id: string;
  organization_id: string;
  compound_id: string;
  name: string;
  facility_type: string;
  capacity: number | null;
  booking_fee: number;
  fee_currency: string | null;
  min_duration_minutes: number;
  max_duration_minutes: number;
  is_active: boolean;
  requires_approval: boolean;
  description: string | null;
}

export async function listFacilities(compoundId?: string): Promise<FacilityRow[]> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("facilities").select("*").order("name");
  if (compoundId) q = q.eq("compound_id", compoundId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FacilityRow[];
}

export async function createFacility(input: FacilityInput): Promise<FacilityRow> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const parsed = facilitySchema.parse(input);
  const supabase = await createClient();
  const { data: c } = await supabase.from("compounds").select("organization_id").eq("id", parsed.compound_id).single();
  if (!c) throw new Error("Compound not found");
  const { data, error } = await supabase
    .from("facilities")
    .insert({
      organization_id: (c as { organization_id: string }).organization_id,
      compound_id: parsed.compound_id,
      name: parsed.name,
      facility_type: parsed.facility_type,
      capacity: parsed.capacity ?? null,
      booking_fee: parsed.booking_fee,
      fee_currency: parsed.fee_currency,
      min_duration_minutes: parsed.min_duration_minutes,
      max_duration_minutes: parsed.max_duration_minutes,
      is_active: parsed.is_active,
      requires_approval: parsed.requires_approval,
      description: parsed.description ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/facilities");
  return data as unknown as FacilityRow;
}

// ─── Bookings ────────────────────────────────────────────────────────────

export interface BookingRow {
  id: string;
  organization_id: string;
  compound_id: string;
  facility_id: string;
  resident_id: string;
  unit_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  fee_amount: number;
  fee_paid: boolean;
  notes: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

interface BookingListOpts {
  facilityId?: string;
  status?: string;
  fromDate?: string;
  page?: number;
  pageSize?: number;
}

export interface EnrichedBookingRow extends BookingRow {
  facility_name: string | null;
  facility_type: string | null;
  resident_name: string | null;
}

export async function listBookings(opts: BookingListOpts = {}): Promise<{ data: EnrichedBookingRow[]; total: number }> {
  await requireUser();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("facility_bookings")
    .select("*, facility:facilities(name, facility_type), resident:residents(first_name, last_name)", { count: "exact" })
    .order("start_time", { ascending: false })
    .range(from, to);
  if (opts.facilityId) q = q.eq("facility_id", opts.facilityId);
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.fromDate) q = q.gte("start_time", opts.fromDate);

  const { data, count, error } = await q;
  if (error) {
    console.error("[listBookings] failed:", error.message);
    return { data: [], total: 0 };
  }

  type Raw = BookingRow & {
    facility: { name: string | null; facility_type: string | null } | null;
    resident: { first_name: string | null; last_name: string | null } | null;
  };
  const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
    ...r,
    facility_name: r.facility?.name ?? null,
    facility_type: r.facility?.facility_type ?? null,
    resident_name: r.resident
      ? [r.resident.first_name, r.resident.last_name].filter(Boolean).join(" ") || null
      : null,
  }));
  return { data: rows, total: count ?? 0 };
}

export async function createBooking(input: BookingInput): Promise<BookingRow> {
  const user = await requireUser();
  const parsed = bookingSchema.parse(input);
  const supabase = await createClient();

  // Resolve org/compound from facility.
  const { data: facility, error: fErr } = await supabase
    .from("facilities").select("organization_id, compound_id, booking_fee, requires_approval, is_active")
    .eq("id", parsed.facility_id).single();
  if (fErr || !facility) throw new Error("Facility not found");
  const f = facility as { organization_id: string; compound_id: string; booking_fee: number; requires_approval: boolean; is_active: boolean };
  if (!f.is_active) throw new Error("Facility is inactive");

  // Conflict check: any approved/pending booking overlaps?
  const { data: clashes } = await supabase
    .from("facility_bookings")
    .select("id")
    .eq("facility_id", parsed.facility_id)
    .in("status", ["pending", "approved"])
    .lt("start_time", parsed.end_time)
    .gt("end_time", parsed.start_time);
  if ((clashes ?? []).length > 0) {
    throw new Error("Time slot already booked. Please pick a different time.");
  }

  const { data, error } = await supabase
    .from("facility_bookings")
    .insert({
      organization_id: f.organization_id,
      compound_id: f.compound_id,
      facility_id: parsed.facility_id,
      resident_id: parsed.resident_id,
      start_time: parsed.start_time,
      end_time: parsed.end_time,
      status: f.requires_approval ? "pending" : "approved",
      fee_amount: f.booking_fee,
      notes: parsed.notes ?? null,
      approved_at: f.requires_approval ? null : new Date().toISOString(),
      approved_by: f.requires_approval ? null : user.id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/bookings");
  return data as unknown as BookingRow;
}

export async function approveBooking(id: string): Promise<void> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("facility_bookings")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user.id, updated_by: user.id })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/bookings");
}

export async function rejectBooking(id: string, reason: string): Promise<void> {
  const user = await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("facility_bookings")
    .update({ status: "rejected", rejected_reason: reason, updated_by: user.id })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/bookings");
}
