import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const buildingSchema = z.object({
  compound_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  code: optionalString,
  number_of_floors: z.coerce.number().int().min(0).max(200).optional(),
  description: optionalString,
  status: z.enum(["active", "inactive", "under_construction"]).default("active"),
});

export type BuildingInput = z.infer<typeof buildingSchema>;
