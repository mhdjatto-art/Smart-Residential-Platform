import { z } from "zod";

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalNumber = (min: number, max: number) =>
  z
    .union([z.coerce.number(), z.literal("")])
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.number().min(min).max(max).optional());

export const assignmentSchema = z
  .object({
    unit_id: z.string().uuid(),
    resident_id: z.string().uuid(),
    assignment_type: z.enum(["owner", "tenant"]),
    status: z.enum(["active", "ended", "cancelled"]).default("active"),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    end_date: optionalDate,
    monthly_rent: optionalNumber(0, 9_999_999),
    notes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine(
    (v) => v.assignment_type === "owner" || v.monthly_rent !== undefined,
    { message: "Monthly rent is required for tenant assignments", path: ["monthly_rent"] },
  );

export type AssignmentInput = z.infer<typeof assignmentSchema>;
