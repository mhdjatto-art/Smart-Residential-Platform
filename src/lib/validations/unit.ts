import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalNumber = (min: number, max: number) =>
  z
    .union([z.coerce.number(), z.literal("")])
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.number().min(min).max(max).optional());

export const unitSchema = z.object({
  building_id: z.string().uuid(),
  floor_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  unit_number: z.string().trim().min(1).max(32),
  unit_type: z.enum([
    "apartment", "villa", "townhouse", "studio",
    "duplex", "penthouse", "office", "commercial", "other",
  ]),
  status: z.enum(["vacant", "occupied", "reserved", "maintenance"]).default("vacant"),
  ownership_status: z.enum(["owned", "for_sale", "for_rent", "leased", "reserved"]).default("owned"),
  floor: optionalNumber(-5, 200),
  area_sqm: optionalNumber(0, 100000),
  bedrooms: optionalNumber(0, 20),
  bathrooms: optionalNumber(0, 20),
  parking_slots: optionalNumber(0, 20),
  purchase_price: optionalNumber(0, 999_999_999),
  rent_price: optionalNumber(0, 9_999_999),
  maintenance_fee: optionalNumber(0, 9_999_999),
  description: optionalString,
});

export type UnitInput = z.infer<typeof unitSchema>;
