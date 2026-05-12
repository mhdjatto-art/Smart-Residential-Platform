import { z } from "zod";

export const unitSchema = z.object({
  building_id: z.string().uuid(),
  unit_number: z.string().trim().min(1).max(32),
  unit_type: z.enum(["apartment", "villa", "townhouse", "studio", "duplex", "penthouse", "other"]),
  status: z.enum(["vacant", "occupied", "reserved", "maintenance"]).default("vacant"),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  area_sqm: z.coerce.number().positive().optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  bathrooms: z.coerce.number().int().min(0).max(20).optional(),
});
export type UnitInput = z.infer<typeof unitSchema>;
