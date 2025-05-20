import { z } from "zod";

// Define as const arrays
export const AuditTargetTypes = ["segment", "survey"] as const;
export const AuditActions = ["created", "updated"] as const;

// Use template literal for the type
export type AuditTargetType = (typeof AuditTargetTypes)[number];
export type AuditAction = (typeof AuditActions)[number];
export type AuditActionType = `${AuditTargetType}.${AuditAction}`;

// For Zod, create all combinations for AuditActionType
export const AuditActionTypes = AuditTargetTypes.flatMap((target) =>
  AuditActions.map((action) => `${target}.${action}` as const)
) as [string, ...string[]];

export const AuditLogEventSchema = z.object({
  actor: z.object({
    id: z.string(),
    type: z.enum(["user", "api"]),
  }),
  action: z.object({
    type: z.enum(AuditActionTypes),
  }),
  target: z.object({
    id: z.string().or(z.undefined()),
    type: z.enum(AuditTargetTypes),
  }),
  status: z.enum(["success", "failure"]),
  timestamp: z.string().datetime(),
  organizationId: z.string(),
  ipAddress: z.string().optional(),
});

export type TAuditLogEvent = z.infer<typeof AuditLogEventSchema>;
