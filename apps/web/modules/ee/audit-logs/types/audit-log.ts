import { z } from "zod";

export const UNKNOWN_DATA = "unknown";

// Define as const arrays
export const ZAuditTargets = z.enum([
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
  "responseNote",
]);
export const ZAuditActions = z.enum([
  "created",
  "updated",
  "deleted",
  "signedIn",
  "merged",
  "verificationEmailSent",
  "createdFromCSV",
  "copiedToOtherEnvironment",
  "addedToResponse",
  "removedFromResponse",
]);
export const ZActors = z.enum(["user", "api"]);
export const ZAuditStatuses = z.enum(["success", "failure"]);

// Use template literal for the type
export type TAuditTarget = z.infer<typeof ZAuditTargets>;
export type TAuditAction = z.infer<typeof ZAuditActions>;
export type TActor = z.infer<typeof ZActors>;
export type TAuditStatus = z.infer<typeof ZAuditStatuses>;

export const AuditLogEventSchema = z.object({
  actor: z.object({
    id: z.string(),
    type: ZActors,
  }),
  action: ZAuditActions,
  target: z.object({
    id: z.string().or(z.undefined()),
    type: ZAuditTargets,
  }),
  status: ZAuditStatuses,
  timestamp: z.string().datetime(),
  organizationId: z.string(),
  ipAddress: z.string().optional(), // Not using the .ip() here because if we don't enabled it we want to put UNKNOWN_DATA string, to keep the same pattern as the other fields
  changes: z.record(z.any()).optional(),
  eventId: z.string().optional(),
  apiUrl: z.string().url().optional(),
  integrityHash: z.string(),
  previousHash: z.string().nullable(),
  chainStart: z.boolean().optional(),
});

export type TAuditLogEvent = z.infer<typeof AuditLogEventSchema>;
