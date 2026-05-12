import { z } from "zod";

const optionalString = z
  .string().trim().max(2000)
  .optional().or(z.literal("").transform(() => undefined));

export const AUTOMATION_TRIGGERS = [
  "cron","event_insert","event_update","event_delete","condition_threshold",
] as const;

export const AUTOMATION_ACTIONS = [
  "send_notification","send_reminder","apply_penalty","suspend_service",
  "escalate_ticket","create_job","assign_technician","export_report","webhook",
] as const;

export const AUTOMATION_STATUSES = ["active","paused","disabled"] as const;

export const automationRuleSchema = z.object({
  organization_id: z.string().uuid(),
  compound_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(2).max(120),
  description: optionalString,
  trigger_kind: z.enum(AUTOMATION_TRIGGERS),
  trigger_config: z.record(z.string(), z.unknown()).default({}),
  action: z.enum(AUTOMATION_ACTIONS),
  action_config: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(AUTOMATION_STATUSES).default("active"),
});
export type AutomationRuleInput = z.infer<typeof automationRuleSchema>;

export const alertUpdateSchema = z.object({
  status: z.enum(["open","acknowledged","resolved","snoozed"]),
});
export type AlertUpdateInput = z.infer<typeof alertUpdateSchema>;

export const REPORT_KINDS = [
  "financial","utility","maintenance","occupancy","resident","marketplace","custom",
] as const;

export const reportDefinitionSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: optionalString,
  report_kind: z.enum(REPORT_KINDS),
  parameters: z.record(z.string(), z.unknown()).default({}),
  schedule_cron: optionalString,
  recipients: z.array(z.string().email()).default([]),
  is_active: z.boolean().default(true),
});
export type ReportDefinitionInput = z.infer<typeof reportDefinitionSchema>;
