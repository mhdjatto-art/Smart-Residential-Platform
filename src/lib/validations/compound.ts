import { z } from "zod";

const slugRegex = /^[a-z0-9-]{2,64}$/;

const optionalString = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const compoundSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(64)
    .regex(slugRegex, "Slug must be lowercase letters, numbers, or dashes"),
  code: optionalString,
  description: optionalString,
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  address_line1: optionalString,
  address_line2: optionalString,
  city: optionalString,
  region: optionalString,
  country_code: optionalString,
  postal_code: optionalString,
  timezone: z.string().trim().default("UTC"),
  logo_path: z.string().optional().nullable(),
});

export type CompoundInput = z.infer<typeof compoundSchema>;
