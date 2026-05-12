import { z } from "zod";

export const residentSchema = z.object({
  unit_id: z.string().uuid("Select a unit"),
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z
    .string()
    .trim()
    .min(5)
    .max(32)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  tenancy_type: z.enum(["owner", "tenant", "family_member", "guest"]),
  status: z.enum(["active", "pending", "former"]).default("active"),
  move_in_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  move_out_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ResidentInput = z.infer<typeof residentSchema>;
