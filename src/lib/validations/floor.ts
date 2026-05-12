import { z } from "zod";

export const floorSchema = z.object({
  building_id: z.string().uuid(),
  floor_number: z.coerce.number().int().min(-5).max(200),
  floor_name: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type FloorInput = z.infer<typeof floorSchema>;
