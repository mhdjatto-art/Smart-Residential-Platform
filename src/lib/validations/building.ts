import { z } from "zod";

export const buildingSchema = z.object({
  compound_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .max(32)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  floors: z.coerce.number().int().min(0).max(200).optional(),
});
export type BuildingInput = z.infer<typeof buildingSchema>;
