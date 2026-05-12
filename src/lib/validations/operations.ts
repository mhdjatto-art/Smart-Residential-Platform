import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalShortString = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal("").transform(() => undefined));

// ─── Tickets ──────────────────────────────────────────────────────────────

export const TICKET_CATEGORIES = [
  "electricity","water","internet","gas","maintenance","cleaning",
  "parking","security","elevator","noise","other",
] as const;

export const ticketSchema = z.object({
  compound_id: z.string().uuid(),
  resident_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  unit_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(5000),
  priority: z.enum(["low","medium","high","urgent"]).default("medium"),
  sla_due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type TicketInput = z.infer<typeof ticketSchema>;

export const ticketUpdateSchema = z.object({
  status: z.enum(["open","assigned","in_progress","pending","resolved","closed"]).optional(),
  priority: z.enum(["low","medium","high","urgent"]).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  resolution_notes: optionalString,
  satisfaction_rating: z.coerce.number().int().min(1).max(5).optional(),
});

// ─── Technicians ──────────────────────────────────────────────────────────

export const technicianSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  mobile: optionalShortString,
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  specialization: z.array(z.string()).default([]),
  availability_status: z.enum(["available","busy","off_duty","vacation"]).default("available"),
  is_active: z.boolean().default(true),
  notes: optionalString,
});
export type TechnicianInput = z.infer<typeof technicianSchema>;

// ─── Maintenance jobs ─────────────────────────────────────────────────────

export const maintenanceJobSchema = z.object({
  compound_id: z.string().uuid(),
  ticket_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  unit_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  building_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  job_type: z.enum(["preventive","corrective","emergency"]),
  title: z.string().trim().min(3).max(160),
  description: optionalString,
  assigned_technician_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  scheduled_for: z.string().optional().or(z.literal("").transform(() => undefined)),
  cost: z.coerce.number().min(0).max(100_000_000).optional(),
});
export type MaintenanceJobInput = z.infer<typeof maintenanceJobSchema>;

// ─── Visitors ─────────────────────────────────────────────────────────────

export const visitorSchema = z.object({
  resident_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  full_name: z.string().trim().min(2).max(120),
  mobile: optionalShortString,
  id_number: optionalShortString,
  vehicle_plate: optionalShortString,
  visitor_type: z.enum(["guest","delivery","maintenance","contractor"]).default("guest"),
  visit_purpose: optionalString,
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  scheduled_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: optionalString,
});
export type VisitorInput = z.infer<typeof visitorSchema>;

// ─── Facilities ───────────────────────────────────────────────────────────

export const facilitySchema = z.object({
  compound_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  facility_type: z.enum([
    "gym","pool","meeting_room","event_hall","football_field",
    "basketball_court","tennis_court","bbq_area","playground","other",
  ]),
  capacity: z.coerce.number().int().min(0).max(10_000).optional(),
  booking_fee: z.coerce.number().min(0).max(10_000_000).default(0),
  fee_currency: z.string().default("USD"),
  min_duration_minutes: z.coerce.number().int().min(15).max(1440).default(60),
  max_duration_minutes: z.coerce.number().int().min(15).max(1440).default(240),
  is_active: z.boolean().default(true),
  requires_approval: z.boolean().default(false),
  description: optionalString,
});
export type FacilityInput = z.infer<typeof facilitySchema>;

// ─── Facility bookings ────────────────────────────────────────────────────

export const bookingSchema = z
  .object({
    facility_id: z.string().uuid(),
    resident_id: z.string().uuid(),
    start_time: z.string(),  // ISO datetime
    end_time: z.string(),
    notes: optionalString,
  })
  .refine((v) => new Date(v.end_time) > new Date(v.start_time), {
    message: "End time must be after start time",
    path: ["end_time"],
  });
export type BookingInput = z.infer<typeof bookingSchema>;

// ─── Announcements ────────────────────────────────────────────────────────

export const announcementSchema = z.object({
  compound_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  kind: z.enum(["general","urgent","maintenance","billing","security","event"]).default("general"),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(5).max(10000),
  target_audience: z.enum(["all","staff_only","residents_only"]).default("all"),
  expires_at: z.string().optional().or(z.literal("").transform(() => undefined)),
  is_pinned: z.boolean().default(false),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;
