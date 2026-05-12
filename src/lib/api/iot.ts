"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth/guards";
import {
  deviceSchema, accessZoneSchema, parkingSpotSchema, parkingAssignmentSchema,
  type DeviceInput, type AccessZoneInput, type ParkingSpotInput, type ParkingAssignmentInput,
} from "@/lib/validations/iot";

// ─── Devices ──────────────────────────────────────────────────────────────

export interface DeviceRow {
  id: string;
  organization_id: string;
  compound_id: string;
  unit_id: string | null;
  device_kind: string;
  name: string;
  serial: string | null;
  ip_address: string | null;
  firmware_version: string | null;
  vendor: string | null;
  model: string | null;
  status: string;
  last_seen_at: string | null;
}

export async function listDevices(): Promise<DeviceRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices").select("*")
    .order("status").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DeviceRow[];
}

export async function createDevice(input: DeviceInput): Promise<DeviceRow> {
  const user = await requireRole(["super_admin","developer_admin","compound_manager"]);
  const parsed = deviceSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .insert({
      organization_id: parsed.organization_id,
      compound_id: parsed.compound_id,
      building_id: parsed.building_id ?? null,
      unit_id: parsed.unit_id ?? null,
      integration_id: parsed.integration_id ?? null,
      device_kind: parsed.device_kind,
      name: parsed.name,
      serial: parsed.serial ?? null,
      mac_address: parsed.mac_address ?? null,
      ip_address: parsed.ip_address ?? null,
      firmware_version: parsed.firmware_version ?? null,
      vendor: parsed.vendor ?? null,
      model: parsed.model ?? null,
      installed_at: parsed.installed_at ?? null,
      status: parsed.status,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/devices");
  return data as unknown as DeviceRow;
}

export async function issueDeviceCommand(deviceId: string, command: string, payload: Record<string, unknown> = {}): Promise<string> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_device_command", {
    p_device_id: deviceId,
    p_command: command,
    p_payload: payload as unknown as object,
    p_scheduled_for: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/devices");
  return data as unknown as string;
}

// ─── Access zones ─────────────────────────────────────────────────────────

export interface AccessZoneRow {
  id: string;
  organization_id: string;
  compound_id: string;
  name: string;
  zone_kind: string;
  device_id: string | null;
  requires_approval: boolean;
  is_active: boolean;
}

export async function listAccessZones(): Promise<AccessZoneRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("access_zones").select("*").order("zone_kind").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AccessZoneRow[];
}

export async function createAccessZone(input: AccessZoneInput): Promise<AccessZoneRow> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const parsed = accessZoneSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.from("access_zones").insert({
    organization_id: parsed.organization_id,
    compound_id: parsed.compound_id,
    name: parsed.name,
    zone_kind: parsed.zone_kind,
    device_id: parsed.device_id ?? null,
    requires_approval: parsed.requires_approval,
    is_active: parsed.is_active,
  }).select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/access-zones");
  return data as unknown as AccessZoneRow;
}

// ─── Access logs ──────────────────────────────────────────────────────────

export interface AccessLogRow {
  id: number;
  organization_id: string;
  zone_id: string | null;
  resident_id: string | null;
  visitor_id: string | null;
  method: string;
  outcome: string;
  direction: string | null;
  identifier: string | null;
  vehicle_plate: string | null;
  occurred_at: string;
}

export async function listAccessLogs(filter?: { zoneId?: string; outcome?: string }): Promise<AccessLogRow[]> {
  await requireUser();
  const supabase = await createClient();
  let q = supabase.from("access_logs").select("*").order("occurred_at", { ascending: false }).limit(200);
  if (filter?.zoneId) q = q.eq("zone_id", filter.zoneId);
  if (filter?.outcome) q = q.eq("outcome", filter.outcome);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AccessLogRow[];
}

// ─── Parking ──────────────────────────────────────────────────────────────

export interface ParkingSpotRow {
  id: string;
  organization_id: string;
  compound_id: string;
  spot_number: string;
  spot_kind: string;
  is_active: boolean;
}

export interface ParkingAssignmentRow {
  id: string;
  spot_id: string;
  spot_number: string | null;
  unit_id: string | null;
  resident_id: string | null;
  vehicle_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
}

export async function listParkingSpots(): Promise<ParkingSpotRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("parking_spots").select("*").order("spot_number");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ParkingSpotRow[];
}

export async function createParkingSpot(input: ParkingSpotInput): Promise<void> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const parsed = parkingSpotSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("parking_spots").insert({
    organization_id: parsed.organization_id,
    compound_id: parsed.compound_id,
    zone_id: parsed.zone_id ?? null,
    spot_number: parsed.spot_number,
    spot_kind: parsed.spot_kind,
    is_active: parsed.is_active,
    notes: parsed.notes ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/parking");
}

export async function listParkingAssignments(): Promise<ParkingAssignmentRow[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parking_assignments")
    .select("id,spot_id,unit_id,resident_id,vehicle_plate,vehicle_make,vehicle_model,start_date,end_date,status,spot:parking_spots(spot_number)")
    .order("status").order("start_date", { ascending: false });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    spot_id: r.spot_id,
    spot_number: r.spot?.spot_number ?? null,
    unit_id: r.unit_id,
    resident_id: r.resident_id,
    vehicle_plate: r.vehicle_plate,
    vehicle_make: r.vehicle_make,
    vehicle_model: r.vehicle_model,
    start_date: r.start_date,
    end_date: r.end_date,
    status: r.status,
  }));
}

export async function createParkingAssignment(input: ParkingAssignmentInput): Promise<void> {
  await requireRole(["super_admin","developer_admin","compound_manager"]);
  const parsed = parkingAssignmentSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("parking_assignments").insert({
    organization_id: parsed.organization_id,
    compound_id: parsed.compound_id,
    spot_id: parsed.spot_id,
    unit_id: parsed.unit_id ?? null,
    resident_id: parsed.resident_id ?? null,
    vehicle_plate: parsed.vehicle_plate ?? null,
    vehicle_make: parsed.vehicle_make ?? null,
    vehicle_model: parsed.vehicle_model ?? null,
    start_date: parsed.start_date,
    end_date: parsed.end_date ?? null,
    status: parsed.status,
    notes: parsed.notes ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/parking");
}
