import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const residentSchema = z.object({
  // Tenant scope is resolved from compound_id on the server, but the client
  // sends compound_id so we can run resident lookups before unit assignment.
  compound_id: z.string().uuid("Select a compound"),
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  mobile: optionalString,
  phone: optionalString,
  national_id: optionalString,
  gender: z.enum(["male", "female", "unspecified"]).default("unspecified"),
  date_of_birth: optionalDate,
  occupation: optionalString,
  tenancy_type: z.enum(["owner", "tenant", "family_member", "guest"]).default("tenant"),
  status: z.enum(["active", "pending", "former"]).default("active"),
  profile_photo_path: z.string().optional().nullable(),
});

export type ResidentInput = z.infer<typeof residentSchema>;
