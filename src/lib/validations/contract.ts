import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal("").transform(() => undefined));

const num = (min: number, max: number) =>
  z
    .union([z.coerce.number(), z.literal("")])
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.number().min(min).max(max));

export const contractSchema = z
  .object({
    unit_id: z.string().uuid(),
    resident_id: z.string().uuid(),
    contract_number: z.string().trim().min(2).max(64),
    contract_type: z.enum(["property_sale", "rental", "lease_to_own"]),
    contract_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    contract_end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    total_property_price: num(0, 1_000_000_000),
    down_payment: num(0, 1_000_000_000),
    installment_frequency: z.enum(["monthly", "quarterly", "biannual", "annual"]).default("monthly"),
    installment_count: num(1, 600),
    annual_interest_rate: num(0, 100).default(0),
    late_penalty_type: z.enum(["fixed", "percentage", "daily", "monthly"]).optional()
      .or(z.literal("").transform(() => undefined)),
    late_penalty_value: num(0, 100_000).optional(),
    grace_period_days: num(0, 365).default(0),
    notes: optionalString,
  })
  .refine((v) => v.down_payment <= v.total_property_price, {
    message: "Down payment cannot exceed total property price",
    path: ["down_payment"],
  })
  .refine(
    (v) => !v.late_penalty_type || (v.late_penalty_value !== undefined && v.late_penalty_value > 0),
    { message: "Penalty value required when penalty type is set", path: ["late_penalty_value"] },
  );

export type ContractInput = z.infer<typeof contractSchema>;

export const paymentSchema = z.object({
  contract_id: z.string().uuid(),
  amount: num(0.01, 1_000_000_000),
  payment_method: z.enum(["cash", "bank_transfer", "online_payment", "wallet", "cheque"]),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  external_reference: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type PaymentInput = z.infer<typeof paymentSchema>;
