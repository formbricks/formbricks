import { z } from "zod";

// Define as const arrays
const AuditTargets = [
  "segment",
  "survey",
  "webhook",
  "user",
  "contactAttributeKey",
  "projectTeam",
  "team",
  "actionClass",
  "response",
  "contact",
  "organization",
  "tag",
  "project",
  "language",
  "invite",
  "membership",
  "twoFactorAuth",
  "apiKey",
] as const;
const AuditActions = [
  "created",
  "updated",
  "deleted",
  "signedin",
  "merged",
  "verificationEmailSent",
  "createdFromCSV",
  "copiedToOtherEnvironment",
] as const;
const Actors = ["user", "api"] as const;
const AuditStatuses = ["success", "failure"] as const;
export const UNKNOWN_DATA = "unknown";

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
  action: z.enum(AuditActionTypes),
  target: z.object({
    id: z.string().or(z.undefined()),
    type: z.enum(AuditTargets),
  }),
  status: z.enum(["success", "failure"]),
  timestamp: z.string().datetime(),
  organizationId: z.string(),
  ipAddress: z.string().ip().optional(),
  changes: z.record(z.any()).optional(),
  eventId: z.string().optional(),
  apiUrl: z.string().url().optional(),
  integrityHash: z.string(),
  previousHash: z.string().nullable(),
  chainStart: z.boolean().optional(),
});

export type TAuditLogEvent = z.infer<typeof AuditLogEventSchema>;
