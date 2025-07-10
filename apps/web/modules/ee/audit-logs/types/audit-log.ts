import { z } from "zod";

export const UNKNOWN_DATA = "unknown";

// Define as const arrays
export const ZAuditTarget = z.enum([
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
  "integration",
  "file",
]);
export const ZAuditAction = z.enum([
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
  "createdUpdated",
  "subscriptionAccessed",
  "subscriptionUpdated",
  "twoFactorVerified",
  "emailVerified",
  "jwtTokenCreated",
  "authenticationAttempted",
  "authenticationSucceeded",
  "passwordVerified",
  "twoFactorAttempted",
  "twoFactorRequired",
  "emailVerificationAttempted",
  "userSignedOut",
  "passwordReset",
  "bulkCreated",
]);
export const ZActor = z.enum(["user", "api", "system"]);
export const ZAuditStatus = z.enum(["success", "failure"]);

// Use template literal for the type
export type TAuditTarget = z.infer<typeof ZAuditTarget>;
export type TAuditAction = z.infer<typeof ZAuditAction>;
export type TActor = z.infer<typeof ZActor>;
export type TAuditStatus = z.infer<typeof ZAuditStatus>;

export const ZAuditLogEventSchema = z.object({
  actor: z.object({
    id: z.string(),
    type: ZActor,
  }),
  action: ZAuditAction,
  target: z.object({
    id: z.string().or(z.undefined()),
    type: ZAuditTarget,
  }),
  status: ZAuditStatus,
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

export type TAuditLogEvent = z.infer<typeof ZAuditLogEventSchema>;
