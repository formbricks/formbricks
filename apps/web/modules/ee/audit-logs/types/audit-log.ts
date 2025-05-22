import { z } from "zod";

// Define as const arrays
const AuditTargets = ["segment", "survey", "webhook"] as const;
const AuditActions = ["created", "updated", "deleted"] as const;
const Actors = ["user", "api"] as const;
const AuditStatuses = ["success", "failure"] as const;

// Use template literal for the type
export type TAuditTarget = (typeof AuditTargets)[number];
export type TAuditAction = (typeof AuditActions)[number];
export type TAuditActionType = `${TAuditTarget}.${TAuditAction}`;
export type TActor = (typeof Actors)[number];
export type TAuditStatus = (typeof AuditStatuses)[number];
// For Zod, create all combinations for AuditActionType
const AuditActionTypes = AuditTargets.flatMap((target) =>
  AuditActions.map((action) => `${target}.${action}` as const)
) as [string, ...string[]];

export const AuditLogEventSchema = z.object({
  actor: z.object({
    id: z.string(),
    type: z.enum(Actors),
  }),
  action: z.object({
    type: z.enum(AuditActionTypes),
  }),
  target: z.object({
    id: z.string().or(z.undefined()),
    type: z.enum(AuditTargets),
  }),
  status: z.enum(["success", "failure"]),
  timestamp: z.string().datetime(),
  organizationId: z.string(),
  ipAddress: z.string().optional(),
  changes: z.record(z.any()).optional(),
  eventId: z.string().optional(),
});

export type TAuditLogEvent = z.infer<typeof AuditLogEventSchema>;
