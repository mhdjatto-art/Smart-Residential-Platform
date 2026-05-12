import { z } from "zod";

const optionalString = z
  .string().trim().max(2000)
  .optional().or(z.literal("").transform(() => undefined));

const optionalUuid = z.string().uuid().optional().or(z.literal("").transform(() => undefined));

export const DEVICE_KINDS = [
  "smart_meter","router","switch","access_point","smart_lock",
  "gate_controller","camera","sensor","intercom","parking_barrier","generator","other",
] as const;

export const DEVICE_STATUSES = ["provisioned","online","offline","degraded","retired","unknown"] as const;

export const ZONE_KINDS = [
  "main_gate","vehicle_gate","pedestrian_gate","parking","gym","pool","lobby","elevator","door","other",
] as const;

export const SPOT_KINDS = ["standard","compact","disabled","ev","visitor","motorcycle","other"] as const;

export const deviceSchema = z.object({
  organization_id: z.string().uuid(),
  compound_id: z.string().uuid(),
  building_id: optionalUuid,
  unit_id: optionalUuid,
  integration_id: optionalUuid,
  device_kind: z.enum(DEVICE_KINDS),
  name: z.string().trim().min(2).max(160),
  serial: optionalString,
  mac_address: optionalString,
  ip_address: optionalString,
  firmware_version: optionalString,
  vendor: optionalString,
  model: optionalString,
  installed_at: optionalString,
  status: z.enum(DEVICE_STATUSES).default("provisioned"),
});
export type DeviceInput = z.infer<typeof deviceSchema>;

export const accessZoneSchema = z.object({
  organization_id: z.string().uuid(),
  compound_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  zone_kind: z.enum(ZONE_KINDS),
  device_id: optionalUuid,
  requires_approval: z.boolean().default(false),
  is_active: z.boolean().default(true),
});
export type AccessZoneInput = z.infer<typeof accessZoneSchema>;

export const parkingSpotSchema = z.object({
  organization_id: z.string().uuid(),
  compound_id: z.string().uuid(),
  zone_id: optionalUuid,
  spot_number: z.string().trim().min(1).max(20),
  spot_kind: z.enum(SPOT_KINDS).default("standard"),
  is_active: z.boolean().default(true),
  notes: optionalString,
});
export type ParkingSpotInput = z.infer<typeof parkingSpotSchema>;

export const parkingAssignmentSchema = z.object({
  organization_id: z.string().uuid(),
  compound_id: z.string().uuid(),
  spot_id: z.string().uuid(),
  unit_id: optionalUuid,
  resident_id: optionalUuid,
  vehicle_plate: optionalString,
  vehicle_make: optionalString,
  vehicle_model: optionalString,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  end_date: optionalString,
  status: z.enum(["active","expired","released","suspended"]).default("active"),
  notes: optionalString,
});
export type ParkingAssignmentInput = z.infer<typeof parkingAssignmentSchema>;
